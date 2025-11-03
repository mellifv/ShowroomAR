// ====== ELEMENTS ======
const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const clothingSelect = document.getElementById("clothingSelect");

// ====== VARIABLES ======
let clothingImage = new Image();
let selectedClothing = null;
let positionOffset = 0.05;
let isProcessing = false;

// For smooth movement
let prevCenterX = null;
let prevClothingHeight = 0;

// ====== CANVAS RESIZING ======
function resizeCanvasToScreen() {
  const aspect = window.innerWidth / window.innerHeight;

  if (aspect > 1) {
    // Landscape (desktop or tablet)
    canvasElement.width = 960;
    canvasElement.height = 720;
  } else {
    // Portrait (phone)
    canvasElement.width = 720;
    canvasElement.height = 960;
  }

  console.log(`📐 Canvas resized: ${canvasElement.width}x${canvasElement.height}`);
}

// ====== LOAD CLOTHING ======
clothingSelect.addEventListener("change", (e) => {
  const value = e.target.value;
  if (value && value !== "none") {
    const newImg = new Image();
    newImg.src = value;
    newImg.onload = () => {
      clothingImage = newImg;
      selectedClothing = clothingImage;
      console.log("👕 Clothing loaded:", value);
    };
  } else {
    selectedClothing = null;
  }
});

// ====== POSE RESULTS ======
function onResults(results) {
  if (isProcessing) return;
  isProcessing = true;

  requestAnimationFrame(() => {
    try {
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

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
        const centerX = (leftShoulderX + rightShoulderX) / 2;
        const shoulderY = (leftShoulderY + rightShoulderY) / 2;

        const hipsVisible =
          leftHip && rightHip && leftHip.visibility > 0.5 && rightHip.visibility > 0.5;

        let clothingWidth, clothingHeight, startY;

        if (hipsVisible) {
          // 🧍 Full torso view
          const avgHipY = ((leftHip.y + rightHip.y) / 2) * canvasElement.height;
          const bodyHeight = Math.abs(avgHipY - shoulderY);
          clothingWidth = shoulderWidth * 1.8;
          clothingHeight = bodyHeight * 1.2;
          startY = shoulderY - clothingHeight * 0.05;
        } else {
          // 💻 Head + shoulders only
          clothingWidth = shoulderWidth * 1.9;
          clothingHeight = shoulderWidth * 0.75;
          startY = shoulderY - clothingHeight * 0.25;
        }

        // ====== SMOOTH TRANSITIONS ======
        const smoothFactor = 0.2;
        if (prevCenterX === null) prevCenterX = centerX;

        prevCenterX = prevCenterX * (1 - smoothFactor) + centerX * smoothFactor;
        prevClothingHeight =
          prevClothingHeight * (1 - smoothFactor) + clothingHeight * smoothFactor;

        // ====== DRAW CLOTHING ======
        canvasCtx.drawImage(
          selectedClothing,
          prevCenterX - clothingWidth / 2,
          startY + positionOffset * canvasElement.height,
          clothingWidth,
          prevClothingHeight
        );
      }
    } catch (error) {
      console.error("Rendering error:", error);
    } finally {
      isProcessing = false;
    }
  });
}

// ====== MEDIAPIPE SETUP ======
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 0,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

pose.onResults(onResults);

// ====== CAMERA INITIALIZATION ======
async function initializeCamera() {
  try {
    console.log("🎥 Starting camera...");

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 960 },
        height: { ideal: 720 },
        frameRate: { ideal: 24 },
      },
    });

    videoElement.srcObject = stream;

    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play().then(resolve).catch(resolve);
      };
      setTimeout(resolve, 1500);
    });

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        try {
          await pose.send({ image: videoElement });
        } catch (error) {
          console.warn("Frame skipped:", error);
        }
      },
      width: 960,
      height: 720,
    });

    await camera.start();
    console.log("✅ Camera & Pose active");
  } catch (error) {
    console.error("❌ Camera failed:", error);
    alert("Camera error: " + error.message);
  }
}

// ====== POSITION CONTROLS ======
function adjustPosition(change) {
  positionOffset = Math.max(-0.3, Math.min(0.3, positionOffset + change));
  updatePositionDisplay();
}

function resetPosition() {
  positionOffset = 0.05;
  updatePositionDisplay();
}

function updatePositionDisplay() {
  const display = document.getElementById("positionDisplay");
  if (display) display.textContent = positionOffset.toFixed(2);
}

function addPositionControls() {
  const controls = document.createElement("div");
  controls.innerHTML = `
    <div style="position: fixed; top: 10px; left: 10px; background: rgba(0,0,0,0.8); color: white; padding: 10px; z-index: 1000; border-radius: 10px; font-size: 14px;">
      <div style="margin-bottom: 8px; font-weight: bold;">🎯 Position Adjust:</div>
      <div style="margin-bottom: 5px;">Current: <span id="positionDisplay">${positionOffset.toFixed(2)}</span></div>
      <button onclick="adjustPosition(-0.05)" style="margin: 2px; padding: 6px 10px; background: #4CAF50; color: white; border: none; border-radius: 5px;">⬆️ Higher</button>
      <button onclick="adjustPosition(0.05)" style="margin: 2px; padding: 6px 10px; background: #2196F3; color: white; border: none; border-radius: 5px;">⬇️ Lower</button>
      <button onclick="resetPosition()" style="margin: 2px; padding: 6px 10px; background: #ff9800; color: white; border: none; border-radius: 5px;">🔄 Reset</button>
    </div>
  `;
  document.body.appendChild(controls);
}

// ====== INITIALIZATION ======
clothingImage.onload = () => {
  selectedClothing = clothingImage;
  console.log("👕 Default clothing loaded");
};
clothingImage.src = "shirt.png";

document.addEventListener("DOMContentLoaded", () => {
  resizeCanvasToScreen();
  addPositionControls();
  initializeCamera();
});

window.addEventListener("resize", resizeCanvasToScreen);

window.addEventListener("beforeunload", () => {
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach((track) => track.stop());
  }
});
