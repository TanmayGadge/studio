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
  const x = (MODEL_WIDTH - scaledWidth) / 2;
  const y = (MODEL_HEIGHT - scaledHeight) / 2;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, MODEL_WIDTH, MODEL_HEIGHT);
  ctx.drawImage(videoFrame, x, y, scaledWidth, scaledHeight);

  const imageData = ctx.getImageData(0, 0, MODEL_WIDTH, MODEL_HEIGHT);
  const { data } = imageData;

  const floatData = new Float32Array(3 * MODEL_WIDTH * MODEL_HEIGHT);
  for (let i = 0; i < MODEL_HEIGHT * MODEL_WIDTH; i++) {
    floatData[i] = data[i * 4 + 0] / 255.0;
    floatData[i + MODEL_WIDTH * MODEL_HEIGHT] = data[i * 4 + 1] / 255.0;
    floatData[i + 2 * MODEL_WIDTH * MODEL_HEIGHT] = data[i * 4 + 2] / 255.0;
  }

  const tensor = new ort.Tensor("float32", floatData, [1, 3, MODEL_HEIGHT, MODEL_WIDTH]);
  return [tensor, scale];
}

// *** THIS IS THE NEW, CORRECT POSTPROCESS FUNCTION ***
function postprocess(
  outputTensor, 
  scale, 
  frameWidth, 
  frameHeight
) {
  // This is the correct logic for a [1, 8400, 84] model
  const data = outputTensor.data;
  const numBoxes = outputTensor.dims[1]; // 8400
  const numClasses = 80;
  const boxStride = 84; // 4 (bbox) + 80 (classes)

  const scaledWidth = frameWidth * scale;
  const scaledHeight = frameHeight * scale;
  const xOffset = (MODEL_WIDTH - scaledWidth) / 2;
  const yOffset = (MODEL_HEIGHT - scaledHeight) / 2;

  const boxes = [];

  for (let i = 0; i < numBoxes; i++) {
    // Get the data for this one box
    const boxData = data.slice(i * boxStride, (i + 1) * boxStride);
    
    const x_center = boxData[0];
    const y_center = boxData[1];
    const width = boxData[2];
    const height = boxData[3];

    // Find the max class score
    let maxScore = 0;
    let maxClassId = -1;
    for (let j = 0; j < numClasses; j++) {
      const score = boxData[j + 4]; // Class scores start at index 4
      if (score > maxScore) {
        maxScore = score;
        maxClassId = j;
      }
    }

    if (maxScore > CONFIDENCE_THRESHOLD) {
      // un-letterbox the coordinates
      const x1 = (x_center - width / 2 - xOffset) / scale;
      const y1 = (y_center - height / 2 - yOffset) / scale;
      const w = width / scale;
      const h = height / scale;

      boxes.push({
        class: COCO_CLASSES[maxClassId] || "unknown",
        score: maxScore,
        bbox: [x1, y1, w, h],
      });
    }
  }
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

self.onmessage = async (event) => {
  if (typeof ort === 'undefined') {
    self.postMessage({ type: "error", message: "ONNX runtime not loaded." });
    return;
  }

  const { type, data } = event.data;

  if (type === "load") {
    
    // THIS IS THE MOST IMPORTANT LINE
    ort.env.wasm.wasmPaths = "/";

    try {
      const navigatorGpu = navigator.gpu; 
      if (navigatorGpu) { 
        try {
          const adapter = await navigatorGpu.requestAdapter({ powerPreference: "high-performance" });
          if (adapter) {
            await adapter.requestDevice();
            ort.env.webgpu.adapter = adapter;
            gpuInfo = "GPU: WebGPU Enabled";
          }
        } catch (e) {
          console.warn("Could not get high-performance adapter, defaulting.", e.message);
        }
      }

      session = await ort.InferenceSession.create("/yolov8s.onnx", {
        executionProviders: ["webgpu", "wasm"],
      });
      self.postMessage({ type: "ready", gpuInfo: gpuInfo });
    } catch (e) {
      self.postMessage({ type: "error", message: e.message });
    }
  } 
  
  else if (type === "detect") {
    const { videoFrame, videoWidth, videoHeight } = data;
    
    let tensor;
    let outputTensor;

    try {
      const [inputTensor, scale] = await preprocess(videoFrame);
      tensor = inputTensor;

      const feeds = { [session.inputNames[0]]: tensor };
      const results = await session.run(feeds);
      outputTensor = results[session.outputNames[0]];

      // This will now call the correct postprocess function
      const detections = postprocess(outputTensor, scale, videoWidth, videoHeight);
      
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