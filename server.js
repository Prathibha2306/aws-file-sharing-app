const express = require("express");
const multer = require("multer");
const path = require("path");

const {
    S3Client,
    PutObjectCommand,
    ListObjectsV2Command,
    GetObjectCommand,
    DeleteObjectCommand
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const { v4: uuidv4 } = require("uuid");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || "ap-south-1";

// AWS SDK automatically uses the EC2 IAM role.
// Do NOT add access keys here.
const s3 = new S3Client({
    region: AWS_REGION
});

// Store uploaded files temporarily in memory
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

app.use(express.static(path.join(__dirname, "public")));


// ===============================
// Upload File
// ===============================
app.post("/upload", upload.single("file"), async (req, res) => {

    try {

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select a file."
            });
        }

        const safeFileName = req.file.originalname.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
        );

        const fileKey = `${Date.now()}-${uuidv4()}-${safeFileName}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        });

        await s3.send(command);

        res.json({
            success: true,
            message: "File uploaded successfully.",
            fileName: req.file.originalname
        });

    } catch (error) {

        console.error("Upload error:", error);

        res.status(500).json({
            success: false,
            message: "File upload failed."
        });
    }
});


// ===============================
// List Files
// ===============================
app.get("/files", async (req, res) => {

    try {

        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME
        });

        const result = await s3.send(command);

        const files = (result.Contents || []).map(file => ({
            key: file.Key,
            size: file.Size,
            uploadedAt: file.LastModified
        }));

        res.json({
            success: true,
            files: files
        });

    } catch (error) {

        console.error("List files error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve files."
        });
    }
});


// ===============================
// Download File
// ===============================
app.get("/download/:key", async (req, res) => {

    try {

        const key = decodeURIComponent(req.params.key);

        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        const url = await getSignedUrl(s3, command, {
            expiresIn: 300
        });

        res.redirect(url);

    } catch (error) {

        console.error("Download error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to download file."
        });
    }
});


// ===============================
// Delete File
// ===============================
app.delete("/files/:key", async (req, res) => {

    try {

        const key = decodeURIComponent(req.params.key);

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        await s3.send(command);

        res.json({
            success: true,
            message: "File deleted successfully."
        });

    } catch (error) {

        console.error("Delete error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to delete file."
        });
    }
});


// ===============================
// Start Server
// ===============================
app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);
    console.log(`S3 Bucket: ${BUCKET_NAME}`);
    console.log(`AWS Region: ${AWS_REGION}`);

});