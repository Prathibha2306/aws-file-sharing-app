const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");

const {
    S3Client,
    PutObjectCommand,
    ListObjectsV2Command,
    GetObjectCommand,
    DeleteObjectCommand
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;
const AWS_REGION = process.env.AWS_REGION || "ap-south-1";
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

if (!BUCKET_NAME) {
    console.error("ERROR: S3_BUCKET_NAME is not configured.");
    process.exit(1);
}

// ----------------------------------------------------
// AWS S3 CLIENT
// ----------------------------------------------------

const s3Client = new S3Client({
    region: AWS_REGION
});

// ----------------------------------------------------
// MULTER CONFIGURATION
// ----------------------------------------------------

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    }
});

// ----------------------------------------------------
// MIDDLEWARE
// ----------------------------------------------------

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// ----------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Cloud File Sharing API is running",
        timestamp: new Date().toISOString()
    });
});

// ----------------------------------------------------
// GET FILE STATISTICS
// ----------------------------------------------------

app.get("/api/stats", async (req, res) => {
    try {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME
        });

        const data = await s3Client.send(command);

        const files = data.Contents || [];

        let totalSize = 0;
        let images = 0;
        let documents = 0;

        files.forEach((file) => {
            totalSize += file.Size || 0;

            const key = file.Key || "";
            const extension = path.extname(key).toLowerCase();

            const imageExtensions = [
                ".jpg",
                ".jpeg",
                ".png",
                ".gif",
                ".webp",
                ".svg"
            ];

            const documentExtensions = [
                ".pdf",
                ".doc",
                ".docx",
                ".txt",
                ".xls",
                ".xlsx",
                ".ppt",
                ".pptx",
                ".csv"
            ];

            if (imageExtensions.includes(extension)) {
                images++;
            }

            if (documentExtensions.includes(extension)) {
                documents++;
            }
        });

        res.json({
            success: true,
            totalFiles: files.length,
            totalSize: totalSize,
            images: images,
            documents: documents
        });

    } catch (error) {
        console.error("Stats error:", error);

        res.status(500).json({
            success: false,
            error: "Failed to retrieve file statistics"
        });
    }
});

// ----------------------------------------------------
// GET ALL FILES
// ----------------------------------------------------

app.get("/api/files", async (req, res) => {
    try {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME
        });

        const data = await s3Client.send(command);

        const files = (data.Contents || []).map((file) => ({
            key: file.Key,
            size: file.Size || 0,
            lastModified: file.LastModified
        }));

        // Newest files first
        files.sort((a, b) => {
            return new Date(b.lastModified) - new Date(a.lastModified);
        });

        res.json({
            success: true,
            files: files
        });

    } catch (error) {
        console.error("List files error:", error);

        res.status(500).json({
            success: false,
            error: "Failed to retrieve files"
        });
    }
});

// ----------------------------------------------------
// UPLOAD FILE
// ----------------------------------------------------

app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No file selected"
            });
        }

        const originalName = req.file.originalname;

        // Remove unsafe characters from filename
        const safeName = originalName
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .replace(/_+/g, "_");

        // Create unique file key
        const uniqueId = crypto.randomUUID();

        const objectKey = `uploads/${uniqueId}-${safeName}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: objectKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            Metadata: {
                originalname: originalName
            }
        });

        await s3Client.send(command);

        res.json({
            success: true,
            message: "File uploaded successfully",
            file: {
                key: objectKey,
                name: originalName,
                size: req.file.size,
                type: req.file.mimetype
            }
        });

    } catch (error) {
        console.error("Upload error:", error);

        res.status(500).json({
            success: false,
            error: "Failed to upload file"
        });
    }
});

// ----------------------------------------------------
// GENERATE DOWNLOAD URL
// ----------------------------------------------------
//
// IMPORTANT:
// We use ?key= instead of /:key(*) because newer
// Express/path-to-regexp versions reject :key(*).
//
// Example:
// /api/download?key=uploads/abc-file.pdf
// ----------------------------------------------------

app.get("/api/download", async (req, res) => {
    try {
        const key = req.query.key;

        if (!key) {
            return res.status(400).json({
                success: false,
                error: "File key is required"
            });
        }

        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        const url = await getSignedUrl(
            s3Client,
            command,
            {
                expiresIn: 300
            }
        );

        res.json({
            success: true,
            url: url
        });

    } catch (error) {
        console.error("Download URL error:", error);

        res.status(500).json({
            success: false,
            error: "Failed to generate download URL"
        });
    }
});

// ----------------------------------------------------
// DELETE FILE
// ----------------------------------------------------

app.delete("/api/files", async (req, res) => {
    try {
        const key = req.query.key;

        if (!key) {
            return res.status(400).json({
                success: false,
                error: "File key is required"
            });
        }

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        await s3Client.send(command);

        res.json({
            success: true,
            message: "File deleted successfully"
        });

    } catch (error) {
        console.error("Delete error:", error);

        res.status(500).json({
            success: false,
            error: "Failed to delete file"
        });
    }
});

// ----------------------------------------------------
// HANDLE MULTER ERRORS
// ----------------------------------------------------

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {

        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                error: "File size must be 10 MB or less"
            });
        }

        return res.status(400).json({
            success: false,
            error: error.message
        });
    }

    next(error);
});

// ----------------------------------------------------
// API 404 HANDLER
// ----------------------------------------------------

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        error: "API endpoint not found"
    });
});

// ----------------------------------------------------
// GENERAL ERROR HANDLER
// ----------------------------------------------------

app.use((error, req, res, next) => {
    console.error("Server error:", error);

    res.status(500).json({
        success: false,
        error: "Internal server error"
    });
});

// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------

app.listen(PORT, "127.0.0.1", () => {
    console.log("----------------------------------------");
    console.log("Cloud File Sharing Application");
    console.log("----------------------------------------");
    console.log(`Server running on port ${PORT}`);
    console.log(`S3 Bucket: ${BUCKET_NAME}`);
    console.log(`AWS Region: ${AWS_REGION}`);
    console.log("----------------------------------------");
});