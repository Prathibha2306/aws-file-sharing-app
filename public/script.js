// ============================================================
// CLOUDVAULT FRONTEND
// ============================================================

// ============================================================
// DOM ELEMENTS
// ============================================================

const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const heroUploadButton = document.getElementById("heroUploadButton");

const filesList = document.getElementById("filesList");
const searchInput = document.getElementById("searchInput");
const refreshBtn = document.getElementById("refreshBtn");

const uploadProgress = document.getElementById("uploadProgress");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const progressFileName = document.getElementById("progressFileName");

const toast = document.getElementById("toast");

const totalFiles = document.getElementById("totalFiles");
const storageUsed = document.getElementById("storageUsed");
const imageCount = document.getElementById("imageCount");
const documentCount = document.getElementById("documentCount");

let allFiles = [];


// ============================================================
// PAGE INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("CloudVault frontend loaded.");

    loadFiles();
    loadStats();
    setupEventListeners();

});


// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {

    // Browse button
    if (browseBtn && fileInput) {

        browseBtn.addEventListener("click", (event) => {

            event.preventDefault();

            fileInput.click();

        });

    }


    // Hero upload button
    if (heroUploadButton) {

        heroUploadButton.addEventListener("click", () => {

            document.getElementById("upload").scrollIntoView({
                behavior: "smooth"
            });

            setTimeout(() => {

                if (fileInput) {
                    fileInput.click();
                }

            }, 500);

        });

    }


    // File selection
    if (fileInput) {

        fileInput.addEventListener("change", (event) => {

            const file = event.target.files[0];

            if (file) {
                uploadFile(file);
            }

        });

    }


    // Drag over
    if (uploadArea) {

        uploadArea.addEventListener("dragover", (event) => {

            event.preventDefault();

            uploadArea.classList.add("dragover");

        });


        // Drag leave
        uploadArea.addEventListener("dragleave", () => {

            uploadArea.classList.remove("dragover");

        });


        // Drop
        uploadArea.addEventListener("drop", (event) => {

            event.preventDefault();

            uploadArea.classList.remove("dragover");

            const file = event.dataTransfer.files[0];

            if (file) {
                uploadFile(file);
            }

        });


        // Click anywhere in upload zone
        uploadArea.addEventListener("click", (event) => {

            if (
                event.target !== browseBtn &&
                fileInput
            ) {

                fileInput.click();

            }

        });

    }


    // Search
    if (searchInput) {

        searchInput.addEventListener("input", () => {

            filterFiles(searchInput.value);

        });

    }


    // Refresh
    if (refreshBtn) {

        refreshBtn.addEventListener("click", () => {

            loadFiles();
            loadStats();

        });

    }

}


// ============================================================
// UPLOAD FILE
// ============================================================

function uploadFile(file) {

    if (!file) {
        return;
    }


    // Maximum 10 MB
    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {

        showToast(
            "File is too large. Maximum size is 10 MB."
        );

        if (fileInput) {
            fileInput.value = "";
        }

        return;
    }


    console.log("Uploading:", file.name);


    // Show progress
    if (uploadProgress) {
        uploadProgress.style.display = "block";
    }

    if (progressFileName) {
        progressFileName.textContent = file.name;
    }

    if (progressBar) {
        progressBar.style.width = "0%";
    }

    if (progressText) {
        progressText.textContent = "0%";
    }


    const formData = new FormData();

    formData.append("file", file);


    const xhr = new XMLHttpRequest();

    xhr.open(
        "POST",
        "/api/upload",
        true
    );


    // ========================================================
    // UPLOAD PROGRESS
    // ========================================================

    xhr.upload.addEventListener(
        "progress",
        (event) => {

            if (event.lengthComputable) {

                const percentage =
                    Math.round(
                        (event.loaded / event.total) * 100
                    );

                if (progressBar) {
                    progressBar.style.width =
                        percentage + "%";
                }

                if (progressText) {
                    progressText.textContent =
                        percentage + "%";
                }

            }

        }
    );


    // ========================================================
    // SUCCESS / ERROR
    // ========================================================

    xhr.addEventListener(
        "load",
        async () => {

            try {

                const result =
                    JSON.parse(xhr.responseText);


                if (
                    xhr.status >= 200 &&
                    xhr.status < 300 &&
                    result.success
                ) {

                    showToast(
                        "File uploaded successfully!"
                    );


                    if (progressBar) {
                        progressBar.style.width = "100%";
                    }

                    if (progressText) {
                        progressText.textContent = "100%";
                    }


                    // Clear input
                    if (fileInput) {
                        fileInput.value = "";
                    }


                    // Refresh files
                    await loadFiles();
                    await loadStats();


                    setTimeout(() => {

                        if (uploadProgress) {
                            uploadProgress.style.display =
                                "none";
                        }

                    }, 1200);

                } else {

                    showToast(
                        result.message ||
                        "Upload failed."
                    );

                    hideProgress();

                }

            } catch (error) {

                console.error(
                    "Upload response error:",
                    error
                );

                showToast(
                    "Unexpected server response."
                );

                hideProgress();

            }

        }
    );


    xhr.addEventListener(
        "error",
        () => {

            console.error(
                "Network error during upload."
            );

            showToast(
                "Unable to connect to the server."
            );

            hideProgress();

        }
    );


    xhr.addEventListener(
        "timeout",
        () => {

            showToast(
                "Upload timed out."
            );

            hideProgress();

        }
    );


    xhr.send(formData);

}


// ============================================================
// LOAD FILES
// ============================================================

async function loadFiles() {

    if (!filesList) {
        return;
    }


    filesList.innerHTML = `
        <div class="empty-state">
            Loading your files...
        </div>
    `;


    try {

        const response =
            await fetch("/api/files");


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const result =
            await response.json();


        if (!result.success) {

            throw new Error(
                result.message ||
                "Unable to load files"
            );

        }


        allFiles = result.files || [];


        renderFiles(allFiles);


    } catch (error) {

        console.error(
            "Load files error:",
            error
        );


        filesList.innerHTML = `
            <div class="empty-state">
                <p>Unable to load files.</p>
                <br>
                <button
                    type="button"
                    class="refresh-button"
                    onclick="loadFiles()"
                >
                    Try Again
                </button>
            </div>
        `;

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
                <p>📁 No files found.</p>
                <p style="margin-top:8px;">
                    Upload a file to see it here.
                </p>
            </div>
        `;

        return;
    }


    filesList.innerHTML = "";


    files.forEach(file => {

        const item =
            document.createElement("div");

        item.className = "file-item";


        const safeName =
            escapeHtml(file.name);


        const size =
            formatBytes(file.size);


        const date =
            formatDate(file.lastModified);


        const icon =
            getFileIcon(file.name);


        item.innerHTML = `

            <div class="file-info">

                <div class="file-icon">
                    ${icon}
                </div>

                <div>

                    <div class="file-name">
                        ${safeName}
                    </div>

                    <div class="file-meta">
                        ${size} • ${date}
                    </div>

                </div>

            </div>


            <div class="file-actions">

                <button
                    type="button"
                    class="action-button download-button"
                    data-action="download"
                >
                    Download
                </button>

                <button
                    type="button"
                    class="action-button delete-button"
                    data-action="delete"
                >
                    Delete
                </button>

            </div>

        `;


        // Download
        item
            .querySelector(
                '[data-action="download"]'
            )
            .addEventListener(
                "click",
                () => downloadFile(file.key)
            );


        // Delete
        item
            .querySelector(
                '[data-action="delete"]'
            )
            .addEventListener(
                "click",
                () => deleteFile(file.key, file.name)
            );


        filesList.appendChild(item);

    });

}


// ============================================================
// LOAD STATISTICS
// ============================================================

async function loadStats() {

    try {

        const response =
            await fetch("/api/stats");


        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const result =
            await response.json();


        if (!result.success) {
            return;
        }


        if (totalFiles) {

            totalFiles.textContent =
                result.totalFiles || 0;

        }


        if (storageUsed) {

            storageUsed.textContent =
                formatBytes(
                    result.totalSize || 0
                );

        }


        if (imageCount) {

            imageCount.textContent =
                result.images || 0;

        }


        if (documentCount) {

            documentCount.textContent =
                result.documents || 0;

        }


    } catch (error) {

        console.error(
            "Stats error:",
            error
        );

    }

}


// ============================================================
// DOWNLOAD FILE
// ============================================================

async function downloadFile(key) {

    try {

        showToast(
            "Preparing download..."
        );


        const response =
            await fetch(
                `/api/download?key=${encodeURIComponent(key)}`
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const result =
            await response.json();


        if (!result.success || !result.url) {

            throw new Error(
                result.message ||
                "Download link unavailable"
            );

        }


        // Open temporary pre-signed S3 URL
        window.open(
            result.url,
            "_blank"
        );


        showToast(
            "Download link generated."
        );


    } catch (error) {

        console.error(
            "Download error:",
            error
        );


        showToast(
            "Unable to download file."
        );

    }

}


// ============================================================
// DELETE FILE
// ============================================================

async function deleteFile(key, name) {

    const confirmed =
        confirm(
            `Are you sure you want to delete "${name}"?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/files?key=${encodeURIComponent(key)}`,
                {
                    method: "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "Delete failed"
            );

        }


        showToast(
            "File deleted successfully."
        );


        await loadFiles();
        await loadStats();


    } catch (error) {

        console.error(
            "Delete error:",
            error
        );


        showToast(
            "Unable to delete file."
        );

    }

}


// ============================================================
// SEARCH
// ============================================================

function filterFiles(searchTerm) {

    const term =
        searchTerm
            .trim()
            .toLowerCase();


    if (!term) {

        renderFiles(allFiles);

        return;

    }


    const filtered =
        allFiles.filter(file =>
            file.name
                .toLowerCase()
                .includes(term)
        );


    renderFiles(filtered);

}


// ============================================================
// FILE ICON
// ============================================================

function getFileIcon(filename) {

    const extension =
        filename
            .split(".")
            .pop()
            .toLowerCase();


    const icons = {

        pdf: "📕",

        doc: "📘",
        docx: "📘",

        xls: "📗",
        xlsx: "📗",

        ppt: "📙",
        pptx: "📙",

        txt: "📄",

        csv: "📊",

        jpg: "🖼️",
        jpeg: "🖼️",
        png: "🖼️",
        gif: "🖼️",
        webp: "🖼️",

        zip: "🗜️",
        rar: "🗜️",

        mp3: "🎵",
        wav: "🎵",

        mp4: "🎬",
        avi: "🎬",

        js: "📜",
        html: "🌐",
        css: "🎨",

        json: "📋"

    };


    return icons[extension] || "📄";

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


    return (
        value.toFixed(
            index === 0 ? 0 : 2
        ) +
        " " +
        units[index]
    );

}


// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(date) {

    if (!date) {
        return "Unknown date";
    }


    try {

        return new Date(date)
            .toLocaleString(
                undefined,
                {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

    } catch (error) {

        return "Unknown date";

    }

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ============================================================
// TOAST
// ============================================================

function showToast(message) {

    if (!toast) {
        return;
    }


    toast.textContent = message;

    toast.classList.add("show");


    clearTimeout(
        window.cloudVaultToastTimer
    );


    window.cloudVaultToastTimer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 3000);

}


// ============================================================
// HIDE PROGRESS
// ============================================================

function hideProgress() {

    if (uploadProgress) {

        setTimeout(() => {

            uploadProgress.style.display =
                "none";

        }, 500);

    }

}