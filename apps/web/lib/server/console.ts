import "server-only";

// The console's read model: everything one tenant's console shows, loaded in one transaction and
// turned into view models. Debt and SLA are computed here from the event log, so the browser
// never needs domain logic beyond formatting.

import { parseCalendar, type CalendarDefinition } from "@clearloop/business-time";
import { schema, type Tx, type User } from "@clearloop/db";
import { computeDebt } from "@/lib/domain/debt";
import { requestSla } from "@/lib/domain/sla";
import { templateFor } from "@/lib/domain/templates";
import type { DomainEvent, Status } from "@/lib/domain/types";
import { virtualNow } from "@/lib/domain/clock";
import type {
  ConsoleData,
  CustomerView,
  PhoneThread,
  RequestView,
  TimelineItem,
  UserView,
} from "@/lib/view/types";
import { toDomainEvent } from "./events";

const toUser = (u: User): UserView => ({ id: u.id, handle: u.handle, name: u.name, role: u.role, team: u.team });

export async function loadConsole(tx: Tx, actor: User): Promise<ConsoleData> {
  const [tenant] = await tx.select().from(schema.tenants).limit(1);
  if (!tenant) throw new Error("No tenant in this transaction");
  const now = virtualNow(tenant.clockOffsetMs);

  const [users, calendars, policies, customers, requests, events, notifications] = await Promise.all([
    tx.select().from(schema.users),
    tx.select().from(schema.businessCalendars),
    tx.select().from(schema.slaPolicies),
    tx.select().from(schema.customers),
    tx.select().from(schema.requests),
    tx.select().from(schema.requestEvents),
    tx.select().from(schema.notifications),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const calendarById = new Map<string, { def: CalendarDefinition; name: string }>();
  for (const row of calendars) {
    calendarById.set(row.id, { def: parseCalendar(row.definition), name: row.name });
  }
  const customerById = new Map<string, CustomerView>();
  for (const c of customers) {
    const calendar = calendarById.get(c.calendarId)!;
    customerById.set(c.id, {
      id: c.id,
      name: c.name,
      tier: c.tier,
      language: c.preferredLanguage,
      channel: c.preferredChannel,
      contactName: c.contactName,
      ownerId: c.ownerUserId,
      ownerName: userById.get(c.ownerUserId)?.name ?? "",
      calendarName: calendar.name,
      timeZone: calendar.def.timeZone,
      lastInboundAt: c.lastInboundAt?.getTime() ?? null,
    });
  }

  const eventsByRequest = new Map<string, DomainEvent[]>();
  const rowsByRequest = new Map<string, typeof events>();
  for (const row of events) {
    const list = eventsByRequest.get(row.requestId) ?? [];
    list.push(toDomainEvent(row));
    eventsByRequest.set(row.requestId, list);
    const rows = rowsByRequest.get(row.requestId) ?? [];
    rows.push(row);
    rowsByRequest.set(row.requestId, rows);
  }

  const views: RequestView[] = requests.map((r) => {
    const customer = customerById.get(r.customerId)!;
    const domainEvents = eventsByRequest.get(r.id) ?? [];
    const debt = computeDebt(domainEvents);
    const policy = policies.find((p) => p.tier === customer.tier && p.priority === r.priority);
    const sla = requestSla({
      calendar: calendarById.get(customers.find((c) => c.id === r.customerId)!.calendarId)!.def,
      openedAt: r.openedAt.getTime(),
      status: r.status as Status,
      events: domainEvents,
      targetMinutes: policy?.targetMinutes ?? 24 * 60,
      now,
    });
    const timeline: TimelineItem[] = (rowsByRequest.get(r.id) ?? [])
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.id - b.id)
      .map((row) => {
        const e = toDomainEvent(row);
        const actor = row.actorUserId ? userById.get(row.actorUserId) : undefined;
        const item: TimelineItem = {
          id: row.id,
          type: row.type,
          at: e.at,
          visibility: row.visibility,
          actorName: actor?.name ?? null,
          actorRole: actor?.role ?? null,
        };
        if (e.type === "status_changed") Object.assign(item, { from: e.from, to: e.to });
        if (e.type === "note_added" || e.type === "customer_pinged") item.text = e.text;
        if (e.type === "eta_set") item.eta = e.eta;
        if (e.type === "update_sent") Object.assign(item, { channel: e.channel, notificationId: e.notificationId });
        if (e.type === "delivery_updated") Object.assign(item, { state: e.state, notificationId: e.notificationId });
        return item;
      });
    return {
      id: r.id,
      number: r.number,
      title: r.title,
      status: r.status as Status,
      priority: r.priority,
      team: r.team,
      version: r.version,
      etaAt: r.etaAt?.getTime() ?? null,
      openedAt: r.openedAt.getTime(),
      resolvedAt: r.resolvedAt?.getTime() ?? null,
      customer,
      sla,
      debt: {
        count: debt.items.length,
        since: debt.since,
        customerAsked: debt.customerAsked,
        askedAt: debt.askedAt,
        knownStatus: debt.knownStatus,
        lastToldAt: debt.lastToldAt,
        untoldIds: debt.items.map((e) => e.id),
      },
      template: templateFor(r.status as Status),
      timeline,
      notifications: notifications
        .filter((n) => n.requestId === r.id)
        .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
        .map((n) => ({
          id: n.id,
          channel: n.channel,
          template: n.template,
          language: n.language,
          body: n.body,
          statusAtSend: n.statusAtSend as Status,
          deliveryState: n.deliveryState,
          attempts: n.attempts,
          lastError: n.lastError,
          sentAt: n.sentAt.getTime(),
          deliveredAt: n.deliveredAt?.getTime() ?? null,
          readAt: n.readAt?.getTime() ?? null,
          actorName: userById.get(n.actorUserId)?.name ?? "",
        })),
      internalNotes: domainEvents
        .filter((e): e is Extract<DomainEvent, { type: "note_added" }> => e.type === "note_added" && e.visibility === "internal")
        .map((e) => e.text),
    };
  });

  const phones: PhoneThread[] = [...customerById.values()].map((customer) => {
    const requestNumber = new Map(requests.filter((r) => r.customerId === customer.id).map((r) => [r.id, r.number]));
    const outgoing = notifications
      .filter((n) => n.customerId === customer.id && n.channel !== "out_of_band")
      .map((n) => ({
        id: n.id,
        direction: "out" as const,
        at: n.sentAt.getTime(),
        text: n.body,
        state: n.deliveryState,
        requestNumber: requestNumber.get(n.requestId),
      }));
    const incoming = events
      .filter((e) => e.type === "customer_pinged" && requestNumber.has(e.requestId))
      .map((e) => ({
        id: `ping-${e.id}`,
        direction: "in" as const,
        at: e.occurredAt.getTime(),
        text: String((e.data as { text?: string }).text ?? ""),
        requestNumber: requestNumber.get(e.requestId),
      }));
    return { customer, messages: [...outgoing, ...incoming].sort((a, b) => a.at - b.at) };
  });

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      expiresAt: tenant.expiresAt?.getTime() ?? null,
      clockOffsetMs: tenant.clockOffsetMs,
      portalEnabled: tenant.customerPortalEnabled,
      deviceOffline: tenant.deviceOffline,
    },
    now,
    actor: toUser(actor),
    users: users.map(toUser),
    engineerNames: users.filter((u) => u.role === "engineer").map((u) => u.name),
    requests: views,
    phones,
  };
}
