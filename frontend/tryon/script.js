// Use your actual API URL here
const API_BASE_URL = "https://showroomar-production.up.railway.app/api";

// Cloudinary helper function
function getCloudinaryUrl(publicId, width = 800, height = 1200) {
    if (!publicId) return "";
    publicId = publicId.replace(/^\//, "").replace(/\.png$/, "");
    return `https://res.cloudinary.com/djwoojdrl/image/upload/${publicId}`;
}

// Global variables
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
let currentFacingMode = "user";
let isImageFlipped = false;
let switchCameraBtn = null;
let flipImageBtn = null;

// Check if camera permission was previously granted
function hasCameraPermission() {
    return localStorage.getItem('cameraPermission') === 'granted';
}

// Save camera permission status
function saveCameraPermission() {
    localStorage.setItem('cameraPermission', 'granted');
}

// Showroom navigation
function loadShowroomContext() {
    const saved = localStorage.getItem('currentShowroom');
    return saved ? JSON.parse(saved) : null;
}

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

// Product info display
function updateSelectedProductInfo(product) {
    const infoDiv = document.getElementById('selectedProductInfo');
    const nameElement = document.getElementById('selectedProductName');
    const priceElement = document.getElementById('selectedProductPrice');
    const categoryElement = document.getElementById('selectedProductCategory');
    
    if (product && infoDiv) {
        nameElement.textContent = product.name;
        priceElement.textContent = `Price: $${product.price}`;
        categoryElement.textContent = `Category: ${product.category}`;
        infoDiv.style.display = 'block';
    } else if (infoDiv) {
        infoDiv.style.display = 'none';
    }
}

// Product management
function loadSavedSelection() {
    const saved = localStorage.getItem("selectedModel");
    if (saved) {
        selected = JSON.parse(saved);
        if (selected && selected.image) {
            shirtImg.src = getCloudinaryUrl(selected.image);
            shirtImg.onload = () => {
                shirtLoaded = true;
                updateSelectedProductInfo(selected);
                if (clothingSelect) clothingSelect.value = selected._id;
            };
        }
    }
}

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

function populateClothingSelect() {
    if (!clothingSelect) return;
    
    clothingSelect.innerHTML = '<option value="none">Select a product...</option>';
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product._id;
        option.textContent = product.name;
        clothingSelect.appendChild(option);
    });
}

function selectProduct(productId) {
    const product = products.find(p => p._id === productId);
    if (product) {
        selected = product;
        localStorage.setItem("selectedModel", JSON.stringify(product));
        
        shirtImg.src = getCloudinaryUrl(product.image);
        shirtImg.onload = () => {
            shirtLoaded = true;
            updateSelectedProductInfo(product);
        };
        shirtImg.onerror = () => {
            console.error('Failed to load product image');
            shirtLoaded = false;
        };
    }
}

// SIMPLIFIED CAMERA FUNCTIONS - FIXED VERSION
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
    console.log('🔄 Switching camera...');
    
    // Stop current stream
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    
    // Toggle facing mode
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    
    try {
        await startCamera();
    } catch (error) {
        console.error('Camera switch failed:', error);
        alert('Unable to switch cameras. Your device might only have one camera.');
        // Revert facing mode
        currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    }
}

function flipImage() {
    isImageFlipped = !isImageFlipped;
    if (flipImageBtn) {
        flipImageBtn.textContent = isImageFlipped ? '↕️ Unflip Image' : '↕️ Flip Image';
    }
}

function updateCameraButtonText() {
    if (switchCameraBtn) {
        const cameraName = currentFacingMode === "user" ? "Back" : "Front";
        switchCameraBtn.textContent = `🔄 Switch to ${cameraName} Camera`;
    }
}

// SIMPLIFIED START CAMERA FUNCTION
async function startCamera() {
    console.log('📷 Starting camera...');
    
    try {
        // Basic constraints that work on most devices
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: currentFacingMode
            }
        };
        
        console.log('Using constraints:', constraints);
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Camera access granted');
        
        // Set up video element
        currentStream = stream;
        videoElement.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
            videoElement.onloadedmetadata = () => {
                console.log('Video metadata loaded');
                videoElement.play().then(resolve).catch(reject);
            };
            videoElement.onerror = reject;
            // Timeout fallback
            setTimeout(resolve, 3000);
        });
        
        // Set canvas size to match video
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        
        console.log('Video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        
        // Save permission and start processing
        saveCameraPermission();
        startMediaPipeProcessing();
        
        // Show camera controls if available
        const cameras = await getCameras();
        if (cameras.length > 1 && switchCameraBtn) {
            switchCameraBtn.style.display = 'block';
        }
        if (flipImageBtn) {
            flipImageBtn.style.display = 'block';
        }
        
        updateCameraButtonText();
        
    } catch (error) {
        console.error('❌ Camera start failed:', error);
        
        // Try fallback without facing mode
        if (error.name === 'OverconstrainedError' || error.name === 'NotFoundError') {
            console.log('🔄 Trying fallback camera access...');
            try {
                const fallbackConstraints = {
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                };
                
                const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                currentStream = stream;
                videoElement.srcObject = stream;
                await videoElement.play();
                startMediaPipeProcessing();
                
                // Hide switch button since we don't know which camera we have
                if (switchCameraBtn) switchCameraBtn.style.display = 'none';
                
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError);
                showCameraError();
            }
        } else if (error.name === 'NotAllowedError') {
            alert('Camera permission denied. Please allow camera access and refresh the page.');
        } else {
            showCameraError();
        }
    }
}

function showCameraError() {
    const canvas = document.getElementById('output_canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Camera not available', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillText('Please check permissions and try again', canvas.width / 2, canvas.height / 2 + 20);
    }
}

function createCameraControls() {
    const controlsContainer = document.querySelector('.camera-controls');
    if (!controlsContainer) {
        console.warn('Camera controls container not found');
        return;
    }
    
    // Switch camera button
    switchCameraBtn = document.createElement('button');
    switchCameraBtn.id = 'switchCamera';
    switchCameraBtn.className = 'camera-btn';
    switchCameraBtn.style.display = 'none';
    switchCameraBtn.onclick = switchCamera;
    
    // Flip image button
    flipImageBtn = document.createElement('button');
    flipImageBtn.id = 'flipImage';
    flipImageBtn.className = 'camera-btn';
    flipImageBtn.style.display = 'none';
    flipImageBtn.onclick = flipImage;
    flipImageBtn.textContent = '↕️ Flip Image';
    
    controlsContainer.appendChild(switchCameraBtn);
    controlsContainer.appendChild(flipImageBtn);
    
    updateCameraButtonText();
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
        console.log('✅ MediaPipe started successfully');
    }).catch((error) => {
        console.error('❌ MediaPipe failed to start:', error);
    });
}

// Main drawing function
function onResults(results) {
    if (!results || !results.image) {
        console.log('No results from MediaPipe');
        return;
    }

    const { width, height } = canvasElement;
    canvasCtx.clearRect(0, 0, width, height);

    // Draw camera feed
    if (currentFacingMode === "environment" && !isImageFlipped) {
        // Back camera - normal
        canvasCtx.drawImage(results.image, 0, 0, width, height);
    } else if (currentFacingMode === "environment" && isImageFlipped) {
        // Back camera - flipped
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

    // Show instruction text if no clothing loaded or no pose detected
    if (!shirtLoaded || !results.poseLandmarks) {
        canvasCtx.fillStyle = 'white';
        canvasCtx.font = '16px Arial';
        canvasCtx.textAlign = 'center';
        canvasCtx.fillText('Stand in front of camera', width / 2, 50);
        canvasCtx.fillText('to try on clothes', width / 2, 80);
        return;
    }

    // Draw clothing if loaded and pose detected
    if (shirtLoaded && results.poseLandmarks) {
        drawClothing(results.poseLandmarks, width, height);
    }
}

// Clothing drawing function
function drawClothing(landmarks, width, height) {
    function pxMirrored(p) {
        return { x: (1 - p.x) * width, y: p.y * height };
    }

    const LM = landmarks;
    const LS = pxMirrored(LM[11]); // Left shoulder
    const RS = pxMirrored(LM[12]); // Right shoulder
    const LH = pxMirrored(LM[23]); // Left hip
    const RH = pxMirrored(LM[24]); // Right hip

    const itemName = (selected?.name || "").toLowerCase();
    const isBottom = /trouser|pant|jean|short|bottom|skirt|legging/.test(itemName);

    if (!isBottom) {
        // Draw top
        const torsoTop = { x: (LS.x + RS.x) / 2, y: (LS.y + RS.y) / 2 };
        const torsoWidth = Math.hypot(RS.x - LS.x, RS.y - LS.y);
        const angle = Math.atan2(RS.y - LS.y, RS.x - LS.x);

        canvasCtx.save();
        canvasCtx.translate(torsoTop.x, torsoTop.y);
        canvasCtx.rotate(angle);

        const drawW = torsoWidth * 1.9;
        const drawH = drawW * 1.2; // Proportional height
        const drawX = -drawW / 2;
        const drawY = -drawH * 0.3;

        canvasCtx.drawImage(shirtImg, drawX, drawY, drawW, drawH);
        canvasCtx.restore();
    } else {
        // Draw bottom
        const hipMid = { x: (LH.x + RH.x) / 2, y: (LH.y + RH.y) / 2 };
        const waistWidth = Math.hypot(RH.x - LH.x, RH.y - LH.y);
        const angle = Math.atan2(RH.y - LH.y, RH.x - LH.x);

        canvasCtx.save();
        canvasCtx.translate(hipMid.x, hipMid.y);
        canvasCtx.rotate(angle);

        const drawW = waistWidth * 2.2;
        const drawH = drawW * 0.8;
        const drawX = -drawW / 2;
        const drawY = -drawH * 0.2;

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

// Start button for first-time users
function setupStartButton() {
    const startButton = document.createElement('button');
    startButton.textContent = '🎥 Start Camera';
    startButton.className = 'start-camera-btn';
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
            startButton.style.display = 'none';
        }, 2000);
    };

    document.body.appendChild(startButton);
}

// Event listeners
if (clothingSelect) {
    clothingSelect.addEventListener('change', function(e) {
        if (e.target.value === 'none') {
            selected = null;
            shirtLoaded = false;
            localStorage.removeItem("selectedModel");
            updateSelectedProductInfo(null);
        } else {
            selectProduct(e.target.value);
        }
    });
}

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Try-on page initializing...');
    
    // Check if required elements exist
    if (!videoElement) console.error('❌ videoElement not found');
    if (!canvasElement) console.error('❌ canvasElement not found');
    if (!clothingSelect) console.warn('⚠️ clothingSelect not found');
    
    // Create camera controls
    createCameraControls();
    
    // Add back button if coming from showroom
    const showroom = loadShowroomContext();
    if (showroom) {
        const backButton = createBackToShowroomButton();
        if (backButton) {
            const navButtons = document.getElementById('navigationButtons') || document.querySelector('.right-panel');
            if (navButtons) {
                navButtons.insertBefore(backButton, navButtons.firstChild);
            }
        }
    }
    
    // Load products and initialize shirt
    await loadProductsForTryOn();
    
    if (!selected || !selected.image) {
        shirtImg.src = getCloudinaryUrl("clothes/shirt/RedShirt_dkyvmdt");
    }
    shirtImg.onload = () => {
        shirtLoaded = true;
        console.log('✅ Shirt image loaded');
    };
    
    // Auto-start camera if permission granted, otherwise show start button
    if (hasCameraPermission()) {
        console.log('🔑 Camera permission remembered - starting automatically');
        await startCamera();
    } else {
        console.log('👆 Showing start camera button');
        setupStartButton();
    }
});

// Cleanup
window.addEventListener('beforeunload', () => {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
});
