"use client";

import { useState, useEffect, useRef } from "react";
import type { Alert, SafetyStatus } from "@/types";
import { Header } from "@/components/dashboard/header";
import { MainDisplayCard } from "@/components/dashboard/main-display-card";
import { StatusCard } from "@/components/dashboard/status-card";
import { ArrowRightLeft, Gauge, GitCommitHorizontal } from "lucide-react";
import { SimulationControls } from "@/components/dashboard/simulation-controls";
import { AlertLog } from "@/components/dashboard/alert-log";
import { HazardAlertBanner } from "@/components/dashboard/hazard-alert-banner";
import { SafetyStatusCard } from "@/components/dashboard/safety-status-card";
import { useToast } from "@/hooks/use-toast";
import { ServerDisplayCard } from "@/components/serverDisplay/ServerDisplayCard";

export default function DriveSafePage() {
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus>("Safe");
  const [currentAlert, setCurrentAlert] = useState<Alert | null>(null);
  const [alertLog, setAlertLog] = useState<Alert[]>([]);
  
  const { toast } = useToast();
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);


  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };

    getCameraPermission();
  }, [toast]);

  useEffect(() => {
    const simulationInterval = setInterval(() => {
      setSpeed((prev) => {
        const change = (Math.random() - 0.5) * 10;
        const newSpeed = prev + change;
        return Math.max(0, Math.min(120, newSpeed));
      });
      setDistance(Math.floor(Math.random() * 50) + 5);
      setTilt(+(Math.random() * 2 - 1).toFixed(2));
    }, 2000);

    return () => clearInterval(simulationInterval);
  }, []);

  const triggerAlert = (type: "Lane Departure" | "Obstacle", message: string) => {
    const newAlert: Alert = {
      id: new Date().toISOString(),
      type,
      message,
      timestamp: new Date(),
    };
    
    setCurrentAlert(newAlert);
    setAlertLog((prev) => [newAlert, ...prev]);
    setSafetyStatus(type === "Obstacle" ? "Danger" : "Warning");

    setTimeout(() => {
      setCurrentAlert(null);
      setSafetyStatus("Safe");
    }, 5000);
  };
  
  const handleSimulateLaneDeparture = () => {
    triggerAlert("Lane Departure", "Vehicle drifting to the right lane.");
  };

  const handleSimulateObstacle = () => {
    triggerAlert("Obstacle", "Obstacle detected 5m ahead. BRAKE NOW!");
  };
  
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <HazardAlertBanner alert={currentAlert} />

      <main className="p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Left Column */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <ServerDisplayCard  
              // videoRef={videoRef} 
              // hasCameraPermission={hasCameraPermission}
            />
            <AlertLog alerts={alertLog} />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <SafetyStatusCard status={safetyStatus} />
            <StatusCard 
              icon={Gauge} 
              title="Speed" 
              value={speed.toFixed(0)} 
              unit="km/h" 
            />
            <StatusCard 
              icon={ArrowRightLeft} 
              title="Fwd. Distance" 
              value={distance} 
              unit="m" 
            />
            <StatusCard 
              icon={GitCommitHorizontal} 
              title="Tilt Angle" 
              value={tilt} 
              unit="°" 
            />
            <SimulationControls 
              onLaneDeparture={handleSimulateLaneDeparture}
              onObstacle={handleSimulateObstacle}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
