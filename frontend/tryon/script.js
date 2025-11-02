const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const clothingSelect = document.getElementById("clothingSelect");

console.log('🚀 Try-on script loaded');
console.log('📱 Video element:', videoElement);
console.log('🎯 Canvas element:', canvasElement);

// Mobile detection
const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
console.log('📱 Is mobile:', isMobile);
console.log('🔒 HTTPS:', window.location.protocol);
console.log('🌐 User agent:', navigator.userAgent);

// Test camera support
console.log('📷 MediaDevices supported:', !!navigator.mediaDevices);
console.log('📷 getUserMedia supported:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));

// Show debug info on page
function showDebugInfo() {
  const debugInfo = `
    <div style="
      background: #ff4444;
      color: white;
      padding: 10px;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      font-size: 12px;
    ">
      <strong>Debug Info:</strong><br>
      Mobile: ${isMobile} | HTTPS: ${window.location.protocol} | 
      MediaDevices: ${!!navigator.mediaDevices} |
      getUserMedia: ${!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)}
    </div>
  `;
  document.body.insertAdjacentHTML('afterbegin', debugInfo);
}

showDebugInfo();

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
  modelComplexity: isMobile ? 0 : 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});
pose.onResults(onResults);

// Test camera directly first
async function testCamera() {
  console.log('🔍 Testing camera access...');
  
  try {
    // Test basic camera access
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: isMobile ? "environment" : "user",
        width: { ideal: 640 },
        height: { ideal: 480 }
      } 
    });
    
    console.log('✅ Camera access granted');
    
    // Test if we can display the stream
    videoElement.srcObject = stream;
    videoElement.play().then(() => {
      console.log('✅ Video element playing');
    }).catch(err => {
      console.error('❌ Video play failed:', err);
    });
    
    return stream;
    
  } catch (err) {
    console.error('❌ Camera test failed:', err.name, err.message);
    showCameraError(err);
    return null;
  }
}

// Start everything
async function initializeTryOn() {
  console.log('🔄 Initializing try-on...');
  
  // Test camera first
  const stream = await testCamera();
  if (!stream) return;
  
  // Wait for video to be ready
  await new Promise((resolve) => {
    videoElement.onloadeddata = () => {
      console.log('✅ Video data loaded');
      resolve();
    };
    videoElement.onerror = (err) => {
      console.error('❌ Video error:', err);
      resolve();
    };
    
    // Timeout fallback
    setTimeout(resolve, 3000);
  });
  
  // Start MediaPipe
  console.log('🔄 Starting MediaPipe...');
  try {
    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await pose.send({ image: videoElement });
      },
      width: 640,
      height: 480
    });
    
    await camera.start();
    console.log('✅ MediaPipe started successfully');
    
  } catch (error) {
    console.error('❌ MediaPipe failed:', error);
  }
}

function showCameraError(error) {
  let message = '';
  
  switch (error.name) {
    case 'NotAllowedError':
      message = '📱 Camera permission denied. Please:\n1. Allow camera access in browser settings\n2. Refresh the page\n3. Click "Allow" when prompted';
      break;
    case 'NotFoundError':
      message = '📱 No camera found on this device.';
      break;
    case 'NotSupportedError':
      message = '📱 Camera not supported in this browser. Try Chrome or Safari.';
      break;
    case 'NotReadableError':
      message = '📱 Camera is busy. Close other apps using camera.';
      break;
    case 'SecurityError':
      message = '📱 Camera blocked for security reasons. Use HTTPS.';
      break;
    default:
      message = `📱 Camera error: ${error.message}`;
  }
  
  alert(message);
  console.error('Camera error details:', error);
}

// Add manual start button for testing
function addManualStartButton() {
  const button = document.createElement('button');
  button.textContent = '🎥 Start Camera';
  button.style.cssText = `
    position: fixed;
    top: 50px;
    left: 10px;
    z-index: 9999;
    padding: 10px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  `;
  button.onclick = initializeTryOn;
  document.body.appendChild(button);
}

// Start when page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM loaded, starting initialization...');
  addManualStartButton();
  
  // Auto-start after a short delay
  setTimeout(() => {
    initializeTryOn();
  }, 1000);
});

// Cleanup
window.addEventListener('beforeunload', () => {
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(track => {
      console.log('🛑 Stopping camera track:', track.kind);
      track.stop();
    });
  }
});
