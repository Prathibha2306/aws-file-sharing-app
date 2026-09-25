const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const message = document.getElementById("message");
const fileList = document.getElementById("fileList");
const refreshButton = document.getElementById("refreshButton");


uploadForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const file = fileInput.files[0];

    if (!file) {
        showMessage("Please select a file.", false);
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showMessage("Maximum file size is 10 MB.", false);
        return;
    }

    const formData = new FormData();

    formData.append("file", file);

    showMessage("Uploading file...", true);

    try {

        const response = await fetch("/upload", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.success) {

            showMessage(
                `${data.fileName} uploaded successfully!`,
                true
            );

            fileInput.value = "";

            loadFiles();

        } else {

            showMessage(data.message, false);

        }

    } catch (error) {

        console.error(error);

        showMessage(
            "An error occurred while uploading.",
            false
        );

    }

});


async function loadFiles() {

    fileList.innerHTML = "<p>Loading files...</p>";

    try {

        const response = await fetch("/files");

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        if (data.files.length === 0) {

            fileList.innerHTML =
                "<p>No files uploaded yet.</p>";

            return;
        }

        fileList.innerHTML = "";

        data.files.forEach(file => {

            const item = document.createElement("div");

            item.className = "file-item";

            const fileSize =
                formatFileSize(file.size);

            const uploadedDate =
                new Date(file.uploadedAt)
                    .toLocaleString();

            const encodedKey =
                encodeURIComponent(file.key);

            item.innerHTML = `

                <div>

                    <div class="file-name">
                        ${escapeHtml(file.key)}
                    </div>

                    <div class="file-info">
                        ${fileSize} |
                        ${uploadedDate}
                    </div>

                </div>

                <div class="actions">

                    <button
                        class="download-btn"
                        onclick="downloadFile('${encodedKey}')">
                        Download
                    </button>

                    <button
                        class="delete-btn"
                        onclick="deleteFile('${encodedKey}')">
                        Delete
                    </button>

                </div>
            `;

            fileList.appendChild(item);

        });

    } catch (error) {

        console.error(error);

        fileList.innerHTML =
            "<p>Unable to load files.</p>";
    }

}


function downloadFile(key) {

    window.location.href =
        `/download/${key}`;

}


async function deleteFile(key) {

    const confirmed =
        confirm("Are you sure you want to delete this file?");

    if (!confirmed) {
        return;
    }

    try {

        const response = await fetch(
            `/files/${key}`,
            {
                method: "DELETE"
            }
        );

        const data = await response.json();

        if (data.success) {

            showMessage(
                "File deleted successfully.",
                true
            );

            loadFiles();

        } else {

            showMessage(
                data.message,
                false
            );

        }

    } catch (error) {

        console.error(error);

        showMessage(
            "Unable to delete file.",
            false
        );

    }

}


function showMessage(text, success) {

    message.textContent = text;

    message.className =
        success ? "success" : "error";

}


function formatFileSize(bytes) {

    if (bytes === 0) {
        return "0 Bytes";
    }

    const sizes = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];

    const i =
        Math.floor(
            Math.log(bytes) / Math.log(1024)
        );

    return (
        parseFloat(
            (bytes / Math.pow(1024, i))
                .toFixed(2)
        )
        + " "
        + sizes[i]
    );

}


function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


refreshButton.addEventListener(
    "click",
    loadFiles
);


loadFiles();