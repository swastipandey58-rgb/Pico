
// Application State
const state = {
    currentFile: null,
    originalImage: null,
    cropper: null,
    watermarkText: '',
    watermarkSettings: { size: 40, color: '#ffffff', x: 50, y: 50 },
    rotation: 0
};

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Update Nav
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update View
        const target = btn.dataset.target;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(target).classList.add('active');

        // Reset state if moving to different tool (optional, keeps clean workspace)
        if (target !== 'home') {
            // Optional: resetTool(target);
        }
    });
});

document.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => {
        const tool = card.dataset.tool;
        document.querySelector(`.nav-btn[data-target="${tool}"]`).click();
    });
});

// Helper: Read File
function handleFileUpload(inputElement, previewContainerId, imageElementId, onImageLoaded = null) {
    inputElement.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        state.currentFile = file;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.getElementById(imageElementId);
            img.src = event.target.result;
            state.originalImage = img; // Keep reference

            // Hide upload box, show preview
            const uploadBox = inputElement.parentElement;
            uploadBox.style.display = 'none';
            document.getElementById(previewContainerId).classList.add('active');

            if (onImageLoaded) onImageLoaded(img);
        };
        reader.readAsDataURL(file);
    });
}

// Helper: Setup Upload Box Click
function setupUploadBox(boxId, inputId) {
    document.getElementById(boxId).addEventListener('click', () => {
        document.getElementById(inputId).click();
    });
    // Drag and drop support
    const box = document.getElementById(boxId);
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.style.borderColor = '#6366f1'; });
    box.addEventListener('dragleave', (e) => { e.preventDefault(); box.style.borderColor = '#27272a'; });
    box.addEventListener('drop', (e) => {
        e.preventDefault();
        box.style.borderColor = '#27272a';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const input = document.getElementById(inputId);
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event('change'));
        }
    });
}

// ----------------------
// COMPRESS TOOL
// ----------------------
setupUploadBox('compress-upload-box', 'compress-file');
handleFileUpload(document.getElementById('compress-file'), 'compress-preview', 'compress-img');

document.getElementById('compress-quality').addEventListener('input', (e) => {
    document.getElementById('compress-quality-val').textContent = e.target.value + '%';
});

document.getElementById('compress-action').addEventListener('click', () => {
    const img = document.getElementById('compress-img');
    if (!img.src) return alert('Please upload an image first.');

    const maxSizeKB = parseInt(document.getElementById('compress-size').value) || 0;

    let quality = parseInt(document.getElementById('compress-quality').value) / 100;
    const format = document.getElementById('compress-fmt').value;

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    let dataUrl = canvas.toDataURL(format, quality);

    // Max Size Logic
    if (maxSizeKB > 0) {
        let currentQuality = quality;
        // Estimate size in KB
        let sizeKB = Math.round((dataUrl.length - ('data:' + format + ';base64,').length) * 0.75) / 1024;

        let attempts = 0;
        while (sizeKB > maxSizeKB && currentQuality > 0.1 && attempts < 10) {
            currentQuality -= 0.1;
            dataUrl = canvas.toDataURL(format, currentQuality);
            sizeKB = Math.round((dataUrl.length - ('data:' + format + ';base64,').length) * 0.75) / 1024;
            attempts++;
        }
    }

    // Calculate estimated size
    const head = 'data:' + format + ';base64,';
    const size = Math.round((dataUrl.length - head.length) * 0.75);
    const origSize = state.currentFile ? state.currentFile.size : 0;

    showModal(origSize, size, dataUrl, `compressed.${format.split('/')[1]}`);
});


// ----------------------
// CROP TOOL
// ----------------------
setupUploadBox('crop-upload-box', 'crop-file');
handleFileUpload(document.getElementById('crop-file'), 'crop-preview', 'crop-img', (img) => {
    if (state.cropper) state.cropper.destroy();
    state.cropper = new Cropper(img, {
        viewMode: 1,
        autoCropArea: 1,
    });
});

document.getElementById('crop-ratio').addEventListener('change', (e) => {
    if (!state.cropper) return;
    const val = parseFloat(e.target.value);
    state.cropper.setAspectRatio(val);
});

document.getElementById('crop-action').addEventListener('click', () => {
    if (!state.cropper) return;
    const format = document.getElementById('crop-fmt').value;
    const canvas = state.cropper.getCroppedCanvas();
    const dataUrl = canvas.toDataURL(format);
    download(dataUrl, `cropped.${format.split('/')[1]}`);
    resetActiveTool();
});


// ----------------------
// RESIZE TOOL
// ----------------------
setupUploadBox('resize-upload-box', 'resize-file');
handleFileUpload(document.getElementById('resize-file'), 'resize-preview', 'resize-img', (img) => {
    document.getElementById('resize-width').value = img.naturalWidth;
    document.getElementById('resize-height').value = img.naturalHeight;
});

const resizeW = document.getElementById('resize-width');
const resizeH = document.getElementById('resize-height');
const resizeLock = document.getElementById('resize-lock');

resizeW.addEventListener('input', () => {
    if (resizeLock.checked && state.currentFile) {
        const aspect = state.originalImage.naturalHeight / state.originalImage.naturalWidth;
        resizeH.value = Math.round(resizeW.value * aspect);
    }
});

resizeH.addEventListener('input', () => {
    if (resizeLock.checked && state.currentFile) {
        const aspect = state.originalImage.naturalWidth / state.originalImage.naturalHeight;
        resizeW.value = Math.round(resizeH.value * aspect);
    }
});

document.getElementById('resize-action').addEventListener('click', () => {
    const img = document.getElementById('resize-img');
    if (!img.src) return;
    const width = parseInt(resizeW.value);
    const height = parseInt(resizeH.value);
    const format = document.getElementById('resize-fmt').value;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    download(canvas.toDataURL(format), `resized.${format.split('/')[1]}`);
    resetActiveTool();
});


// ----------------------
// CONVERT TOOL
// ----------------------
setupUploadBox('convert-upload-box', 'convert-file');
handleFileUpload(document.getElementById('convert-file'), 'convert-preview', 'convert-img');

document.getElementById('convert-quality').addEventListener('input', (e) => {
    document.getElementById('convert-quality-val').textContent = e.target.value + '%';
});

document.getElementById('convert-action').addEventListener('click', () => {
    const img = document.getElementById('convert-img');
    if (!img.src) return;

    const format = document.getElementById('convert-fmt').value;
    const quality = parseInt(document.getElementById('convert-quality').value) / 100;

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    download(canvas.toDataURL(format, quality), `converted.${format.split('/')[1]}`);
    resetActiveTool();
});


// ----------------------
// UPSCALE TOOL
// ----------------------
// Note: True AI upscaling is complex for client-side vanilla JS.
// We will use Bicubic interpolation on a larger canvas as a basic implementation.
setupUploadBox('upscale-upload-box', 'upscale-file');
handleFileUpload(document.getElementById('upscale-file'), 'upscale-preview', 'upscale-img');

document.getElementById('upscale-action').addEventListener('click', () => {
    const img = document.getElementById('upscale-img');
    if (!img.src) return;

    const scale = parseInt(document.getElementById('upscale-factor').value);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;

    const ctx = canvas.getContext('2d');
    // Enable better smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    download(canvas.toDataURL('image/png'), `upscaled_x${scale}.png`);
    resetActiveTool();
});


// ----------------------
// WATERMARK TOOL
// ----------------------
setupUploadBox('watermark-upload-box', 'watermark-file');
// We need a custom handler for watermark to draw on canvas immediately
const wmInput = document.getElementById('watermark-file');
wmInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            state.wmImg = img;
            drawWatermarkPreview();
            // Hide upload box, show preview
            document.getElementById('watermark-upload-box').style.display = 'none';
            document.getElementById('watermark-preview').classList.add('active');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

function drawWatermarkPreview() {
    if (!state.wmImg) return;
    const canvas = document.getElementById('watermark-canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size to match image
    canvas.width = state.wmImg.naturalWidth;
    canvas.height = state.wmImg.naturalHeight;

    // Draw Image
    ctx.globalAlpha = 1.0;
    ctx.drawImage(state.wmImg, 0, 0);

    // Draw Text
    const text = document.getElementById('wm-text').value;
    const size = parseInt(document.getElementById('wm-size').value);
    const color = document.getElementById('wm-color').value;
    const opacity = parseFloat(document.getElementById('wm-opacity').value);
    const repeat = document.getElementById('wm-repeat').checked;

    if (text) {
        ctx.font = `bold ${size}px Arial`;
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity;
        ctx.textBaseline = 'middle';

        if (repeat) {
            const metrics = ctx.measureText(text);
            const w = metrics.width + size * 2;
            const h = size * 2;

            ctx.save();
            // Rotate pattern
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(-30 * Math.PI / 180);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);

            const diag = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);

            for (let x = -diag; x < diag * 1.5; x += w) {
                for (let y = -diag; y < diag * 1.5; y += h) {
                    ctx.fillText(text, x, y);
                }
            }
            ctx.restore();
        } else {
            const posX = parseInt(document.getElementById('wm-x').value);
            const posY = parseInt(document.getElementById('wm-y').value);
            ctx.textAlign = 'center';
            const x = (canvas.width * posX) / 100;
            const y = (canvas.height * posY) / 100;
            ctx.fillText(text, x, y);
        }
        ctx.globalAlpha = 1.0;
    }
}

// Add listeners for watermark controls
['wm-text', 'wm-size', 'wm-color', 'wm-x', 'wm-y', 'wm-opacity', 'wm-repeat'].forEach(id => {
    document.getElementById(id).addEventListener('input', drawWatermarkPreview);
});

document.getElementById('watermark-action').addEventListener('click', () => {
    const canvas = document.getElementById('watermark-canvas');
    if (!state.wmImg) return;
    const format = document.getElementById('watermark-fmt').value;
    download(canvas.toDataURL(format), `watermarked.${format.split('/')[1]}`);
    resetActiveTool();
});


// Utility
function download(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Size Comparison Modal Logic
function showModal(origSize, newSize, url, filename) {
    const formatSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    document.getElementById('size-before').textContent = formatSize(origSize);
    document.getElementById('size-after').textContent = formatSize(newSize);

    const savingsText = document.getElementById('size-savings');
    if (origSize > 0) {
        const saving = ((origSize - newSize) / origSize * 100).toFixed(1);
        if (newSize < origSize) {
            savingsText.textContent = `Saved ${saving}%!`;
            savingsText.style.color = '#4ade80';
        } else {
            savingsText.textContent = `Size increased`;
            savingsText.style.color = '#ef4444';
        }
    } else {
        savingsText.textContent = 'Done!';
    }

    const modal = document.getElementById('size-modal');
    modal.classList.add('active');

    const downBtn = document.getElementById('modal-download');
    // Replace to clear listeners
    const newBtn = downBtn.cloneNode(true);
    downBtn.parentNode.replaceChild(newBtn, downBtn);

    newBtn.addEventListener('click', () => {
        download(url, filename);
        modal.classList.remove('active');
        resetActiveTool();
    });

    document.querySelector('.close-modal').onclick = () => {
        modal.classList.remove('active');
    };
}

window.onclick = (e) => {
    const modal = document.getElementById('size-modal');
    if (e.target == modal) modal.classList.remove('active');
}


// ----------------------
// ROTATE TOOL
// ----------------------
setupUploadBox('rotate-upload-box', 'rotate-file');
handleFileUpload(document.getElementById('rotate-file'), 'rotate-preview', 'rotate-img', () => {
    state.rotation = 0;
    updateRotatePreview();
});

let rotateAngle = 0;
document.getElementById('rotate-left').addEventListener('click', () => {
    rotateAngle = (rotateAngle - 90) % 360;
    updateRotatePreview();
});
document.getElementById('rotate-right').addEventListener('click', () => {
    rotateAngle = (rotateAngle + 90) % 360;
    updateRotatePreview();
});

function updateRotatePreview() {
    const img = document.getElementById('rotate-img');
    if (!img) return;
    img.style.transform = `rotate(${rotateAngle}deg)`;
}

document.getElementById('rotate-action').addEventListener('click', () => {
    const img = document.getElementById('rotate-img');
    if (!img.src) return;

    const format = document.getElementById('rotate-fmt').value;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Calculate new dimensions
    const rad = rotateAngle * Math.PI / 180;
    const absSin = Math.abs(Math.sin(rad));
    const absCos = Math.abs(Math.cos(rad));

    canvas.width = img.naturalWidth * absCos + img.naturalHeight * absSin;
    canvas.height = img.naturalWidth * absSin + img.naturalHeight * absCos;

    // Draw
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    download(canvas.toDataURL(format), `rotated.${format.split('/')[1]}`);
    resetActiveTool();
});

// Utility: Reset Tool State
function resetActiveTool() {
    const activeSection = document.querySelector('.view.active');
    if (!activeSection) return;

    // Reset UI Elements
    const uploadBox = activeSection.querySelector('.upload-box');
    const preview = activeSection.querySelector('.image-preview');
    const img = preview ? preview.querySelector('img') : null;
    const fileInput = uploadBox ? uploadBox.querySelector('input[type="file"]') : null;
    const canvas = preview ? preview.querySelector('canvas') : null;

    if (uploadBox) uploadBox.style.display = 'flex';
    if (preview) preview.classList.remove('active');
    if (img) img.src = '';
    if (fileInput) fileInput.value = '';

    // Clear canvas if exists (Watermark)
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // State Reset
    state.currentFile = null;
    state.originalImage = null;
    if (state.cropper) {
        state.cropper.destroy();
        state.cropper = null;
    }
    state.wmImg = null;
    state.rotation = 0;

    // Also clear other inputs in the workspace
    activeSection.querySelectorAll('input').forEach(inp => {
        if (inp.type === 'number' || inp.type === 'text') inp.value = '';
    });
}
