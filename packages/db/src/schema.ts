// Typed mirror of migrations/0001_schema.sql for queries. The SQL files are the source of truth;
// tests/schema.test.ts fails when a column here and in the database disagree.

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

const xid8 = customType<{ data: string }>({ dataType: () => "xid8" });

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  expiresAt: timestamptz("expires_at"),
  clockOffsetMs: bigint("clock_offset_ms", { mode: "number" }).notNull().default(0),
  customerPortalEnabled: boolean("customer_portal_enabled").notNull().default(false),
  deviceOffline: boolean("device_offline").notNull().default(false),
  seedVersion: integer("seed_version").notNull().default(1),
});

export const users = pgTable("users", {
  tenantId: uuid("tenant_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  handle: text("handle").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["am", "engineer", "lead"] }).notNull(),
  team: text("team"),
});

export const businessCalendars = pgTable("business_calendars", {
  tenantId: uuid("tenant_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  definition: jsonb("definition").notNull(),
});

export const slaPolicies = pgTable("sla_policies", {
  tenantId: uuid("tenant_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  tier: text("tier", { enum: ["standard", "pro", "vip"] }).notNull(),
  priority: text("priority", { enum: ["low", "normal", "high", "urgent"] }).notNull(),
  targetMinutes: integer("target_minutes").notNull(),
});

export const customers = pgTable("customers", {
  tenantId: uuid("tenant_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tier: text("tier", { enum: ["standard", "pro", "vip"] }).notNull(),
  ownerUserId: uuid("owner_user_id").notNull(),
  calendarId: uuid("calendar_id").notNull(),
  preferredLanguage: text("preferred_language", { enum: ["ar", "en"] }).notNull(),
  preferredChannel: text("preferred_channel", { enum: ["whatsapp", "email"] }).notNull(),
  contactName: text("contact_name").notNull(),
  lastInboundAt: timestamptz("last_inbound_at"),
});

export const REQUEST_STATUSES = [
  "new",
  "triage",
  "in_progress",
  "blocked",
  "waiting_on_customer",
  "resolved",
] as const;

export const requests = pgTable("requests", {
  tenantId: uuid("tenant_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  number: integer("number").notNull(),
  customerId: uuid("customer_id").notNull(),
  title: text("title").notNull(),
  status: text("status", { enum: REQUEST_STATUSES }).notNull(),
  priority: text("priority", { enum: ["low", "normal", "high", "urgent"] }).notNull(),
  team: text("team").notNull(),
  version: integer("version").notNull().default(1),
  etaAt: timestamptz("eta_at"),
  openedAt: timestamptz("opened_at").notNull(),
  resolvedAt: timestamptz("resolved_at"),
});

export const EVENT_TYPES = [
  "created",
  "status_changed",
  "note_added",
  "eta_set",
  "customer_pinged",
  "update_sent",
  "delivery_updated",
] as const;

export const requestEvents = pgTable("request_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id").notNull(),
  requestId: uuid("request_id").notNull(),
  type: text("type", { enum: EVENT_TYPES }).notNull(),
  visibility: text("visibility", { enum: ["internal", "customer"] }).notNull(),
  actorUserId: uuid("actor_user_id"),
  occurredAt: timestamptz("occurred_at").notNull(),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  xid: xid8("xid").notNull().default(sql`pg_current_xact_id()`),
  recordedAt: timestamptz("recorded_at").notNull().defaultNow(),
});

export const DELIVERY_STATES = ["queued", "sent", "delivered", "read", "failed", "logged"] as const;

export const notifications = pgTable("notifications", {
  tenantId: uuid("tenant_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  actorUserId: uuid("actor_user_id").notNull(),
  channel: text("channel", { enum: ["whatsapp", "email", "out_of_band"] }).notNull(),
  template: text("template").notNull(),
  language: text("language", { enum: ["ar", "en"] }).notNull(),
  body: text("body").notNull(),
  note: text("note"),
  statusAtSend: text("status_at_send").notNull(),
  requestVersion: integer("request_version").notNull(),
  bodyHash: text("body_hash").notNull(),
  idempotencyKey: text("idempotency_key"),
  deliveryState: text("delivery_state", { enum: DELIVERY_STATES }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamptz("next_attempt_at"),
  lastError: text("last_error"),
  providerMessageId: text("provider_message_id"),
  sentAt: timestamptz("sent_at").notNull(),
  deliveredAt: timestamptz("delivered_at"),
  readAt: timestamptz("read_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    tenantId: uuid("tenant_id").notNull(),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    statusCode: integer("status_code").notNull(),
    response: jsonb("response").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.scope, t.key] })],
);

export const presence = pgTable(
  "presence",
  {
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    requestId: uuid("request_id"),
    seenAt: timestamptz("seen_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId] })],
);

export const customerLinks = pgTable("customer_links", {
  tenantId: uuid("tenant_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamptz("expires_at").notNull(),
  revokedAt: timestamptz("revoked_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

// Tables the app reaches only through privileged functions. Listed so the schema test covers them.
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamptz("window_start").notNull(),
    hits: integer("hits").notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type DeliveryState = (typeof DELIVERY_STATES)[number];
export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type RequestEvent = typeof requestEvents.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type SlaPolicy = typeof slaPolicies.$inferSelect;
export type BusinessCalendarRow = typeof businessCalendars.$inferSelect;
