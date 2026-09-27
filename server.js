// ============================================================
// CLOUD FILE SHARING APPLICATION
// Backend: Node.js + Express + Amazon S3
// ============================================================

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

// ============================================================
// CONFIGURATION
// ============================================================

const app = express();

const PORT = process.env.PORT || 3000;
const AWS_REGION = process.env.AWS_REGION || "ap-south-1";
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

if (!S3_BUCKET_NAME) {
    console.error("ERROR: S3_BUCKET_NAME is not configured.");
    process.exit(1);
}

// ============================================================
// AWS S3 CLIENT
// ============================================================
// Credentials are automatically obtained from the EC2 IAM role.
// No AWS access key or secret key is stored in this application.
// ============================================================

const s3Client = new S3Client({
    region: AWS_REGION
});

// ============================================================
// MULTER CONFIGURATION
// ============================================================
// Files are temporarily stored in memory before being uploaded
// directly to Amazon S3.
// ============================================================

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    }
});

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", async (req, res) => {
    res.json({
        success: true,
        message: "Cloud File Sharing Server is running",
        region: AWS_REGION,
        bucket: S3_BUCKET_NAME
    });
});

// ============================================================
// GET FILE STATISTICS
// ============================================================

app.get("/api/stats", async (req, res) => {
    try {
        const command = new ListObjectsV2Command({
            Bucket: S3_BUCKET_NAME
        });

        const result = await s3Client.send(command);

        const files = result.Contents || [];

        let totalSize = 0;
        let images = 0;
        let documents = 0;

        files.forEach(file => {
            const key = file.Key || "";
            const size = file.Size || 0;

            totalSize += size;

            const extension = path.extname(key).toLowerCase();

            if (
                [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"]
                    .includes(extension)
            ) {
                images++;
            } else {
                documents++;
            }
        });

        res.json({
            success: true,
            totalFiles: files.length,
            totalSize,
            images,
            documents
        });

    } catch (error) {
        console.error("Stats error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load file statistics"
        });
    }
});

// ============================================================
// GET ALL FILES
// ============================================================

app.get("/api/files", async (req, res) => {
    try {
        const command = new ListObjectsV2Command({
            Bucket: S3_BUCKET_NAME
        });

        const result = await s3Client.send(command);

        const files = (result.Contents || [])
            .filter(file => file.Key)
            .map(file => ({
                key: file.Key,
                name: file.Key.split("/").pop(),
                size: file.Size || 0,
                lastModified: file.LastModified
            }))
            .sort((a, b) => {
                return new Date(b.lastModified) - new Date(a.lastModified);
            });

        res.json({
            success: true,
            files
        });

    } catch (error) {
        console.error("List files error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load files from Amazon S3"
        });
    }
});

// ============================================================
// UPLOAD FILE
// ============================================================

app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file was selected"
            });
        }

        const originalName = req.file.originalname;

        // Remove unsafe characters from filename
        const safeName = originalName
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .replace(/_+/g, "_");

        // Generate unique file name
        const uniqueId = crypto.randomUUID();

        const key = `uploads/${uniqueId}-${safeName}`;

        const command = new PutObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        });

        await s3Client.send(command);

        console.log(`File uploaded successfully: ${key}`);

        res.json({
            success: true,
            message: "File uploaded successfully",
            file: {
                key,
                name: safeName,
                size: req.file.size,
                type: req.file.mimetype
            }
        });

    } catch (error) {

        console.error("Upload error:", error);

        res.status(500).json({
            success: false,
            message: "File upload failed"
        });
    }
});

// ============================================================
// DOWNLOAD FILE
// ============================================================
// Example:
// /api/download?key=uploads/example.pdf
//
// A temporary pre-signed URL is generated.
// ============================================================

app.get("/api/download", async (req, res) => {
    try {

        const key = req.query.key;

        if (!key) {
            return res.status(400).json({
                success: false,
                message: "File key is required"
            });
        }

        const command = new GetObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: key
        });

        const signedUrl = await getSignedUrl(
            s3Client,
            command,
            {
                expiresIn: 300
            }
        );

        res.json({
            success: true,
            url: signedUrl
        });

    } catch (error) {

        console.error("Download error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to generate download link"
        });
    }
});

// ============================================================
// DELETE FILE
// ============================================================

app.delete("/api/files", async (req, res) => {
    try {

        const key = req.query.key;

        if (!key) {
            return res.status(400).json({
                success: false,
                message: "File key is required"
            });
        }

        const command = new DeleteObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: key
        });

        await s3Client.send(command);

        console.log(`File deleted: ${key}`);

        res.json({
            success: true,
            message: "File deleted successfully"
        });

    } catch (error) {

        console.error("Delete error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to delete file"
        });
    }
});

// ============================================================
// MULTER ERROR HANDLER
// ============================================================

app.use((error, req, res, next) => {

    if (error instanceof multer.MulterError) {

        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File size must be less than 10 MB"
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    console.error("Server error:", error);

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, "127.0.0.1", () => {

    console.log("");
    console.log("==============================================");
    console.log("      CLOUD FILE SHARING APPLICATION");
    console.log("==============================================");
    console.log(`Server running on port ${PORT}`);
    console.log(`S3 Bucket: ${S3_BUCKET_NAME}`);
    console.log(`AWS Region: ${AWS_REGION}`);
    console.log("==============================================");
    console.log("");
});