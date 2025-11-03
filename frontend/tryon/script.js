const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

const clothingSelect = document.getElementById("clothingSelect");
let clothingImage = new Image();
let selectedClothing = null;

// Position adjustment variable
let positionOffset = 0.05;
let isProcessing = false; // Prevent overlapping frame processing

// SIMPLIFIED canvas sizing - better performance
function resizeCanvasToVideo() {
  // Use fixed sizes for better performance
  if (window.innerWidth > window.innerHeight) {
    // Landscape
    canvasElement.width = 640;
    canvasElement.height = 480;
  } else {
    // Portrait (phone)
    canvasElement.width = 480;
    canvasElement.height = 640;
  }
  console.log(`Canvas resized to: ${canvasElement.width}x${canvasElement.height}`);
}

// Load clothing image when user selects it
clothingSelect.addEventListener("change", (e) => {
  const value = e.target.value;
  if (value && value !== "none") {
    clothingImage.src = value;
    selectedClothing = clothingImage;
  } else {
    selectedClothing = null;
  }
});

// OPTIMIZED pose processing with frame skipping
// FIXED VERSION - Correct rotation and positioning
function onResults(results) {
  if (isProcessing) return;
  isProcessing = true;

  requestAnimationFrame(() => {
    try {
      const { width, height } = canvasElement;
      canvasCtx.clearRect(0, 0, width, height);
      canvasCtx.drawImage(results.image, 0, 0, width, height);

      if (results.poseLandmarks && selectedClothing) {
        const lm = results.poseLandmarks;

        const leftShoulder = lm[11];
        const rightShoulder = lm[12];
        const leftHip = lm[23];
        const rightHip = lm[24];

        // Convert normalized coords to canvas coords
        const leftShoulderX = leftShoulder.x * width;
        const leftShoulderY = leftShoulder.y * height;
        const rightShoulderX = rightShoulder.x * width;
        const rightShoulderY = rightShoulder.y * height;

        const shoulderCenterX = (leftShoulderX + rightShoulderX) / 2;
        const shoulderCenterY = (leftShoulderY + rightShoulderY) / 2;

        const shoulderWidth = Math.abs(rightShoulderX - leftShoulderX);
        const hipCenterY = ((leftHip.y + rightHip.y) / 2) * height;

        // Calculate realistic clothing size
        const clothingWidth = shoulderWidth * 2.2; // slightly wider for natural fit
        const clothingHeight = (hipCenterY - shoulderCenterY) * 1.15;

        // Position: slightly below shoulders
        const x = shoulderCenterX - clothingWidth / 2;
        const y = shoulderCenterY - clothingHeight * (0.15 - positionOffset);

        // Draw clothing
        canvasCtx.drawImage(selectedClothing, x, y, clothingWidth, clothingHeight);

        // Debug markers (optional)
        // canvasCtx.fillStyle = "red";
        // canvasCtx.fillRect(leftShoulderX - 2, leftShoulderY - 2, 4, 4);
        // canvasCtx.fillRect(rightShoulderX - 2, rightShoulderY - 2, 4, 4);
      }
    } catch (e) {
      console.error("Render error:", e);
    } finally {
      isProcessing = false;
    }
  });
}


// SIMPLIFIED Pose configuration
const pose = new Pose({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 0, // LOWER complexity for better performance
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5, // LOWER for faster detection
  minTrackingConfidence: 0.5,  // LOWER for better tracking
});

pose.onResults(onResults);

// RELIABLE Camera initialization
async function initializeCamera() {
  try {
    console.log('🔄 Starting camera...');
    
    // Test camera access first
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 24 } // Lower FPS for stability
      } 
    });
    
    videoElement.srcObject = stream;
    
    // Wait for video to be ready
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play().then(resolve).catch(resolve);
      };
      setTimeout(resolve, 2000);
    });
    
    console.log('✅ Camera ready, starting MediaPipe...');
    
    // Start MediaPipe with error handling
    const camera = new Camera(videoElement, {
      onFrame: async () => {
        try {
          await pose.send({ image: videoElement });
        } catch (error) {
          console.warn('Frame processing skipped:', error);
        }
      },
      width: 640,  // Lower resolution for performance
      height: 480
    });
    
    await camera.start();
    console.log('✅ MediaPipe started successfully');
    
  } catch (error) {
    console.error('❌ Camera initialization failed:', error);
    
    let message = 'Camera error: ';
    if (error.name === 'NotAllowedError') {
      message = 'Camera permission denied. Please allow camera access and refresh.';
    } else if (error.name === 'NotFoundError') {
      message = 'No camera found on this device.';
    } else {
      message += error.message;
    }
    
    alert(message);
  }
}

// Position adjustment functions
function adjustPosition(change) {
  positionOffset = Math.max(-0.2, Math.min(0.3, positionOffset + change));
  updatePositionDisplay();
  console.log('Position offset:', positionOffset);
}

function resetPosition() {
  positionOffset = 0.05;
  updatePositionDisplay();
  console.log('Position reset to:', positionOffset);
}

function updatePositionDisplay() {
  const display = document.getElementById('positionDisplay');
  if (display) {
    display.textContent = positionOffset.toFixed(2);
  }
}

// Add position controls
function addPositionControls() {
  const controls = document.createElement('div');
  controls.innerHTML = `
    <div style="position: fixed; top: 10px; left: 10px; background: rgba(0,0,0,0.8); color: white; padding: 10px; z-index: 1000; border-radius: 10px; font-size: 14px;">
      <div style="margin-bottom: 8px; font-weight: bold;">🎯 Position Adjust:</div>
      <div style="margin-bottom: 5px;">Current: <span id="positionDisplay">${positionOffset.toFixed(2)}</span></div>
      <button onclick="adjustPosition(-0.05)" style="margin: 2px; padding: 6px 10px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">⬆️ Higher</button>
      <button onclick="adjustPosition(0.05)" style="margin: 2px; padding: 6px 10px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">⬇️ Lower</button>
      <button onclick="resetPosition()" style="margin: 2px; padding: 6px 10px; background: #ff9800; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">🔄 Reset</button>
    </div>
  `;
  document.body.appendChild(controls);
}

// Set default clothing
clothingImage.onload = () => {
  console.log('✅ Clothing image loaded');
  selectedClothing = clothingImage;
};
clothingImage.src = "shirt.png";

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 Page loaded, initializing...');
  resizeCanvasToVideo();
  addPositionControls();
  
  // Small delay to ensure everything is ready
  setTimeout(() => {
    initializeCamera();
  }, 500);
});

// Handle window resize
window.addEventListener('resize', () => {
  resizeCanvasToVideo();
});

// Cleanup when leaving page
window.addEventListener('beforeunload', () => {
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(track => track.stop());
  }
});

// Add manual restart function
function restartCamera() {
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(track => track.stop());
  }
  setTimeout(initializeCamera, 1000);
}
