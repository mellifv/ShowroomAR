const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const clothingSelect = document.getElementById("clothingSelect");

console.log('🚀 Try-on script loaded');

const selected = JSON.parse(localStorage.getItem("selectedModel"));
let shirtImg = new Image();
let shirtLoaded = false;
shirtImg.src = selected ? selected.image : "shirt.png";
shirtImg.onload = () => (shirtLoaded = true);

// Change clothing
clothingSelect.addEventListener("change", () => {
    const newImg = new Image();
    shirtLoaded = false;
    newImg.src = clothingSelect.value;
    newImg.onload = () => {
        shirtImg = newImg;
        shirtLoaded = true;
    };
});

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
      selected?.image || ""
    ).toLowerCase();
    const isBottom = /trouser|pant|jean|short|bottom|legging/.test(itemName);
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

        // Calculate dimensions based on whether it's shorts or trousers
        let drawW, drawH, drawY;
        
        if (isShort) {
            // For shorts - extend to just below knees
            drawW = waistWidth * 1.8; // Wider for shorts
            drawH = Math.max(30, Math.abs(kneeMid.y - hipMid.y) * 1.2); // Shorter length
            drawY = -drawH * 0.1; // Position slightly above hips for better fit
        } else {
            // For trousers/pants - extend to ankles
            drawW = waistWidth * 1.7; // Slightly narrower than shorts
            drawH = Math.max(40, legHeight * 1.4); // Longer length
            drawY = -drawH * 0.15; // Position at hips with slight overlap
        }

        const drawX = -drawW / 2;

        canvasCtx.drawImage(shirtImg, drawX, drawY, drawW, drawH);
        canvasCtx.restore();
    
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
        alert('Camera error: ' + error.message);
        updateStartButton('error');
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
        updateStartButton('success');
    }).catch((error) => {
        console.error('❌ MediaPipe failed:', error);
        updateStartButton('error');
    });
}

// Start button UI
let startButton = null;

function setupStartButton() {
    startButton = document.createElement('button');
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
    };

    document.body.appendChild(startButton);
}

function updateStartButton(status) {
    if (!startButton) return;
    if (status === 'success') {
        startButton.textContent = '✅ Camera Active';
        startButton.style.background = '#4caf50';
        setTimeout(() => {
            startButton.style.display = 'none';
        }, 2000);
    } else if (status === 'error') {
        startButton.textContent = '🔄 Try Again';
        startButton.disabled = false;
        startButton.style.background = '#ff4444';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 Page loaded');
    setupStartButton();
});

// Cleanup
window.addEventListener('beforeunload', () => {
    if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach((track) => track.stop());
    }
});
