import type { SlaState } from "@/lib/types";

interface SlaBadgeProps {
  state: SlaState;
  hours: number;
}

export function SlaBadge({ state, hours }: SlaBadgeProps) {
  if (state === "breached") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
        style={{
          backgroundColor: "var(--sla-breached-soft)",
          borderColor: "color-mix(in oklch, var(--sla-breached) 30%, transparent)",
          color: "var(--sla-breached-ink)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--sla-breached)" }}
        />
        Breached · {Math.abs(hours).toFixed(0)}h over
      </span>
    );
  }

  if (state === "at_risk") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
        style={{
          backgroundColor: "var(--sla-risk-soft)",
          borderColor: "color-mix(in oklch, var(--sla-risk) 30%, transparent)",
          color: "var(--sla-risk-ink)",
        }}
      >
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ backgroundColor: "var(--sla-risk)" }}
        />
        At risk · {hours.toFixed(1)}h left
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{
        backgroundColor: "var(--sla-healthy-soft)",
        borderColor: "color-mix(in oklch, var(--sla-healthy) 25%, transparent)",
        color: "var(--sla-healthy-ink)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: "var(--sla-healthy)" }}
      />
      On track · {hours.toFixed(0)}h left
    </span>
  );
}
