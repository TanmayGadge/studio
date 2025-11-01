"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { InferenceSession, Tensor, env } from "onnxruntime-web";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Laptop, Router, Video, Loader2 } from "lucide-react";

// --- YOLOv8 ONNX Helper Functions ---

const MODEL_WIDTH = 640;
const MODEL_HEIGHT = 640;
const CONFIDENCE_THRESHOLD = 0.5; 
const IOU_THRESHOLD = 0.45; 

async function preprocess(
  video: HTMLVideoElement
): Promise<[Tensor, number]> {
  const canvas = document.createElement("canvas");
  canvas.width = MODEL_WIDTH;
  canvas.height = MODEL_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  const scale = Math.min(MODEL_WIDTH / video.videoWidth, MODEL_HEIGHT / video.videoHeight);
  const scaledWidth = video.videoWidth * scale;
  const scaledHeight = video.videoHeight * scale;
  const x = (MODEL_WIDTH - scaledWidth) / 2;
  const y = (MODEL_HEIGHT - scaledHeight) / 2;

  ctx.fillStyle = "#000000"; 
  ctx.fillRect(0, 0, MODEL_WIDTH, MODEL_HEIGHT);
  ctx.drawImage(video, x, y, scaledWidth, scaledHeight);

  const imageData = ctx.getImageData(0, 0, MODEL_WIDTH, MODEL_HEIGHT);
  const { data } = imageData;
  
  const floatData = new Float32Array(3 * MODEL_WIDTH * MODEL_HEIGHT);
  for (let i = 0; i < MODEL_HEIGHT * MODEL_WIDTH; i++) {
    floatData[i] = data[i * 4 + 0] / 255.0;
    floatData[i + MODEL_WIDTH * MODEL_HEIGHT] = data[i * 4 + 1] / 255.0;
    floatData[i + 2 * MODEL_WIDTH * MODEL_HEIGHT] = data[i * 4 + 2] / 255.0;
  }

  const tensor = new Tensor("float32", floatData, [1, 3, MODEL_HEIGHT, MODEL_WIDTH]);
  return [tensor, scale];
}

interface DetectedObject {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

function postprocess(
  outputTensor: Tensor, 
  scale: number, 
  videoWidth: number, 
  videoHeight: number
): DetectedObject[] {
  const data = outputTensor.data as Float32Array;
  const numClasses = 80;
  const numBoxes = outputTensor.dims[2]; 

  const scaledWidth = videoWidth * scale;
  const scaledHeight = videoHeight * scale;
  const xOffset = (MODEL_WIDTH - scaledWidth) / 2;
  const yOffset = (MODEL_HEIGHT - scaledHeight) / 2;
  
  const boxes: DetectedObject[] = [];
  
  for (let i = 0; i < numBoxes; i++) {
    let maxScore = 0;
    let maxClassId = -1;
    for (let j = 0; j < numClasses; j++) {
      const score = data[(j + 4) * numBoxes + i];
      if (score > maxScore) {
        maxScore = score;
        maxClassId = j;
      }
    }

    if (maxScore > CONFIDENCE_THRESHOLD) {
      const x_center = data[0 * numBoxes + i];
      const y_center = data[1 * numBoxes + i];
      const width = data[2 * numBoxes + i];
      const height = data[3 * numBoxes + i];

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

function nms(boxes: DetectedObject[], iouThreshold: number): DetectedObject[] {
  boxes.sort((a, b) => b.score - a.score);
  const selectedBoxes: DetectedObject[] = [];
  
  while (boxes.length > 0) {
    const currentBox = boxes.shift()!;
    selectedBoxes.push(currentBox);
    
    boxes = boxes.filter(box => {
      if (box.class !== currentBox.class) {
        return true; 
      }
      const iou = calculateIoU(currentBox.bbox, box.bbox);
      return iou < iouThreshold; 
    });
  }
  return selectedBoxes;
}

function calculateIoU(box1: [number, number, number, number], box2: [number, number, number, number]): number {
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

interface MainDisplayCardProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  hasCameraPermission: boolean;
}

export function MainDisplayCard({ videoRef, hasCameraPermission }: MainDisplayCardProps) {
  const [piStreamUrl, setPiStreamUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("laptop");
  
  const [model, setModel] = useState<InferenceSession | null>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [gpuInfo, setGpuInfo] = useState<string>("");

  const animationFrameId = useRef<number | null>(null);
  const isProcessingRef = useRef(isProcessing);
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  // Load the ONNX model with NVIDIA GPU priority
  useEffect(() => {
    async function loadModel() {
      let session: InferenceSession;
      let adapterInfo = "";
      
      try {
        console.log("Configuring WebGPU for high-performance GPU (NVIDIA RTX 3050)...");
        
        // Check if WebGPU is available
        const gpu = (navigator as any).gpu;
        if (gpu) {
          try {
            // Request high-performance adapter (NVIDIA GPU)
            const adapter = await gpu.requestAdapter({
              powerPreference: "high-performance"
            });
            
            if (adapter) {
              // Get adapter info
              const info = await adapter.requestAdapterInfo();
              adapterInfo = `GPU: ${info.vendor} ${info.architecture || info.device || 'Unknown'}`;
              console.log("Selected GPU adapter:", adapterInfo);
              console.log("Adapter details:", info);
              
              // Create device from the adapter
              const device = await adapter.requestDevice();
              
              // Set the adapter in ONNX Runtime env (this is the correct way, not powerPreference)
              env.webgpu.adapter = adapter;
              
              setGpuInfo(adapterInfo);
            }
          } catch (adapterError: any) {
            console.warn("Could not manually select adapter:", adapterError);
          }
        } else {
          console.warn("WebGPU not available in this browser");
        }
        
        console.log("Loading YOLOv8s ONNX model with WebGPU...");
        session = await InferenceSession.create("/yolov8s.onnx", {
          executionProviders: ["webgpu"]
        });
        console.log("Successfully loaded model with WebGPU.");
        
      } catch (e: any) { 
        console.warn("WebGPU failed, falling back to CPU (Wasm).", e.message);
        session = await InferenceSession.create("/yolov8s.onnx", {
          executionProviders: ["wasm"]
        });
        console.log("Successfully loaded model with CPU (Wasm).");
        setGpuInfo("CPU (WebGPU not available)");
      }
        
      setModel(session);
      setModelLoading(false);
    }
    loadModel();
  }, []);

  const drawDetections = useCallback((detections: DetectedObject[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.videoWidth === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = video.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const font = "16px Arial";
    ctx.font = font;
    ctx.textBaseline = "top";

    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    detections.forEach(obj => {
      if (obj.class === 'car' || obj.class === 'person' || obj.class === 'truck' || obj.class === 'bicycle' || obj.class === 'bus' || obj.class === 'motorcycle') {
        const [x, y, width, height] = obj.bbox;
        
        const drawX = x * scaleX;
        const drawY = y * scaleY;
        const drawWidth = width * scaleX;
        const drawHeight = height * scaleY;

        ctx.strokeStyle = "rgba(0, 255, 0, 0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);

        ctx.fillStyle = "rgba(0, 255, 0, 0.9)";
        const text = `${obj.class} (${Math.round(obj.score * 100)}%)`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(drawX, drawY, textWidth + 4, 18);

        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(text, drawX + 2, drawY);
      }
    });
  }, [videoRef]);

  const processFrame = useCallback(async () => {
    if (!isProcessingRef.current) {
      animationFrameId.current = null;
      return; 
    }

    if (model && videoRef.current && videoRef.current.readyState >= 3 && !videoRef.current.paused) {
      const video = videoRef.current;
      try {
        const [tensor, scale] = await preprocess(video);
        
        const feeds = { [model.inputNames[0]]: tensor };
        const results = await model.run(feeds);
        
        const outputTensor = results[model.outputNames[0]];
        const detections = postprocess(outputTensor, scale, video.videoWidth, video.videoHeight);
        
        drawDetections(detections);
      } catch (error: any) { 
        console.error("Error during detection:", error);
      }
    }

    animationFrameId.current = requestAnimationFrame(processFrame);
  
  }, [model, videoRef, drawDetections]); 

  
  useEffect(() => {
    const video = videoRef.current;
    const stopProcessingLoop = () => {
      setIsProcessing(false);
      isProcessingRef.current = false;
    };
    if(video) {
        video.addEventListener('pause', stopProcessingLoop);
        video.addEventListener('ended', stopProcessingLoop);
    }
    return () => {
        if(video) {
            video.removeEventListener('pause', stopProcessingLoop);
            video.removeEventListener('ended', stopProcessingLoop);
        }
        stopProcessingLoop();
    };
  }, [videoRef]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setIsProcessing(false); 
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(file);
        videoRef.current.loop = true;
        videoRef.current.pause();
      }
    }
  };

  const handleStartAnalysis = () => {
    if (modelLoading || !videoRef.current) return;
    videoRef.current.play()
      .then(() => {
        setIsProcessing(true);
        isProcessingRef.current = true; 
        if (!animationFrameId.current) {
          animationFrameId.current = requestAnimationFrame(processFrame);
        }
      })
      .catch((e: any) => console.error("Error playing video:", e)); 
  };

  const handleStopAnalysis = () => {
    setIsProcessing(false);
    isProcessingRef.current = false; 

    if (videoRef.current) {
      videoRef.current.pause();
    }
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    if (activeTab === 'video-file') {
        setVideoFile(null); 
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        if (videoRef.current) {
          videoRef.current.src = "";
        }
    }
  };

  const handlePiStreamConnect = () => {
    if (piStreamUrl && videoRef.current) {
      setVideoFile(null);
      videoRef.current.srcObject = null;
      videoRef.current.src = piStreamUrl;
      handleStartAnalysis();
    }
  };

  const handleTabChange = async (value: string) => {
    setActiveTab(value);
    setIsProcessing(false);
    isProcessingRef.current = false;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
      videoRef.current.srcObject = null;
    }
    
    if(canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    if (value === "laptop") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          handleStartAnalysis();
        }
      } catch (error: any) { 
        console.error("Error accessing camera:", error);
      }
    } else if (value === "video-file" && videoFile && videoRef.current) {
       videoRef.current.src = URL.createObjectURL(videoFile);
    }
  };
  
  const getButtonState = () => {
      if (modelLoading) {
          return { text: "Loading Model...", disabled: true, icon: <Loader2 className="mr-2 h-4 w-4 animate-spin" /> };
      }
      if (isProcessing) {
          return { text: "Stop Analysis", disabled: false, onClick: handleStopAnalysis, variant: "destructive" as "destructive" };
      }
      if (activeTab === 'video-file') {
          if (!videoFile) {
              return { text: "Upload a Video", disabled: true };
          }
          return { text: "Start Analysis", disabled: false, onClick: handleStartAnalysis };
      }
      if (activeTab === 'raspberry-pi') {
          return { text: "Connect & Analyze", disabled: !piStreamUrl, onClick: handlePiStreamConnect };
      }
      return { text: "Start Analysis", disabled: false, onClick: handleStartAnalysis };
  };

  const { text: buttonText, disabled: buttonDisabled, onClick: buttonOnClick, variant: buttonVariant, icon: buttonIcon } = getButtonState();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Feed</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="laptop" className="w-full" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="laptop"><Laptop className="mr-2" /> Laptop Camera</TabsTrigger>
            <TabsTrigger value="raspberry-pi"><Router className="mr-2" /> Raspberry Pi</TabsTrigger>
            <TabsTrigger value="video-file"><Video className="mr-2" /> Video File</TabsTrigger>
          </TabsList>

          <div className="relative aspect-video w-full overflow-hidden rounded-lg border mt-4 bg-black">
             <video ref={videoRef} className="w-full h-full aspect-video rounded-md" autoPlay muted playsInline />
             <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />

            {modelLoading && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white z-10">
                    <Loader2 className="h-12 w-12 animate-spin mb-4" />
                    <p>Loading YOLOv8s Model...</p>
                    <p className="text-sm text-gray-400 mt-2">Requesting high-performance GPU...</p>
                </div>
            )}

            {gpuInfo && (
                <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 text-xs rounded z-20">
                    {gpuInfo}
                </div>
            )}

            <TabsContent value="laptop" className="absolute inset-0 m-0">
                {!hasCameraPermission && !modelLoading && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                    <Alert variant="destructive" className="w-auto">
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                        Please allow camera access to use this feature.
                        </AlertDescription>
                    </Alert>
                    </div>
                )}
            </TabsContent>
            
            <TabsContent value="raspberry-pi" className="absolute inset-0 m-0">
                {!isProcessing && !modelLoading && (
                <div className="h-full w-full flex items-center justify-center bg-background z-10">
                    <div className="flex flex-col gap-4 p-4 w-full max-w-md">
                    <p className="text-muted-foreground text-center">Enter the streaming URL from your Raspberry Pi camera.</p>
                    <Input 
                        type="url" 
                        placeholder="e.g., http://192.168.1.10:8000/stream.mjpg"
                        value={piStreamUrl}
                        onChange={(e) => setPiStreamUrl(e.target.value)}
                    />
                    <Button onClick={handlePiStreamConnect} disabled={!piStreamUrl || modelLoading}>
                        {modelLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {modelLoading ? "Loading Model..." : "Connect & Analyze"}
                    </Button>
                    </div>
                </div>)}
            </TabsContent>

            <TabsContent value="video-file" className="absolute inset-0 m-0">
                 {!videoFile && !isProcessing && !modelLoading && (
                    <div className="h-full w-full flex items-center justify-center bg-background z-10">
                        <div className="flex flex-col gap-4 p-4 w-full max-w-md text-center">
                            <p className="text-muted-foreground">Upload a video file to run detection algorithms.</p>
                            <Input 
                                type="file" 
                                accept="video/*" 
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="file:text-foreground"
                            />
                        </div>
                    </div>
                )}
            </TabsContent>

             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                {activeTab === 'video-file' && !videoFile && !isProcessing ? null : (
                     <Button 
                        variant={buttonVariant || "default"} 
                        onClick={buttonOnClick} 
                        disabled={buttonDisabled}
                        className="shadow-lg"
                    >
                        {buttonIcon}
                        {buttonText}
                    </Button>
                )}
             </div>

             {isProcessing && <div className="absolute top-2 right-2 bg-destructive/80 text-white px-2 py-1 text-xs rounded font-bold animate-pulse z-20">
                ● LIVE ANALYSIS
            </div>}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}

const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 
  'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 
  'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 'kite', 
  'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 'bottle', 
  'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 
  'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 
  'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 
  'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];