// Camera functions - FIXED VERSION
async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        console.log('📹 Available cameras:', cameras.map(cam => ({
            label: cam.label,
            deviceId: cam.deviceId
        })));
        return cameras;
    } catch (error) {
        console.error('Error getting cameras:', error);
        return [];
    }
}

// Improved camera switching function
async function switchCamera() {
    console.log('🔄 Attempting to switch camera...');
    
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    
    try {
        const cameras = await getCameras();
        
        if (cameras.length < 2) {
            alert('Only one camera found on this device');
            return;
        }
        
        // Toggle between front and back
        currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
        console.log(`🔄 Switching to ${currentFacingMode} camera`);
        
        // Try different constraint approaches
        let constraints;
        
        if (currentFacingMode === "user") {
            // Front camera
            constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user"
                }
            };
        } else {
            // Back camera
            constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "environment"
                }
            };
        }
        
        console.log('🎯 Camera constraints:', constraints);
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        await handleNewStream(stream);
        
    } catch (error) {
        console.error('❌ Camera switch failed:', error);
        
        // Fallback: try deviceId-based switching
        await fallbackCameraSwitch();
    }
}

// Fallback method using deviceId
async function fallbackCameraSwitch() {
    try {
        console.log('🔄 Trying fallback camera switching...');
        const cameras = await getCameras();
        
        if (cameras.length < 2) {
            throw new Error('Only one camera available');
        }
        
        // Get current deviceId to switch to the other one
        const currentDeviceId = currentStream?.getVideoTracks()[0]?.getSettings()?.deviceId;
        const otherCamera = cameras.find(cam => cam.deviceId !== currentDeviceId);
        
        if (!otherCamera) {
            throw new Error('Could not find alternative camera');
        }
        
        console.log('🎯 Switching to camera:', otherCamera.label);
        
        const constraints = {
            video: {
                deviceId: { exact: otherCamera.deviceId },
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        await handleNewStream(stream);
        
        // Update facing mode based on camera label
        if (otherCamera.label.toLowerCase().includes('back') || 
            otherCamera.label.toLowerCase().includes('rear')) {
            currentFacingMode = "environment";
        } else {
            currentFacingMode = "user";
        }
        
    } catch (fallbackError) {
        console.error('❌ Fallback camera switch failed:', fallbackError);
        alert('Unable to switch cameras. Your device might only have one camera.');
        
        // Revert to original facing mode
        currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    }
}

// Handle new stream
async function handleNewStream(stream) {
    currentStream = stream;
    videoElement.srcObject = stream;
    
    await new Promise((resolve) => {
        videoElement.onloadedmetadata = () => {
            resizeCanvasToVideo();
            videoElement.play().then(resolve).catch(resolve);
        };
        setTimeout(resolve, 1000);
    });
    
    updateCameraButtonText();
    console.log('✅ Camera switched successfully');
}

// Improved startCamera function
async function startCamera() {
    console.log('📷 Starting camera...');
    try {
        const cameras = await getCameras();
        const hasMultipleCameras = cameras.length > 1;
        
        let constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: currentFacingMode
            }
        };
        
        console.log('🎯 Initial camera constraints:', constraints);
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log('✅ Camera access granted');
        currentStream = stream;
        videoElement.style.display = 'none';
        videoElement.srcObject = stream;
        
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
        } else {
            console.log('ℹ️ Only one camera detected, hiding switch button');
            if (switchCameraBtn) {
                switchCameraBtn.style.display = 'none';
            }
        }
        
        updateCameraButtonText();
        startMediaPipeProcessing();
        
    } catch (error) {
        console.error('❌ Camera start failed:', error);
        
        // More specific error handling
        if (error.name === 'NotAllowedError') {
            console.log('❌ Camera permission denied');
        } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
            console.log('🔄 Retrying with relaxed constraints...');
            await startCameraWithRelaxedConstraints();
        } else {
            console.error('❌ Unexpected camera error:', error);
        }
    }
}

// Fallback for when specific constraints fail
async function startCameraWithRelaxedConstraints() {
    try {
        console.log('🔄 Trying relaxed camera constraints...');
        
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 }
                // No facingMode specified
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        videoElement.srcObject = stream;
        
        await videoElement.play();
        startMediaPipeProcessing();
        
        // Hide switch button since we don't know which camera we got
        if (switchCameraBtn) {
            switchCameraBtn.style.display = 'none';
        }
        
        console.log('✅ Camera started with relaxed constraints');
        
    } catch (fallbackError) {
        console.error('❌ Relaxed constraints also failed:', fallbackError);
        alert('Cannot access camera. Please check permissions and try again.');
    }
}

// Update camera button visibility
function showCameraControls() {
    const cameras = getCameras().then(cameras => {
        if (cameras.length > 1) {
            if (switchCameraBtn) {
                switchCameraBtn.style.display = 'block';
            }
            if (flipImageBtn) {
                flipImageBtn.style.display = 'block';
            }
        } else {
            console.log('ℹ️ Only one camera detected');
            if (switchCameraBtn) {
                switchCameraBtn.style.display = 'none';
            }
        }
    });
}
