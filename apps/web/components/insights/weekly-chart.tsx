"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { DATE_LOCALES } from "@/i18n/core";
import { percent } from "@/lib/view/format";

interface Week {
  start: number;
  end: number;
  rate: number | null;
  decided: number;
}

/**
 * Ask-first rate by week: one series, so no legend (the title names it). Columns are capped at
 * 24px with a 4px rounded top, square at the baseline; only the latest week is labelled, and every
 * value is on hover, on keyboard focus, and in the table below.
 */
export function WeeklyChart({ weeks }: { weeks: Week[] }) {
  const { t, language } = useT();
  const [hover, setHover] = useState<number | null>(null);
  // Close to the rendered width, so 11px text and the 24px bar cap stay true to size.
  const width = 900;
  const height = 240;
  const pad = { top: 22, bottom: 30, start: 40, end: 12 };
  const plotW = width - pad.start - pad.end;
  const plotH = height - pad.top - pad.bottom;
  const band = plotW / weeks.length;
  const barW = Math.min(24, band * 0.5);
  const y = (v: number) => pad.top + plotH * (1 - v);
  const fmtDay = (ms: number) => new Intl.DateTimeFormat(DATE_LOCALES[language], { day: "numeric", month: "short" }).format(ms);
  const rtl = language === "ar";
  // In Arabic the time axis runs right to left, like the text.
  const x = (i: number) => (rtl ? pad.start + plotW - band * (i + 0.5) : pad.start + band * (i + 0.5));

  return (
    <figure>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={t("insights.weekly")}>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={pad.start} x2={width - pad.end} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
              <text x={pad.start - 8} y={y(v) + 4} textAnchor="end" className="fill-fg-subtle text-[11px] num">
                {percent(v, language)}
              </text>
            </g>
          ))}
          {weeks.map((w, i) => {
            const cx = x(i);
            const value = w.rate ?? 0;
            const top = y(value);
            const h = Math.max(0, pad.top + plotH - top);
            const r = Math.min(4, h);
            const left = cx - barW / 2;
            const latest = i === weeks.length - 1;
            return (
              <g
                key={w.start}
                tabIndex={0}
                role="img"
                aria-label={`${fmtDay(w.start)} – ${fmtDay(w.end)}: ${percent(w.rate, language)}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="outline-none"
              >
                {/* The hit target is the whole band, not just the painted bar. */}
                <rect x={cx - band / 2} y={pad.top} width={band} height={plotH} fill="transparent" />
                {w.rate !== null && h > 0 && (
                  <path
                    d={`M${left},${pad.top + plotH} V${top + r} Q${left},${top} ${left + r},${top} H${left + barW - r} Q${left + barW},${top} ${left + barW},${top + r} V${pad.top + plotH} Z`}
                    fill="var(--chart-debt)"
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                )}
                {latest && w.rate !== null && (
                  <text x={cx} y={top - 6} textAnchor="middle" className="fill-fg text-[12px] font-semibold">
                    {percent(w.rate, language)}
                  </text>
                )}
                <text x={cx} y={height - 10} textAnchor="middle" className="fill-fg-subtle text-[11px]">
                  {fmtDay(w.start)}
                </text>
              </g>
            );
          })}
          <line x1={pad.start} x2={width - pad.end} y1={pad.top + plotH} y2={pad.top + plotH} stroke="var(--line-strong)" strokeWidth="1" />
        </svg>
        {hover !== null && weeks[hover] && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow-pane"
            style={{ insetInlineStart: `${(rtl ? weeks.length - 1 - hover : hover) * (100 / weeks.length) + 2}%` }}
          >
            <p className="text-sm font-semibold">{percent(weeks[hover].rate, language)}</p>
            <p className="text-fg-muted">
              {fmtDay(weeks[hover].start)} – {fmtDay(weeks[hover].end)} · {weeks[hover].decided}
            </p>
          </div>
        )}
      </div>
      <details className="mt-2 text-xs text-fg-muted">
        <summary className="cursor-pointer select-none">{t("insights.showTable")}</summary>
        <table className="mt-2 w-full text-start">
          <thead>
            <tr className="text-fg-subtle">
              <th className="py-1 text-start font-medium">{t("insights.columns.week")}</th>
              <th className="py-1 text-end font-medium">{t("insights.askFirst")}</th>
              <th className="py-1 text-end font-medium">{t("insights.columns.changes")}</th>
            </tr>
          </thead>
          <tbody className="num">
            {weeks.map((w) => (
              <tr key={w.start} className="border-t border-line">
                <td className="py-1">
                  {fmtDay(w.start)} – {fmtDay(w.end)}
                </td>
                <td className="py-1 text-end">{percent(w.rate, language)}</td>
                <td className="py-1 text-end">{w.decided}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
