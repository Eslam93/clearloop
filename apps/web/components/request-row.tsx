"use client";

import { SlaBadge } from "@/components/sla-badge";
import {
  formatRelative,
  hoursToSla,
  lastNotifiedAt,
  slaState,
} from "@/lib/sla";
import type { RequestRecord } from "@/lib/types";

interface RequestRowProps {
  request: RequestRecord;
  nowIso: string;
  onSelect: (id: string) => void;
}

const STATUS_LABEL: Record<RequestRecord["status"], string> = {
  new: "New",
  triage: "Triage",
  in_progress: "In progress",
  blocked: "Blocked",
  resolved: "Resolved",
};

const STATUS_TONE: Record<RequestRecord["status"], string> = {
  new: "bg-slate-100 text-slate-700",
  triage: "bg-sky-100 text-sky-800",
  in_progress: "bg-violet-100 text-violet-800",
  blocked: "bg-rose-100 text-rose-800",
  resolved: "bg-emerald-100 text-emerald-800",
};

const PRIORITY_LABEL: Record<RequestRecord["priority"], string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_DOT: Record<RequestRecord["priority"], string> = {
  low: "bg-slate-300",
  normal: "bg-sky-400",
  high: "bg-amber-500",
  urgent: "bg-rose-500",
};

const TIER_LABEL: Record<RequestRecord["customerTier"], string> = {
  standard: "",
  pro: "Pro",
  vip: "VIP",
};

const TIER_CLASS: Record<RequestRecord["customerTier"], string> = {
  standard: "",
  pro: "bg-slate-900 text-white",
  vip: "bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950",
};

function formatLastNotified(req: RequestRecord, nowIso: string): string {
  const at = lastNotifiedAt(req);
  return at ? formatRelative(at, nowIso) : "Never";
}

export function RequestRow({ request, nowIso, onSelect }: RequestRowProps) {
  const state = slaState(request.slaDueAt, nowIso);
  const hours = hoursToSla(request.slaDueAt, nowIso);

  const accentBar = {
    breached: "bg-[var(--sla-breached)]",
    at_risk: "bg-[var(--sla-risk)]",
    healthy: "bg-[var(--sla-healthy)]/60",
  }[state];

  return (
    <button
      type="button"
      onClick={() => onSelect(request.id)}
      className="group surface-card relative w-full overflow-hidden p-5 text-left transition hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_18px_36px_-18px_rgba(15,23,42,0.18)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${accentBar}`} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0 pl-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              {request.customerName}
            </span>
            {TIER_LABEL[request.customerTier] && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TIER_CLASS[request.customerTier]}`}
              >
                {TIER_LABEL[request.customerTier]}
              </span>
            )}
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_TONE[request.status]}`}
            >
              {STATUS_LABEL[request.status]}
            </span>
          </div>
          <p className="mt-1.5 truncate text-sm leading-snug text-foreground/80">
            {request.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[request.priority]}`}
              />
              {PRIORITY_LABEL[request.priority]}
            </span>
            <span>·</span>
            <span>{request.assignedTeam} team</span>
            <span>·</span>
            <span>Notified {formatLastNotified(request, nowIso)}</span>
            <span className="ml-auto hidden text-[10px] uppercase tracking-wider opacity-60 md:inline">
              {request.id}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <SlaBadge state={state} hours={hours} />
          <svg
            className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground md:block"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </div>
    </button>
  );
}
