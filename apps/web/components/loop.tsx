// The loop: ClearLoop's one shape. An open loop means the customer is behind on what changed; a
// closed loop means they are up to date. The logo, the row indicator and the notify animation all
// use it, so the product's name means something on screen.

interface LoopGlyphProps {
  state: "open" | "closed" | "asked";
  size?: number;
  className?: string;
  title?: string;
}

export function LoopGlyph({ state, size = 16, className, title }: LoopGlyphProps) {
  const color =
    state === "closed" ? "var(--brand)" : state === "asked" ? "var(--sla-breached)" : "var(--debt)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {state === "closed" ? (
        <>
          <circle cx="8" cy="8" r="5.5" fill="none" stroke={color} strokeWidth="2" />
          <circle cx="8" cy="8" r="1.75" fill={color} />
        </>
      ) : (
        <>
          {/* A ring with a gap at the top right: the update that hasn't reached the customer. */}
          <path
            d="M 12.76 5.25 A 5.5 5.5 0 1 1 8 2.5"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12.4" cy="2.9" r="1.6" fill={color} />
        </>
      )}
    </svg>
  );
}

/** The brand mark: a closed loop with the update travelling on it. */
export function Logo({ size = 28, withName = true }: { size?: number; withName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="inline-flex items-center justify-center rounded-[9px] bg-brand text-brand-fg shadow-[0_6px_16px_-8px_var(--brand)]"
        style={{ width: size, height: size }}
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.9" />
          <circle cx="12.3" cy="5" r="2" fill="currentColor" />
        </svg>
      </span>
      {withName && <span className="text-[15px] font-semibold tracking-tight">ClearLoop</span>}
    </span>
  );
}
