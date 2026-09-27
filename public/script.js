/* =====================================================
   CLOUDVAULT - FRONTEND APPLICATION
===================================================== */


// =====================================================
// DOM ELEMENTS
// =====================================================

const fileInput = document.getElementById("fileInput");
const browseButton = document.getElementById("browseButton");
const uploadZone = document.getElementById("uploadZone");

const heroUploadButton =
    document.getElementById("heroUploadButton");

const emptyUploadButton =
    document.getElementById("emptyUploadButton");

const refreshButton =
    document.getElementById("refreshButton");

const fileList =
    document.getElementById("fileList");

const searchInput =
    document.getElementById("searchInput");

const loadingState =
    document.getElementById("loadingState");

const emptyState =
    document.getElementById("emptyState");

const uploadProgressContainer =
    document.getElementById(
        "uploadProgressContainer"
    );

const progressBar =
    document.getElementById("progressBar");

const uploadPercentage =
    document.getElementById("uploadPercentage");

const uploadFileName =
    document.getElementById("uploadFileName");

const uploadProgressText =
    document.getElementById(
        "uploadProgressText"
    );

const uploadFileIcon =
    document.getElementById("uploadFileIcon");


// Statistics

const totalFiles =
    document.getElementById("totalFiles");

const totalStorage =
    document.getElementById("totalStorage");

const imageCount =
    document.getElementById("imageCount");

const documentCount =
    document.getElementById("documentCount");


// Notification

const notification =
    document.getElementById("notification");

const notificationIcon =
    document.getElementById(
        "notificationIcon"
    );

const notificationTitle =
    document.getElementById(
        "notificationTitle"
    );

const notificationMessage =
    document.getElementById(
        "notificationMessage"
    );

const notificationClose =
    document.getElementById(
        "notificationClose"
    );


// Delete modal

const deleteModal =
    document.getElementById("deleteModal");

const cancelDelete =
    document.getElementById("cancelDelete");

const confirmDelete =
    document.getElementById(
        "confirmDelete"
    );


// =====================================================
// APPLICATION STATE
// =====================================================

let allFiles = [];

let fileToDelete = null;


// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadFiles();

        loadStatistics();

    }
);


// =====================================================
// FILE SELECTION
// =====================================================

browseButton.addEventListener(
    "click",
    () => {

        fileInput.click();

    }
);


heroUploadButton.addEventListener(
    "click",
    () => {

        document
            .getElementById("upload")
            .scrollIntoView({
                behavior: "smooth"
            });

        setTimeout(
            () => fileInput.click(),
            500
        );

    }
);


emptyUploadButton.addEventListener(
    "click",
    () => {

        fileInput.click();

    }
);


fileInput.addEventListener(
    "change",
    () => {

        if (fileInput.files.length > 0) {

            uploadFile(
                fileInput.files[0]
            );

        }

    }
);


// =====================================================
// DRAG & DROP
// =====================================================

[
    "dragenter",
    "dragover"
].forEach(
    eventName => {

        uploadZone.addEventListener(
            eventName,
            event => {

                event.preventDefault();

                uploadZone.classList.add(
                    "dragover"
                );

            }
        );

    }
);


[
    "dragleave",
    "drop"
].forEach(
    eventName => {

        uploadZone.addEventListener(
            eventName,
            event => {

                event.preventDefault();

                uploadZone.classList.remove(
                    "dragover"
                );

            }
        );

    }
);


uploadZone.addEventListener(
    "drop",
    event => {

        const files =
            event.dataTransfer.files;

        if (files.length > 0) {

            uploadFile(files[0]);

        }

    }
);


// =====================================================
// UPLOAD FILE
// =====================================================

function uploadFile(file) {

    const maxSize =
        10 * 1024 * 1024;

    if (file.size > maxSize) {

        showNotification(
            "Upload failed",
            "Maximum file size is 10 MB.",
            "error"
        );

        return;
    }


    uploadProgressContainer.style.display =
        "block";


    uploadFileName.textContent =
        file.name;

    uploadProgressText.textContent =
        "Preparing upload...";

    uploadPercentage.textContent =
        "0%";

    progressBar.style.width =
        "0%";


    uploadFileIcon.textContent =
        getFileEmoji(file.name);


    const formData =
        new FormData();

    formData.append(
        "file",
        file
    );


    const xhr =
        new XMLHttpRequest();


    xhr.open(
        "POST",
        "/api/upload"
    );


    // Upload progress

    xhr.upload.addEventListener(
        "progress",
        event => {

            if (event.lengthComputable) {

                const percent =
                    Math.round(
                        (event.loaded /
                            event.total) *
                        100
                    );

                progressBar.style.width =
                    `${percent}%`;

                uploadPercentage.textContent =
                    `${percent}%`;

                uploadProgressText.textContent =
                    percent === 100
                        ? "Processing..."
                        : "Uploading...";

            }

        }
    );


    xhr.onload = () => {

        if (
            xhr.status >= 200 &&
            xhr.status < 300
        ) {

            uploadProgressText.textContent =
                "Upload complete";

            progressBar.style.width =
                "100%";

            uploadPercentage.textContent =
                "100%";


            showNotification(
                "Upload successful",
                `${file.name} has been uploaded.`,
                "success"
            );


            fileInput.value = "";


            setTimeout(
                () => {

                    uploadProgressContainer.style.display =
                        "none";

                    loadFiles();

                    loadStatistics();

                },
                900
            );

        } else {

            let message =
                "Unable to upload the file.";

            try {

                const response =
                    JSON.parse(
                        xhr.responseText
                    );

                if (response.message) {
                    message =
                        response.message;
                }

            } catch (error) {

                console.error(error);

            }


            uploadProgressContainer.style.display =
                "none";


            showNotification(
                "Upload failed",
                message,
                "error"
            );

        }

    };


    xhr.onerror = () => {

        uploadProgressContainer.style.display =
            "none";

        showNotification(
            "Connection error",
            "Could not connect to the server.",
            "error"
        );

    };


    xhr.send(formData);

}


// =====================================================
// LOAD FILES
// =====================================================

async function loadFiles() {

    loadingState.style.display =
        "flex";

    emptyState.style.display =
        "none";

    fileList.innerHTML = "";


    try {

        const response =
            await fetch(
                "/api/files"
            );

        if (!response.ok) {

            throw new Error(
                "Unable to load files."
            );

        }


        const data =
            await response.json();


        allFiles =
            data.files || [];


        renderFiles(
            allFiles
        );


    } catch (error) {

        console.error(error);


        showNotification(
            "Unable to load files",
            "Please refresh the page and try again.",
            "error"
        );

    } finally {

        loadingState.style.display =
            "none";

    }

}


// =====================================================
// RENDER FILES
// =====================================================

function renderFiles(files) {

    fileList.innerHTML = "";


    if (files.length === 0) {

        emptyState.style.display =
            "block";

        return;

    }


    emptyState.style.display =
        "none";


    files.forEach(
        file => {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "file-row";


            const category =
                file.category ||
                "other";


            const extension =
                getExtension(
                    file.name
                );


            const icon =
                getFileEmoji(
                    file.name
                );


            const date =
                formatDate(
                    file.uploadedAt
                );


            row.innerHTML = `

                <div class="file-main">

                    <div class="file-icon ${category}">
                        ${icon}
                    </div>

                    <div style="min-width:0">

                        <div
                            class="file-name"
                            title="${escapeHtml(file.name)}"
                        >
                            ${escapeHtml(file.name)}
                        </div>

                        <div class="file-type">
                            ${extension}
                        </div>

                    </div>

                </div>


                <div class="file-meta">
                    ${file.sizeFormatted}
                </div>


                <div class="file-date">
                    ${date}
                </div>


                <div class="file-actions">

                    <button
                        class="file-action download"
                        title="Download"
                        data-action="download"
                        data-key="${encodeURIComponent(file.key)}"
                    >
                        ↓
                    </button>

                    <button
                        class="file-action delete"
                        title="Delete"
                        data-action="delete"
                        data-key="${encodeURIComponent(file.key)}"
                    >
                        ×
                    </button>

                </div>

            `;


            fileList.appendChild(
                row
            );

        }
    );

}


// =====================================================
// FILE ACTIONS
// =====================================================

fileList.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-action]"
            );

        if (!button) {
            return;
        }


        const key =
            decodeURIComponent(
                button.dataset.key
            );


        const action =
            button.dataset.action;


        if (action === "download") {

            downloadFile(key);

        }


        if (action === "delete") {

            openDeleteModal(key);

        }

    }
);


// =====================================================
// DOWNLOAD
// =====================================================

async function downloadFile(key) {

    try {

        showNotification(
            "Preparing download",
            "Generating a secure download link...",
            "success"
        );


        const response =
            await fetch(
                `/api/download/${encodeURIComponent(key)}`
            );


        const data =
            await response.json();


        if (!response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Download failed."
            );

        }


        window.open(
            data.url,
            "_blank"
        );


    } catch (error) {

        console.error(error);


        showNotification(
            "Download failed",
            error.message,
            "error"
        );

    }

}


// =====================================================
// DELETE MODAL
// =====================================================

function openDeleteModal(key) {

    fileToDelete =
        key;

    deleteModal.classList.add(
        "show"
    );

}


function closeDeleteModal() {

    fileToDelete =
        null;

    deleteModal.classList.remove(
        "show"
    );

}


cancelDelete.addEventListener(
    "click",
    closeDeleteModal
);


deleteModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            deleteModal
        ) {

            closeDeleteModal();

        }

    }
);


confirmDelete.addEventListener(
    "click",
    async () => {

        if (!fileToDelete) {
            return;
        }


        confirmDelete.disabled =
            true;

        confirmDelete.textContent =
            "Deleting...";


        try {

            const response =
                await fetch(
                    `/api/files/${encodeURIComponent(fileToDelete)}`,
                    {
                        method: "DELETE"
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Delete failed."
                );

            }


            closeDeleteModal();


            showNotification(
                "File deleted",
                "The file was removed from your cloud.",
                "success"
            );


            loadFiles();

            loadStatistics();


        } catch (error) {

            console.error(error);


            showNotification(
                "Delete failed",
                error.message,
                "error"
            );

        } finally {

            confirmDelete.disabled =
                false;

            confirmDelete.textContent =
                "Delete file";

        }

    }
);


// =====================================================
// STATISTICS
// =====================================================

async function loadStatistics() {

    try {

        const response =
            await fetch(
                "/api/stats"
            );


        if (!response.ok) {

            throw new Error(
                "Statistics unavailable."
            );

        }


        const data =
            await response.json();


        totalFiles.textContent =
            data.totalFiles || 0;


        totalStorage.textContent =
            data.totalSizeFormatted ||
            "0 Bytes";


        imageCount.textContent =
            data.categories?.images ||
            0;


        documentCount.textContent =
            data.categories?.documents ||
            0;


    } catch (error) {

        console.error(
            "Statistics error:",
            error
        );

    }

}


// =====================================================
// SEARCH
// =====================================================

searchInput.addEventListener(
    "input",
    () => {

        const query =
            searchInput.value
                .trim()
                .toLowerCase();


        if (!query) {

            renderFiles(
                allFiles
            );

            return;

        }


        const filtered =
            allFiles.filter(
                file =>
                    file.name
                        .toLowerCase()
                        .includes(query)
            );


        renderFiles(
            filtered
        );

    }
);


// =====================================================
// REFRESH
// =====================================================

refreshButton.addEventListener(
    "click",
    async () => {

        refreshButton.style.transform =
            "rotate(360deg)";


        await Promise.all([
            loadFiles(),
            loadStatistics()
        ]);


        setTimeout(
            () => {

                refreshButton.style.transform =
                    "";

            },
            400
        );


        showNotification(
            "Files refreshed",
            "Your cloud storage is up to date.",
            "success"
        );

    }
);


// =====================================================
// NOTIFICATIONS
// =====================================================

let notificationTimer;


function showNotification(
    title,
    message,
    type = "success"
) {

    clearTimeout(
        notificationTimer
    );


    notificationTitle.textContent =
        title;

    notificationMessage.textContent =
        message;


    if (type === "error") {

        notificationIcon.textContent =
            "×";

        notificationIcon.style.background =
            "#fef2f2";

        notificationIcon.style.color =
            "#ef4444";

    } else {

        notificationIcon.textContent =
            "✓";

        notificationIcon.style.background =
            "#ecfdf5";

        notificationIcon.style.color =
            "#10b981";

    }


    notification.classList.add(
        "show"
    );


    notificationTimer =
        setTimeout(
            () => {

                notification.classList.remove(
                    "show"
                );

            },
            4000
        );

}


notificationClose.addEventListener(
    "click",
    () => {

        notification.classList.remove(
            "show"
        );

    }
);


// =====================================================
// HELPERS
// =====================================================

function getExtension(filename) {

    const parts =
        filename.split(".");

    if (parts.length <= 1) {
        return "FILE";
    }

    return (
        "." +
        parts.pop().toUpperCase()
    );

}


function getFileEmoji(filename) {

    const extension =
        getExtension(
            filename
        ).toLowerCase();


    const icons = {

        ".pdf": "📕",

        ".doc": "📘",
        ".docx": "📘",

        ".txt": "📄",

        ".jpg": "🖼️",
        ".jpeg": "🖼️",
        ".png": "🖼️",
        ".gif": "🖼️",
        ".webp": "🖼️",

        ".xls": "📊",
        ".xlsx": "📊",
        ".csv": "📊",

        ".ppt": "📙",
        ".pptx": "📙",

        ".zip": "📦"

    };


    return icons[extension] || "📄";

}


function formatDate(dateString) {

    if (!dateString) {
        return "—";
    }


    const date =
        new Date(
            dateString
        );


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


function escapeHtml(value) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value;

    return div.innerHTML;

}