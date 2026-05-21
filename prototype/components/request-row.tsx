"use client";

import { SlaBadge } from "@/components/sla-badge";
import { lastNotifiedAt, type RequestRecord } from "@/lib/data";

interface RequestRowProps {
  request: RequestRecord;
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
  new: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  triage: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
  in_progress: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
  blocked: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
};

const PRIORITY_LABEL: Record<RequestRecord["priority"], string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const TIER_LABEL: Record<RequestRecord["customerTier"], string> = {
  standard: "",
  pro: "Pro",
  vip: "VIP",
};

function formatLastNotified(req: RequestRecord): string {
  const at = lastNotifiedAt(req);
  if (!at) return "Never";
  const hours = (Date.now() - new Date(at).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function RequestRow({ request, onSelect }: RequestRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(request.id)}
      className="group grid w-full grid-cols-[1fr_auto] items-start gap-3 rounded-lg border border-slate-200/70 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {request.customerName}
          </span>
          {TIER_LABEL[request.customerTier] && (
            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-slate-200 dark:text-slate-900">
              {TIER_LABEL[request.customerTier]}
            </span>
          )}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_TONE[request.status]}`}
          >
            {STATUS_LABEL[request.status]}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-slate-700 dark:text-slate-300">
          {request.title}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {PRIORITY_LABEL[request.priority]} priority · {request.assignedTeam} team
          · Last notified {formatLastNotified(request)}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 md:flex-row md:items-center md:gap-3">
        <SlaBadge request={request} />
        <span className="text-xs text-slate-400 dark:text-slate-500 md:hidden">
          #{request.id}
        </span>
      </div>
    </button>
  );
}
