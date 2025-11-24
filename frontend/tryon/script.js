// Use your actual API URL here
const API_BASE_URL = "https://showroomar-production.up.railway.app/api";

// Cloudinary helper function - FIXED VERSION
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

// Check if camera permission was previously granted
function hasCameraPermission() {
    return localStorage.getItem('cameraPermission') === 'granted';
}

// Save camera permission status
function saveCameraPermission() {
    localStorage.setItem('cameraPermission', 'granted');
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
        // If there's a saved selection, load it
        if (selected && selected.cloudinary_public_id) {
            shirtImg.src = getCloudinaryUrl(selected.cloudinary_public_id);
            shirtImg.onload = () => {
                shirtLoaded = true;
                updateSelectedProductInfo(selected);
                // Also update the dropdown to show the selected item
                clothingSelect.value = selected._id;
            };
        }
    }
}
// Add these variables at the top
let currentStream = null;
let currentFacingMode = "user"; // "user" = front, "environment" = back
let isImageFlipped = false;

// Camera control elements
let switchCameraBtn = null;
let flipImageBtn = null;

// Function to get available cameras
async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
        console.error('Error getting cameras:', error);
        return [];
    }
}

// Function to switch between front and back cameras
async function switchCamera() {
    if (currentStream) {
        // Stop current stream
        currentStream.getTracks().forEach(track => track.stop());
    }
    
    // Toggle between front and back camera
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    
    console.log(`🔄 Switching to ${currentFacingMode} camera`);
    
    try {
        await startCamera();
        updateCameraButtonText();
    } catch (error) {
        console.error('Error switching camera:', error);
        // Revert if failed
        currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    }
}

// Function to flip the canvas image (for back camera)
function flipImage() {
    isImageFlipped = !isImageFlipped;
    flipImageBtn.textContent = isImageFlipped ? '↕️ Unflip Image' : '↕️ Flip Image';
    console.log(`🔄 Image flipped: ${isImageFlipped}`);
}

// Update camera button text based on current camera
function updateCameraButtonText() {
    if (switchCameraBtn) {
        const cameraName = currentFacingMode === "user" ? "Back" : "Front";
        switchCameraBtn.textContent = `🔄 Switch to ${cameraName} Camera`;
    }
}

// Modified startCamera function with device selection
async function startCamera() {
    console.log('📷 Starting camera...');
    try {
        // Check if multiple cameras are available
        const cameras = await getCameras();
        const hasMultipleCameras = cameras.length > 1;
        
        console.log(`📹 Available cameras: ${cameras.length}`);
        
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: currentFacingMode
            },
        };
        
        // For devices with multiple cameras, be more specific
        if (hasMultipleCameras && cameras.length === 2) {
            // Get the deviceId for the desired camera
            const desiredCamera = cameras.find(device => 
                currentFacingMode === "user" ? 
                device.label.toLowerCase().includes('front') || !device.label.toLowerCase().includes('back') :
                device.label.toLowerCase().includes('back')
            );
            
            if (desiredCamera) {
                constraints.video.deviceId = { exact: desiredCamera.deviceId };
            }
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log('✅ Camera access granted');
        currentStream = stream;
        videoElement.style.display = 'none';
        videoElement.srcObject = stream;

        // Save permission to localStorage
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
        }
        
        // Update button text
        updateCameraButtonText();

        startMediaPipeProcessing();
    } catch (error) {
        console.error('❌ Camera start failed:', error);
        
        // If facingMode fails, try without specific facing mode
        if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
            console.log('🔄 Retrying without facing mode constraint...');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                });
                currentStream = stream;
                videoElement.srcObject = stream;
                await videoElement.play();
                startMediaPipeProcessing();
            } catch (fallbackError) {
                console.error('❌ Fallback camera start failed:', fallbackError);
            }
        }
        
        if (error.name !== 'NotAllowedError') {
            alert('Camera error: ' + error.message);
        }
    }
}

// Show camera control buttons
function showCameraControls() {
    if (switchCameraBtn) {
        switchCameraBtn.style.display = 'block';
    }
    if (flipImageBtn) {
        flipImageBtn.style.display = 'block';
    }
}

// Create camera control buttons
function createCameraControls() {
    const controlsContainer = document.querySelector('.camera-controls');
    
    if (!controlsContainer) {
        console.warn('❌ Camera controls container not found');
        return;
    }
    
    // Switch Camera Button
    switchCameraBtn = document.createElement('button');
    switchCameraBtn.id = 'switchCamera';
    switchCameraBtn.className = 'camera-btn';
    switchCameraBtn.style.display = 'none';
    switchCameraBtn.onclick = switchCamera;
    
    // Flip Image Button
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

// Modified onResults function to handle back camera flipping
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

    // Rest of your drawing code remains the same...
    if (!shirtLoaded || !results.poseLandmarks) {
        canvasCtx.fillStyle = 'white';
        canvasCtx.font = '18px Arial';
        canvasCtx.textAlign = 'center';
        canvasCtx.fillText('Stand in front of camera', width / 2, 50);
        canvasCtx.fillText('to try on clothes', width / 2, 80);
        return;
    }

    // Your existing pose detection and clothing drawing code...
    // ... (keep all your existing pose detection code)
}

// Update initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 Page loaded');
    
    // Create camera controls
    createCameraControls();
    
    // Load showroom context
    const showroom = loadShowroomContext();
    if (showroom) {
        console.log(`🎯 Came from showroom: ${showroom.name}`);
    }
    
    // Add back button if we have showroom context
    const backButton = createBackToShowroomButton();
    if (backButton) {
        const navButtons = document.getElementById('navigationButtons');
        if (navButtons) {
            navButtons.appendChild(backButton);
        }
    }
    
    // Check if camera permission was previously granted
    if (hasCameraPermission()) {
        console.log('🔑 Camera permission remembered - starting automatically');
        await startCamera();
    } else {
        setupStartButton();
    }
});

// Update cleanup to handle stream properly
window.addEventListener('beforeunload', () => {
    if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
    }
});
// Add this function to load products from your API
async function loadProductsForTryOn() {
    try {
        clothingSelect.innerHTML = '<option value="none">Loading products...</option>';
        
        const response = await fetch(`${API_BASE_URL}/products`);
        products = await response.json();
        
        populateClothingSelect();
        clothingSelect.disabled = false;
        
        // After loading products, load any saved selection
        loadSavedSelection();
    } catch (error) {
        console.error('Error loading products:', error);
        clothingSelect.innerHTML = '<option value="none">Error loading products</option>';
    }
}

// Function to populate the dropdown select with product names only
function populateClothingSelect() {
    clothingSelect.innerHTML = '<option value="none">Select a product...</option>';
    
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product._id; // Use product ID as value
        option.textContent = product.name; // Only show product name
        option.setAttribute('data-product', JSON.stringify(product));
        clothingSelect.appendChild(option);
    });
}

// SIMPLE & CORRECT - Uses the full public_id from image field
function selectProduct(productId) {
    const product = products.find(p => p._id === productId);
    if (product) {
        selected = product;
        // Save to localStorage
        localStorage.setItem("selectedModel", JSON.stringify(product));
        
        // Use the image field directly as Cloudinary public_id
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

// SINGLE event listener for clothing select
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

// Call this function when the page loads
loadProductsForTryOn();
console.log('🚀 Try-on script loaded');

// Initialize shirt image with default or saved selection
if (selected && selected.image) {
    shirtImg.src = getCloudinaryUrl(selected.image);
} else {
    // Make sure you have a default image in Cloudinary
    shirtImg.src = getCloudinaryUrl("clothes/shirt/RedShirt_dkyvmdt"); // Update this path
}
shirtImg.onload = () => {
    shirtLoaded = true;
    console.log('✅ Default shirt image loaded');
};

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

    canvasCtx.save();
    canvasCtx.translate(width, 0);
    canvasCtx.scale(-1, 1);
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

    function pxMirrored(p) {
        return { x: (1 - p.x) * width, y: p.y * height };
    }

    const LM = results.poseLandmarks;
    const LS = pxMirrored(LM[11]); // shoulders
    const RS = pxMirrored(LM[12]);
    const LH = pxMirrored(LM[23]); // hips
    const RH = pxMirrored(LM[24]);
    const LK = pxMirrored(LM[25]); // knees
    const RK = pxMirrored(LM[26]);
    const LA = pxMirrored(LM[27]); // ankles
    const RA = pxMirrored(LM[28]);

    const itemName = (
      selected?.name ||
      selected?.product_name ||
      selected?.title ||
      "" 
    ).toLowerCase();
    const isBottom = /trouser|pant|jean|short|bottom|skirt|legging/.test(itemName);
    const isShort = /gear/.test(itemName);

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

        // Calculate dimensions based on whether it's shorts or trousers
        let drawW, drawH, drawY;
        
        if (isShort) {
            // For shorts - extend to just below knees
            drawW = waistWidth * 1.8; // Wider for shorts
            drawH = Math.max(30, Math.abs(kneeMid.y - hipMid.y) * 1.2); // Shorter length
            drawY = -drawH * 0.1; // Position slightly above hips for better fit
        } else {
            // For trousers/pants - extend to ankles
            drawW = waistWidth * 2.5; // Slightly narrower than shorts
            drawH = Math.max(40, legHeight * 1.4); // Longer length
            drawY = -drawH * 0.15; // Position at hips with slight overlap
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

// Camera control
async function startCamera() {
    console.log('📷 Starting camera...');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user",
            },
        });

        console.log('✅ Camera access granted');
        videoElement.style.display = 'none';
        videoElement.srcObject = stream;

        // Save permission to localStorage
        saveCameraPermission();

        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                resizeCanvasToVideo();
                videoElement.play().then(resolve).catch(resolve);
            };
            setTimeout(resolve, 2000);
        });

        startMediaPipeProcessing();
    } catch (error) {
        console.error('❌ Camera start failed:', error);
        // Don't show alert for common permission errors
        if (error.name !== 'NotAllowedError') {
            alert('Camera error: ' + error.message);
        }
    }
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

// Initialize - automatically start camera if permission was previously granted
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 Page loaded');
    
    // Check if camera permission was previously granted
    if (hasCameraPermission()) {
        console.log('🔑 Camera permission remembered - starting automatically');
        await startCamera();
    } else {
        // Only show start button if no permission was granted
        setupStartButton();
    }
});

// Simple fallback start button (only shows if no permission)
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
        
        // Hide button after successful start
        setTimeout(() => {
            startButton.style.display = 'none';
        }, 2000);
    };

    document.body.appendChild(startButton);
}

// Cleanup
window.addEventListener('beforeunload', () => {
    if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach((track) => track.stop());
    }
});
