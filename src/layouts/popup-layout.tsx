import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PopupLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn("relative w-[360px] max-w-full overflow-hidden bg-background text-foreground", className)}>
      {children}
    </main>
  );
}
