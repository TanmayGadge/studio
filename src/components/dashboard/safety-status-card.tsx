import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SafetyStatus } from "@/types";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface SafetyStatusCardProps {
  status: SafetyStatus;
}

const statusConfig = {
  Safe: {
    icon: CheckCircle2,
    label: "All Systems Safe",
    color: "text-primary",
  },
  Warning: {
    icon: AlertTriangle,
    label: "Potential Hazard",
    color: "text-accent",
  },
  Danger: {
    icon: XCircle,
    label: "Immediate Danger",
    color: "text-destructive",
  },
};

export function SafetyStatusCard({ status }: SafetyStatusCardProps) {
  const { icon: Icon, label, color } = statusConfig[status];

  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Safety Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Icon className={cn("h-10 w-10 transition-colors", color)} />
          <p className={cn("text-xl font-bold transition-colors", color)}>{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
