// Add these variables at the top
let currentStream = null;
let currentFacingMode = "user"; // "user" = front, "environment" = back
let isImageFlipped = false;

// Camera control elements
let switchCameraBtn = null;
let flipImageBtn = null;

// Function to get available cameras
async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
        console.error('Error getting cameras:', error);
        return [];
    }
}

// Function to switch between front and back cameras
async function switchCamera() {
    if (currentStream) {
        // Stop current stream
        currentStream.getTracks().forEach(track => track.stop());
    }
    
    // Toggle between front and back camera
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    
    console.log(`🔄 Switching to ${currentFacingMode} camera`);
    
    try {
        await startCamera();
        updateCameraButtonText();
    } catch (error) {
        console.error('Error switching camera:', error);
        // Revert if failed
        currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    }
}

// Function to flip the canvas image (for back camera)
function flipImage() {
    isImageFlipped = !isImageFlipped;
    flipImageBtn.textContent = isImageFlipped ? '↕️ Unflip Image' : '↕️ Flip Image';
    console.log(`🔄 Image flipped: ${isImageFlipped}`);
}

// Update camera button text based on current camera
function updateCameraButtonText() {
    if (switchCameraBtn) {
        const cameraName = currentFacingMode === "user" ? "Back" : "Front";
        switchCameraBtn.textContent = `🔄 Switch to ${cameraName} Camera`;
    }
}

// Modified startCamera function with device selection
async function startCamera() {
    console.log('📷 Starting camera...');
    try {
        // Check if multiple cameras are available
        const cameras = await getCameras();
        const hasMultipleCameras = cameras.length > 1;
        
        console.log(`📹 Available cameras: ${cameras.length}`);
        
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: currentFacingMode
            },
        };
        
        // For devices with multiple cameras, be more specific
        if (hasMultipleCameras && cameras.length === 2) {
            // Get the deviceId for the desired camera
            const desiredCamera = cameras.find(device => 
                currentFacingMode === "user" ? 
                device.label.toLowerCase().includes('front') || !device.label.toLowerCase().includes('back') :
                device.label.toLowerCase().includes('back')
            );
            
            if (desiredCamera) {
                constraints.video.deviceId = { exact: desiredCamera.deviceId };
            }
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log('✅ Camera access granted');
        currentStream = stream;
        videoElement.style.display = 'none';
        videoElement.srcObject = stream;

        // Save permission to localStorage
        saveCameraPermission();

        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                resizeCanvasToVideo();
                videoElement.play().then(resolve).catch(resolve);
            };
            setTimeout(resolve, 2000);
        });

        // Show camera controls if multiple cameras available
        if (hasMultipleCameras) {
            showCameraControls();
        }
        
        // Update button text
        updateCameraButtonText();

        startMediaPipeProcessing();
    } catch (error) {
        console.error('❌ Camera start failed:', error);
        
        // If facingMode fails, try without specific facing mode
        if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
            console.log('🔄 Retrying without facing mode constraint...');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                });
                currentStream = stream;
                videoElement.srcObject = stream;
                await videoElement.play();
                startMediaPipeProcessing();
            } catch (fallbackError) {
                console.error('❌ Fallback camera start failed:', fallbackError);
            }
        }
        
        if (error.name !== 'NotAllowedError') {
            alert('Camera error: ' + error.message);
        }
    }
}

// Show camera control buttons
function showCameraControls() {
    if (switchCameraBtn) {
        switchCameraBtn.style.display = 'block';
    }
    if (flipImageBtn) {
        flipImageBtn.style.display = 'block';
    }
}

// Create camera control buttons
function createCameraControls() {
    const controlsContainer = document.querySelector('.camera-controls');
    
    if (!controlsContainer) {
        console.warn('❌ Camera controls container not found');
        return;
    }
    
    // Switch Camera Button
    switchCameraBtn = document.createElement('button');
    switchCameraBtn.id = 'switchCamera';
    switchCameraBtn.className = 'camera-btn';
    switchCameraBtn.style.display = 'none';
    switchCameraBtn.onclick = switchCamera;
    
    // Flip Image Button
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

// Modified onResults function to handle back camera flipping
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

    // Rest of your drawing code remains the same...
    if (!shirtLoaded || !results.poseLandmarks) {
        canvasCtx.fillStyle = 'white';
        canvasCtx.font = '18px Arial';
        canvasCtx.textAlign = 'center';
        canvasCtx.fillText('Stand in front of camera', width / 2, 50);
        canvasCtx.fillText('to try on clothes', width / 2, 80);
        return;
    }

    // Your existing pose detection and clothing drawing code...
    // ... (keep all your existing pose detection code)
}

// Update initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 Page loaded');
    
    // Create camera controls
    createCameraControls();
    
    // Load showroom context
    const showroom = loadShowroomContext();
    if (showroom) {
        console.log(`🎯 Came from showroom: ${showroom.name}`);
    }
    
    // Add back button if we have showroom context
    const backButton = createBackToShowroomButton();
    if (backButton) {
        const navButtons = document.getElementById('navigationButtons');
        if (navButtons) {
            navButtons.appendChild(backButton);
        }
    }
    
    // Check if camera permission was previously granted
    if (hasCameraPermission()) {
        console.log('🔑 Camera permission remembered - starting automatically');
        await startCamera();
    } else {
        setupStartButton();
    }
});

// Update cleanup to handle stream properly
window.addEventListener('beforeunload', () => {
    if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
    }
});
