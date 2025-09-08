"use client";
import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Laptop, Router, Video } from "lucide-react";
import { analyzeVideo, AnalyzeVideoOutput } from "@/ai/flows/video-analysis-flow";

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

  const drawDetections = (detections: AnalyzeVideoOutput) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw lanes
    ctx.strokeStyle = "rgba(0, 255, 0, 0.7)";
    ctx.lineWidth = 4;
    detections.lanes.forEach(lane => {
      ctx.beginPath();
      ctx.moveTo(lane.startX, lane.startY);
      ctx.lineTo(lane.endX, lane.endY);
      ctx.stroke();
    });

    // Draw objects
    ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
    ctx.lineWidth = 2;
    ctx.font = "16px Arial";
    ctx.fillStyle = "rgba(255, 0, 0, 0.9)";
    detections.objects.forEach(obj => {
      ctx.beginPath();
      ctx.rect(obj.x, obj.y, obj.width, obj.height);
      ctx.stroke();
      ctx.fillText(obj.label, obj.x, obj.y - 5);
    });
  };

  const processFrame = async () => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended || !isProcessing) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext("2d");

    if (tempCtx) {
      tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
      const dataUri = tempCanvas.toDataURL("image/jpeg");
      
      try {
        const result = await analyzeVideo({ frameDataUri: dataUri });
        drawDetections(result);
      } catch (error) {
        console.error("Error analyzing frame:", error);
      }
    }
    
    requestAnimationFrame(processFrame);
  };
  
  useEffect(() => {
    const video = videoRef.current;
    
    const startProcessing = () => {
      if (videoFile) {
        setIsProcessing(true);
        requestAnimationFrame(processFrame);
      }
    };
    
    const stopProcessing = () => {
      setIsProcessing(false);
    };

    if(video) {
        video.addEventListener('play', startProcessing);
        video.addEventListener('pause', stopProcessing);
        video.addEventListener('ended', stopProcessing);
    }

    return () => {
        if(video) {
            video.removeEventListener('play', startProcessing);
            video.removeEventListener('pause', stopProcessing);
            video.removeEventListener('ended', stopProcessing);
        }
    };
  }, [videoRef, videoFile, isProcessing]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setIsProcessing(false); // Stop processing previous video
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(file);
        videoRef.current.loop = true;
        videoRef.current.play();
      }
    }
  };

  const handlePiStreamConnect = () => {
    if (piStreamUrl && videoRef.current) {
      setVideoFile(null);
      setIsProcessing(false);
      videoRef.current.srcObject = null;
      videoRef.current.src = piStreamUrl;
    }
  };

  const handleTabChange = async (value: string) => {
    setIsProcessing(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
      videoRef.current.srcObject = null;
    }

    if (value === "laptop") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
      }
    } else if (value === "video-file" && videoFile && videoRef.current) {
       videoRef.current.src = URL.createObjectURL(videoFile);
       videoRef.current.play();
    }
  };

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

          <div className="relative aspect-video w-full overflow-hidden rounded-lg border mt-4">
             <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted playsInline />
             <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />

            <TabsContent value="laptop" className="absolute inset-0 m-0">
                {!hasCameraPermission && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Alert variant="destructive" className="w-auto">
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                        Please allow camera access to use this feature.
                        </AlertDescription>
                    </Alert>
                    </div>
                )}
                <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 text-xs rounded">
                    REC ●
                </div>
            </TabsContent>
            
            <TabsContent value="raspberry-pi" className="absolute inset-0 m-0">
                <div className="h-full w-full flex items-center justify-center bg-background">
                    <div className="flex flex-col gap-4 p-4 w-full max-w-md">
                    <p className="text-muted-foreground text-center">Enter the streaming URL from your Raspberry Pi camera.</p>
                    <Input 
                        type="url" 
                        placeholder="e.g., http://192.168.1.10:8000/stream.mjpg"
                        value={piStreamUrl}
                        onChange={(e) => setPiStreamUrl(e.target.value)}
                    />
                    <Button onClick={handlePiStreamConnect}>Connect to Stream</Button>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="video-file" className="absolute inset-0 m-0">
                <div className="h-full w-full flex items-center justify-center bg-background">
                    <div className="flex flex-col gap-4 p-4 w-full max-w-md text-center">
                        <p className="text-muted-foreground">Upload a video file to run detection algorithms.</p>
                        <Input 
                            type="file" 
                            accept="video/*" 
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="file:text-foreground"
                        />
                        {videoFile && <p>Selected: {videoFile.name}</p>}
                    </div>
                </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
