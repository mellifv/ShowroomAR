// Use your actual API URL here
const API_BASE_URL = "https://showroomar-production.up.railway.app/api";

// Cloudinary helper function
function getCloudinaryUrl(publicId, width = 800, height = 1200) {
    if (!publicId) return "";
    
    // Remove leading slash and .png extension if present
    publicId = publicId.replace(/^\//, "").replace(/\.png$/, "");
    
    // Build the Cloudinary URL - NO .png extension added
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

// Check if camera permission was previously granted
function hasCameraPermission() {
    return localStorage.getItem('cameraPermission') === 'granted';
}

// Save camera permission status
function saveCameraPermission() {
    localStorage.setItem('cameraPermission', 'granted');
}

// Function to save showroom context when coming from a showroom
function saveShowroomContext(showroomId, showroomName) {
    currentShowroom = { id: showroomId, name: showroomName };
    localStorage.setItem('currentShowroom', JSON.stringify(currentShowroom));
}

// Function to load showroom context
function loadShowroomContext() {
    const saved = localStorage.getItem('currentShowroom');
    if (saved) {
        currentShowroom = JSON.parse(saved);
        return currentShowroom;
    }
    return null;
}

// Function to create back button
function createBackToShowroomButton() {
    const showroom = loadShowroomContext();
    if (!showroom) return null;
    
    const backButton = document.createElement('a');
    backButton.href = `../showroom/showroom-products.html?showroom=${showroom.id}`;
    backButton.className = 'btn-secondary';
    backButton.innerHTML = `← Back to ${showroom.name}`;
    backButton.style.marginRight = '10px';
    
    return backButton;
}

// Function to update selected product info display
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

// Load any previously selected model from localStorage
function loadSavedSelection() {
    const saved = localStorage.getItem("selectedModel");
    if (saved) {
        selected = JSON.parse(saved);
        if (selected && selected.image) {
            shirtImg.src = getCloudinaryUrl(selected.image);
            shirtImg.onload = () => {
                shirtLoaded = true;
                updateSelectedProductInfo(selected);
                if (clothingSelect) {
                    clothingSelect.value = selected._id;
                }
            };
        }
    }
}

// Add this function to load products from your API
async function loadProductsForTryOn() {
    try {
        if (!clothingSelect) return;
        
        clothingSelect.innerHTML = '<option value="none">Loading products...</option>';
        
        const response = await fetch(`${API_BASE_URL}/products`);
        products = await response.json();
        
        populateClothingSelect();
        clothingSelect.disabled = false;
        
        loadSavedSelection();
    } catch (error) {
        console.error('Error loading products:', error);
        if (clothingSelect) {
            clothingSelect.innerHTML = '<option value="none">Error loading products</option>';
        }
    }
}

// Function to populate the dropdown select with product names only
function populateClothingSelect() {
    if (!clothingSelect) return;
    
    clothingSelect.innerHTML = '<option value="none">Select a product...</option>';
    
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product._id;
        option.textContent = product.name;
        option.setAttribute('data-product', JSON.stringify(product));
        clothingSelect.appendChild(option);
    });
}

// Product selection function
function selectProduct(productId) {
    const product = products.find(p => p._id === productId);
    if (product) {
        selected = product;
        localStorage.setItem("selectedModel", JSON.stringify(product));
        
        shirtImg.src = getCloudinaryUrl(product.image);
        console.log('🔄 Loading:', product.image);
        console.log('📦 Cloudinary URL:', shirtImg.src);
        
        shirtImg.onload = () => {
            shirtLoaded = true;
            updateSelectedProductInfo(product);
            console.log(`✅ Successfully loaded: ${product.name}`);
        };
        
        shirtImg.onerror = () => {
            console.error('❌ Failed to load:', product.image);
            console.error('Full URL:', shirtImg.src);
            alert('Image not found in Cloudinary. Please check if the image was uploaded.');
            shirtLoaded = false;
        };
    }
}

// Camera functions - FIXED VERSION
async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        console.log('📹 Available cameras:', cameras.map(cam => ({
            label: cam.label,
            deviceId: cam.deviceId
        })));
        return cameras;
    } catch (error) {
        console.error('Error getting cameras:', error);
        return [];
    }
}

// Improved camera switching function
async function switchCamera() {
    console.log('🔄 Attempting to switch camera...');
    
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    
    try {
        const cameras = await getCameras();
        
        if (cameras.length < 2) {
            alert('Only one camera found on this device');
            return;
        }
        
        // Toggle between front and back
        currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
        console.log(`🔄 Switching to ${currentFacingMode} camera`);
        
        // Try different constraint approaches
        let constraints;
        
        if (currentFacingMode === "user") {
            // Front camera
            constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user"
                }
            };
        } else {
            // Back camera
            constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "environment"
                }
            };
        }
        
        console.log('🎯 Camera constraints:', constraints);
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        await handleNewStream(stream);
        
    } catch (error) {
        console.error('❌ Camera switch failed:', error);
        
        // Fallback: try deviceId-based switching
        await fallbackCameraSwitch();
    }
}

// Fallback method using deviceId
async function fallbackCameraSwitch() {
    try {
        console.log('🔄 Trying fallback camera switching...');
        const cameras = await getCameras();
        
        if (cameras.length < 2) {
            throw new Error('Only one camera available');
        }
        
        // Get current deviceId to switch to the other one
        const currentDeviceId = currentStream?.getVideoTracks()[0]?.getSettings()?.deviceId;
        const otherCamera = cameras.find(cam => cam.deviceId !== currentDeviceId);
        
        if (!otherCamera) {
            throw new Error('Could not find alternative camera');
        }
        
        console.log('🎯 Switching to camera:', otherCamera.label);
        
        const constraints = {
            video: {
                deviceId: { exact: otherCamera.deviceId },
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        await handleNewStream(stream);
        
        // Update facing mode based on camera label
        if (otherCamera.label.toLowerCase().includes('back') || 
            otherCamera.label.toLowerCase().includes('rear')) {
            currentFacingMode = "environment";
        } else {
            currentFacingMode = "user";
        }
        
    } catch (fallbackError) {
        console.error('❌ Fallback camera switch failed:', fallbackError);
        alert('Unable to switch cameras. Your device might only have one camera.');
        
        // Revert to original facing mode
        currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    }
}

// Handle new stream
async function handleNewStream(stream) {
    currentStream = stream;
    videoElement.srcObject = stream;
    
    await new Promise((resolve) => {
        videoElement.onloadedmetadata = () => {
            resizeCanvasToVideo();
            videoElement.play().then(resolve).catch(resolve);
        };
        setTimeout(resolve, 1000);
    });
    
    updateCameraButtonText();
    console.log('✅ Camera switched successfully');
}

// Improved startCamera function
async function startCamera() {
    console.log('📷 Starting camera...');
    try {
        const cameras = await getCameras();
        const hasMultipleCameras = cameras.length > 1;
        
        let constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: currentFacingMode
            }
        };
        
        console.log('🎯 Initial camera constraints:', constraints);
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log('✅ Camera access granted');
        currentStream = stream;
        videoElement.style.display = 'none';
        videoElement.srcObject = stream;
        
        saveCameraPermission();
        
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                resizeCanvasToVideo();
                videoElement.play().then(resolve).catch(resolve);
            };
            setTimeout(resolve, 2000);
        });
        
        // Show camera controls if multiple cameras available
        if (hasMultipleCameras) {
            showCameraControls();
        } else {
            console.log('ℹ️ Only one camera detected, hiding switch button');
            if (switchCameraBtn) {
                switchCameraBtn.style.display = 'none';
            }
        }
        
        updateCameraButtonText();
        startMediaPipeProcessing();
        
    } catch (error) {
        console.error('❌ Camera start failed:', error);
        
        // More specific error handling
        if (error.name === 'NotAllowedError') {
            console.log('❌ Camera permission denied');
        } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
            console.log('🔄 Retrying with relaxed constraints...');
            await startCameraWithRelaxedConstraints();
        } else {
            console.error('❌ Unexpected camera error:', error);
        }
    }
}

// Fallback for when specific constraints fail
async function startCameraWithRelaxedConstraints() {
    try {
        console.log('🔄 Trying relaxed camera constraints...');
        
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 }
                // No facingMode specified
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        videoElement.srcObject = stream;
        
        await videoElement.play();
        startMediaPipeProcessing();
        
        // Hide switch button since we don't know which camera we got
        if (switchCameraBtn) {
            switchCameraBtn.style.display = 'none';
        }
        
        console.log('✅ Camera started with relaxed constraints');
        
    } catch (fallbackError) {
        console.error('❌ Relaxed constraints also failed:', fallbackError);
        alert('Cannot access camera. Please check permissions and try again.');
    }
}

// Function to flip the canvas image (for back camera)
function flipImage() {
    isImageFlipped = !isImageFlipped;
    if (flipImageBtn) {
        flipImageBtn.textContent = isImageFlipped ? '↕️ Unflip Image' : '↕️ Flip Image';
    }
    console.log(`🔄 Image flipped: ${isImageFlipped}`);
}

// Update camera button text based on current camera
function updateCameraButtonText() {
    if (switchCameraBtn) {
        const cameraName = currentFacingMode === "user" ? "Back" : "Front";
        switchCameraBtn.textContent = `🔄 Switch to ${cameraName} Camera`;
    }
}

// Show camera control buttons
function showCameraControls() {
    getCameras().then(cameras => {
        if (cameras.length > 1) {
            if (switchCameraBtn) {
                switchCameraBtn.style.display = 'block';
            }
            if (flipImageBtn) {
                flipImageBtn.style.display = 'block';
            }
        } else {
            console.log('ℹ️ Only one camera detected');
            if (switchCameraBtn) {
                switchCameraBtn.style.display = 'none';
            }
        }
    });
}

// Create camera control buttons
function createCameraControls() {
    const controlsContainer = document.querySelector('.camera-controls');
    
    if (!controlsContainer) {
        console.warn('❌ Camera controls container not found');
        return;
    }
    
    switchCameraBtn = document.createElement('button');
    switchCameraBtn.id = 'switchCamera';
    switchCameraBtn.className = 'camera-btn';
    switchCameraBtn.style.display = 'none';
    switchCameraBtn.onclick = switchCamera;
    
    flipImageBtn = document.createElement('button');
    flipImageBtn.id = 'flipImage';
    flipImageBtn.className = 'camera-btn';
    flipImageBtn.style.display = 'none';
    flipImageBtn.onclick = flipImage;
    
    controlsContainer.appendChild(switchCameraBtn);
    controlsContainer.appendChild(flipImageBtn);
    
    updateCameraButtonText();
    flipImageBtn.textContent = '↕️ Flip Image';
}

function startMediaPipeProcessing() {
    console.log('🔄 Starting MediaPipe...');
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            try {
                await pose.send({ image: videoElement });
            } catch (error) {
                console.error('MediaPipe frame error:', error);
            }
        },
        width: 640,
        height: 480,
    });

    camera.start().then(() => {
        console.log('✅ MediaPipe started');
    }).catch((error) => {
        console.error('❌ MediaPipe failed:', error);
    });
}

// Keep canvas aspect ratio correct for mobile
function resizeCanvasToVideo() {
    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;
    if (vw && vh) {
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
}

// Main drawing function
function onResults(results) {
    if (!videoElement.srcObject) return;

    const { width, height } = canvasElement;
    canvasCtx.clearRect(0, 0, width, height);

    // Handle different camera orientations
    if (currentFacingMode === "environment" && !isImageFlipped) {
        // Back camera - no flip (normal orientation)
        canvasCtx.save();
        canvasCtx.drawImage(results.image, 0, 0, width, height);
        canvasCtx.restore();
    } else if (currentFacingMode === "environment" && isImageFlipped) {
        // Back camera - flipped horizontally
        canvasCtx.save();
        canvasCtx.translate(width, 0);
        canvasCtx.scale(-1, 1);
        canvasCtx.drawImage(results.image, 0, 0, width, height);
        canvasCtx.restore();
    } else {
        // Front camera - always mirrored
        canvasCtx.save();
        canvasCtx.translate(width, 0);
        canvasCtx.scale(-1, 1);
        canvasCtx.drawImage(results.image, 0, 0, width, height);
        canvasCtx.restore();
    }

    if (!shirtLoaded || !results.poseLandmarks) {
        canvasCtx.fillStyle = 'white';
        canvasCtx.font = '18px Arial';
        canvasCtx.textAlign = 'center';
        canvasCtx.fillText('Stand in front of camera', width / 2, 50);
        canvasCtx.fillText('to try on clothes', width / 2, 80);
        return;
    }

    function pxMirrored(p) {
        return { x: (1 - p.x) * width, y: p.y * height };
    }

    const LM = results.poseLandmarks;
    const LS = pxMirrored(LM[11]);
    const RS = pxMirrored(LM[12]);
    const LH = pxMirrored(LM[23]);
    const RH = pxMirrored(LM[24]);
    const LK = pxMirrored(LM[25]);
    const RK = pxMirrored(LM[26]);
    const LA = pxMirrored(LM[27]);
    const RA = pxMirrored(LM[28]);

    const itemName = (selected?.name || "").toLowerCase();
    const isBottom = /trouser|pant|jean|short|bottom|skirt|legging/.test(itemName);
    const isShort = /short/.test(itemName);

    if (!isBottom) {
        // --- SHIRT / JACKET ---
        const torsoTop = { x: (LS.x + RS.x) / 2, y: (LS.y + RS.y) / 2 };
        const torsoBottom = { x: (LH.x + RH.x) / 2, y: (LH.y + RH.y) / 2 };
        const torsoWidth = Math.hypot(RS.x - LS.x, RS.y - LS.y);
        const torsoHeight = Math.abs(torsoBottom.y - torsoTop.y);
        const angle = Math.atan2(RS.y - LS.y, RS.x - LS.x);

        canvasCtx.save();
        canvasCtx.translate(torsoTop.x, torsoTop.y);
        canvasCtx.rotate(angle);

        const drawW = torsoWidth * 1.9;
        const drawH = Math.max(20, torsoHeight * 2.0);
        const drawX = -drawW / 2;
        const drawY = -drawH * 0.18;

        canvasCtx.drawImage(shirtImg, drawX, drawY, drawW, drawH);
        canvasCtx.restore();
    } else {
        // --- TROUSERS / SHORTS ---
        const hipMid = { x: (LH.x + RH.x) / 2, y: (LH.y + RH.y) / 2 };
        const kneeMid = { x: (LK.x + RK.x) / 2, y: (LK.y + RK.y) / 2 };
        const ankleMid = { x: (LA.x + RA.x) / 2, y: (LA.y + RA.y) / 2 };
        
        const waistWidth = Math.hypot(RH.x - LH.x, RH.y - LH.y);
        const legHeight = Math.abs(ankleMid.y - hipMid.y);
        const angle = Math.atan2(RH.y - LH.y, RH.x - LH.x);

        canvasCtx.save();
        canvasCtx.translate(hipMid.x, hipMid.y);
        canvasCtx.rotate(angle);

        let drawW, drawH, drawY;
        
        if (isShort) {
            drawW = waistWidth * 1.8;
            drawH = Math.max(30, Math.abs(kneeMid.y - hipMid.y) * 1.2);
            drawY = -drawH * 0.1;
        } else {
            drawW = waistWidth * 2.5;
            drawH = Math.max(40, legHeight * 1.4);
            drawY = -drawH * 0.15;
        }

        const drawX = -drawW / 2;
        canvasCtx.drawImage(shirtImg, drawX, drawY, drawW, drawH);
        canvasCtx.restore();
    }
}

// Setup MediaPipe Pose
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
});
pose.setOptions({
    modelComplexity: 0,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
});
pose.onResults(onResults);

// Simple fallback start button
function setupStartButton() {
    const startButton = document.createElement('button');
    startButton.textContent = '🎥 Start Camera';
    startButton.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        padding: 12px 24px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 25px;
        font-size: 16px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        font-weight: bold;
    `;

    startButton.onclick = async () => {
        startButton.textContent = 'Starting...';
        startButton.disabled = true;
        await startCamera();
        
        setTimeout(() => {
            if (startButton.parentNode) {
                startButton.style.display = 'none';
            }
        }, 2000);
    };

    document.body.appendChild(startButton);
}

// SINGLE event listener for clothing select
if (clothingSelect) {
    clothingSelect.addEventListener('change', function(e) {
        if (e.target.value === 'none') {
            selected = null;
            shirtLoaded = false;
            localStorage.removeItem("selectedModel");
            updateSelectedProductInfo(null);
            return;
        }
        
        const productId = e.target.value;
        selectProduct(productId);
    });
}

// Initialize everything
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 Page loaded');
    
    // Create camera controls
    createCameraControls();
    
    // Load showroom context and create back button
    const showroom = loadShowroomContext();
    if (showroom) {
        console.log(`🎯 Came from showroom: ${showroom.name}`);
        const backButton = createBackToShowroomButton();
        if (backButton) {
            const navButtons = document.getElementById('navigationButtons') || document.querySelector('.right-panel');
            if (navButtons) {
                navButtons.insertBefore(backButton, navButtons.firstChild);
            }
        }
    }
    
    // Load products
    await loadProductsForTryOn();
    
    // Initialize shirt image
    if (selected && selected.image) {
        shirtImg.src = getCloudinaryUrl(selected.image);
    } else {
        shirtImg.src = getCloudinaryUrl("clothes/shirt/RedShirt_dkyvmdt");
    }
    shirtImg.onload = () => {
        shirtLoaded = true;
        console.log('✅ Default shirt image loaded');
    };

    // Start camera if permission granted
    if (hasCameraPermission()) {
        console.log('🔑 Camera permission remembered - starting automatically');
        await startCamera();
    } else {
        setupStartButton();
    }
});

// Cleanup
window.addEventListener('beforeunload', () => {
    if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
    }
});
