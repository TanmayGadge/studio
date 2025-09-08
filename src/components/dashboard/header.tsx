import { ShieldCheck } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
      <div className="flex items-center gap-3">
        <ShieldCheck className="text-primary h-8 w-8" />
        <h1 className="text-2xl font-bold">DriveSafe</h1>
      </div>
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
        </span>
        <span className="text-sm text-muted-foreground">System Online</span>
      </div>
    </header>
  );
}
