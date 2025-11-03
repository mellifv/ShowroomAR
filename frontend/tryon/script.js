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
function onResults(results) {
  // Skip frame if still processing previous one
  if (isProcessing) {
    return;
  }
  
  isProcessing = true;
  
  // Use requestAnimationFrame for smoother rendering
  requestAnimationFrame(() => {
    try {
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      // Draw camera feed
      canvasCtx.drawImage(
        results.image,
        0, 0, canvasElement.width, canvasElement.height
      );

      if (results.poseLandmarks && selectedClothing) {
        const landmarks = results.poseLandmarks;

        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];

        // Convert to canvas coordinates
        const leftShoulderX = leftShoulder.x * canvasElement.width;
        const leftShoulderY = leftShoulder.y * canvasElement.height;
        const rightShoulderX = rightShoulder.x * canvasElement.width;
        const rightShoulderY = rightShoulder.y * canvasElement.height;

        const shoulderWidth = Math.abs(rightShoulderX - leftShoulderX);
        const bodyHeight = Math.abs(
          ((leftHip.y + rightHip.y) / 2) * canvasElement.height - 
          ((leftShoulderY + rightShoulderY) / 2)
        );

        // Clothing sizing
        const clothingWidth = shoulderWidth * 1.8;
        const clothingHeight = bodyHeight * 1.3;
        
        const centerX = (leftShoulderX + rightShoulderX) / 2;
        const startY = ((leftShoulderY + rightShoulderY) / 2) + (clothingHeight * positionOffset);

        const shoulderAngle = Math.atan2(
          rightShoulderY - leftShoulderY,
          rightShoulderX - leftShoulderX
        );

        // Draw clothing
        canvasCtx.save();
        canvasCtx.translate(centerX, startY);
        canvasCtx.rotate(shoulderAngle);
        
        canvasCtx.drawImage(
          selectedClothing,
          -clothingWidth / 2,
          0,
          clothingWidth,
          clothingHeight
        );
        
        canvasCtx.restore();

        // Debug info (optional)
        canvasCtx.fillStyle = 'white';
        canvasCtx.font = '14px Arial';
        canvasCtx.fillText(`Position: ${positionOffset.toFixed(2)}`, 10, 20);
        canvasCtx.fillText(`FPS: Stable`, 10, 40);
      }
    } catch (error) {
      console.error('Rendering error:', error);
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
