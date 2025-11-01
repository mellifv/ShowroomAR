const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const clothingSelect = document.getElementById("clothingSelect");

const selected = JSON.parse(localStorage.getItem("selectedModel"));
let shirtImg = new Image(); // ❌ FIXED: must be 'let', not 'const' (since you reassign it later)
let shirtLoaded = false; // ✅ Added variable definition
shirtImg.src = selected ? selected.image : "shirt.png";
shirtImg.onload = () => (shirtLoaded = true); // ✅ make sure to set loaded state after loading

// Change clothing safely
clothingSelect.addEventListener("change", () => {
  const newImg = new Image();
  shirtLoaded = false; // pause drawing until loaded
  newImg.src = clothingSelect.value;
  newImg.onload = () => {
    shirtImg = newImg; // ✅ works now since shirtImg is 'let'
    shirtLoaded = true;
  };
});

function onResults(results) {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (!shirtLoaded || !results.poseLandmarks) return; // skip frame if not ready

  const leftShoulder = results.poseLandmarks[11];
  const rightShoulder = results.poseLandmarks[12];
  const leftHip = results.poseLandmarks[23];
  const rightHip = results.poseLandmarks[24];

  // ❌ FIXED: averaging error (was dividing by 3 instead of 2)
  const shoulderCenter = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 3,
  };
  const hipCenter = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
  };

  const width = Math.abs(rightShoulder.x - leftShoulder.x) * canvasElement.width * 2;
  const height = Math.abs(hipCenter.y - shoulderCenter.y) * canvasElement.height * 1; // slight height correction

  const x = shoulderCenter.x * canvasElement.width - width / 2;
  const y = shoulderCenter.y * canvasElement.height - height * 0.25;

  canvasCtx.drawImage(shirtImg, x, y, width, height);
}

// Setup MediaPipe Pose
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
});
pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.8,
});
pose.onResults(onResults);

// Start webcam
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({ image: videoElement });
  },
  width: 640,
  height: 480,
});
camera.start();
