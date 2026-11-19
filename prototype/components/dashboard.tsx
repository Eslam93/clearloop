"use client";

import { useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { RequestRow } from "@/components/request-row";
import { FilterChip } from "@/components/filter-chip";
import { RequestDrawer } from "@/components/request-drawer";
import { formatDateLabel, hoursToSla, slaState } from "@/lib/sla";
import type {
  CurrentUser,
  NotificationRecord,
  RequestRecord,
} from "@/lib/types";

type StatusFilter = "open" | "all";

interface DashboardProps {
  // Already scoped to the current tenant on the server.
  initialRequests: RequestRecord[];
  currentUser: CurrentUser;
  // The one clock for this render. Server and browser both use it.
  nowIso: string;
}

export function Dashboard({ initialRequests, currentUser, nowIso }: DashboardProps) {
  const [requests, setRequests] = useState<RequestRecord[]>(initialRequests);
  const [filter, setFilter] = useState<StatusFilter>("open");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const open = requests.filter((r) => r.status !== "resolved").length;
    const atRisk = requests.filter(
      (r) => r.status !== "resolved" && slaState(r.slaDueAt, nowIso) === "at_risk"
    ).length;
    const breached = requests.filter(
      (r) => r.status !== "resolved" && slaState(r.slaDueAt, nowIso) === "breached"
    ).length;
    return { open, atRisk, breached, total: requests.length };
  }, [requests, nowIso]);

  const visible = useMemo(() => {
    const filtered =
      filter === "open"
        ? requests.filter((r) => r.status !== "resolved")
        : requests.slice();
    return filtered.sort((a, b) => {
      const sa = slaState(a.slaDueAt, nowIso);
      const sb = slaState(b.slaDueAt, nowIso);
      const order = { breached: 0, at_risk: 1, healthy: 2 };
      if (order[sa] !== order[sb]) return order[sa] - order[sb];
      return hoursToSla(a.slaDueAt, nowIso) - hoursToSla(b.slaDueAt, nowIso);
    });
  }, [requests, filter, nowIso]);

  const selected = openId ? requests.find((r) => r.id === openId) ?? null : null;

  function handleSelect(id: string) {
    setOpenId(id);
  }

  function handleNotified(requestId: string, notification: NotificationRecord) {
    // A notification is not a status change, so `version` stays put. The
    // design in part2-technical.md increments it on status changes only.
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, notifications: [...r.notifications, notification] }
          : r
      )
    );
  }

  const initials = currentUser.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <main className="min-h-screen text-foreground">
      <Toaster richColors position="top-right" />

      <header className="border-b border-black/[0.06] bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-foreground)] shadow-[0_8px_18px_-8px_oklch(0.5_0.13_200_/_0.5)]">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-3.5-7.1" />
                <path d="M21 4v5h-5" />
              </svg>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">
                ClearLoop
              </span>
              <span className="text-[11px] text-muted-foreground">
                Account Manager Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-black/[0.06] bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--sla-healthy)]" />
              Tenant {currentUser.tenantId.replace("tnt_", "")}
            </span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[11px] font-semibold text-[var(--brand-ink)]">
                {initials}
              </div>
              <div className="hidden flex-col text-right leading-tight sm:flex">
                <span className="text-xs font-semibold">{currentUser.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  Account Manager
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-16 pt-10">
        <div className="flex flex-col gap-1">
          <span className="text-kicker">Today · {formatDateLabel(nowIso)}</span>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            My requests
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Every open request from customers you own. Sorted by SLA risk so the
            customer never asks first.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Counter label="Open" value={counts.open} tone="brand" hint="active right now" />
          <Counter label="At risk" value={counts.atRisk} tone="amber" hint="under 4h to SLA" />
          <Counter label="Breached" value={counts.breached} tone="rose" hint="past SLA — escalate" />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
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
          <span className="ml-auto text-[11px] uppercase tracking-wider text-muted-foreground">
            Sorted: Breached → At risk → Healthy
          </span>
        </div>

        <ul className="mt-4 flex flex-col gap-2.5">
          {visible.map((req) => (
            <li key={req.id}>
              <RequestRow request={req} nowIso={nowIso} onSelect={handleSelect} />
            </li>
          ))}
        </ul>

        {visible.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-black/10 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing matches the current filter. Try switching to{" "}
              <span className="font-medium text-foreground">All</span>.
            </p>
          </div>
        )}

        <footer className="mt-14 rounded-2xl border border-black/[0.05] bg-white/60 px-5 py-4 text-xs text-muted-foreground backdrop-blur">
          <p className="leading-relaxed">
            <span className="font-semibold text-foreground">Static demo.</span>{" "}
            Notification record is persisted server-side via{" "}
            <code className="rounded bg-black/[0.05] px-1.5 py-0.5 font-mono text-[11px]">
              POST /api/requests/[id]/notify
            </code>
            ; WhatsApp/email delivery is mocked. Tenant B exists in the dataset
            but is filtered out on the server by{" "}
            <code className="rounded bg-black/[0.05] px-1.5 py-0.5 font-mono text-[11px]">
              currentUser.tenant_id
            </code>{" "}
            and never reaches the browser.
          </p>
        </footer>
      </section>

      <RequestDrawer
        request={selected}
        currentUser={currentUser}
        nowIso={nowIso}
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
  hint: string;
  tone: "brand" | "amber" | "rose";
}

function Counter({ label, value, hint, tone }: CounterProps) {
  const accents = {
    brand: {
      ring: "ring-[var(--brand)]/15",
      bar: "bg-[var(--brand)]",
      text: "text-[var(--brand-ink)]",
    },
    amber: {
      ring: "ring-[var(--sla-risk)]/20",
      bar: "bg-[var(--sla-risk)]",
      text: "text-[var(--sla-risk-ink)]",
    },
    rose: {
      ring: "ring-[var(--sla-breached)]/20",
      bar: "bg-[var(--sla-breached)]",
      text: "text-[var(--sla-breached-ink)]",
    },
  }[tone];

  return (
    <div className={`surface-card relative overflow-hidden p-5 ring-1 ${accents.ring}`}>
      <div className={`absolute inset-y-0 left-0 w-[3px] ${accents.bar}`} />
      <div className="flex items-start justify-between">
        <span className="text-kicker">{label}</span>
        <span className={`h-2 w-2 rounded-full ${accents.bar}`} />
      </div>
      <p className={`mt-3 text-4xl font-semibold tabular-nums ${accents.text}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
