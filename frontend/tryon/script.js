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

    // Example: estimate shoulder width and y position
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const shoulderWidth = Math.abs(
      rightShoulder.x * canvasElement.width -
      leftShoulder.x * canvasElement.width
    );

    const yPosition =
      ((leftShoulder.y + rightShoulder.y) / 2) * canvasElement.height -
      shoulderWidth * 0.3;

    const clothingWidth = shoulderWidth * 2.2;
    const clothingHeight = clothingWidth * 1.2;

    canvasCtx.drawImage(
      selectedClothing,
      (canvasElement.width - clothingWidth) / 2,
      yPosition,
      clothingWidth,
      clothingHeight
    );
  }

  canvasCtx.restore();
}

// Initialize Pose
const pose = new Pose({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

pose.onResults(onResults);

// Initialize camera
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({ image: videoElement });
  },
  width: 960,
  height: 540,
});
camera.start();

// Adjust canvas dynamically when camera starts
videoElement.addEventListener("loadedmetadata", () => {
  resizeCanvasToVideo(videoElement);
});

// Handle resizing (for phones rotating)
window.addEventListener("resize", () => {
  resizeCanvasToVideo(videoElement);
});
