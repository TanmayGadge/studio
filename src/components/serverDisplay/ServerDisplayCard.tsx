"use client";
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ServerDisplayCard() {
  const [isStreaming, setIsStreaming] = useState(true);

  // The URL of our Python server's feed
  const streamUrl = "http://localhost:8000/video_feed";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server-Side Feed (Python + CUDA)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-black">
          {isStreaming ? (
            <img
              src={streamUrl}
              alt="Live video feed from Python server"
              className="w-full h-full aspect-video rounded-md"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-background">
              <p className="text-muted-foreground">
                Python server stream is offline.
              </p>
            </div>
          )}

          {isStreaming && (
            <div className="absolute top-2 right-2 bg-destructive/80 text-white px-2 py-1 text-xs rounded font-bold animate-pulse z-20">
              ● LIVE ANALYSIS (from Server)
            </div>
          )}
        </div>
        
        <div className="w-full flex justify-center mt-4">
          <Button
            variant={isStreaming ? "destructive" : "default"}
            onClick={() => setIsStreaming(!isStreaming)}
            className="shadow-lg"
          >
            {isStreaming ? "Stop Stream" : "Start Stream"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}