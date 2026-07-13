import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, FileQuestion, LoaderCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FeedbackStateProps = {
  title: string;
  description: string;
  variant?: "loading" | "empty" | "error" | "success";
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  icon?: LucideIcon;
};

const stateDefaults = {
  loading: { icon: LoaderCircle, className: "text-primary", iconClassName: "animate-spin" },
  empty: { icon: FileQuestion, className: "text-foreground", iconClassName: "" },
  error: { icon: AlertCircle, className: "border-destructive/40 text-destructive", iconClassName: "" },
  success: { icon: CheckCircle2, className: "border-success/35 text-success", iconClassName: "" }
} as const;

export function FeedbackState({
  title,
  description,
  variant = "empty",
  actionLabel,
  onAction,
  compact = false,
  icon
}: FeedbackStateProps) {
  const defaults = stateDefaults[variant];
  const Icon = icon ?? defaults.icon;

  return (
    <Alert
      className={cn(
        "motion-card grid items-start gap-x-3 border-border/80 bg-card/80 shadow-xs",
        compact ? "grid-cols-[auto_1fr] p-3" : "grid-cols-[auto_1fr] p-5",
        defaults.className
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon className={cn("mt-0.5 size-5", defaults.iconClassName)} aria-hidden="true" />
      <div className="min-w-0">
        <AlertTitle className="text-foreground">{title}</AlertTitle>
        <AlertDescription className="mt-1 text-muted-foreground">{description}</AlertDescription>
        {actionLabel && onAction && (
          <Button type="button" variant="outline" size="sm" className="mt-3 motion-press" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </Alert>
  );
}
