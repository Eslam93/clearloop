import { getTranslator } from "@/i18n/server";

// The product in one picture: the team changes a request, the account manager tells the
// customer, the customer reads it. An update travels around the ring; reduced motion stops it.

export async function LoopDiagram() {
  const { t } = await getTranslator();
  const stations = [
    { key: "engineering", angle: -90, color: "var(--fg-muted)" },
    { key: "you", angle: 30, color: "var(--brand)" },
    { key: "customer", angle: 150, color: "var(--debt)" },
  ] as const;
  const cx = 160;
  const cy = 150;
  const r = 100;
  const at = (deg: number, radius = r) => ({
    x: cx + radius * Math.cos((deg * Math.PI) / 180),
    y: cy + radius * Math.sin((deg * Math.PI) / 180),
  });

  return (
    <figure className="pane relative mx-auto w-full max-w-md overflow-hidden p-4">
      <svg viewBox="0 0 320 300" role="img" aria-label={t("landing.diagram.label")} className="w-full">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--debt)" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#ring)" strokeWidth="3" strokeDasharray="4 7" />
        <g className="loop-orbit" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <circle cx={cx + r} cy={cy} r="7" fill="var(--brand)" />
          <circle cx={cx + r} cy={cy} r="12" fill="var(--brand)" opacity="0.18" />
        </g>
        {stations.map((s) => {
          const p = at(s.angle);
          return (
            <g key={s.key}>
              <circle cx={p.x} cy={p.y} r="9" fill="var(--panel)" stroke={s.color} strokeWidth="3" />
            </g>
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-fg text-[15px] font-semibold">
          {t("landing.diagram.closed")}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="fill-fg-subtle font-mono text-[11px]">
          ask-first 0%
        </text>
      </svg>
      <figcaption className="mt-2 grid grid-cols-3 gap-2 text-center text-xs leading-snug text-fg-muted">
        {stations.map((s) => (
          <span key={s.key} className="flex flex-col items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            {t(`landing.diagram.${s.key}`)}
          </span>
        ))}
      </figcaption>
      <style>{`
        @keyframes loop-orbit { from { transform: rotate(-90deg) } to { transform: rotate(270deg) } }
        .loop-orbit { animation: loop-orbit 7s cubic-bezier(.55,.1,.35,.9) infinite; }
      `}</style>
    </figure>
  );
}
