// === TRY-ON AR SCRIPT ===
// Mobile-optimized & responsive version
console.log('🚀 Try-on script loaded');

const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const clothingSelect = document.getElementById("clothingSelect");

let pose = null;
let shirtImg = new Image();
let shirtLoaded = false;
let startButton = null;

// Load selected model image or fallback
const selected = JSON.parse(localStorage.getItem("selectedModel"));
shirtImg.src = selected ? selected.image : "shirt.png";
shirtImg.onload = () => (shirtLoaded = true);

// Clothing selector change
clothingSelect.addEventListener("change", () => {
  const newImg = new Image();
  shirtLoaded = false;
  newImg.src = clothingSelect.value;
  newImg.onload = () => {
    shirtImg = newImg;
    shirtLoaded = true;
  };
});

// === SMOOTHING FUNCTION ===
function smoothPoint(newPoint, oldPoint) {
  if (!oldPoint) return newPoint;
  return {
    x: 0.8 * oldPoint.x + 0.2 * newPoint.x,
    y: 0.8 * oldPoint.y + 0.2 * newPoint.y
  };
}
let prevShoulderCenter = null;

// === MAIN DRAW FUNCTION ===
let lastFrame = 0;
function onResults(results) {
  const now = Date.now();
  if (now - lastFrame < 60) return; // limit to ~15 FPS
  lastFrame = now;

  const videoWidth = videoElement.videoWidth;
  const videoHeight = videoElement.videoHeight;

  // Keep canvas same aspect ratio as video
  canvasElement.width = videoWidth;
  canvasElement.height = videoHeight;

  canvasCtx.clearRect(0, 0, videoWidth, videoHeight);
  canvasCtx.drawImage(results.image, 0, 0, videoWidth, videoHeight);

  if (!shirtLoaded || !results.poseLandmarks) {
    canvasCtx.fillStyle = 'white';
    canvasCtx.font = '18px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('Stand in front of camera', videoWidth / 2, 50);
    canvasCtx.fillText('to try on clothes', videoWidth / 2, 80);
    return;
  }

  const leftShoulder = results.poseLandmarks[11];
  const rightShoulder = results.poseLandmarks[12];
  const leftHip = results.poseLandmarks[23];
  const rightHip = results.poseLandmarks[24];

  let shoulderCenter = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2
  };
  shoulderCenter = smoothPoint(shoulderCenter, prevShoulderCenter);
  prevShoulderCenter = shoulderCenter;

  const hipCenter = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };

  const width = Math.abs(rightShoulder.x - leftShoulder.x) * videoWidth * 2;
  const height = Math.abs(hipCenter.y - shoulderCenter.y) * videoHeight * 1.2;
  const x = shoulderCenter.x * videoWidth - width / 2;
  const y = shoulderCenter.y * videoHeight - height * 0.25;

  canvasCtx.save();
  canvasCtx.imageSmoothingEnabled = true;
  canvasCtx.drawImage(shirtImg, x, y, width, height);
  canvasCtx.restore();
}

// === START CAMERA ===
async function startCamera() {
  console.log('📷 Starting camera...');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: window.innerWidth > 800 ? 640 : 480 },
        height: { ideal: window.innerHeight > 800 ? 480 : 640 }
      }
    });

    console.log('✅ Camera access granted');
    videoElement.srcObject = stream;
    videoElement.style.display = 'none';

    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play().then(resolve).catch(() => {
          const tapBtn = document.createElement('button');
          tapBtn.textContent = 'Tap to start camera';
          tapBtn.style.cssText = `
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: #007bff; color: white; padding: 12px 20px;
            border: none; border-radius: 20px; z-index: 1000;
          `;
          document.body.appendChild(tapBtn);
          tapBtn.onclick = () => {
            videoElement.play();
            tapBtn.remove();
            resolve();
          };
        });
      };
      setTimeout(resolve, 2000);
    });

    startMediaPipeProcessing();
  } catch (error) {
    console.error('❌ Camera start failed:', error);
    alert('Camera error: ' + error.message);
    updateStartButton('error');
  }
}

// === START MEDIAPIPE ===
function startMediaPipeProcessing() {
  console.log('🔄 Starting MediaPipe...');
  const camera = new Camera(videoElement, {
    onFrame: async () => {
      try {
        await pose.send({ image: videoElement });
      } catch (error) {
        console.error('MediaPipe frame error:', error);
      }
    },
  });

  camera.start().then(() => {
    console.log('✅ MediaPipe started');
    updateStartButton('success');
  }).catch(error => {
    console.error('❌ MediaPipe failed:', error);
    updateStartButton('error');
  });
}

// === BUTTON ===
function setupStartButton() {
  startButton = document.createElement('button');
  startButton.textContent = '🎥 Start Camera';
  startButton.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    padding: 12px 24px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 25px;
    font-size: 16px;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    font-weight: bold;
  `;

  startButton.onclick = async () => {
    startButton.textContent = '⏳ Loading...';
    startButton.disabled = true;

    // Lazy-load MediaPipe libraries
    const [{ Pose }, { Camera }] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose.min.js'),
      import('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.5/camera_utils.min.js')
    ]);

    window.Camera = Camera;
    pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    pose.onResults(onResults);
    await startCamera();
  };

  document.body.appendChild(startButton);
}

function updateStartButton(status) {
  if (!startButton) return;
  if (status === 'success') {
    startButton.textContent = '✅ Camera Active';
    startButton.style.background = '#4caf50';
    setTimeout(() => (startButton.style.display = 'none'), 2000);
  } else if (status === 'error') {
    startButton.textContent = '🔄 Try Again';
    startButton.disabled = false;
    startButton.style.background = '#ff4444';
  }
}

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 Page loaded');
  setupStartButton();
});

// === CLEANUP ===
window.addEventListener('beforeunload', () => {
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach((track) => track.stop());
  }
});
