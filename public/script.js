// ============================================================
// CLOUD FILE SHARING - FRONTEND SCRIPT
// ============================================================

const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const browseBtn = document.getElementById("browseBtn");

const filesList = document.getElementById("filesList");
const searchInput = document.getElementById("searchInput");

const refreshBtn = document.getElementById("refreshBtn");

const uploadProgress = document.getElementById("uploadProgress");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

const toast = document.getElementById("toast");

let allFiles = [];
let selectedFile = null;

// ============================================================
// INITIAL LOAD
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    loadFiles();
    loadStats();
    setupNavigation();
});

// ============================================================
// FILE INPUT
// ============================================================

if (browseBtn) {
    browseBtn.addEventListener("click", () => {
        fileInput.click();
    });
}

if (uploadBtn) {
    uploadBtn.addEventListener("click", () => {
        fileInput.click();
    });
}

if (fileInput) {
    fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];

        if (file) {
            selectedFile = file;
            uploadFile(file);
        }
    });
}

// ============================================================
// DRAG AND DROP
// ============================================================

if (uploadArea) {

    uploadArea.addEventListener("dragover", (event) => {
        event.preventDefault();

        uploadArea.classList.add("drag-over");
    });

    uploadArea.addEventListener("dragleave", () => {
        uploadArea.classList.remove("drag-over");
    });

    uploadArea.addEventListener("drop", (event) => {
        event.preventDefault();

        uploadArea.classList.remove("drag-over");

        const file = event.dataTransfer.files[0];

        if (file) {
            selectedFile = file;
            uploadFile(file);
        }
    });
}

// ============================================================
// UPLOAD FILE
// ============================================================

function uploadFile(file) {

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
        showToast("File must be smaller than 10 MB", "error");
        return;
    }

    const formData = new FormData();

    formData.append("file", file);

    showUploadProgress();

    const xhr = new XMLHttpRequest();

    xhr.open("POST", "/api/upload", true);

    // --------------------------------------------------------
    // Upload progress
    // --------------------------------------------------------

    xhr.upload.addEventListener("progress", (event) => {

        if (event.lengthComputable) {

            const percent = Math.round(
                (event.loaded / event.total) * 100
            );

            if (progressBar) {
                progressBar.style.width = `${percent}%`;
            }

            if (progressText) {
                progressText.textContent =
                    `Uploading ${percent}%`;
            }
        }
    });

    // --------------------------------------------------------
    // Upload completed
    // --------------------------------------------------------

    xhr.onload = () => {

        hideUploadProgress();

        if (xhr.status >= 200 && xhr.status < 300) {

            try {

                const response = JSON.parse(xhr.responseText);

                if (response.success) {

                    showToast(
                        `${file.name} uploaded successfully`,
                        "success"
                    );

                    fileInput.value = "";

                    loadFiles();
                    loadStats();

                } else {

                    showToast(
                        response.error || "Upload failed",
                        "error"
                    );
                }

            } catch (error) {

                showToast(
                    "Invalid server response",
                    "error"
                );
            }

        } else {

            try {

                const response = JSON.parse(xhr.responseText);

                showToast(
                    response.error || "Upload failed",
                    "error"
                );

            } catch {

                showToast(
                    "Upload failed",
                    "error"
                );
            }
        }
    };

    // --------------------------------------------------------
    // Upload error
    // --------------------------------------------------------

    xhr.onerror = () => {

        hideUploadProgress();

        showToast(
            "Network error. Please try again.",
            "error"
        );
    };

    xhr.send(formData);
}

// ============================================================
// LOAD FILES
// ============================================================

async function loadFiles() {

    showLoading();

    try {

        const response = await fetch("/api/files");

        if (!response.ok) {
            throw new Error("Failed to load files");
        }

        const data = await response.json();

        if (data.success) {

            allFiles = data.files || [];

            renderFiles(allFiles);

        } else {

            throw new Error(
                data.error || "Failed to load files"
            );
        }

    } catch (error) {

        console.error(error);

        showError(
            "Unable to load files. Please refresh the page."
        );
    }
}

// ============================================================
// LOAD STATISTICS
// ============================================================

async function loadStats() {

    try {

        const response = await fetch("/api/stats");

        if (!response.ok) {
            throw new Error("Failed to load statistics");
        }

        const data = await response.json();

        if (!data.success) {
            return;
        }

        updateElement(
            "totalFiles",
            data.totalFiles || 0
        );

        updateElement(
            "storageUsed",
            formatBytes(data.totalSize || 0)
        );

        updateElement(
            "imageCount",
            data.images || 0
        );

        updateElement(
            "documentCount",
            data.documents || 0
        );

    } catch (error) {

        console.error(
            "Statistics error:",
            error
        );
    }
}

// ============================================================
// RENDER FILES
// ============================================================

function renderFiles(files) {

    if (!filesList) {
        return;
    }

    if (!files || files.length === 0) {

        filesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">☁️</div>
                <h3>No files yet</h3>
                <p>Upload your first file to get started.</p>
            </div>
        `;

        return;
    }

    filesList.innerHTML = "";

    files.forEach((file) => {

        const fileName = getFileName(file.key);

        const fileType = getFileType(fileName);

        const fileIcon = getFileIcon(fileName);

        const item = document.createElement("div");

        item.className = "file-item";

        item.innerHTML = `
            <div class="file-icon ${fileType}">
                ${fileIcon}
            </div>

            <div class="file-info">

                <div class="file-name" title="${escapeHtml(fileName)}">
                    ${escapeHtml(fileName)}
                </div>

                <div class="file-meta">
                    ${formatBytes(file.size)}
                    <span>•</span>
                    ${formatDate(file.lastModified)}
                </div>

            </div>

            <div class="file-actions">

                <button
                    class="action-btn download-btn"
                    title="Download"
                    data-key="${encodeURIComponent(file.key)}">
                    ↓
                </button>

                <button
                    class="action-btn delete-btn"
                    title="Delete"
                    data-key="${encodeURIComponent(file.key)}">
                    ×
                </button>

            </div>
        `;

        filesList.appendChild(item);
    });

    // Download buttons
    document
        .querySelectorAll(".download-btn")
        .forEach((button) => {

            button.addEventListener("click", () => {

                const key = decodeURIComponent(
                    button.dataset.key
                );

                downloadFile(key);
            });
        });

    // Delete buttons
    document
        .querySelectorAll(".delete-btn")
        .forEach((button) => {

            button.addEventListener("click", () => {

                const key = decodeURIComponent(
                    button.dataset.key
                );

                deleteFile(key);
            });
        });
}

// ============================================================
// DOWNLOAD FILE
// ============================================================

async function downloadFile(key) {

    try {

        showToast(
            "Preparing your download...",
            "info"
        );

        const response = await fetch(
            `/api/download?key=${encodeURIComponent(key)}`
        );

        if (!response.ok) {
            throw new Error(
                "Failed to generate download link"
            );
        }

        const data = await response.json();

        if (!data.success || !data.url) {
            throw new Error(
                data.error || "Download failed"
            );
        }

        // Open temporary S3 signed URL
        window.open(
            data.url,
            "_blank"
        );

        showToast(
            "Download started",
            "success"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to download the file",
            "error"
        );
    }
}

// ============================================================
// DELETE FILE
// ============================================================

async function deleteFile(key) {

    const fileName = getFileName(key);

    const confirmed = confirm(
        `Are you sure you want to delete "${fileName}"?`
    );

    if (!confirmed) {
        return;
    }

    try {

        const response = await fetch(
            `/api/files?key=${encodeURIComponent(key)}`,
            {
                method: "DELETE"
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(
                data.error || "Delete failed"
            );
        }

        showToast(
            `${fileName} deleted successfully`,
            "success"
        );

        loadFiles();
        loadStats();

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to delete the file",
            "error"
        );
    }
}

// ============================================================
// SEARCH
// ============================================================

if (searchInput) {

    searchInput.addEventListener(
        "input",
        (event) => {

            const query =
                event.target.value
                    .trim()
                    .toLowerCase();

            if (!query) {

                renderFiles(allFiles);

                return;
            }

            const filteredFiles =
                allFiles.filter((file) => {

                    const fileName =
                        getFileName(file.key)
                            .toLowerCase();

                    return fileName.includes(query);
                });

            renderFiles(filteredFiles);
        }
    );
}

// ============================================================
// REFRESH
// ============================================================

if (refreshBtn) {

    refreshBtn.addEventListener(
        "click",
        async () => {

            refreshBtn.classList.add("rotating");

            await Promise.all([
                loadFiles(),
                loadStats()
            ]);

            setTimeout(() => {
                refreshBtn.classList.remove(
                    "rotating"
                );
            }, 500);
        }
    );
}

// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {

    const navItems =
        document.querySelectorAll(
            ".nav-item"
        );

    navItems.forEach((item) => {

        item.addEventListener(
            "click",
            (event) => {

                const target =
                    item.dataset.target;

                if (!target) {
                    return;
                }

                navItems.forEach((nav) => {
                    nav.classList.remove(
                        "active"
                    );
                });

                item.classList.add("active");

                const section =
                    document.getElementById(
                        target
                    );

                if (section) {

                    section.scrollIntoView({
                        behavior: "smooth"
                    });
                }
            }
        );
    });
}

// ============================================================
// UPLOAD PROGRESS
// ============================================================

function showUploadProgress() {

    if (uploadProgress) {

        uploadProgress.style.display =
            "block";
    }

    if (progressBar) {

        progressBar.style.width =
            "0%";
    }

    if (progressText) {

        progressText.textContent =
            "Uploading 0%";
    }
}

function hideUploadProgress() {

    setTimeout(() => {

        if (uploadProgress) {

            uploadProgress.style.display =
                "none";
        }

    }, 700);
}

// ============================================================
// LOADING STATE
// ============================================================

function showLoading() {

    if (!filesList) {
        return;
    }

    filesList.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading your files...</p>
        </div>
    `;
}

// ============================================================
// ERROR STATE
// ============================================================

function showError(message) {

    if (!filesList) {
        return;
    }

    filesList.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3>Something went wrong</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================

function showToast(
    message,
    type = "info"
) {

    if (!toast) {
        return;
    }

    toast.textContent = message;

    toast.className = `toast ${type}`;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove(
            "show"
        );

    }, 3000);
}

// ============================================================
// FILE HELPERS
// ============================================================

function getFileName(key) {

    if (!key) {
        return "Unknown file";
    }

    const parts = key.split("/");

    const fullName =
        parts[parts.length - 1];

    // Remove UUID prefix if generated by our server
    // uploads/uuid-filename.pdf
    const uuidPattern =
        /^[a-f0-9-]{36}-(.+)$/i;

    const match =
        fullName.match(uuidPattern);

    if (match) {
        return match[1];
    }

    return fullName;
}

function getFileType(fileName) {

    const extension =
        getExtension(fileName);

    const images = [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp",
        "svg"
    ];

    const documents = [
        "pdf",
        "doc",
        "docx",
        "txt"
    ];

    const spreadsheets = [
        "xls",
        "xlsx",
        "csv"
    ];

    const presentations = [
        "ppt",
        "pptx"
    ];

    const archives = [
        "zip",
        "rar",
        "7z"
    ];

    if (images.includes(extension)) {
        return "image";
    }

    if (documents.includes(extension)) {
        return "document";
    }

    if (spreadsheets.includes(extension)) {
        return "spreadsheet";
    }

    if (presentations.includes(extension)) {
        return "presentation";
    }

    if (archives.includes(extension)) {
        return "archive";
    }

    return "file";
}

function getFileIcon(fileName) {

    const type =
        getFileType(fileName);

    const icons = {
        image: "🖼️",
        document: "📄",
        spreadsheet: "📊",
        presentation: "📑",
        archive: "📦",
        file: "📁"
    };

    return icons[type] || "📁";
}

function getExtension(fileName) {

    const parts =
        fileName.split(".");

    if (parts.length < 2) {
        return "";
    }

    return parts
        .pop()
        .toLowerCase();
}

// ============================================================
// FORMAT BYTES
// ============================================================

function formatBytes(bytes) {

    if (!bytes || bytes === 0) {
        return "0 B";
    }

    const units = [
        "B",
        "KB",
        "MB",
        "GB",
        "TB"
    ];

    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );

    const value =
        bytes /
        Math.pow(1024, index);

    return `${value.toFixed(
        index === 0 ? 0 : 1
    )} ${units[index]}`;
}

// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(date) {

    if (!date) {
        return "Unknown date";
    }

    const parsedDate =
        new Date(date);

    if (isNaN(parsedDate)) {
        return "Unknown date";
    }

    return parsedDate.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}

// ============================================================
// UPDATE ELEMENT
// ============================================================

function updateElement(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHtml(value) {

    if (value === null ||
        value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}