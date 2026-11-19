import "server-only";

// The sandbox every visitor gets. Deterministic content, anchored to the most recent Tuesday 10:30
// in Riyadh, so the demo always opens on a working morning in the Gulf. The sandbox's virtual clock
// then runs forward from there in real time.
//
// The current requests are chosen to show each idea once:
// - Nour Logistics #1042: two updates behind while its SLA is still fine (the brief's problem)
// - Falcon Retail #1045: the customer asked, and is waiting
// - Nour Logistics #1038: waiting on the customer, so its SLA clock is paused
// - Pearl Clinics #1036: breached in business time
// - Nour Logistics #1050: resolved, and nobody has told the customer
// History: 28 resolved requests over five weeks, so the insights have something to measure.

import { randomUUID } from "node:crypto";
import { localDateOf, localToInstant, presetCalendar } from "@clearloop/business-time";
import { eq, schema, type Tx } from "@clearloop/db";
import type { Status } from "@/lib/domain/types";
import { renderMessage, templateFor } from "@/lib/domain/templates";

const RIYADH = "Asia/Riyadh";
const DAY_MS = 86_400_000;

export const SEED_VERSION = 2;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The most recent Tuesday 10:30 in Riyadh at or before `realNow`. */
export function seedAnchor(realNow: number): number {
  let date = localDateOf(realNow, RIYADH);
  for (let i = 0; i < 8; i++) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const candidate = localToInstant(RIYADH, date, "10:30");
    if (weekday === 2 && candidate <= realNow) return candidate;
    date = addDays(date, -1);
  }
  throw new Error("no Tuesday found");
}

/** A small seeded random generator (mulberry32): the same sandbox every time. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Handle = "sarah" | "omar" | "layla" | "khalid" | "reem";
type CustomerKey = "nour" | "falcon" | "pearl" | "atlas" | "dune";

const USERS: Array<{ handle: Handle; name: string; role: "am" | "engineer"; team: string | null }> = [
  { handle: "sarah", name: "Sarah Al Hashimi", role: "am", team: null },
  { handle: "omar", name: "Omar Haddad", role: "am", team: null },
  { handle: "layla", name: "Layla Mansour", role: "engineer", team: "Mobile" },
  { handle: "khalid", name: "Khalid Othman", role: "engineer", team: "Payments" },
  { handle: "reem", name: "Reem Saleh", role: "engineer", team: "Platform" },
];

const CUSTOMERS: Record<
  CustomerKey,
  { name: string; tier: "standard" | "pro" | "vip"; calendar: string; language: "ar" | "en"; channel: "whatsapp" | "email"; contact: string; owner: Handle }
> = {
  nour: { name: "Nour Logistics", tier: "vip", calendar: "SA", language: "ar", channel: "whatsapp", contact: "فيصل", owner: "sarah" },
  falcon: { name: "Falcon Retail", tier: "pro", calendar: "AE", language: "en", channel: "whatsapp", contact: "Mariam", owner: "sarah" },
  pearl: { name: "Pearl Clinics", tier: "standard", calendar: "QA", language: "ar", channel: "email", contact: "د. هدى", owner: "sarah" },
  atlas: { name: "Atlas Manufacturing", tier: "pro", calendar: "EG", language: "en", channel: "email", contact: "Karim", owner: "omar" },
  dune: { name: "Dune Hospitality", tier: "vip", calendar: "AE", language: "en", channel: "whatsapp", contact: "James", owner: "omar" },
};

// Business-hour targets per tier and priority.
const TARGET_HOURS = {
  vip: { urgent: 4, high: 8, normal: 16, low: 32 },
  pro: { urgent: 6, high: 12, normal: 24, low: 48 },
  standard: { urgent: 8, high: 16, normal: 32, low: 64 },
} as const;

type Step =
  | { kind: "created"; at: number }
  | { kind: "status"; at: number; to: Status; by: Handle }
  | { kind: "note"; at: number; text: string; by: Handle; visibility: "internal" | "customer" }
  | { kind: "ping"; at: number; text: string }
  | { kind: "told"; at: number; by: Handle; read: boolean; note?: string };

interface Plan {
  number: number;
  customer: CustomerKey;
  title: string;
  priority: "low" | "normal" | "high" | "urgent";
  team: string;
  steps: Step[];
}

export interface SeedResult {
  tenantId: string;
  name: string;
}

/**
 * Writes a complete sandbox tenant. Runs inside withTenant for the new tenant's id: the tenant
 * row passes row-level security because its id is the transaction's tenant.
 */
export async function seedSandbox(tx: Tx, tenantId: string, realNow: number, expiresAt: Date): Promise<SeedResult> {
  const anchor = seedAnchor(realNow);
  const short = tenantId.slice(0, 4).toUpperCase();
  const name = `Sandbox ${short}`;

  await tx.insert(schema.tenants).values({
    id: tenantId,
    name,
    expiresAt,
    clockOffsetMs: anchor - realNow,
    seedVersion: SEED_VERSION,
  });

  const users = await tx
    .insert(schema.users)
    .values(USERS.map((u) => ({ tenantId, handle: u.handle, name: u.name, role: u.role, team: u.team })))
    .returning();
  const userId = (h: Handle) => users.find((u) => u.handle === h)!.id;
  const userName = (h: Handle) => users.find((u) => u.handle === h)!.name;

  const calendarIds = new Map<string, string>();
  const zone = new Map<string, string>();
  for (const id of ["SA", "AE", "QA", "EG"]) {
    const definition = presetCalendar(id);
    const [row] = await tx
      .insert(schema.businessCalendars)
      .values({ tenantId, name: definition.name, definition })
      .returning();
    calendarIds.set(id, row!.id);
    zone.set(id, definition.timeZone);
  }

  await tx.insert(schema.slaPolicies).values(
    (["vip", "pro", "standard"] as const).flatMap((tier) =>
      (["urgent", "high", "normal", "low"] as const).map((priority) => ({
        tenantId,
        tier,
        priority,
        targetMinutes: TARGET_HOURS[tier][priority] * 60,
      })),
    ),
  );

  const customerIds = new Map<CustomerKey, string>();
  for (const [key, c] of Object.entries(CUSTOMERS) as Array<[CustomerKey, (typeof CUSTOMERS)[CustomerKey]]>) {
    const [row] = await tx
      .insert(schema.customers)
      .values({
        tenantId,
        name: c.name,
        tier: c.tier,
        ownerUserId: userId(c.owner),
        calendarId: calendarIds.get(c.calendar)!,
        preferredLanguage: c.language,
        preferredChannel: c.channel,
        contactName: c.contact,
      })
      .returning();
    customerIds.set(key, row!.id);
  }

  // A local time on a day relative to the anchor's day, in a customer's zone.
  const at = (customer: CustomerKey, day: number, time: string) => {
    const tz = zone.get(CUSTOMERS[customer].calendar)!;
    return localToInstant(tz, addDays(localDateOf(anchor, tz), day), time);
  };

  const plans: Plan[] = [...currentPlans(at), ...historyPlans(at, anchor)];
  const lastInbound = new Map<CustomerKey, number>();

  for (const plan of plans) {
    const customer = CUSTOMERS[plan.customer];
    const steps = [...plan.steps].sort((a, b) => a.at - b.at);
    let status: Status = "new";
    let version = 1;
    let resolvedAt: number | null = null;
    for (const s of steps) {
      if (s.kind === "status") {
        status = s.to;
        version += 1;
        resolvedAt = s.to === "resolved" ? s.at : null;
      }
    }
    const opened = steps.find((s) => s.kind === "created")!.at;
    const [request] = await tx
      .insert(schema.requests)
      .values({
        tenantId,
        number: plan.number,
        customerId: customerIds.get(plan.customer)!,
        title: plan.title,
        status,
        priority: plan.priority,
        team: plan.team,
        version,
        openedAt: new Date(opened),
        resolvedAt: resolvedAt ? new Date(resolvedAt) : null,
      })
      .returning();

    let current: Status = "new";
    let currentVersion = 1;
    for (const s of steps) {
      const occurredAt = new Date(s.at);
      const base = { tenantId, requestId: request!.id, occurredAt };
      if (s.kind === "created") {
        await tx.insert(schema.requestEvents).values({ ...base, type: "created", visibility: "customer" });
      } else if (s.kind === "status") {
        await tx.insert(schema.requestEvents).values({
          ...base,
          type: "status_changed",
          visibility: "customer",
          actorUserId: userId(s.by),
          data: { from: current, to: s.to },
        });
        current = s.to;
        currentVersion += 1;
      } else if (s.kind === "note") {
        await tx.insert(schema.requestEvents).values({
          ...base,
          type: "note_added",
          visibility: s.visibility,
          actorUserId: userId(s.by),
          data: { text: s.text },
        });
      } else if (s.kind === "ping") {
        await tx.insert(schema.requestEvents).values({
          ...base,
          type: "customer_pinged",
          visibility: "customer",
          data: { text: s.text },
        });
        lastInbound.set(plan.customer, Math.max(lastInbound.get(plan.customer) ?? 0, s.at));
      } else {
        const template = templateFor(current);
        const body = renderMessage(template, customer.language, {
          contactName: customer.contact,
          requestNumber: plan.number,
          requestTitle: plan.title,
          status: current,
          amName: userName(s.by),
          eta: null,
          note: s.note ?? null,
        });
        const [n] = await tx
          .insert(schema.notifications)
          .values({
            tenantId,
            requestId: request!.id,
            customerId: customerIds.get(plan.customer)!,
            actorUserId: userId(s.by),
            channel: customer.channel,
            template,
            language: customer.language,
            body,
            note: s.note ?? null,
            statusAtSend: current,
            requestVersion: currentVersion,
            bodyHash: `seed-${plan.number}-${s.at}`,
            deliveryState: s.read ? "read" : "delivered",
            attempts: 1,
            providerMessageId: `sbx.seed.${tenantId}.${plan.number}.${s.at}`,
            sentAt: occurredAt,
            deliveredAt: new Date(s.at + 20_000),
            readAt: s.read ? new Date(s.at + 15 * 60_000) : null,
          })
          .returning();
        await tx.insert(schema.requestEvents).values({
          ...base,
          type: "update_sent",
          visibility: "customer",
          actorUserId: userId(s.by),
          data: { notificationId: n!.id, channel: customer.channel, template, status: current },
        });
      }
    }
  }

  // Falcon Retail wrote 45 minutes ago, so its WhatsApp window is open; Nour Logistics last wrote
  // more than a day ago, so only templates reach them.
  lastInbound.set("nour", at("nour", -1, "09:10"));
  for (const [key, when] of lastInbound) {
    await tx
      .update(schema.customers)
      .set({ lastInboundAt: new Date(when) })
      .where(eq(schema.customers.id, customerIds.get(key)!));
  }

  return { tenantId, name };
}

function currentPlans(at: (c: CustomerKey, day: number, time: string) => number): Plan[] {
  return [
    {
      number: 1042,
      customer: "nour",
      title: "Driver app crash on cold start",
      priority: "high",
      team: "Mobile",
      steps: [
        { kind: "created", at: at("nour", -1, "13:00") },
        { kind: "status", at: at("nour", -1, "14:00"), to: "triage", by: "layla" },
        { kind: "note", at: at("nour", -1, "14:05"), by: "layla", visibility: "internal", text: "Repro confirmed on Android 14 after an OS update." },
        { kind: "told", at: at("nour", -1, "14:30"), by: "sarah", read: true },
        { kind: "status", at: at("nour", -1, "16:00"), to: "in_progress", by: "khalid" },
        { kind: "note", at: at("nour", -1, "16:05"), by: "khalid", visibility: "internal", text: "Tracked to a null auth token on cold start. Their MDM profile strips the keychain, do not mention the MDM problem to the customer yet." },
        { kind: "note", at: at("nour", 0, "09:30"), by: "khalid", visibility: "customer", text: "A fix is in code review." },
      ],
    },
    {
      number: 1038,
      customer: "nour",
      title: "Invoice export missing VAT column",
      priority: "normal",
      team: "Platform",
      steps: [
        { kind: "created", at: at("nour", -2, "09:00") },
        { kind: "status", at: at("nour", -2, "11:00"), to: "in_progress", by: "reem" },
        { kind: "told", at: at("nour", -2, "11:30"), by: "sarah", read: true },
        { kind: "status", at: at("nour", -1, "10:00"), to: "waiting_on_customer", by: "reem" },
        { kind: "note", at: at("nour", -1, "10:00"), by: "reem", visibility: "customer", text: "We need a sample export file to reproduce the missing column." },
        { kind: "told", at: at("nour", -1, "10:20"), by: "sarah", read: false, note: "هل يمكنكم إرسال ملف تصدير واحد من الشهر الماضي يظهر فيه نقص عمود ضريبة القيمة المضافة؟" },
      ],
    },
    {
      number: 1045,
      customer: "falcon",
      title: "POS reconciliation fails for store #14",
      priority: "high",
      team: "Payments",
      steps: [
        { kind: "created", at: at("falcon", -1, "10:00") },
        { kind: "status", at: at("falcon", -1, "11:30"), to: "in_progress", by: "khalid" },
        { kind: "note", at: at("falcon", -1, "11:35"), by: "khalid", visibility: "internal", text: "The reconciliation job times out on store 14's batch size." },
        { kind: "ping", at: at("falcon", 0, "10:45"), text: "Any news on the store 14 issue? Our finance team is asking." },
      ],
    },
    {
      number: 1047,
      customer: "falcon",
      title: "Loyalty points not accruing on Apple Pay",
      priority: "high",
      team: "Payments",
      steps: [
        { kind: "created", at: at("falcon", -1, "14:00") },
        { kind: "status", at: at("falcon", -1, "14:30"), to: "triage", by: "layla" },
        { kind: "told", at: at("falcon", -1, "15:00"), by: "sarah", read: true },
        { kind: "status", at: at("falcon", -1, "16:00"), to: "in_progress", by: "khalid" },
        { kind: "told", at: at("falcon", -1, "16:30"), by: "sarah", read: false },
      ],
    },
    {
      number: 1031,
      customer: "falcon",
      title: "Add bulk CSV import to the product catalog",
      priority: "low",
      team: "Platform",
      steps: [
        { kind: "created", at: at("falcon", -5, "11:00") },
        { kind: "status", at: at("falcon", -5, "15:00"), to: "triage", by: "reem" },
        { kind: "told", at: at("falcon", -5, "15:30"), by: "sarah", read: true },
      ],
    },
    {
      number: 1049,
      customer: "pearl",
      title: "Two-factor auth codes not arriving by SMS",
      priority: "urgent",
      team: "Platform",
      steps: [{ kind: "created", at: at("pearl", 0, "08:30") }],
    },
    {
      number: 1036,
      customer: "pearl",
      title: "Patient export to PDF cuts off long names",
      priority: "normal",
      team: "Platform",
      steps: [
        { kind: "created", at: at("pearl", -6, "09:00") },
        { kind: "status", at: at("pearl", -6, "11:00"), to: "triage", by: "reem" },
        { kind: "told", at: at("pearl", -6, "11:30"), by: "sarah", read: true },
        { kind: "status", at: at("pearl", -2, "10:00"), to: "in_progress", by: "reem" },
        { kind: "note", at: at("pearl", -2, "10:10"), by: "reem", visibility: "internal", text: "Needs the PDF library upgrade, which is waiting on a license review." },
      ],
    },
    {
      number: 1040,
      customer: "pearl",
      title: "Add a weekly utilization report",
      priority: "low",
      team: "Platform",
      steps: [
        { kind: "created", at: at("pearl", -2, "12:00") },
        { kind: "status", at: at("pearl", -1, "09:00"), to: "triage", by: "reem" },
        { kind: "told", at: at("pearl", -1, "09:30"), by: "sarah", read: false },
      ],
    },
    {
      number: 1044,
      customer: "nour",
      title: "Driver onboarding webhook missing a payload field",
      priority: "normal",
      team: "Platform",
      steps: [
        { kind: "created", at: at("nour", -1, "09:00") },
        { kind: "status", at: at("nour", -1, "11:00"), to: "in_progress", by: "reem" },
        { kind: "told", at: at("nour", -1, "11:15"), by: "sarah", read: true },
      ],
    },
    {
      number: 1048,
      customer: "nour",
      title: "Bulk reassignment for fleet managers",
      priority: "low",
      team: "Mobile",
      steps: [
        { kind: "created", at: at("nour", 0, "08:15") },
        { kind: "status", at: at("nour", 0, "09:00"), to: "triage", by: "layla" },
      ],
    },
    {
      number: 1050,
      customer: "nour",
      title: "Map tiles fail to load in Jeddah",
      priority: "high",
      team: "Mobile",
      steps: [
        { kind: "created", at: at("nour", -1, "11:00") },
        { kind: "status", at: at("nour", -1, "11:30"), to: "in_progress", by: "layla" },
        { kind: "told", at: at("nour", -1, "11:50"), by: "sarah", read: true },
        { kind: "status", at: at("nour", 0, "09:45"), to: "resolved", by: "layla" },
        { kind: "note", at: at("nour", 0, "09:45"), by: "layla", visibility: "customer", text: "Fixed in app version 4.12, rolling out now." },
      ],
    },
    {
      number: 1043,
      customer: "atlas",
      title: "Shift scheduling collision on the night shift",
      priority: "high",
      team: "Platform",
      steps: [
        { kind: "created", at: at("atlas", -1, "12:00") },
        { kind: "status", at: at("atlas", -1, "13:00"), to: "triage", by: "reem" },
        { kind: "told", at: at("atlas", -1, "13:30"), by: "omar", read: true },
        { kind: "status", at: at("atlas", -1, "16:00"), to: "in_progress", by: "reem" },
      ],
    },
    {
      number: 1046,
      customer: "atlas",
      title: "Export the schedule to PDF",
      priority: "normal",
      team: "Platform",
      steps: [{ kind: "created", at: at("atlas", 0, "09:10") }],
    },
    {
      number: 1041,
      customer: "dune",
      title: "Guest Wi-Fi portal rejects valid room numbers",
      priority: "urgent",
      team: "Platform",
      steps: [
        { kind: "created", at: at("dune", 0, "09:00") },
        { kind: "status", at: at("dune", 0, "09:40"), to: "in_progress", by: "reem" },
      ],
    },
    {
      number: 1033,
      customer: "falcon",
      title: "Add an Arabic locale to the receipt template",
      priority: "low",
      team: "Mobile",
      steps: [
        { kind: "created", at: at("falcon", -8, "10:00") },
        { kind: "status", at: at("falcon", -8, "12:00"), to: "in_progress", by: "layla" },
        { kind: "told", at: at("falcon", -8, "12:30"), by: "sarah", read: true },
        { kind: "status", at: at("falcon", -6, "15:00"), to: "resolved", by: "layla" },
        { kind: "told", at: at("falcon", -6, "15:20"), by: "sarah", read: true },
      ],
    },
  ];
}

const HISTORY_TITLES = [
  "Push notifications delayed on iOS",
  "Invoice PDF shows the wrong currency",
  "Bulk upload stalls at 90 percent",
  "Session expires during checkout",
  "Report filters reset after export",
  "Duplicate SMS reminders for appointments",
  "Arabic names truncated in the driver app",
  "Webhook retries flood the endpoint",
  "Dashboard totals differ from the export",
  "Password reset email lands in spam",
  "Map pins misplaced for new addresses",
  "Refund status stuck on pending",
  "Search ignores Arabic diacritics",
  "CSV import rejects valid dates",
];

/** Five weeks of resolved requests with a realistic mix of told-first and asked-first. */
function historyPlans(at: (c: CustomerKey, day: number, time: string) => number, anchor: number): Plan[] {
  const rand = random(20260521);
  const keys: CustomerKey[] = ["nour", "falcon", "pearl", "atlas", "dune"];
  const engineers: Handle[] = ["layla", "khalid", "reem"];
  const plans: Plan[] = [];
  for (let i = 0; i < 28; i++) {
    const customer = keys[i % keys.length]!;
    const am = CUSTOMERS[customer].owner;
    // Sarah tells first more often than Omar; nobody is perfect.
    const proactive = am === "sarah" ? 0.68 : 0.45;
    const startDay = -35 + Math.floor(rand() * 26);
    const hour = 9 + Math.floor(rand() * 5);
    let t = at(customer, startDay, `${String(hour).padStart(2, "0")}:00`);
    const steps: Step[] = [{ kind: "created", at: t }];
    const by = engineers[Math.floor(rand() * engineers.length)]!;
    for (const to of ["triage", "in_progress", "resolved"] as const) {
      t += (2 + rand() * 20) * 3_600_000;
      if (t > anchor - DAY_MS) break;
      steps.push({ kind: "status", at: t, to, by });
      if (rand() < proactive) {
        steps.push({ kind: "told", at: t + (0.3 + rand() * 5) * 3_600_000, by: am, read: rand() < 0.8 });
      } else {
        const asked = t + (2 + rand() * 18) * 3_600_000;
        steps.push({ kind: "ping", at: asked, text: rand() < 0.5 ? "Any update?" : "هل من جديد؟" });
        steps.push({ kind: "told", at: asked + (0.3 + rand() * 3) * 3_600_000, by: am, read: rand() < 0.8 });
      }
    }
    plans.push({
      number: 1001 + i,
      customer,
      title: HISTORY_TITLES[i % HISTORY_TITLES.length]!,
      priority: (["normal", "high", "low", "normal"] as const)[i % 4]!,
      team: ["Mobile", "Payments", "Platform"][i % 3]!,
      steps: steps.filter((s) => s.at < anchor),
    });
  }
  return plans;
}

export function newTenantId(): string {
  return randomUUID();
}
