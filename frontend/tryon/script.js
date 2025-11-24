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

// SUPER SIMPLE CAMERA FUNCTIONS
async function startCamera() {
    console.log('📷 Starting camera...');
    
    try {
        // Stop any existing stream
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        // MINIMAL constraints that work everywhere
        const constraints = {
            video: true // Let the browser choose the best camera
        };
        
        console.log('Using minimal constraints');
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Camera access granted');
        
        currentStream = stream;
        videoElement.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                console.log('Video ready - dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
                
                // Set canvas size to match video
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
                
                videoElement.play().then(resolve).catch(resolve);
            };
            // Fallback timeout
            setTimeout(resolve, 2000);
        });
        
        // Start MediaPipe processing
        startMediaPipeProcessing();
        
        // Hide any start button
        const startBtn = document.querySelector('.start-camera-btn');
        if (startBtn) startBtn.style.display = 'none';
        
        localStorage.setItem('cameraPermission', 'granted');
        
    } catch (error) {
        console.error('❌ Camera failed:', error);
        
        // Show error on canvas
        showCameraError(error);
        
        // Show start button again
        const startBtn = document.querySelector('.start-camera-btn');
        if (startBtn) {
            startBtn.style.display = 'block';
            startBtn.textContent = '🔄 Try Again';
            startBtn.disabled = false;
        }
    }
}

function showCameraError(error) {
    const ctx = canvasElement.getContext('2d');
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    
    if (error.name === 'NotAllowedError') {
        ctx.fillText('Camera permission denied', canvasElement.width / 2, canvasElement.height / 2 - 20);
        ctx.fillText('Please allow camera access and refresh', canvasElement.width / 2, canvasElement.height / 2 + 10);
    } else if (error.name === 'NotFoundError') {
        ctx.fillText('No camera found', canvasElement.width / 2, canvasElement.height / 2 - 20);
        ctx.fillText('Please check if your device has a camera', canvasElement.width / 2, canvasElement.height / 2 + 10);
    } else {
        ctx.fillText('Camera error: ' + error.message, canvasElement.width / 2, canvasElement.height / 2 - 20);
        ctx.fillText('Please refresh and try again', canvasElement.width / 2, canvasElement.height / 2 + 10);
    }
}

function startMediaPipeProcessing() {
    console.log('🔄 Starting MediaPipe...');
    
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            try {
                await pose.send({ image: videoElement });
            } catch (error) {
                console.error('MediaPipe error:', error);
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

// Product functions
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
        shirtImg.onload = () => {
            shirtLoaded = true;
            updateSelectedProductInfo(product);
        };
    }
}

// MediaPipe drawing function
function onResults(results) {
    if (!results || !results.image) return;

    const { width, height } = canvasElement;
    canvasCtx.clearRect(0, 0, width, height);

    // Draw camera feed (mirrored for front camera)
    canvasCtx.save();
    canvasCtx.translate(width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, width, height);
    canvasCtx.restore();

    // Show instructions if no clothing or pose
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

    const LS = pxMirrored(landmarks[11]); // Left shoulder
    const RS = pxMirrored(landmarks[12]); // Right shoulder
    const LH = pxMirrored(landmarks[23]); // Left hip
    const RH = pxMirrored(landmarks[24]); // Right hip

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

// Setup MediaPipe
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
    };

    document.body.appendChild(startButton);
}

// Event listener for product selection
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

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Try-on page loading...');
    
    // Set default shirt image
    shirtImg.src = getCloudinaryUrl("clothes/shirt/RedShirt_dkyvmdt");
    shirtImg.onload = () => {
        shirtLoaded = true;
        console.log('✅ Default shirt loaded');
    };
    
    // Load products
    await loadProductsForTryOn();
    
    // Auto-start camera if permission was granted before
    if (localStorage.getItem('cameraPermission') === 'granted') {
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
