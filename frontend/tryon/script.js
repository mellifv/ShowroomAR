const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

const clothingSelect = document.getElementById("clothingSelect");
let clothingImage = new Image();
let selectedClothing = null;

// Position adjustment variable
let positionOffset = 0.05; // Default starting position

// Maintain aspect ratio automatically
function resizeCanvasToVideo(video) {
  const videoRatio = video.videoWidth / video.videoHeight;
  const screenRatio = window.innerWidth / window.innerHeight;

  // Adjust canvas size based on device orientation
  if (screenRatio > 1) {
    // landscape
    canvasElement.width = 960;
    canvasElement.height = 540;
  } else {
    // portrait (phone)
    canvasElement.width = 720;
    canvasElement.height = 960;
  }
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

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  if (results.poseLandmarks && selectedClothing) {
    const landmarks = results.poseLandmarks;

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    const leftShoulderX = leftShoulder.x * canvasElement.width;
    const leftShoulderY = leftShoulder.y * canvasElement.height;
    const rightShoulderX = rightShoulder.x * canvasElement.width;
    const rightShoulderY = rightShoulder.y * canvasElement.height;

    const shoulderWidth = Math.abs(rightShoulderX - leftShoulderX);
    const bodyHeight = Math.abs(
      ((leftHip.y + rightHip.y) / 2) * canvasElement.height - 
      ((leftShoulderY + rightShoulderY) / 2)
    );

    // **ADJUSTABLE CLOTHING SIZE**
    const clothingWidth = shoulderWidth * 1.8;
    const clothingHeight = bodyHeight * 1.3;
    
    const centerX = (leftShoulderX + rightShoulderX) / 2;
    
    // **FINE-TUNED POSITIONING - USES positionOffset VARIABLE**
    const startY = ((leftShoulderY + rightShoulderY) / 2) + (clothingHeight * positionOffset);

    const shoulderAngle = Math.atan2(
      rightShoulderY - leftShoulderY,
      rightShoulderX - leftShoulderX
    );

    canvasCtx.save();
    canvasCtx.translate(centerX, startY);
    canvasCtx.rotate(shoulderAngle);
    
    canvasCtx.drawImage(
      selectedClothing,
      -clothingWidth / 2,
      0, // Start drawing from shoulder level
      clothingWidth,
      clothingHeight
    );
    
    canvasCtx.restore();

    // **DEBUG VISUALS**
    canvasCtx.fillStyle = 'rgba(255, 0, 0, 0.7)';
    canvasCtx.fillRect(leftShoulderX - 5, leftShoulderY - 5, 10, 10);
    canvasCtx.fillRect(rightShoulderX - 5, rightShoulderY - 5, 10, 10);
    
    canvasCtx.fillStyle = 'rgba(0, 0, 255, 0.7)';
    canvasCtx.fillRect(centerX - 3, startY - 3, 6, 6);
    
    // Draw line showing clothing start position
    canvasCtx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
    canvasCtx.beginPath();
    canvasCtx.moveTo(centerX - 50, startY);
    canvasCtx.lineTo(centerX + 50, startY);
    canvasCtx.stroke();
    
    // Show current offset value on screen
    canvasCtx.fillStyle = 'white';
    canvasCtx.font = '16px Arial';
    canvasCtx.fillText(`Position: ${positionOffset.toFixed(2)}`, 10, 30);
  }

  canvasCtx.restore();
}

// **ENHANCED POSE CONFIGURATION FOR BETTER TRACKING**
const pose = new Pose({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.7,    // Higher for better accuracy
  minTrackingConfidence: 0.7,     // Higher for stable tracking
});

pose.onResults(onResults);

// **POSITION ADJUSTMENT FUNCTIONS**
function adjustPosition(change) {
  positionOffset += change;
  console.log('Position offset:', positionOffset);
  
  // Update the display if it exists
  const display = document.getElementById('positionDisplay');
  if (display) {
    display.textContent = positionOffset.toFixed(2);
  }
}

function resetPosition() {
  positionOffset = 0.05;
  console.log('Position reset to:', positionOffset);
}

// **ADD POSITION CONTROLS**
function addPositionControls() {
  const controls = document.createElement('div');
  controls.innerHTML = `
    <div style="position: fixed; top: 10px; left: 10px; background: rgba(0,0,0,0.8); color: white; padding: 10px; z-index: 1000; border-radius: 10px;">
      <div style="margin-bottom: 8px; font-weight: bold;">🎯 Position Adjust:</div>
      <div style="margin-bottom: 5px;">Current: <span id="positionDisplay">${positionOffset.toFixed(2)}</span></div>
      <button onclick="adjustPosition(-0.05)" style="margin: 2px; padding: 8px 12px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">⬆️ Higher</button>
      <button onclick="adjustPosition(0.05)" style="margin: 2px; padding: 8px 12px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer;">⬇️ Lower</button>
      <button onclick="resetPosition()" style="margin: 2px; padding: 8px 12px; background: #ff9800; color: white; border: none; border-radius: 5px; cursor: pointer;">🔄 Reset</button>
    </div>
  `;
  document.body.appendChild(controls);
}

// **IMPROVED CAMERA INITIALIZATION**
async function initializeCamera() {
  try {
    const camera = new Camera(videoElement, {
      onFrame: async () => {
        try {
          await pose.send({ image: videoElement });
        } catch (error) {
          console.error('Pose detection error:', error);
        }
      },
      width: 960,
      height: 540,
    });
    
    await camera.start();
    console.log('✅ Camera and pose detection started');
    
  } catch (error) {
    console.error('❌ Camera initialization failed:', error);
    alert('Camera error: ' + error.message);
  }
}

// **WAIT FOR CLOTHING IMAGE TO LOAD BEFORE STARTING**
clothingImage.onload = () => {
  console.log('✅ Clothing image loaded');
};

// Set default clothing
clothingImage.src = "shirt.png"; // Default clothing
selectedClothing = clothingImage;

// Adjust canvas dynamically when camera starts
videoElement.addEventListener("loadedmetadata", () => {
  resizeCanvasToVideo(videoElement);
});

// Handle resizing (for phones rotating)
window.addEventListener("resize", () => {
  resizeCanvasToVideo(videoElement);
});

// Start everything when page loads
document.addEventListener('DOMContentLoaded', () => {
  initializeCamera();
  addPositionControls(); // Add the adjustment controls
});

// **QUICK POSITION PRESETS**
function setPositionPreset(preset) {
  const presets = {
    high: -0.05,    // Higher on body
    medium: 0.05,   // Medium (default)
    low: 0.15       // Lower on body
  };
  
  positionOffset = presets[preset] || 0.05;
  console.log(`Position set to ${preset}: ${positionOffset}`);
}
