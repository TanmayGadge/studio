import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MainDisplayCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Camera Feed</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
          <Image
            src="https://picsum.photos/1280/720"
            alt="Simulated camera feed of a road"
            fill
            className="object-cover"
            priority
            data-ai-hint="road street"
          />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <p className="text-white/80 text-lg font-semibold tracking-widest uppercase">
              ESP32-CAM FEED
            </p>
          </div>
           <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 text-xs rounded">
            REC ●
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
