const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const clothingSelect = document.getElementById("clothingSelect");

console.log('🚀 Try-on script loaded');

// Remove the debug info div (it's blocking the camera view)
setTimeout(() => {
    const debugDiv = document.querySelector('[style*="background: #ff4444"]');
    if (debugDiv) debugDiv.remove();
}, 3000);

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

function onResults(results) {
    if (!videoElement.srcObject) return; // Don't process if no camera
    
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (!shirtLoaded || !results.poseLandmarks) return;

    const leftShoulder = results.poseLandmarks[11];
    const rightShoulder = results.poseLandmarks[12];
    const leftHip = results.poseLandmarks[23];
    const rightHip = results.poseLandmarks[24];

    const shoulderCenter = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 3,
    };
    const hipCenter = {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2,
    };

    const width = Math.abs(rightShoulder.x - leftShoulder.x) * canvasElement.width * 2;
    const height = Math.abs(hipCenter.y - shoulderCenter.y) * canvasElement.height * 1;

    const x = shoulderCenter.x * canvasElement.width - width / 2;
    const y = shoulderCenter.y * canvasElement.height - height * 0.25;

    canvasCtx.drawImage(shirtImg, x, y, width, height);
}

// Setup MediaPipe Pose
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
});
pose.setOptions({
    modelComplexity: 0, // Simple model for mobile
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
});
pose.onResults(onResults);

// **MAIN CAMERA START FUNCTION**
async function startCamera() {
    console.log('📷 Starting camera...');
    
    try {
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment", // Use back camera
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });

        console.log('✅ Camera access granted');
        
        // Connect stream to video element
        videoElement.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play().then(resolve).catch(console.error);
            };
        });

        console.log('✅ Video is playing');
        
        // Start MediaPipe processing
        startMediaPipeProcessing();
        
    } catch (error) {
        console.error('❌ Camera error:', error);
        alert('Camera error: ' + error.message);
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
        width: 320, // Lower resolution for mobile
        height: 240
    });
    
    camera.start().then(() => {
        console.log('✅ MediaPipe started');
    }).catch(error => {
        console.error('❌ MediaPipe failed:', error);
    });
}

// **MAKE SURE THE START BUTTON WORKS**
function setupStartButton() {
    const startBtn = document.createElement('button');
    startBtn.textContent = '🎥 Start Camera';
    startBtn.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        padding: 12px 20px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 25px;
        font-size: 16px;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    
    startBtn.onclick = async () => {
        startBtn.textContent = 'Starting...';
        startBtn.disabled = true;
        await startCamera();
        startBtn.style.display = 'none'; // Hide after starting
    };
    
    document.body.appendChild(startBtn);
}

// Auto-start when page loads (with user interaction)
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 Page loaded');
    setupStartButton();
    
    // Try auto-start after a short delay (some browsers allow this)
    setTimeout(() => {
        // Check if we already have camera permission
        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                const hasCameraPermission = devices.some(device => 
                    device.kind === 'videoinput' && device.label
                );
                if (hasCameraPermission) {
                    console.log('🔄 Auto-starting camera (has permission)');
                    startCamera();
                }
            })
            .catch(console.error);
    }, 1000);
});

// Cleanup
window.addEventListener('beforeunload', () => {
    if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
    }
});
