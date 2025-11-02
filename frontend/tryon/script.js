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

function onResults(results) {
    if (!videoElement.srcObject) return;
    
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // ✅ FIX: Always show the camera feed
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // Show debug info on canvas
    canvasCtx.fillStyle = 'white';
    canvasCtx.font = '16px Arial';
    canvasCtx.fillText('Camera: Active | Pose: ' + (results.poseLandmarks ? 'Detected' : 'Searching'), 10, 30);

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
    modelComplexity: 0,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
});
pose.onResults(onResults);

// **FIXED CAMERA START WITH VISIBLE FEED**
async function startCamera() {
    console.log('📷 Starting camera...');
    
    try {
        // Try different camera options
        const constraints = { 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 30 }
            } 
        };

        console.log('🔄 Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Camera access granted');
        
        // ✅ FIX: Make sure video element is visible for testing
        videoElement.style.display = 'block';
        videoElement.style.width = '100%';
        videoElement.style.maxWidth = '400px';
        videoElement.style.margin = '10px auto';
        videoElement.style.border = '2px solid green';
        
        videoElement.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                console.log('✅ Video metadata loaded');
                videoElement.play()
                    .then(() => {
                        console.log('✅ Video is playing');
                        resolve();
                    })
                    .catch(error => {
                        console.error('❌ Video play failed:', error);
                        resolve();
                    });
            };
            
            // Timeout fallback
            setTimeout(resolve, 3000);
        });

        // ✅ TEST: Show raw camera feed temporarily
        showRawCameraFeed();
        
        // Start MediaPipe after a short delay
        setTimeout(startMediaPipeProcessing, 1000);
        
    } catch (error) {
        console.error('❌ Camera start failed:', error);
        showCameraError(error);
    }
}

// ✅ NEW: Show raw camera feed for testing
function showRawCameraFeed() {
    const testDiv = document.createElement('div');
    testDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 80px;
            left: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            z-index: 999;
            font-size: 12px;
        ">
            <div>📹 RAW CAMERA FEED:</div>
            <video id="testVideo" autoplay muted playsinline 
                   style="width: 150px; border: 2px solid red; margin: 5px 0;"></video>
            <div>🎯 POSE DETECTION:</div>
            <canvas id="testCanvas" width="150" height="100" 
                    style="border: 2px solid blue; margin: 5px 0;"></canvas>
        </div>
    `;
    document.body.appendChild(testDiv);
    
    // Show raw video feed
    const testVideo = document.getElementById('testVideo');
    const testCanvas = document.getElementById('testCanvas');
    const testCtx = testCanvas.getContext('2d');
    
    if (videoElement.srcObject) {
        testVideo.srcObject = videoElement.srcObject;
        testVideo.play();
        
        // Update test canvas periodically
        setInterval(() => {
            testCtx.drawImage(testVideo, 0, 0, testCanvas.width, testCanvas.height);
        }, 100);
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
        height: 480
    });
    
    camera.start().then(() => {
        console.log('✅ MediaPipe started');
        updateStartButton('success');
    }).catch(error => {
        console.error('❌ MediaPipe failed:', error);
        updateStartButton('error');
    });
}

function showCameraError(error) {
    let message = 'Camera error: ' + error.message;
    alert(message);
    updateStartButton('error');
}

// Start button
let startButton = null;

function setupStartButton() {
    startButton = document.createElement('button');
    startButton.textContent = '🎥 Start Camera';
    startButton.id = 'cameraStartBtn';
    startButton.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        padding: 15px 25px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 25px;
        font-size: 18px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        font-weight: bold;
    `;
    
    startButton.onclick = async () => {
        startButton.textContent = '🔍 Starting...';
        startButton.disabled = true;
        startButton.style.background = '#ff9800';
        await startCamera();
    };
    
    document.body.appendChild(startButton);
}

function updateStartButton(status) {
    if (!startButton) return;
    
    switch (status) {
        case 'success':
            startButton.textContent = '✅ Camera Active';
            startButton.style.background = '#4caf50';
            setTimeout(() => {
                startButton.style.display = 'none';
            }, 2000);
            break;
        case 'error':
            startButton.textContent = '🔄 Try Again';
            startButton.disabled = false;
            startButton.style.background = '#ff4444';
            break;
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
        videoElement.srcObject.getTracks().forEach(track => {
            track.stop();
        });
    }
});
