export type SafetyStatus = "Safe" | "Warning" | "Danger";

export interface Alert {
  id: string;
  type: "Lane Departure" | "Obstacle";
  timestamp: Date;
  message: string;
}
