"use client";
import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Laptop, Router, Video } from "lucide-react";

interface MainDisplayCardProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  hasCameraPermission: boolean;
}

export function MainDisplayCard({ videoRef, hasCameraPermission }: MainDisplayCardProps) {
  const [piStreamUrl, setPiStreamUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(file);
        videoRef.current.loop = true;
      }
    }
  };

  const handlePiStreamConnect = () => {
    if (piStreamUrl && videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = piStreamUrl;
    }
  };

  const handleTabChange = async (value: string) => {
    if (videoRef.current) {
      // Stop any existing video/stream
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
          <TabsContent value="laptop">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border mt-4">
              <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted playsInline />
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
            </div>
          </TabsContent>
          <TabsContent value="raspberry-pi">
             <div className="relative aspect-video w-full overflow-hidden rounded-lg border mt-4 flex items-center justify-center">
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
          <TabsContent value="video-file">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border mt-4 flex items-center justify-center">
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
        </Tabs>
      </CardContent>
    </Card>
  );
}
