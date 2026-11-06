import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <div className="flex items-center gap-2 text-base text-muted-foreground">
          <Icon className="size-5" />
          {label}
        </div>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="text-base text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
