const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const clothingSelect = document.getElementById("clothingSelect");

// Mobile camera detection
const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Show mobile instructions
if (isMobile) {
  showMobileInstructions();
}

const selected = JSON.parse(localStorage.getItem("selectedModel"));
let shirtImg = new Image();
let shirtLoaded = false;
shirtImg.src = selected ? selected.image : "shirt.png";
shirtImg.onload = () => (shirtLoaded = true);

// Change clothing safely
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
  modelComplexity: isMobile ? 0 : 1, // Lower complexity for mobile
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5, // Lower for better mobile performance
});
pose.onResults(onResults);

// Mobile-optimized camera initialization
async function startCamera() {
  try {
    // Check HTTPS for mobile
    if (isMobile && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      alert('📱 Camera requires HTTPS on mobile. Please use the secure URL.');
      return;
    }

    // Mobile-optimized camera constraints
    const constraints = {
      video: {
        facingMode: isMobile ? "environment" : "user", // Use back camera on mobile
        width: { ideal: isMobile ? 640 : 1280 },
        height: { ideal: isMobile ? 480 : 720 },
        frameRate: { ideal: isMobile ? 24 : 30 } // Lower FPS for mobile performance
      }
    };

    // Safari-specific constraints
    if (isSafari) {
      constraints.video.frameRate = { ideal: 20 };
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;

    // Wait for video to be ready
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        resolve();
      };
    });

    // Start MediaPipe processing
    startMediaPipe();

  } catch (err) {
    console.error('Camera error:', err);
    handleCameraError(err);
  }
}

function startMediaPipe() {
  const camera = new Camera(videoElement, {
    onFrame: async () => {
      try {
        await pose.send({ image: videoElement });
      } catch (error) {
        console.error('MediaPipe frame error:', error);
      }
    },
    width: isMobile ? 320 : 640, // Lower resolution for mobile
    height: isMobile ? 240 : 480
  });
  camera.start().catch(error => {
    console.error('Camera start failed:', error);
    handleCameraError(error);
  });
}

function handleCameraError(error) {
  let message = 'Camera error: ';
  
  switch (error.name) {
    case 'NotAllowedError':
      message = '📱 Camera access denied. Please allow camera permissions in your browser settings.';
      break;
    case 'NotFoundError':
      message = '📱 No camera found on this device.';
      break;
    case 'NotSupportedError':
      message = '📱 Camera not supported in this browser. Try Chrome or Safari.';
      break;
    case 'NotReadableError':
      message = '📱 Camera is already in use by another application.';
      break;
    default:
      message += error.message;
  }
  
  alert(message);
  console.error('Camera error details:', error);
}

function showMobileInstructions() {
  const instructions = `
    <div class="mobile-instructions" style="
      background: rgba(0,0,0,0.85);
      color: white;
      padding: 15px;
      border-radius: 10px;
      margin: 10px;
      font-size: 14px;
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      z-index: 1000;
    ">
      <h3 style="margin: 0 0 10px 0;">📱 Mobile Tips:</h3>
      <ul style="margin: 0; padding-left: 20px;">
        <li>Allow camera permissions when prompted</li>
        <li>Use in <strong>landscape mode</strong> for best results</li>
        <li>Hold phone steady for better tracking</li>
        <li>Ensure good lighting</li>
      </ul>
      <button onclick="this.parentElement.remove()" style="
        background: #007bff;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 5px;
        margin-top: 10px;
        cursor: pointer;
      ">Got it!</button>
    </div>
  `;
  document.body.insertAdjacentHTML('afterbegin', instructions);
}

// Add performance optimization for mobile
if (isMobile) {
  // Reduce rendering frequency on mobile
  const originalOnResults = onResults;
  let lastRenderTime = 0;
  pose.onResults = (results) => {
    const now = Date.now();
    if (now - lastRenderTime > 66) { // ~15 FPS on mobile
      originalOnResults(results);
      lastRenderTime = now;
    }
  };
}

// Start camera when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to ensure everything is loaded
  setTimeout(startCamera, 500);
});

// Add cleanup function
window.addEventListener('beforeunload', () => {
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(track => track.stop());
  }
});
