const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const {
    S3Client,
    PutObjectCommand,
    ListObjectsV2Command,
    GetObjectCommand,
    DeleteObjectCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
require("dotenv").config();

const app = express();

// ======================================================
// CONFIGURATION
// ======================================================

const PORT = process.env.PORT || 3000;
const AWS_REGION = process.env.AWS_REGION || "ap-south-1";
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

if (!S3_BUCKET_NAME) {
    console.error("❌ S3_BUCKET_NAME is missing in .env");
    process.exit(1);
}

// ======================================================
// AWS S3 CLIENT
// ======================================================
// Credentials are NOT hard-coded.
// EC2 automatically uses the attached IAM role.
// ======================================================

const s3 = new S3Client({
    region: AWS_REGION
});

// ======================================================
// EXPRESS CONFIGURATION
// ======================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// ======================================================
// BASIC SECURITY HEADERS
// ======================================================

app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
});

// ======================================================
// MULTER CONFIGURATION
// ======================================================

const storage = multer.memoryStorage();

const upload = multer({
    storage,

    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    },

    fileFilter: (req, file, cb) => {

        const allowedExtensions = [
            ".pdf",
            ".doc",
            ".docx",
            ".txt",
            ".jpg",
            ".jpeg",
            ".png",
            ".gif",
            ".webp",
            ".csv",
            ".xlsx",
            ".xls",
            ".ppt",
            ".pptx",
            ".zip"
        ];

        const extension = path.extname(file.originalname).toLowerCase();

        if (!allowedExtensions.includes(extension)) {
            return cb(
                new Error(
                    "File type not supported. Please upload a supported document, image, spreadsheet, presentation, ZIP or text file."
                )
            );
        }

        cb(null, true);
    }
});

// ======================================================
// HELPER FUNCTIONS
// ======================================================

function generateObjectKey(originalName) {

    const extension = path.extname(originalName).toLowerCase();

    const safeName = path
        .basename(originalName, extension)
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .substring(0, 80);

    const uniqueId = crypto.randomUUID();

    return `${safeName}-${uniqueId}${extension}`;
}


function formatFileSize(bytes) {

    if (!bytes || bytes === 0) {
        return "0 Bytes";
    }

    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];

    const index = Math.floor(
        Math.log(bytes) / Math.log(1024)
    );

    const size = bytes / Math.pow(1024, index);

    return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}


function getFileCategory(key) {

    const extension = path.extname(key).toLowerCase();

    const categories = {

        images: [
            ".jpg",
            ".jpeg",
            ".png",
            ".gif",
            ".webp"
        ],

        documents: [
            ".pdf",
            ".doc",
            ".docx",
            ".txt"
        ],

        spreadsheets: [
            ".xls",
            ".xlsx",
            ".csv"
        ],

        presentations: [
            ".ppt",
            ".pptx"
        ],

        archives: [
            ".zip"
        ]
    };

    for (const [category, extensions] of Object.entries(categories)) {

        if (extensions.includes(extension)) {
            return category;
        }
    }

    return "other";
}


// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/api/health", (req, res) => {

    res.json({
        success: true,
        status: "online",
        application: "Cloud File Sharing App",
        region: AWS_REGION,
        storage: "Amazon S3",
        serverTime: new Date().toISOString()
    });
});


// ======================================================
// DASHBOARD STATISTICS
// ======================================================

app.get("/api/stats", async (req, res) => {

    try {

        const command = new ListObjectsV2Command({
            Bucket: S3_BUCKET_NAME
        });

        const response = await s3.send(command);

        const objects = response.Contents || [];

        let totalSize = 0;

        const categories = {
            images: 0,
            documents: 0,
            spreadsheets: 0,
            presentations: 0,
            archives: 0,
            other: 0
        };

        objects.forEach((object) => {

            totalSize += object.Size || 0;

            const category = getFileCategory(object.Key);

            if (categories[category] !== undefined) {
                categories[category]++;
            }
        });

        res.json({
            success: true,

            totalFiles: objects.length,

            totalSize: totalSize,

            totalSizeFormatted: formatFileSize(totalSize),

            categories
        });

    } catch (error) {

        console.error("Stats error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve storage statistics."
        });
    }
});


// ======================================================
// UPLOAD FILE
// ======================================================

app.post(
    "/api/upload",
    upload.single("file"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({
                    success: false,
                    message: "Please select a file to upload."
                });
            }

            const objectKey = generateObjectKey(
                req.file.originalname
            );

            const command = new PutObjectCommand({

                Bucket: S3_BUCKET_NAME,

                Key: objectKey,

                Body: req.file.buffer,

                ContentType:
                    req.file.mimetype ||
                    "application/octet-stream",

                Metadata: {
                    originalname:
                        encodeURIComponent(
                            req.file.originalname
                        )
                }
            });

            await s3.send(command);

            console.log(
                `✅ Uploaded: ${req.file.originalname}`
            );

            res.status(201).json({

                success: true,

                message: "File uploaded successfully.",

                file: {

                    key: objectKey,

                    name: req.file.originalname,

                    size: req.file.size,

                    sizeFormatted:
                        formatFileSize(req.file.size),

                    type: req.file.mimetype,

                    category:
                        getFileCategory(objectKey)
                }
            });

        } catch (error) {

            console.error(
                "Upload error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "File upload failed. Please try again."
            });
        }
    }
);


// ======================================================
// LIST FILES
// ======================================================

app.get("/api/files", async (req, res) => {

    try {

        const command = new ListObjectsV2Command({

            Bucket: S3_BUCKET_NAME

        });

        const response =
            await s3.send(command);

        const objects =
            response.Contents || [];

        const files = await Promise.all(

            objects.map(async (object) => {

                let originalName =
                    object.Key;

                try {

                    const headCommand =
                        new GetObjectCommand({
                            Bucket:
                                S3_BUCKET_NAME,
                            Key:
                                object.Key,
                            ResponseContentDisposition:
                                "inline"
                        });

                    // We don't download the object.
                    // The command is only prepared here.
                    void headCommand;

                } catch (error) {
                    console.log(error);
                }

                return {

                    key: object.Key,

                    name: originalName,

                    size: object.Size || 0,

                    sizeFormatted:
                        formatFileSize(
                            object.Size || 0
                        ),

                    category:
                        getFileCategory(
                            object.Key
                        ),

                    uploadedAt:
                        object.LastModified || null
                };
            })
        );

        files.sort(
            (a, b) =>
                new Date(b.uploadedAt) -
                new Date(a.uploadedAt)
        );

        res.json({

            success: true,

            count: files.length,

            files

        });

    } catch (error) {

        console.error(
            "List files error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Unable to load files."
        });
    }
});


// ======================================================
// DOWNLOAD FILE
// ======================================================

app.get(
    "/api/download/:key(*)",
    async (req, res) => {

        try {

            const key =
                decodeURIComponent(
                    req.params.key
                );

            const command =
                new GetObjectCommand({

                    Bucket:
                        S3_BUCKET_NAME,

                    Key: key
                });

            const signedUrl =
                await getSignedUrl(
                    s3,
                    command,
                    {
                        expiresIn: 300
                    }
                );

            res.json({

                success: true,

                url: signedUrl,

                expiresIn: 300

            });

        } catch (error) {

            console.error(
                "Download error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to generate download link."
            });
        }
    }
);


// ======================================================
// DELETE FILE
// ======================================================

app.delete(
    "/api/files/:key(*)",
    async (req, res) => {

        try {

            const key =
                decodeURIComponent(
                    req.params.key
                );

            if (!key) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid file."
                });
            }

            const command =
                new DeleteObjectCommand({

                    Bucket:
                        S3_BUCKET_NAME,

                    Key: key
                });

            await s3.send(command);

            console.log(
                `🗑️ Deleted: ${key}`
            );

            res.json({

                success: true,

                message:
                    "File deleted successfully."

            });

        } catch (error) {

            console.error(
                "Delete error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to delete the file."
            });
        }
    }
);


// ======================================================
// FRONTEND FALLBACK
// ======================================================

app.get("*", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});


// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "Server error:",
            error
        );

        if (
            error instanceof multer.MulterError
        ) {

            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "File is too large. Maximum size is 10 MB."
                });
            }
        }

        res.status(500).json({

            success: false,

            message:
                error.message ||
                "Something went wrong."
        });
    }
);


// ======================================================
// START SERVER
// ======================================================

app.listen(
    PORT,
    "127.0.0.1",
    () => {

        console.log("");
        console.log(
            "╔══════════════════════════════════════════╗"
        );
        console.log(
            "║       CLOUD FILE SHARING APP             ║"
        );
        console.log(
            "╠══════════════════════════════════════════╣"
        );
        console.log(
            `║ Server     : http://127.0.0.1:${PORT}       ║`
        );
        console.log(
            `║ AWS Region : ${AWS_REGION}                ║`
        );
        console.log(
            `║ S3 Bucket  : ${S3_BUCKET_NAME}             ║`
        );
        console.log(
            "║ Storage    : Amazon S3                   ║"
        );
        console.log(
            "║ Status     : ONLINE                      ║"
        );
        console.log(
            "╚══════════════════════════════════════════╝"
        );
        console.log("");
    }
);