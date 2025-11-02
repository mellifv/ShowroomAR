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
    modelComplexity: 0,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
});
pose.onResults(onResults);

// **FLEXIBLE CAMERA START - TRIES ALL OPTIONS**
async function startCamera() {
    console.log('📷 Starting camera...');
    
    const cameraOptions = [
        // Try back camera first
        { video: { facingMode: "environment" } },
        // Try front camera
        { video: { facingMode: "user" } },
        // Try without any specific camera (let browser choose)
        { video: true },
        // Try with basic constraints
        { video: { width: 640, height: 480 } }
    ];

    for (let i = 0; i < cameraOptions.length; i++) {
        try {
            console.log(`🔄 Trying camera option ${i + 1}:`, cameraOptions[i]);
            
            const stream = await navigator.mediaDevices.getUserMedia(cameraOptions[i]);
            console.log(`✅ Camera option ${i + 1} succeeded!`);
            
            // Connect stream to video element
            videoElement.srcObject = stream;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    videoElement.play()
                        .then(() => {
                            console.log('✅ Video is playing');
                            resolve();
                        })
                        .catch(error => {
                            console.error('Video play failed:', error);
                            resolve(); // Continue anyway
                        });
                };
                
                // Timeout fallback
                setTimeout(resolve, 2000);
            });

            // Start MediaPipe processing
            startMediaPipeProcessing();
            return; // Success - exit the loop
            
        } catch (error) {
            console.log(`❌ Camera option ${i + 1} failed:`, error.name);
            
            // If this is the last option, show error
            if (i === cameraOptions.length - 1) {
                showCameraError(error);
            }
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
        width: 320,
        height: 240
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
    let message = 'Camera error: ';
    
    switch (error.name) {
        case 'NotFoundError':
        case 'OverconstrainedError':
            message = '📱 No camera found or camera not accessible.\n\nPlease try:\n• Using a different browser (Chrome recommended)\n• Checking if another app is using the camera\n• Restarting your phone';
            break;
        case 'NotAllowedError':
            message = '📱 Camera permission denied.\n\nPlease:\n1. Allow camera access in browser settings\n2. Refresh the page\n3. Click "Allow" when prompted';
            break;
        case 'NotSupportedError':
            message = '📱 Camera not supported.\n\nTry using Chrome browser instead.';
            break;
        default:
            message = `📱 Camera error: ${error.message}`;
    }
    
    alert(message);
    updateStartButton('error');
}

// **SMART START BUTTON**
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
        startButton.textContent = '🔍 Finding Camera...';
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

// Check available cameras (for debugging)
async function listCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        console.log('📸 Available cameras:', cameras);
        return cameras;
    } catch (error) {
        console.error('Error listing cameras:', error);
        return [];
    }
}

// Auto-detect and start
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 Page loaded');
    
    // List available cameras for debugging
    await listCameras();
    
    setupStartButton();
    
    // Try to auto-start if we already have permission
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCameraPermission = devices.some(device => 
            device.kind === 'videoinput' && device.label
        );
        
        if (hasCameraPermission) {
            console.log('🔄 Auto-starting camera (previous permission detected)');
            setTimeout(() => {
                startButton.click();
            }, 1000);
        }
    } catch (error) {
        console.log('No previous camera permission');
    }
});

// Cleanup
window.addEventListener('beforeunload', () => {
    if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => {
            console.log('🛑 Stopping camera track');
            track.stop();
        });
    }
});
