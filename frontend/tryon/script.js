// Use your actual API URL here
const API_BASE_URL = "https://showroomar-production.up.railway.app/api";

// Cloudinary helper function
function getCloudinaryUrl(publicId, width = 800, height = 1200) {
    if (!publicId) return "";
    publicId = publicId.replace(/^\//, "").replace(/\.png$/, "");
    return `https://res.cloudinary.com/djwoojdrl/image/upload/${publicId}`;
}

const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const clothingSelect = document.getElementById("clothingSelect");

let products = [];
let selected = null;
let shirtImg = new Image();
let shirtLoaded = false;

// Camera variables
let currentStream = null;
let currentFacingMode = "user"; // "user" = front, "environment" = back
let isImageFlipped = false;
let switchCameraBtn = null;
let flipImageBtn = null;

// Showroom navigation variables
let currentShowroom = null;

// ---------------- CAMERA PERMISSION & SHOWROOM ----------------
function hasCameraPermission() {
    return localStorage.getItem('cameraPermission') === 'granted';
}
function saveCameraPermission() {
    localStorage.setItem('cameraPermission', 'granted');
}
function saveShowroomContext(showroomId, showroomName) {
    currentShowroom = { id: showroomId, name: showroomName };
    localStorage.setItem('currentShowroom', JSON.stringify(currentShowroom));
}
function loadShowroomContext() {
    const saved = localStorage.getItem('currentShowroom');
    if (saved) {
        currentShowroom = JSON.parse(saved);
        return currentShowroom;
    }
    return null;
}
function createBackToShowroomButton() {
    const showroom = loadShowroomContext();
    if (!showroom) return null;
    const backButton = document.createElement('a');
    backButton.href = `../showroom/showroom.html?showroom=${showroom.id}`;
    backButton.className = 'btn-secondary';
    backButton.innerHTML = `← Back to ${showroom.name}`;
    backButton.style.marginRight = '10px';
    return backButton;
}

// ---------------- PRODUCT MANAGEMENT ----------------
function updateSelectedProductInfo(product) {
    const infoDiv = document.getElementById('selectedProductInfo');
    const nameElement = document.getElementById('selectedProductName');
    const priceElement = document.getElementById('selectedProductPrice');
    const categoryElement = document.getElementById('selectedProductCategory');

    if (product) {
        nameElement.textContent = product.name;
        priceElement.textContent = `Price: $${product.price}`;
        categoryElement.textContent = `Category: ${product.category}`;
        infoDiv.style.display = 'block';
    } else {
        infoDiv.style.display = 'none';
    }
}
function loadSavedSelection() {
    const saved = localStorage.getItem("selectedModel");
    if (saved) {
        selected = JSON.parse(saved);
        if (selected && selected.image) {
            shirtImg.src = getCloudinaryUrl(selected.image);
            shirtImg.onload = () => {
                shirtLoaded = true;
                updateSelectedProductInfo(selected);
                clothingSelect.value = selected._id;
            };
        }
    }
}
async function loadProductsForTryOn() {
    try {
        clothingSelect.innerHTML = '<option value="none">Loading products...</option>';
        const response = await fetch(`${API_BASE_URL}/products`);
        products = await response.json();
        populateClothingSelect();
        clothingSelect.disabled = false;
        loadSavedSelection();
    } catch (error) {
        console.error('Error loading products:', error);
        clothingSelect.innerHTML = '<option value="none">Error loading products</option>';
    }
}
function populateClothingSelect() {
    clothingSelect.innerHTML = '<option value="none">Select a product...</option>';
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product._id;
        option.textContent = product.name;
        option.setAttribute('data-product', JSON.stringify(product));
        clothingSelect.appendChild(option);
    });
}
function selectProduct(productId) {
    const product = products.find(p => p._id === productId);
    if (!product) return;
    selected = product;
    localStorage.setItem("selectedModel", JSON.stringify(product));
    shirtImg.src = getCloudinaryUrl(product.image);

    shirtImg.onload = () => {
        shirtLoaded = true;
        updateSelectedProductInfo(product);
    };
    shirtImg.onerror = () => {
        shirtLoaded = false;
        alert('Image not found in Cloudinary. Please check if the image was uploaded.');
    };
}
clothingSelect.addEventListener('change', (e) => {
    if (e.target.value === 'none') {
        selected = null;
        shirtLoaded = false;
        localStorage.removeItem("selectedModel");
        updateSelectedProductInfo(null);
        return;
    }
    selectProduct(e.target.value);
});

// ---------------- CAMERA FUNCTIONS ----------------
async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
        console.error('Error getting cameras:', error);
        return [];
    }
}
async function switchCamera() {
    if (currentStream) currentStream.getTracks().forEach(track => track.stop());
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    await startCamera();
    updateCameraButtonText();
}
function flipImage() {
    isImageFlipped = !isImageFlipped;
    if (flipImageBtn) flipImageBtn.textContent = isImageFlipped ? '↕️ Unflip Image' : '↕️ Flip Image';
}
function updateCameraButtonText() {
    if (switchCameraBtn) {
        const cameraName = currentFacingMode === "user" ? "Back" : "Front";
        switchCameraBtn.textContent = `🔄 Switch to ${cameraName} Camera`;
    }
}

// ---------------- ROBUST START CAMERA ----------------
async function startCamera() {
    console.log('📷 Starting camera...');
    if (currentStream) currentStream.getTracks().forEach(t => t.stop());
    const cameras = await getCameras();
    if (!cameras.length) { alert('No cameras found'); return; }

    let chosenDeviceId;
    if (currentFacingMode === 'environment') {
        const backCam = cameras.find(c => /back|rear/i.test(c.label));
        chosenDeviceId = backCam ? backCam.deviceId : cameras[cameras.length - 1].deviceId;
    } else {
        const frontCam = cameras.find(c => /front/i.test(c.label));
        chosenDeviceId = frontCam ? frontCam.deviceId : cameras[0].deviceId;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: chosenDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
        });
        currentStream = stream;
        videoElement.srcObject = stream;
        videoElement.style.display = 'none';
        saveCameraPermission();

        await new Promise(resolve => {
            videoElement.onloadedmetadata = () => {
                resizeCanvasToVideo();
                videoElement.play().then(resolve).catch(resolve);
            };
            setTimeout(resolve, 2000);
        });

        if (cameras.length > 1) showCameraControls();
        updateCameraButtonText();
        startMediaPipeProcessing();
        console.log(`✅ Camera started: ${currentFacingMode}`);
    } catch (err) {
        console.error('❌ Failed to start camera:', err);
        alert('Unable to access camera. Check permissions and device camera.');
    }
}

function showCameraControls() {
    if (switchCameraBtn) switchCameraBtn.style.display = 'block';
    if (flipImageBtn) flipImageBtn.style.display = 'block';
}
function createCameraControls() {
    const controlsContainer = document.querySelector('.camera-controls');
    if (!controlsContainer) return;

    switchCameraBtn = document.createElement('button');
    switchCameraBtn.className = 'camera-btn';
    switchCameraBtn.style.display = 'none';
    switchCameraBtn.onclick = switchCamera;

    flipImageBtn = document.createElement('button');
    flipImageBtn.className = 'camera-btn';
    flipImageBtn.style.display = 'none';
    flipImageBtn.onclick = flipImage;

    controlsContainer.appendChild(switchCameraBtn);
    controlsContainer.appendChild(flipImageBtn);

    updateCameraButtonText();
    flipImageBtn.textContent = '↕️ Flip Image';
}

// ---------------- MEDIAPIPE ----------------
function startMediaPipeProcessing() {
    const camera = new Camera(videoElement, {
        onFrame: async () => { try { await pose.send({ image: videoElement }); } catch (err) { console.error(err); } },
        width: 640,
        height: 480
    });
    camera.start().catch(err => console.error('MediaPipe failed:', err));
}

const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
});
pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
pose.onResults(onResults);

// ---------------- CANVAS DRAWING ----------------
function resizeCanvasToVideo() {
    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;
    if (!vw || !vh) return;

    const aspect = vw / vh;
    const screenAspect = window.innerWidth / window.innerHeight;

    if (aspect > screenAspect) {
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerWidth / aspect;
    } else {
        canvasElement.height = window.innerHeight;
        canvasElement.width = window.innerHeight * aspect;
    }
}

// Drawing function kept intact
function onResults(results) {
    if (!videoElement.srcObject) return;
    const { width, height } = canvasElement;
    canvasCtx.clearRect(0, 0, width, height);

    // Handle camera mirroring
    canvasCtx.save();
    if ((currentFacingMode === "user") || (currentFacingMode === "environment" && isImageFlipped)) {
        canvasCtx.translate(width, 0);
        canvasCtx.scale(-1, 1);
    }
    canvasCtx.drawImage(results.image, 0, 0, width, height);
    canvasCtx.restore();

    if (!shirtLoaded || !results.poseLandmarks) {
        canvasCtx.fillStyle = 'white';
        canvasCtx.font = '18px Arial';
        canvasCtx.textAlign = 'center';
        canvasCtx.fillText('Stand in front of camera', width / 2, 50);
        canvasCtx.fillText('to try on clothes', width / 2, 80);
        return;
    }

    // Pose landmarks
    const px = p => ({ x: (1 - p.x) * width, y: p.y * height });
    const LM = results.poseLandmarks;
    const LS = px(LM[11]), RS = px(LM[12]);
    const LH = px(LM[23]), RH = px(LM[24]);
    const LK = px(LM[25]), RK = px(LM[26]);
    const LA = px(LM[27]), RA = px(LM[28]);

    const itemName = (selected?.name || "").toLowerCase();
    const isBottom = /trouser|pant|jean|short|bottom|skirt|legging/.test(itemName);
    const isShort = /pofdk/.test(itemName);

    if (!isBottom) {
        // Shirt
        const torsoTop = { x: (LS.x + RS.x)/2, y: (LS.y + RS.y)/2 };
        const torsoBottom = { x: (LH.x + RH.x)/2, y: (LH.y + RH.y)/2 };
        const torsoWidth = Math.hypot(RS.x - LS.x, RS.y - LS.y);
        const torsoHeight = Math.abs(torsoBottom.y - torsoTop.y);
        const angle = Math.atan2(RS.y - LS.y, RS.x - LS.x);

        canvasCtx.save();
        canvasCtx.translate(torsoTop.x, torsoTop.y);
        canvasCtx.rotate(angle);
        canvasCtx.drawImage(shirtImg, -torsoWidth*0.95, -torsoHeight, torsoWidth*1.9, torsoHeight*2);
        canvasCtx.restore();
    } else {
        // Pants
        const hipMid = { x: (LH.x + RH.x)/2, y: (LH.y + RH.y)/2 };
        const kneeMid = { x: (LK.x + RK.x)/2, y: (LK.y + RK.y)/2 };
        const ankleMid = { x: (LA.x + RA.x)/2, y: (LA.y + RA.y)/2 };
        const waistWidth = Math.hypot(RH.x - LH.x, RH.y - LH.y);
        const legHeight = Math.abs(ankleMid.y - hipMid.y);
        const angle = Math.atan2(RH.y - LH.y, RH.x - LH.x);

        canvasCtx.save();
        canvasCtx.translate(hipMid.x, hipMid.y);
        canvasCtx.rotate(angle);

        const drawW = isShort ? waistWidth*1.8 : waistWidth*2.5;
        const drawH = isShort ? Math.max(30, Math.abs(kneeMid.y - hipMid.y)*1.2) : Math.max(40, legHeight*1.4);
        const drawY = isShort ? -drawH*0.1 : -drawH*0.15;
        canvasCtx.drawImage(shirtImg, -drawW/2, drawY, drawW, drawH);
        canvasCtx.restore();
    }
}

// ---------------- START BUTTON ----------------
function setupStartButton() {
    const startButton = document.createElement('button');
    startButton.textContent = '🎥 Start Camera';
    startButton.style.cssText = `position: fixed; top: 80px; left: 50%; transform: translateX(-50%); z-index: 1000; padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 25px; font-size: 16px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-weight: bold;`;
    startButton.onclick = async () => { startButton.disabled = true; startButton.textContent = 'Starting...'; await startCamera(); startButton.style.display='none'; };
    document.body.appendChild(startButton);
}

// ---------------- INIT ----------------
document.addEventListener('DOMContentLoaded', async () => {
    createCameraControls();
    const showroom = loadShowroomContext();
    if (showroom) {
        const backButton = createBackToShowroomButton();
        if (backButton) {
            const navButtons = document.getElementById('navigationButtons') || document.querySelector('.right-panel');
            if (navButtons) navButtons.insertBefore(backButton, navButtons.firstChild);
        }
    }

    await loadProductsForTryOn();

    if (selected && selected.image) shirtImg.src = getCloudinaryUrl(selected.image);
    else shirtImg.src = getCloudinaryUrl("clothes/shirt/RedShirt_dkyvmdt");

    shirtImg.onload = () => { shirtLoaded = true; };

    if (hasCameraPermission()) await startCamera();
    else setupStartButton();
});

// Cleanup
window.addEventListener('beforeunload', () => { if (currentStream) currentStream.getTracks().forEach(track => track.stop()); });
