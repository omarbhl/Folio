import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function OptionsLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className={cn("mx-auto w-full max-w-[1240px] px-4 py-5 sm:px-6 lg:px-8", className)}>{children}</div>
    </div>
  );
}
