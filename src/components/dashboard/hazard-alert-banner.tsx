"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { Alert } from "@/types";
import { cn } from "@/lib/utils";

interface HazardAlertBannerProps {
  alert: Alert | null;
}

export function HazardAlertBanner({ alert }: HazardAlertBannerProps) {
  if (!alert) {
    return null;
  }

  const isObstacle = alert.type === "Obstacle";

  return (
    <div
      className={cn(
        "fixed top-20 left-1/2 -translate-x-1/2 w-11/12 max-w-2xl z-50 p-4 rounded-lg flex items-center gap-4 shadow-2xl",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full",
        isObstacle
          ? "bg-destructive/90 border border-destructive text-destructive-foreground"
          : "bg-accent/90 border border-accent text-accent-foreground"
      )}
      data-state={alert ? "open" : "closed"}
      key={alert.id}
    >
      {isObstacle ? (
        <ShieldAlert className="h-8 w-8 flex-shrink-0" />
      ) : (
        <AlertTriangle className="h-8 w-8 flex-shrink-0" />
      )}
      <div className="flex-grow">
        <h3 className="font-bold text-lg">{alert.type} Detected</h3>
        <p className="text-sm">{alert.message}</p>
      </div>
    </div>
  );
}
