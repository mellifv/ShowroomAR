// Use your actual API URL here
const API_BASE_URL = "https://showroomar-production.up.railway.app/api";

// Cloudinary helper function - FIXED VERSION
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

// iOS detection
function isIOS() {
    return [
        'iPad Simulator',
        'iPhone Simulator',
        'iPod Simulator',
        'iPad',
        'iPhone',
        'iPod'
    ].includes(navigator.platform) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document);
}

function applyIOSFixes() {
    if (isIOS()) {
        console.log('📱 iOS detected - applying fixes');
        
        // Add iOS-specific styles
        const style = document.createElement('style');
        style.textContent = `
            /* iOS-specific fixes */
            video {
                -webkit-transform: translateZ(0);
                transform: translateZ(0);
            }
            canvas {
                -webkit-transform: translateZ(0);
                transform: translateZ(0);
            }
        `;
        document.head.appendChild(style);
        
        // Force canvas redraw on orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                resizeCanvasToVideo();
            }, 300);
        });
    }
}

function setupVideoElementForIOS() {
    // iOS requires these attributes for proper video playback
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
    videoElement.muted = true;
    videoElement.preload = 'metadata';
    
    // Ensure video element is properly styled
    videoElement.style.position = 'absolute';
    videoElement.style.top = '0';
    videoElement.style.left = '0';
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.objectFit = 'cover';
    videoElement.style.display = 'none'; // Start hidden
}

function setupCameraRecovery() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => {
            track.addEventListener('ended', () => {
                console.log('📹 Camera track ended, attempting recovery...');
                setTimeout(() => {
                    startCamera().catch(console.error);
                }, 1000);
            });
        });
    }
}

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

// Function to create back button (use absolute path to avoid 404)
function createBackToShowroomButton() {
    const showroom = loadShowroomContext();
    if (!showroom) return null;

    const backButton = document.createElement('a');
    // Use absolute path to avoid relative path issues
    backButton.href = `/showroom/showroom.html?showroom=${showroom.id}`;
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
                clothingSelect.value = selected._id;
            };
        }
    }
}

// Add this function to load products from your API
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

// Function to populate the dropdown select with product names only
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

// Camera functions
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
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    console.log(`🔄 Switching to ${currentFacingMode} camera`);

    try {
        await startCamera();
        updateCameraButtonText();
    } catch (error) {
        console.error('Error switching camera:', error);
        currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    }
}

function flipImage() {
    isImageFlipped = !isImageFlipped;
    if (flipImageBtn) {
        flipImageBtn.textContent = isImageFlipped ? '↕️ Unflip Image' : '↕️ Flip Image';
    }
    console.log(`🔄 Image flipped: ${isImageFlipped}`);
}

function updateCameraButtonText() {
    if (switchCameraBtn) {
        const cameraName = currentFacingMode === "user" ? "Back" : "Front";
        switchCameraBtn.textContent = `🔄 Switch to ${cameraName} Camera`;
    }
}

// iOS-compatible camera start function
async function startCamera() {
    console.log('📷 Starting camera...');
    
    // Stop previous stream if any
    if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
        currentStream = null;
    }

    // iOS-specific constraints
    const constraints = {
        video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: { ideal: currentFacingMode },
            frameRate: { ideal: 30 }
        },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        videoElement.srcObject = stream;
        
        // iOS requires explicit plays and user interaction
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('webkit-playsinline', 'true');
        videoElement.muted = true;
        videoElement.style.display = 'block'; // Make visible for iOS
        
        saveCameraPermission();

        // Wait for video to be ready with better iOS handling
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Camera timeout'));
            }, 10000);

            videoElement.onloadedmetadata = () => {
                console.log('✅ Video metadata loaded');
                resizeCanvasToVideo();
                
                // iOS requires user gesture for video.play()
                videoElement.play().then(() => {
                    console.log('✅ Video playback started');
                    clearTimeout(timeout);
                    
                    // Hide video after it's playing (keep for iOS)
                    setTimeout(() => {
                        videoElement.style.display = 'none';
                    }, 1000);
                    
                    resolve(stream);
                }).catch(playError => {
                    console.warn('⚠️ Auto-play prevented, continuing anyway:', playError);
                    clearTimeout(timeout);
                    resolve(stream); // Resolve even if autoplay fails
                });
            };

            videoElement.onerror = (error) => {
                console.error('❌ Video error:', error);
                clearTimeout(timeout);
                reject(error);
            };
        });

        // Setup camera recovery
        setupCameraRecovery();

        // Show controls if multiple cameras exist
        const cameras = await getCameras();
        if (cameras.length > 1) {
            showCameraControls();
        }

        updateCameraButtonText();
        startMediaPipeProcessing();
        console.log('✅ Camera started successfully');
        return;

    } catch (error) {
        console.error('❌ Camera access failed:', error);
        
        // Provide user-friendly error messages
        if (error.name === 'NotAllowedError') {
            alert('Camera access was denied. Please allow camera permissions in your browser settings and refresh the page.');
        } else if (error.name === 'NotFoundError') {
            alert('No camera found. Please check if your device has a working camera.');
        } else {
            alert('Failed to access camera: ' + error.message);
        }
        throw error;
    }
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

// Main drawing function (kept your logic intact)
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
    const isShort = /jkjnl/.test(itemName);

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

// iOS-compatible start button
function setupStartButton() {
    const startButton = document.createElement('button');
    startButton.textContent = '🎥 Start Camera';
    startButton.id = 'cameraStartBtn';
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
        
        try {
            await startCamera();
            startButton.style.display = 'none';
            
            // Force a resize after camera starts
            setTimeout(() => {
                resizeCanvasToVideo();
            }, 500);
            
        } catch (error) {
            console.error('Failed to start camera:', error);
            startButton.textContent = '🎥 Start Camera';
            startButton.disabled = false;
        }
    };

    document.body.appendChild(startButton);
}

// Initialize everything
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 Page loaded');

    // Apply iOS fixes first
    applyIOSFixes();
    setupVideoElementForIOS();
    
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

    // Handle camera start based on platform
    if (isIOS()) {
        // Always show start button on iOS
        setupStartButton();
    } else if (hasCameraPermission()) {
        console.log('🔑 Camera permission remembered - starting automatically');
        await startCamera();
    } else {
        setupStartButton();
    }
    
    // Handle page visibility changes (important for iOS)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && currentStream) {
            // Page became visible again, restart camera if needed
            setTimeout(() => {
                if (!videoElement.srcObject) {
                    startCamera().catch(console.error);
                }
            }, 300);
        }
    });
});

// Cleanup
window.addEventListener('beforeunload', () => {
    if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
    }
});
