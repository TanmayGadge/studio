import { Car, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface SimulationControlsProps {
  onLaneDeparture: () => void;
  onObstacle: () => void;
}

export function SimulationControls({ onLaneDeparture, onObstacle }: SimulationControlsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hazard Simulation</CardTitle>
        <CardDescription>Trigger events to test system response.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button variant="outline" onClick={onLaneDeparture} className="justify-start">
          <Waypoints className="mr-2 h-4 w-4 text-accent" />
          Simulate Lane Departure
        </Button>
        <Button variant="destructive" onClick={onObstacle} className="justify-start">
          <Car className="mr-2 h-4 w-4" />
          Simulate Obstacle
        </Button>
      </CardContent>
    </Card>
  );
}
