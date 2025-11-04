// This file is plain JavaScript and lives in /public/
// It is NOT processed by the Next.js bundler.

try {
  // Load the ONNX library. This will fetch /ort.js
  self.importScripts('/ort.js'); 
} catch (e) {
  console.error("Failed to load ort.js from /public folder.", e);
  self.postMessage({ type: "error", message: "Fatal: Failed to load ONNX runtime script." });
}

// --- Model & Preprocessing Constants ---
const MODEL_WIDTH = 640;
const MODEL_HEIGHT = 640;
const CONFIDENCE_THRESHOLD = 0.5;
const IOU_THRESHOLD = 0.45;
const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 
  'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 
  'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 'kite', 
  'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 'bottle', 
  'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 
  'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 
  'keyboard', 'cell phone', 'microwave', 'oven', ' toaster', 'sink', 'refrigerator', 'book', 
  'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

let session;
let gpuInfo = "CPU (Wasm)"; // Default

// --- ONNX Helper Functions (Now inside the worker) ---

async function preprocess(videoFrame) {
  const canvas = new OffscreenCanvas(MODEL_WIDTH, MODEL_HEIGHT);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get OffscreenCanvas context");

  const scale = Math.min(MODEL_WIDTH / videoFrame.width, MODEL_HEIGHT / videoFrame.height);
  const scaledWidth = videoFrame.width * scale;
  const scaledHeight = videoFrame.height * scale;
  const xPad = (MODEL_WIDTH - scaledWidth) / 2;
  const yPad = (MODEL_HEIGHT - scaledHeight) / 2;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, MODEL_WIDTH, MODEL_HEIGHT);
  ctx.drawImage(videoFrame, xPad, yPad, scaledWidth, scaledHeight);

  const imageData = ctx.getImageData(0, 0, MODEL_WIDTH, MODEL_HEIGHT);
  const { data } = imageData;

  const floatData = new Float32Array(3 * MODEL_WIDTH * MODEL_HEIGHT);
  for (let i = 0; i < MODEL_HEIGHT * MODEL_WIDTH; i++) {
    floatData[i] = data[i * 4 + 0] / 255.0;
    floatData[i + MODEL_WIDTH * MODEL_HEIGHT] = data[i * 4 + 1] / 255.0;
    floatData[i + 2 * MODEL_WIDTH * MODEL_HEIGHT] = data[i * 4 + 2] / 255.0;
  }

  const tensor = new ort.Tensor("float32", floatData, [1, 3, MODEL_HEIGHT, MODEL_WIDTH]);
  return [tensor, scale, xPad, yPad];
}


function postprocess(
  outputTensor,
  scale,
  xPad,
  yPad,
  frameWidth, // Not used, but good to have
  frameHeight // Not used, but good to have
) {
  const data = outputTensor.data;
  const numProposals = outputTensor.dims[2]; // This is 8400
  const numClasses = 80;

  const boxes = [];

  // Iterate through each of the 8400 proposals
  for (let i = 0; i < numProposals; i++) {
    
    // Find the class with the highest score
    let maxScore = 0;
    let maxClassId = -1;

    // Iterate through all 80 class scores for this proposal
    // Scores start at channel 4
    for (let j = 0; j < numClasses; j++) {
      // The data is transposed, so we access it as:
      // data[(channel * numProposals) + proposal_index]
      const score = data[(j + 4) * numProposals + i];
      if (score > maxScore) {
        maxScore = score;
        maxClassId = j;
      }
    }

    // Check if the highest score is above our confidence threshold
    if (maxScore > CONFIDENCE_THRESHOLD) {
      
      // Get the bounding box coordinates
      const x_center = data[0 * numProposals + i]; // x_center
      const y_center = data[1 * numProposals + i]; // y_center
      const width = data[2 * numProposals + i];    // w
      const height = data[3 * numProposals + i];   // h

      // --- Letterbox Removal & Scaling ---
      // This is the same logic as before, which is correct.
      // It scales the 640x640 model coordinates back to the
      // original video frame's dimensions.
      const x1 = (x_center - width / 2 - xPad) / scale;
      const y1 = (y_center - height / 2 - yPad) / scale;
      const w = width / scale;
      const h = height / scale;

      boxes.push({
        class: COCO_CLASSES[maxClassId] || "unknown",
        score: maxScore, // This is now a correct value, e.g., 0.63
        bbox: [x1, y1, w, h],
      });
    }
  }

  // Run Non-Max Suppression
  return nms(boxes, IOU_THRESHOLD);
}
function nms(boxes, iouThreshold) {
  boxes.sort((a, b) => b.score - a.score);
  const selectedBoxes = [];
  while (boxes.length > 0) {
    const currentBox = boxes.shift();
    selectedBoxes.push(currentBox);
    boxes = boxes.filter(box => {
      if (box.class !== currentBox.class) return true;
      const iou = calculateIoU(currentBox.bbox, box.bbox);
      return iou < iouThreshold;
    });
  }
  return selectedBoxes;
}

function calculateIoU(box1, box2) {
  const [x1, y1, w1, h1] = box1;
  const [x2, y2, w2, h2] = box2;
  const r1 = x1 + w1;
  const b1 = y1 + h1;
  const r2 = x2 + w2;
  const b2 = y2 + h2;

  const interX1 = Math.max(x1, x2);
  const interY1 = Math.max(y1, y2);
  const interX2 = Math.min(r1, r2);
  const interY2 = Math.min(b1, b2);

  const interWidth = Math.max(0, interX2 - interX1);
  const interHeight = Math.max(0, interY2 - interY1);
  const interArea = interWidth * interHeight;

  const area1 = w1 * h1;
  const area2 = w2 * h2;
  const unionArea = area1 + area2 - interArea;

  if (unionArea === 0) return 0;
  return interArea / unionArea;
}

// --- Worker Message Handler ---

// REPLACE your entire "self.onmessage" function with this one

// REPLACE your entire "self.onmessage" function with this new one

self.onmessage = async (event) => {
  if (typeof ort === 'undefined') {
    self.postMessage({ type: "error", message: "ONNX runtime not loaded." });
    return;
  }

  const { type, data } = event.data;

  if (type === "load") {
    
    ort.env.wasm.wasmPaths = "/";
    let selectedProvider = "wasm"; // Default to CPU
    
    // Switch back to yolov8s for a better speed test first
    let modelFile = "/yolov8s.onnx"; 
    
    try {
      // --- Step 1: Try to initialize WebGPU ---
      const navigatorGpu = navigator.gpu;
      if (!navigatorGpu) throw new Error("WebGPU is not supported by this browser.");

      const adapter = await navigatorGpu.requestAdapter({ powerPreference: "high-performance" });
      if (!adapter) throw new Error("Could not get high-performance WebGPU adapter.");
      
      const device = await adapter.requestDevice(); // Get the device
      if (!device) throw new Error("Could not get WebGPU device from adapter.");

      // --- THIS IS THE FIX ---
      // We must pass the 'device' object, not the 'adapter' object
      ort.env.webgpu.device = device;
      // ---------------------

      // --- Step 2: Try to create a session with *ONLY* WebGPU ---
      console.log("Attempting to create WebGPU session...");
      session = await ort.InferenceSession.create(modelFile, {
        executionProviders: ["webgpu"],
        logSeverityLevel: 0 // Get verbose logs
      });

      // If we get here, WebGPU worked!
      gpuInfo = "GPU: WebGPU (Active)";
      selectedProvider = "webgpu";
      console.log("WebGPU session created successfully.");

    } catch (e) {
      // --- Step 3: WebGPU failed. Fallback to WASM (CPU) ---
      console.warn(`WebGPU session failed: ${e.message}. Falling back to WASM...`);
      
      try {
        session = await ort.InferenceSession.create(modelFile, {
          executionProviders: ["wasm"],
          logSeverityLevel: 0
        });

        gpuInfo = "CPU: WASM (WebGPU failed)";
        selectedProvider = "wasm";
        console.log("WASM (CPU) session created successfully.");

      } catch (fatalError) {
        // This is a *fatal* error (e.g., model file not found)
        console.error("Fatal error loading model:", fatalError);
        self.postMessage({ type: "error", message: `Fatal Model Error: ${fatalError.message}` });
        return; // Stop loading
      }
    }
    
    // --- Step 4: Report readiness ---
    self.postMessage({ type: "ready", gpuInfo: gpuInfo });

  } 
  
  else if (type === "detect") {
    // ... (This 'detect' block remains 100% the same as before)
    if (!session) {
      self.postMessage({ type: "error", message: "Session not ready." });
      return;
    }

    const { videoFrame, videoWidth, videoHeight } = data;
    
    let tensor;
    let outputTensor;

    try {
      const [inputTensor, scale, xPad, yPad] = await preprocess(videoFrame);
      tensor = inputTensor;

      const feeds = { [session.inputNames[0]]: tensor };
      const results = await session.run(feeds);
      outputTensor = results[session.outputNames[0]];

      const detections = postprocess(outputTensor, scale, xPad, yPad, videoWidth, videoHeight);
      
      self.postMessage({ type: "results", detections: detections });

    } catch (e) {
      console.error("Error in worker detection:", e);
      self.postMessage({ type: "error", message: e.message });
    } finally {
      tensor?.dispose();
      outputTensor?.dispose();
      videoFrame.close();
    }
  }
};