"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
// ONNX imports are no longer needed here
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Laptop, Router, Video, Loader2 } from "lucide-react";

// All helper functions (preprocess, postprocess, etc.) are in the worker

interface DetectedObject {
  bbox: [number, number, number, number];
  class: string;
  score: number;
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
  const [debugInfo, setDebugInfo] = useState<string>("");

  const [modelLoading, setModelLoading] = useState(true);
  const [gpuInfo, setGpuInfo] = useState<string>("");
  
  // Worker refs
  const workerRef = useRef<Worker | null>(null);
  const isWorkerBusy = useRef<boolean>(false);

  const animationFrameRef = useRef<number | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const detectionCountRef = useRef<number>(0);

// Load the Worker
  useEffect(() => {
    if (!workerRef.current) {
      // ** THIS IS THE NEW KEY CHANGE **
      // We load the worker directly from the /public folder.
      // This stops the Next.js bundler from processing it,
      // which fixes all the "Invalid URL" errors.
      const worker = new Worker('/yolo.worker.js?v=2');
      workerRef.current = worker;

      // Listen for messages from the worker
      worker.onmessage = (event: MessageEvent<{ type: string; detections?: DetectedObject[]; message?: string; gpuInfo?: string }>) => {
        const { type, detections, message, gpuInfo } = event.data;

        if (type === "ready") {
          console.log("Worker is ready.");
          setModelLoading(false);
          setGpuInfo(gpuInfo || "Unknown");
        } else if (type === "results" && detections) {
          drawDetections(detections);
          
          // Update stats
          const now = performance.now();
          const fps = 1000 / (now - lastFrameTimeRef.current);
          lastFrameTimeRef.current = now;
          detectionCountRef.current++;
          setDebugInfo(`FPS: ${fps.toFixed(1)} | Detections: ${detections.length} | Total Frames: ${detectionCountRef.current}`);

          // Mark worker as free for the next frame
          isWorkerBusy.current = false;

        } else if (type === "error") {
          console.error("Worker Error:", message);
          setDebugInfo(`Error: ${message}`);
          setIsProcessing(false); // Stop on error
        }
      };

      // Start loading the model in the worker
      console.log("Loading model in worker...");
      worker.postMessage({ type: "load" });
    }

    // Cleanup worker on component unmount
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []); // Empty dependency array ensures this runs only once

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
      // Filter for common road objects
      if (['car', 'person', 'truck', 'bicycle', 'bus', 'motorcycle', 'traffic light', 'stop sign'].includes(obj.class)) {
        const [x, y, width, height] = obj.bbox;
        
        const drawX = x * scaleX;
        const drawY = y * scaleY;
        const drawWidth = width * scaleX;
        const drawHeight = height * scaleY;

        // Dynamic color based on class
        const color = obj.class === 'person' || obj.class === 'bicycle' || obj.class === 'motorcycle' 
          ? "rgba(255, 0, 0, 0.9)" // Red for vulnerable road users
          : "rgba(0, 255, 0, 0.9)"; // Green for vehicles

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);

        ctx.fillStyle = color;
        const text = `${obj.class} (${Math.round(obj.score * 100)}%)`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(drawX, drawY, textWidth + 4, 18);

        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(text, drawX + 2, drawY);
      }
    });
    
  }, [videoRef]); // videoRef is stable, so this function is stable

  // Detection loop
  const detectionLoop = useCallback(async () => {
    if (!isProcessing || !workerRef.current) {
      return;
    }

    const video = videoRef.current;
    if (!video || video.paused || video.ended || video.readyState < 2 || video.videoWidth === 0) {
      // Video not ready, try again on next frame
      animationFrameRef.current = requestAnimationFrame(detectionLoop);
      return;
    }

    // Only send a new frame if the worker isn't busy
    if (!isWorkerBusy.current) {
      isWorkerBusy.current = true; // Mark as busy

      try {
        // Create an ImageBitmap from the video (efficient for workers)
        const videoFrame = await createImageBitmap(video);

        // Send the frame to the worker.
        // The [videoFrame] part is a "transferable object",
        // which gives the worker ownership and avoids copying.
        workerRef.current.postMessage({
          type: "detect",
          data: {
            videoFrame: videoFrame,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight
          }
        }, [videoFrame]);

      } catch (e) {
        console.error("Error creating ImageBitmap:", e);
        isWorkerBusy.current = false; // Free worker on error
      }
    }

    // Continue the loop
    animationFrameRef.current = requestAnimationFrame(detectionLoop);
    
  }, [isProcessing, videoRef]); // Dependencies are stable

  // Start/Stop detection loop
  useEffect(() => {
    if (isProcessing && !animationFrameRef.current) {
      console.log("Starting detection loop");
      lastFrameTimeRef.current = performance.now();
      detectionCountRef.current = 0;
      animationFrameRef.current = requestAnimationFrame(detectionLoop);
    } else if (!isProcessing && animationFrameRef.current) {
      console.log("Stopping detection loop");
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isProcessing, detectionLoop]);

  // Cleanup function
  const cleanupVideo = useCallback(() => {
    console.log("Cleaning up video");
    const video = videoRef.current;
    
    setIsProcessing(false);
    
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (video) {
      video.pause();
      
      if (video.srcObject && video.srcObject instanceof MediaStream) {
        video.srcObject.getTracks().forEach(track => {
          track.stop();
          console.log("Stopped track:", track.kind);
        });
      }
      
      video.srcObject = null;
      video.src = "";
      video.load();
    }
    
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    setDebugInfo("");
  }, [videoRef]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("File selected:", file.name);
      cleanupVideo();
      
      setVideoFile(file);
      
      if (videoRef.current) {
        const url = URL.createObjectURL(file);
        videoUrlRef.current = url;
        videoRef.current.src = url;
        videoRef.current.loop = true;
        
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded:", videoRef.current?.videoWidth, "x", videoRef.current?.videoHeight);
        };
      }
    }
  };

  const handleStartAnalysis = async () => {
    if (modelLoading || !videoRef.current) {
      console.log("Cannot start - model loading or no video ref");
      return;
    }
    
    const video = videoRef.current;
    
    console.log("Starting analysis...");
    
    try {
      await video.play();
      console.log("Video playing successfully");
      setIsProcessing(true);
    } catch (e: any) {
      console.error("Error playing video:", e);
      setDebugInfo(`Play error: ${e.message}`);
    }
  };

  const handleStopAnalysis = () => {
    console.log("Stop analysis clicked");
    
    setIsProcessing(false);
    
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
      console.log("Video paused");
    }
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    setDebugInfo("Analysis stopped");
  };

  const handlePiStreamConnect = () => {
    if (piStreamUrl && videoRef.current) {
      cleanupVideo();
      setVideoFile(null);
      videoRef.current.src = piStreamUrl;
      
      videoRef.current.onloadedmetadata = () => {
        console.log("Pi stream metadata loaded");
        handleStartAnalysis();
      };
      
      videoRef.current.onerror = () => {
        console.error("Error loading Pi stream");
        setDebugInfo("Error: Could not load Pi stream.");
      }
    }
  };

  const handleTabChange = async (value: string) => {
    console.log("Tab changed to:", value);
    cleanupVideo();
    setActiveTab(value);

    if (value === "laptop") {
      if (!hasCameraPermission) {
        console.warn("No camera permission.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 } 
        });
        console.log("Camera stream obtained");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            console.log("Auto-starting camera analysis");
            handleStartAnalysis();
          }
        }
      } catch (error: any) { 
        console.error("Error accessing camera:", error);
        setDebugInfo(`Camera error: ${error.message}`);
      }
    } else if (value === "video-file" && videoFile && videoRef.current) {
      const url = URL.createObjectURL(videoFile);
      videoUrlRef.current = url;
      videoRef.current.src = url;
      videoRef.current.loop = true;
    }
  };
  
  const getButtonState = () => {
    if (modelLoading) {
      return { 
        text: "Loading Model...", 
        disabled: true, 
        icon: <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
      };
    }
    if (isProcessing) {
      return { 
        text: "Stop Analysis", 
        disabled: false, 
        onClick: handleStopAnalysis, 
        variant: "destructive" as "destructive" 
      };
    }
    if (activeTab === 'video-file') {
      if (!videoFile) {
        return { text: "Upload a Video", disabled: true };
      }
      return { text: "Start Analysis", disabled: false, onClick: handleStartAnalysis };
    }
    if (activeTab === 'raspberry-pi') {
      return { 
        text: "Connect & Analyze", 
        disabled: !piStreamUrl, 
        onClick: handlePiStreamConnect 
      };
    }
    // Default for laptop
    return { 
      text: "Start Analysis", 
      disabled: !hasCameraPermission, 
      onClick: handleStartAnalysis 
    };
  };

  const { 
    text: buttonText, 
    disabled: buttonDisabled, 
    onClick: buttonOnClick, 
    variant: buttonVariant, 
    icon: buttonIcon 
  } = getButtonState();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Feed</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="laptop" className="w-full" onValueChange={handleTabChange} value={activeTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="laptop"><Laptop className="mr-2" /> Laptop Camera</TabsTrigger>
            <TabsTrigger value="raspberry-pi"><Router className="mr-2" /> Raspberry Pi</TabsTrigger>
            <TabsTrigger value="video-file"><Video className="mr-2" /> Video File</TabsTrigger>
          </TabsList>

          <div className="relative aspect-video w-full overflow-hidden rounded-lg border mt-4 bg-black">
            <video 
              ref={videoRef} 
              className="w-full h-full aspect-video rounded-md" 
              muted 
              playsInline 
            />
            <canvas 
              ref={canvasRef} 
              className="absolute top-0 left-0 w-full h-full pointer-events-none" 
            />

            {modelLoading && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white z-10">
                <Loader2 className="h-12 w-12 animate-spin mb-4" />
                <p>Loading YOLOv8s Model...</p> 
                <p className="text-sm text-gray-400 mt-2">This may take a moment...</p>
              </div>
            )}

            {gpuInfo && !modelLoading && (
              <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 text-xs rounded z-20">
                {gpuInfo}
              </div>
            )}
            
            {debugInfo && (
              <div className="absolute bottom-16 left-2 bg-black/70 text-white px-2 py-1 text-xs rounded z-20 font-mono">
                {debugInfo}
              </div>
            )}

            <TabsContent value="laptop" className="absolute inset-0 m-0">
              {!hasCameraPermission && !modelLoading && !isProcessing && (
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
                    <p className="text-muted-foreground text-center">
                      Enter the streaming URL from your Raspberry Pi camera.
                    </p>
                    <Input 
                      type="url" 
                      placeholder="e.g., http://192.168.1.10:8000/stream.mjpg"
                      value={piStreamUrl}
                      onChange={(e) => setPiStreamUrl(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="video-file" className="absolute inset-0 m-0">
              {!videoFile && !isProcessing && !modelLoading && (
                <div className="h-full w-full flex items-center justify-center bg-background z-10">
                  <div className="flex flex-col gap-4 p-4 w-full max-w-md text-center">
                    <p className="text-muted-foreground">
                      Upload a video file to run detection algorithms.
                    </p>
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
              {/* Special logic for Pi tab button, which is inside the tab content */}
              {activeTab === 'raspberry-pi' && !isProcessing && !modelLoading ? (
                 <Button 
                    onClick={handlePiStreamConnect} 
                    disabled={!piStreamUrl || modelLoading}
                    className="shadow-lg"
                  >
                    {modelLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {modelLoading ? "Loading Model..." : "Connect & Analyze"}
                  </Button>
              ) : activeTab === 'video-file' && !videoFile && !isProcessing ? null : (
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

            {isProcessing && (
              <div className="absolute top-2 right-2 bg-destructive/80 text-white px-2 py-1 text-xs rounded font-bold animate-pulse z-20">
                ● LIVE ANALYSIS
              </div>
            )}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}