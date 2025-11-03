const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

const clothingSelect = document.getElementById("clothingSelect");
let clothingImage = new Image();
let selectedClothing = null;

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

  // Draw mirrored webcam image
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  if (results.poseLandmarks && selectedClothing) {
    const landmarks = results.poseLandmarks;

    // **PRECISE SHOULDER DETECTION**
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];

    // Convert normalized coordinates to canvas pixels
    const leftShoulderX = leftShoulder.x * canvasElement.width;
    const leftShoulderY = leftShoulder.y * canvasElement.height;
    const rightShoulderX = rightShoulder.x * canvasElement.width;
    const rightShoulderY = rightShoulder.y * canvasElement.height;

    // **CALCULATE EXACT CLOTHING POSITION**
    
    // Shoulder width (base for clothing width)
    const shoulderWidth = Math.abs(rightShoulderX - leftShoulderX);
    
    // Body height from shoulders to hips
    const bodyHeight = Math.abs(
      ((leftHip.y + rightHip.y) / 2) * canvasElement.height - 
      ((leftShoulderY + rightShoulderY) / 2)
    );

    // **PRECISE POSITIONING**
    const clothingWidth = shoulderWidth * 1.2; // Slightly wider than shoulders
    const clothingHeight = bodyHeight * 1.5;   // Extend below hips
    
    // Center position between shoulders
    const centerX = (leftShoulderX + rightShoulderX) / 2;
    
    // Start from slightly above shoulders for natural fit
    const startY = ((leftShoulderY + rightShoulderY) / 2) - (clothingHeight * 0.1);

    // **ADJUST FOR BODY ROTATION**
    // Calculate shoulder angle for tilted poses
    const shoulderAngle = Math.atan2(
      rightShoulderY - leftShoulderY,
      rightShoulderX - leftShoulderX
    );

    // **DRAW CLOTHING WITH PRECISE PLACEMENT**
    canvasCtx.save();
    
    // Apply rotation if body is tilted
    canvasCtx.translate(centerX, startY + (clothingHeight * 0.1));
    canvasCtx.rotate(shoulderAngle);
    
    // Draw clothing centered on shoulders
    canvasCtx.drawImage(
      selectedClothing,
      -clothingWidth / 2,    // Center horizontally
      -clothingHeight * 0.1, // Start slightly above shoulder line
      clothingWidth,
      clothingHeight
    );
    
    canvasCtx.restore();

    // **DEBUG: Draw shoulder points (remove in production)**
    canvasCtx.fillStyle = 'red';
    canvasCtx.fillRect(leftShoulderX - 5, leftShoulderY - 5, 10, 10);
    canvasCtx.fillRect(rightShoulderX - 5, rightShoulderY - 5, 10, 10);
    
    canvasCtx.fillStyle = 'blue';
    canvasCtx.fillRect(centerX - 3, startY - 3, 6, 6);
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
});

// **ADD MANUAL CALIBRATION IF NEEDED**
function calibrateClothingPosition(adjustment = 1.0) {
  // This can be called to fine-tune clothing position
  console.log('Calibrating clothing position:', adjustment);
}
