"use client";

import { useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { RequestRow } from "@/components/request-row";
import { FilterChip } from "@/components/filter-chip";
import { RequestDrawer } from "@/components/request-drawer";
import {
  CURRENT_USER,
  getVisibleRequests,
  hoursToSla,
  slaState,
  type NotificationRecord,
  type RequestRecord,
} from "@/lib/data";

type StatusFilter = "open" | "all";

const initialRequests = getVisibleRequests();

export default function DashboardPage() {
  const [requests, setRequests] = useState<RequestRecord[]>(initialRequests);
  const [filter, setFilter] = useState<StatusFilter>("open");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const open = requests.filter((r) => r.status !== "resolved").length;
    const atRisk = requests.filter(
      (r) => r.status !== "resolved" && slaState(r.slaDueAt) === "at_risk"
    ).length;
    const breached = requests.filter(
      (r) => r.status !== "resolved" && slaState(r.slaDueAt) === "breached"
    ).length;
    return { open, atRisk, breached, total: requests.length };
  }, [requests]);

  const visible = useMemo(() => {
    const filtered =
      filter === "open"
        ? requests.filter((r) => r.status !== "resolved")
        : requests.slice();
    // Sort: breached first, then at-risk, then by hours-to-sla ascending.
    return filtered.sort((a, b) => {
      const sa = slaState(a.slaDueAt);
      const sb = slaState(b.slaDueAt);
      const order = { breached: 0, at_risk: 1, healthy: 2 };
      if (order[sa] !== order[sb]) return order[sa] - order[sb];
      return hoursToSla(a.slaDueAt) - hoursToSla(b.slaDueAt);
    });
  }, [requests, filter]);

  const selected = openId ? requests.find((r) => r.id === openId) ?? null : null;

  function handleSelect(id: string) {
    setOpenId(id);
  }

  function handleNotified(requestId: string, notification: NotificationRecord) {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              notifications: [...r.notifications, notification],
              version: r.version + 1,
            }
          : r
      )
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Toaster richColors position="top-right" />

      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Account Manager Console · Tenant {CURRENT_USER.tenantId.replace("tnt_", "")}
          </p>
          <h1 className="text-xl font-semibold">My requests</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Logged in as {CURRENT_USER.name}. Showing requests for customers you own.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-6">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
          <Counter label="Open" value={counts.open} tone="default" />
          <Counter label="At risk" value={counts.atRisk} tone="amber" />
          <Counter label="Breached" value={counts.breached} tone="red" />
        </div>

        <div className="mt-6 flex items-center gap-2">
          <FilterChip
            label="Open"
            count={requests.filter((r) => r.status !== "resolved").length}
            active={filter === "open"}
            onClick={() => setFilter("open")}
          />
          <FilterChip
            label="All"
            count={requests.length}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <span className="ml-auto text-xs text-slate-500">
            Sorted by SLA (breached → at-risk → healthy)
          </span>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {visible.map((req) => (
            <li key={req.id}>
              <RequestRow request={req} onSelect={handleSelect} />
            </li>
          ))}
        </ul>

        {visible.length === 0 && (
          <p className="mt-6 rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
            No requests match the current filter.
          </p>
        )}

        <footer className="mt-12 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Static demo. Notification channel is mocked (toast only). Tenant B data
          exists in the dataset but is filtered out by{" "}
          <code className="rounded bg-slate-100 px-1 py-px text-[11px] dark:bg-slate-900">
            currentUser.tenant_id
          </code>
          .
        </footer>
      </section>

      <RequestDrawer
        request={selected}
        open={openId !== null}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
        onNotified={handleNotified}
      />
    </main>
  );
}

interface CounterProps {
  label: string;
  value: number;
  tone: "default" | "amber" | "red";
}

const TONE_CLASS: Record<CounterProps["tone"], string> = {
  default: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
  amber:
    "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30",
  red: "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30",
};

function Counter({ label, value, tone }: CounterProps) {
  return (
    <div className={`rounded-lg border p-4 ${TONE_CLASS[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
