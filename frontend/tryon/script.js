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
let currentFacingMode = "user";
let isImageFlipped = false;
let switchCameraBtn = null;
let flipImageBtn = null;

// Showroom navigation
let currentShowroom = null;

// Check if camera permission was previously granted
function hasCameraPermission() {
    return localStorage.getItem('cameraPermission') === 'granted';
}

// Save camera permission status
function saveCameraPermission() {
    localStorage.setItem('cameraPermission', 'granted');
}

// Showroom context functions
function loadShowroomContext() {
    const saved = localStorage.getItem('currentShowroom');
    return saved ? JSON.parse(saved) : null;
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

// Product info display
function updateSelectedProductInfo(product) {
    const infoDiv = document.getElementById('selectedProductInfo');
    if (!infoDiv) return;
    
    if (product) {
        document.getElementById('selectedProductName').textContent = product.name;
        document.getElementById('selectedProductPrice').textContent = `Price: $${product.price}`;
        document.getElementById('selectedProductCategory').textContent = `Category: ${product.category}`;
        infoDiv.style.display = 'block';
    } else {
        infoDiv.style.display = 'none';
    }
}

// Load saved selection
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

// Load products
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
        updateCameraButtonText();
    } catch (error) {
        console.error('Camera switch failed:', error);
        // Revert on failure
        currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
        alert('Unable to switch cameras. Your device might only have one camera.');
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

// SIMPLIFIED AND ROBUST START CAMERA FUNCTION
async function startCamera() {
    console.log('📷 Starting camera...');
    
    // Stop any existing stream
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }

    try {
        // Get available cameras first
        const cameras = await getCameras();
        console.log(`📹 Found ${cameras.length} cameras`);
        
        let stream;
        
        // Try different approaches based on camera count and facing mode
        if (cameras.length === 0) {
            throw new Error('No cameras found on this device');
        }
        
        if (cameras.length === 1) {
            // Single camera - use basic constraints
            console.log('📹 Using single camera approach');
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
        } else {
            // Multiple cameras - try to select based on facing mode
            console.log(`📹 Trying to select ${currentFacingMode} camera`);
            
            try {
                // First try with facingMode constraint
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: currentFacingMode
                    }
                });
                console.log(`✅ Successfully got ${currentFacingMode} camera using facingMode`);
            } catch (facingError) {
                console.warn(`⚠️ facingMode ${currentFacingMode} failed, trying device selection`);
                
                // Fallback: try to select by deviceId based on camera labels
                let targetDeviceId = null;
                
                if (currentFacingMode === "environment") {
                    // Look for back camera
                    const backCamera = cameras.find(cam => 
                        cam.label.toLowerCase().includes('back') || 
                        cam.label.toLowerCase().includes('rear')
                    );
                    targetDeviceId = backCamera ? backCamera.deviceId : cameras[cameras.length - 1].deviceId;
                } else {
                    // Look for front camera
                    const frontCamera = cameras.find(cam => 
                        cam.label.toLowerCase().includes('front') || 
                        cam.label.toLowerCase().includes('user')
                    );
                    targetDeviceId = frontCamera ? frontCamera.deviceId : cameras[0].deviceId;
                }
                
                if (targetDeviceId) {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            deviceId: { exact: targetDeviceId },
                            width: { ideal: 640 },
                            height: { ideal: 480 }
                        }
                    });
                    console.log(`✅ Successfully got camera using deviceId`);
                } else {
                    throw new Error('Could not determine target camera');
                }
            }
        }

        // Set up the stream
        currentStream = stream;
        videoElement.srcObject = stream;
        videoElement.style.display = 'none';
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
            videoElement.onloadedmetadata = () => {
                console.log('🎥 Video ready - dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
                resizeCanvasToVideo();
                videoElement.play().then(resolve).catch(reject);
            };
            videoElement.onerror = reject;
            setTimeout(resolve, 3000); // Fallback timeout
        });
        
        // Save permission and update UI
        saveCameraPermission();
        
        // Show camera controls if multiple cameras
        if (cameras.length > 1) {
            showCameraControls();
        } else {
            if (switchCameraBtn) switchCameraBtn.style.display = 'none';
        }
        
        updateCameraButtonText();
        startMediaPipeProcessing();
        
        console.log('✅ Camera started successfully');
        
    } catch (error) {
        console.error('❌ Camera start failed:', error);
        
        // Final fallback: try with minimal constraints
        if (error.name !== 'NotAllowedError') {
            console.log('🔄 Trying final fallback with minimal constraints...');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                currentStream = stream;
                videoElement.srcObject = stream;
                await videoElement.play();
                startMediaPipeProcessing();
                console.log('✅ Camera started with minimal constraints fallback');
            } catch (finalError) {
                console.error('❌ All camera attempts failed:', finalError);
                showCameraError(finalError);
            }
        } else {
            showCameraError(error);
        }
    }
}

function showCameraError(error) {
    const ctx = canvasElement.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    
    let message1 = 'Camera Error';
    let message2 = 'Please check permissions';
    
    if (error.name === 'NotAllowedError') {
        message1 = 'Camera Permission Required';
        message2 = 'Please allow camera access and refresh';
    } else if (error.name === 'NotFoundError') {
        message1 = 'No Camera Found';
        message2 = 'Please check if your device has a camera';
    }
    
    ctx.fillText(message1, canvasElement.width / 2, canvasElement.height / 2 - 20);
    ctx.fillText(message2, canvasElement.width / 2, canvasElement.height / 2 + 10);
}

function showCameraControls() {
    if (switchCameraBtn) {
        switchCameraBtn.style.display = 'block';
    }
    if (flipImageBtn) {
        flipImageBtn.style.display = 'block';
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

// Canvas functions
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
    if (!results || !results.image) return;

    const { width, height } = canvasElement;
    canvasCtx.clearRect(0, 0, width, height);

    // Draw camera feed with proper orientation
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
        // Front camera - mirrored
        canvasCtx.save();
        canvasCtx.translate(width, 0);
        canvasCtx.scale(-1, 1);
        canvasCtx.drawImage(results.image, 0, 0, width, height);
        canvasCtx.restore();
    }

    // Show instructions if needed
    if (!shirtLoaded || !results.poseLandmarks) {
        canvasCtx.fillStyle = 'white';
        canvasCtx.font = '16px Arial';
        canvasCtx.textAlign = 'center';
        canvasCtx.fillText('Stand in front of camera', width / 2, 50);
        canvasCtx.fillText('Select a product to try on', width / 2, 80);
        return;
    }

    // Draw clothing
    drawClothing(results.poseLandmarks, width, height);
}

function drawClothing(landmarks, width, height) {
    function pxMirrored(p) {
        return { x: (1 - p.x) * width, y: p.y * height };
    }

    const LS = pxMirrored(landmarks[11]);
    const RS = pxMirrored(landmarks[12]);
    const LH = pxMirrored(landmarks[23]);
    const RH = pxMirrored(landmarks[24]);

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
        const drawH = drawW * 1.2;
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

// MediaPipe setup
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
});
pose.setOptions({
    modelComplexity: 0,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
});
pose.onResults(onResults);

// Start button
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

// Initialize everything
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Try-on page initializing...');
    
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
    
    // Auto-start camera if permission granted
    if (hasCameraPermission()) {
        console.log('🔑 Auto-starting camera...');
        await startCamera();
    } else {
        console.log('👆 Showing start button');
        setupStartButton();
    }
});

// Cleanup
window.addEventListener('beforeunload', () => {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
});
