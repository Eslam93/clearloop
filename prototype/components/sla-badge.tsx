import { Badge } from "@/components/ui/badge";
import { hoursToSla, slaState, type RequestRecord } from "@/lib/data";

interface SlaBadgeProps {
  request: Pick<RequestRecord, "slaDueAt">;
}

export function SlaBadge({ request }: SlaBadgeProps) {
  const state = slaState(request.slaDueAt);
  const hours = hoursToSla(request.slaDueAt);

  if (state === "breached") {
    const overdueHours = Math.abs(hours).toFixed(0);
    return (
      <Badge variant="destructive" className="text-[11px] font-medium">
        Breached · {overdueHours}h over
      </Badge>
    );
  }

  if (state === "at_risk") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/40 bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 text-[11px] font-medium"
      >
        At risk · {hours.toFixed(1)}h left
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 text-[11px] font-medium"
    >
      On track · {hours.toFixed(0)}h left
    </Badge>
  );
}
