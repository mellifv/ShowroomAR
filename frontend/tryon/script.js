const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

const isMobile = /Mobi|Android/i.test(navigator.userAgent);
const videoWidth = isMobile ? 480 : 960;
const videoHeight = isMobile ? 640 : 540;

const clothingSelect = document.getElementById("clothingSelect");
let clothingImage = new Image();
let selectedClothing = null;

// Maintain aspect ratio automatically
function resizeCanvasToVideo(video) {
  const { videoWidth, videoHeight } = video;
  if (videoWidth && videoHeight) {
    const ratio = videoWidth / videoHeight;
    let targetWidth, targetHeight;

    if (window.innerWidth < window.innerHeight) {
      // portrait
      targetWidth = window.innerWidth;
      targetHeight = targetWidth / ratio;
    } else {
      // landscape
      targetHeight = window.innerHeight;
      targetWidth = targetHeight * ratio;
    }

    canvasElement.width = targetWidth;
    canvasElement.height = targetHeight;
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
  requestAnimationFrame(() => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Mirror webcam image for natural front-camera view
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.restore();

    if (results.poseLandmarks && selectedClothing) {
      const landmarks = results.poseLandmarks;

      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];

      // Convert normalized coordinates to canvas pixels
      const leftShoulderX = leftShoulder.x * canvasElement.width;
      const leftShoulderY = leftShoulder.y * canvasElement.height;
      const rightShoulderX = rightShoulder.x * canvasElement.width;
      const rightShoulderY = rightShoulder.y * canvasElement.height;

      const shoulderWidth = Math.abs(rightShoulderX - leftShoulderX);
      const bodyHeight = Math.abs(
        ((leftHip.y + rightHip.y) / 2) * canvasElement.height -
        ((leftShoulderY + rightShoulderY) / 2)
      );

      const clothingWidth = shoulderWidth * 1.8;
      const clothingHeight = bodyHeight * 1.3;
      const centerX = (leftShoulderX + rightShoulderX) / 2;
      const startY = ((leftShoulderY + rightShoulderY) / 2) - (clothingHeight * 0.1);
      const shoulderAngle = Math.atan2(
        rightShoulderY - leftShoulderY,
        rightShoulderX - leftShoulderX
      );

      // Draw clothing
      canvasCtx.save();
      canvasCtx.translate(centerX, startY + (clothingHeight * 0.1));
      canvasCtx.rotate(shoulderAngle);
      canvasCtx.drawImage(
        selectedClothing,
        -clothingWidth / 2,
        -clothingHeight * 0.1,
        clothingWidth,
        clothingHeight
      );
      canvasCtx.restore();

      // Debug dots (smaller for mobile)
      canvasCtx.fillStyle = 'red';
      canvasCtx.fillRect(leftShoulderX - 2, leftShoulderY - 2, 4, 4);
      canvasCtx.fillRect(rightShoulderX - 2, rightShoulderY - 2, 4, 4);
    }
  });
}

// Pose setup
const pose = new Pose({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

pose.onResults(onResults);

// Camera setup
async function initializeCamera() {
  try {
    videoElement.setAttribute('playsinline', true);
    const camera = new Camera(videoElement, {
      onFrame: async () => {
        try {
          await pose.send({ image: videoElement });
        } catch (err) {
          console.error('Pose detection error:', err);
        }
      },
      width: videoWidth,
      height: videoHeight,
      facingMode: "user"
    });

    await camera.start();
    console.log('✅ Camera and pose detection started');
  } catch (error) {
    console.error('❌ Camera initialization failed:', error);
    alert('Camera error: ' + error.message);
  }
}

// Wait for clothing image
clothingImage.onload = () => console.log('✅ Clothing image loaded');
clothingImage.src = "shirt.png";
selectedClothing = clothingImage;

videoElement.addEventListener("loadedmetadata", () => {
  resizeCanvasToVideo(videoElement);
});

window.addEventListener("resize", () => {
  resizeCanvasToVideo(videoElement);
});

document.addEventListener('DOMContentLoaded', () => {
  initializeCamera();
});

// Optional manual calibration
function calibrateClothingPosition(adjustment = 1.0) {
  console.log('Calibrating clothing position:', adjustment);
}
