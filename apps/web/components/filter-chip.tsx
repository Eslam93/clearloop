"use client";

interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

export function FilterChip({ label, count, active, onClick }: FilterChipProps) {
  if (active) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-3.5 py-1.5 text-xs font-semibold text-[var(--brand-foreground)] shadow-[0_8px_22px_-12px_oklch(0.5_0.13_200_/_0.6)] transition focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
      >
        <span>{label}</span>
        <span className="rounded-full bg-white/20 px-1.5 py-px text-[10px] font-bold tabular-nums">
          {count}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-xs font-medium text-foreground/70 transition hover:border-black/15 hover:bg-white hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
    >
      <span>{label}</span>
      <span className="rounded-full bg-black/[0.06] px-1.5 py-px text-[10px] font-bold tabular-nums text-muted-foreground">
        {count}
      </span>
    </button>
  );
}
