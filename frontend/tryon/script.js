// Use your actual API URL here
const API_BASE_URL = "https://showroomar-production.up.railway.app/api";

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

// Removed: facingMode, flip, switch buttons
// ============================================

// Showroom navigation
let currentShowroom = null;

// Restore saved showroom context
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

// CAMERA: only front-facing, no switch, no flip
// ========================================================

async function startCamera() {
    console.log('📷 Starting simple camera...');

    try {
        // Stop old stream if exists
        if (currentStream) {
            currentStream.getTracks().forEach(t => t.stop());
        }

        // Just grab default camera
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true
        });

        currentStream = stream;
        videoElement.srcObject = stream;

        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                resolve();
            };
        });

        canvasElement.width = videoElement.videoWidth || 640;
        canvasElement.height = videoElement.videoHeight || 480;

        console.log("Canvas:", canvasElement.width, canvasElement.height);

        localStorage.setItem("cameraPermission", "granted");
        startMediaPipeProcessing();

        const startBtn = document.querySelector('.start-camera-btn');
        if (startBtn) startBtn.style.display = 'none';

    } catch (error) {
        console.error("❌ Camera error:", error);
        showCameraError(error);
    }
}

// No camera switching needed
function showCameraError(error) {
    const ctx = canvasCtx;
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.fillStyle = 'white';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';

    let msg1, msg2;

    if (error.name === 'NotAllowedError') {
        msg1 = '📷 Camera Permission Required';
        msg2 = 'Please allow camera access';
    } else {
        msg1 = '📷 Camera Error';
        msg2 = 'Please refresh and try again';
    }

    ctx.fillText(msg1, canvasElement.width/2, canvasElement.height/2 - 30);
    ctx.fillText(msg2, canvasElement.width/2, canvasElement.height/2);

    const startBtn = document.querySelector('.start-camera-btn');
    if (startBtn) {
        startBtn.style.display = 'block';
        startBtn.textContent = '🔄 Try Again';
        startBtn.disabled = false;
    }
}

// MEDIA PIPE PROCESSING
// =========================================

function startMediaPipeProcessing() {
    console.log("🔄 Starting MediaPipe...");

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            try {
                await pose.send({ image: videoElement });
            } catch (e) {
                console.error("MediaPipe Error:", e);
            }
        },
        width: 640,
        height: 480
    });

    camera.start();
}

// RESULTS (no flip, no back-camera logic)
function onResults(results) {
    const { width, height } = canvasElement;
    canvasCtx.clearRect(0, 0, width, height);

    // Always draw mirrored (front camera behavior)
    canvasCtx.save();
    canvasCtx.translate(width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, width, height);
    canvasCtx.restore();

    if (!shirtLoaded || !results.poseLandmarks) {
        showInstructions(width, height);
        return;
    }

    drawClothingWithPrecision(results.poseLandmarks, width, height);
}

function showInstructions(width, height) {
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    canvasCtx.font = 'bold 18px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('🎯 Stand in front of the camera', width/2, 50);
    canvasCtx.fillText('👕 Select a product to try on', width/2, 80);
}

// Remaining clothing positioning functions stay unchanged
// =========================================================
// (drawClothingWithPrecision, drawTopWithPrecision, drawBottomWithPrecision, debug etc.)
// =========================================================


// Product selection logic stays unchanged
// =========================================================


// MEDIAPIPE CONFIG
const pose = new Pose({
    locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${f}`,
});
pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});
pose.onResults(onResults);


// START BUTTON
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
        font-weight: bold;
    `;

    startButton.onclick = async () => {
        startButton.textContent = 'Starting...';
        startButton.disabled = true;
        await startCamera();
    };

    document.body.appendChild(startButton);
}


// INIT
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Virtual Try-On Initializing (No back cam, no flip)");
    setupStartButton();

    const showroom = loadShowroomContext();
    if (showroom) {
        const backBtn = createBackToShowroomButton();
        const navButtons = document.getElementById('navigationButtons') 
            || document.querySelector('.right-panel');
        if (backBtn && navButtons) {
            navButtons.prepend(backBtn);
        }
    }

    loadProductsForTryOn();
});
