import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={cn("border-border/60", className)}>
      <CardContent className="flex items-start justify-between pt-6">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          {subtext && (
            <p className="mt-1 text-sm text-muted-foreground">{subtext}</p>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
          <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
        </div>
      </CardContent>
    </Card>
  );
}
