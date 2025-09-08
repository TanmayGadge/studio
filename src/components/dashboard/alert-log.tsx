import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Alert } from "@/types";
import { FileClock } from "lucide-react";

interface AlertLogProps {
  alerts: Alert[];
}

export function AlertLog({ alerts }: AlertLogProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert Log</CardTitle>
        <CardDescription>A history of all detected hazards.</CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-muted-foreground">
            <FileClock className="h-12 w-12" />
            <p>No alerts recorded yet.</p>
          </div>
        ) : (
          <div className="max-h-[250px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>{alert.timestamp.toLocaleTimeString()}</TableCell>
                    <TableCell>
                      <span className={alert.type === "Obstacle" ? "text-destructive" : "text-accent"}>
                        {alert.type}
                      </span>
                    </TableCell>
                    <TableCell>{alert.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
