// Use your actual API URL here
const API_BASE_URL = "https://showroomar-production.up.railway.app/api";

// Cloudinary helper function
function getCloudinaryUrl(publicId) {
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
let currentStream = null;

// ==================== ULTRA-SIMPLE CAMERA SOLUTION ====================
async function startCamera() {
    console.log('📷 Starting camera...');
    
    try {
        // Stop any existing stream
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        // SIMPLEST POSSIBLE CONSTRAINTS - This works on 99% of devices
        const constraints = { video: true };
        
        console.log('🎯 Using constraints:', constraints);
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Camera access granted');
        
        currentStream = stream;
        videoElement.srcObject = stream;
        
        // Wait for video to be ready with better error handling
        await new Promise((resolve, reject) => {
            let resolved = false;
            
            const onReady = () => {
                if (resolved) return;
                resolved = true;
                console.log('🎥 Video metadata loaded');
                videoElement.play().then(resolve).catch(reject);
            };
            
            videoElement.onloadedmetadata = onReady;
            videoElement.oncanplay = onReady;
            
            // Fallback timeout
            setTimeout(() => {
                if (!resolved) {
                    console.log('⏰ Video timeout - proceeding anyway');
                    resolve();
                }
            }, 3000);
        });
        
        // Set canvas size
        canvasElement.width = videoElement.videoWidth || 640;
        canvasElement.height = videoElement.videoHeight || 480;
        
        console.log('📐 Canvas size:', canvasElement.width, 'x', canvasElement.height);
        
        // Save permission and start processing
        localStorage.setItem('cameraPermission', 'granted');
        startMediaPipeProcessing();
        
        // Hide start button
        const startBtn = document.querySelector('.start-camera-btn');
        if (startBtn) startBtn.style.display = 'none';
        
        console.log('🚀 Camera started successfully');
        
    } catch (error) {
        console.error('❌ Camera failed completely:', error);
        showCameraError(error);
    }
}

function showCameraError(error) {
    const ctx = canvasElement.getContext('2d');
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.fillStyle = 'white';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    
    let message1, message2;
    
    if (error.name === 'NotAllowedError') {
        message1 = '📷 Camera Permission Required';
        message2 = 'Please allow camera access in your browser settings';
    } else if (error.name === 'NotFoundError') {
        message1 = '📷 No Camera Found';
        message2 = 'Please check if your device has a camera';
    } else {
        message1 = '📷 Camera Error';
        message2 = 'Please refresh and try again';
    }
    
    ctx.fillText(message1, canvasElement.width / 2, canvasElement.height / 2 - 30);
    ctx.fillText(message2, canvasElement.width / 2, canvasElement.height / 2);
    
    // Show retry button
    const startBtn = document.querySelector('.start-camera-btn');
    if (startBtn) {
        startBtn.style.display = 'block';
        startBtn.textContent = '🔄 Try Again';
        startBtn.disabled = false;
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
        console.log('✅ MediaPipe started successfully');
    }).catch((error) => {
        console.error('❌ MediaPipe failed:', error);
    });
}

// ==================== PRECISE SHOULDER POSITIONING ====================
function onResults(results) {
    if (!results || !results.image) {
        console.log('No results from MediaPipe');
        return;
    }

    const { width, height } = canvasElement;
    canvasCtx.clearRect(0, 0, width, height);

    // Draw mirrored camera feed (front camera)
    canvasCtx.save();
    canvasCtx.translate(width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, width, height);
    canvasCtx.restore();

    // Show instructions if no clothing or pose
    if (!shirtLoaded || !results.poseLandmarks) {
        showInstructions(width, height);
        return;
    }

    // Draw clothing with PRECISE shoulder positioning
    drawClothingWithPrecision(results.poseLandmarks, width, height);
}

function showInstructions(width, height) {
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    canvasCtx.font = 'bold 18px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('🎯 Stand in front of camera', width / 2, 50);
    canvasCtx.fillText('👕 Select a product to try on', width / 2, 80);
    
    // Add pose detection status
    if (!shirtLoaded) {
        canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        canvasCtx.font = '14px Arial';
        canvasCtx.fillText('Waiting for product selection...', width / 2, 110);
    }
}

// ==================== PRECISE CLOTHING POSITIONING ====================
function drawClothingWithPrecision(landmarks, width, height) {
    // Convert landmarks to canvas coordinates
    function toCanvas(p) {
        return { x: (1 - p.x) * width, y: p.y * height };
    }

    // Get key landmarks
    const leftShoulder = toCanvas(landmarks[11]);
    const rightShoulder = toCanvas(landmarks[12]);
    const leftHip = toCanvas(landmarks[23]);
    const rightHip = toCanvas(landmarks[24]);
    const leftElbow = toCanvas(landmarks[13]);
    const rightElbow = toCanvas(landmarks[14]);

    // Calculate shoulder line
    const shoulderCenter = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2
    };

    // Calculate shoulder width and angle
    const shoulderWidth = Math.sqrt(
        Math.pow(rightShoulder.x - leftShoulder.x, 2) + 
        Math.pow(rightShoulder.y - leftShoulder.y, 2)
    );

    const shoulderAngle = Math.atan2(
        rightShoulder.y - leftShoulder.y, 
        rightShoulder.x - leftShoulder.x
    );

    // Calculate torso height (shoulders to hips)
    const hipCenter = {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2
    };

    const torsoHeight = Math.sqrt(
        Math.pow(hipCenter.x - shoulderCenter.x, 2) + 
        Math.pow(hipCenter.y - shoulderCenter.y, 2)
    );

    const itemName = (selected?.name || "").toLowerCase();
    const isBottom = /trouser|pant|jean|short|bottom|skirt|legging/.test(itemName);

    if (!isBottom) {
        // ========== PRECISE TOP POSITIONING ==========
        drawTopWithPrecision(
            shoulderCenter, 
            shoulderWidth, 
            shoulderAngle, 
            torsoHeight,
            leftShoulder,
            rightShoulder
        );
    } else {
        // ========== PRECISE BOTTOM POSITIONING ==========
        drawBottomWithPrecision(
            hipCenter,
            shoulderWidth,
            shoulderAngle,
            torsoHeight
        );
    }

    // DEBUG: Draw shoulder points (remove in production)
    drawDebugPoints([leftShoulder, rightShoulder, shoulderCenter]);
}

function drawTopWithPrecision(shoulderCenter, shoulderWidth, shoulderAngle, torsoHeight, leftShoulder, rightShoulder) {
    canvasCtx.save();
    
    // Position at shoulder center
    canvasCtx.translate(shoulderCenter.x, shoulderCenter.y);
    canvasCtx.rotate(shoulderAngle);

    // Calculate dimensions based on body proportions
    const clothingWidth = shoulderWidth * 2.2;  // Wider than shoulders
    const clothingHeight = torsoHeight * 1.8;   // Extend below hips
    
    // Position so shoulders align with top of clothing
    const drawX = -clothingWidth / 2;
    const drawY = -clothingHeight * 0.15;  // Start above shoulder line

    // Draw the clothing
    canvasCtx.drawImage(shirtImg, drawX, drawY, clothingWidth, clothingHeight);
    
    canvasCtx.restore();

    // DEBUG: Log positioning info
    console.log('👕 Top Positioning:', {
        shoulderCenter,
        shoulderWidth: Math.round(shoulderWidth),
        clothingWidth: Math.round(clothingWidth),
        clothingHeight: Math.round(clothingHeight),
        angle: Math.round(shoulderAngle * 180 / Math.PI) + '°'
    });
}

function drawBottomWithPrecision(hipCenter, shoulderWidth, shoulderAngle, torsoHeight) {
    canvasCtx.save();
    
    // Position at hips
    canvasCtx.translate(hipCenter.x, hipCenter.y);
    canvasCtx.rotate(shoulderAngle);

    // Calculate dimensions
    const clothingWidth = shoulderWidth * 1.8;
    const clothingHeight = torsoHeight * 1.4;
    
    // Position at waist level
    const drawX = -clothingWidth / 2;
    const drawY = -clothingHeight * 0.3;

    canvasCtx.drawImage(shirtImg, drawX, drawY, clothingWidth, clothingHeight);
    canvasCtx.restore();

    console.log('👖 Bottom Positioning:', {
        hipCenter,
        clothingWidth: Math.round(clothingWidth),
        clothingHeight: Math.round(clothingHeight)
    });
}

// DEBUG: Visualize key points (remove in production)
function drawDebugPoints(points) {
    if (!window.showDebugPoints) return;
    
    points.forEach((point, index) => {
        canvasCtx.fillStyle = index === 2 ? 'red' : 'blue';
        canvasCtx.beginPath();
        canvasCtx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
        canvasCtx.fill();
        
        canvasCtx.fillStyle = 'white';
        canvasCtx.font = '12px Arial';
        canvasCtx.fillText(['LS', 'RS', 'SC'][index] || 'P', point.x + 8, point.y - 8);
    });
}

// ==================== PRODUCT MANAGEMENT ====================
function updateSelectedProductInfo(product) {
    const infoDiv = document.getElementById('selectedProductInfo');
    if (!infoDiv) return;
    
    if (product) {
        document.getElementById('selectedProductName').textContent = product.name;
        document.getElementById('selectedProductPrice').textContent = `$${product.price}`;
        document.getElementById('selectedProductCategory').textContent = product.category;
        infoDiv.style.display = 'block';
    } else {
        infoDiv.style.display = 'none';
    }
}

async function loadProductsForTryOn() {
    try {
        if (!clothingSelect) return;
        
        clothingSelect.innerHTML = '<option value="none">Loading products...</option>';
        const response = await fetch(`${API_BASE_URL}/products`);
        products = await response.json();
        
        clothingSelect.innerHTML = '<option value="none">Select a product...</option>';
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product._id;
            option.textContent = product.name;
            clothingSelect.appendChild(option);
        });
        
        // Load saved selection
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
        
    } catch (error) {
        console.error('Error loading products:', error);
        if (clothingSelect) {
            clothingSelect.innerHTML = '<option value="none">Error loading products</option>';
        }
    }
}

function selectProduct(productId) {
    const product = products.find(p => p._id === productId);
    if (product) {
        selected = product;
        localStorage.setItem("selectedModel", JSON.stringify(product));
        
        shirtImg.src = getCloudinaryUrl(product.image);
        console.log('🔄 Loading product:', product.name);
        
        shirtImg.onload = () => {
            shirtLoaded = true;
            updateSelectedProductInfo(product);
            console.log('✅ Product loaded successfully');
        };
        
        shirtImg.onerror = () => {
            console.error('❌ Failed to load product image');
            shirtLoaded = false;
        };
    }
}

// ==================== MEDIAPIPE SETUP ====================
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
});
pose.setOptions({
    modelComplexity: 1,  // Higher accuracy for better shoulder detection
    smoothLandmarks: true,
    minDetectionConfidence: 0.7,  // Higher confidence threshold
    minTrackingConfidence: 0.7,
});
pose.onResults(onResults);

// ==================== INITIALIZATION ====================
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
    };

    document.body.appendChild(startButton);
}

// Event listener
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

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Virtual Try-On Initializing...');
    
    // Set default shirt
    shirtImg.src = getCloudinaryUrl("clothes/shirt/RedShirt_dkyvmdt");
    shirtImg.onload = () => {
        shirtLoaded = true;
        console.log('✅ Default shirt loaded');
    };
    
    // Load products
    await loadProductsForTryOn();
    
    // Auto-start or show button
    if (localStorage.getItem('cameraPermission') === 'granted') {
        console.log('🔑 Auto-starting camera...');
        await startCamera();
    } else {
        console.log('👆 Showing start button');
        setupStartButton();
    }
    
    // Enable debug points with ?debug=true in URL
    const urlParams = new URLSearchParams(window.location.search);
    window.showDebugPoints = urlParams.has('debug');
});

// Cleanup
window.addEventListener('beforeunload', () => {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
});
