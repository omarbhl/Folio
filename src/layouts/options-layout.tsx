import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function OptionsLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className={cn("mx-auto min-h-svh w-full", className)}>{children}</div>
    </div>
  );
}
