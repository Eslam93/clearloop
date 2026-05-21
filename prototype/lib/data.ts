// Static dataset. In part2-technical.md the model has 6 normalized entities;
// here User/Team are flattened to name strings on rows because the prototype
// renders them — it doesn't join through them. The cross-tenant edge case
// from part2-technical.md is demonstrated by including Tenant B data that
// the dashboard never shows (filtered by currentUser.tenant_id).

export type RequestStatus =
  | "new"
  | "triage"
  | "in_progress"
  | "blocked"
  | "resolved";

export type RequestPriority = "low" | "normal" | "high" | "urgent";

export type CustomerTier = "standard" | "pro" | "vip";

export type NotifyChannel = "whatsapp" | "email";

export interface StatusEvent {
  id: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  actorName: string;
  actorRole: "am" | "engineer" | "lead";
  note?: string;
  at: string; // ISO timestamp
}

export interface NotificationRecord {
  id: string;
  channel: NotifyChannel;
  statusAtSend: RequestStatus;
  actorName: string;
  sentAt: string; // ISO timestamp
}

export interface RequestRecord {
  id: string;
  tenantId: string;
  customerName: string;
  customerTier: CustomerTier;
  title: string;
  status: RequestStatus;
  priority: RequestPriority;
  assignedTeam: string;
  version: number;
  createdAt: string;
  slaDueAt: string;
  timeline: StatusEvent[];
  notifications: NotificationRecord[];
}

export interface CurrentUser {
  id: string;
  tenantId: string;
  name: string;
  role: "am" | "lead" | "engineer";
}

// Hardcoded session — Sarah is the AM for Tenant A.
// Tenant B's data exists in REQUESTS below but the dashboard filters it out.
export const CURRENT_USER: CurrentUser = {
  id: "usr_sarah",
  tenantId: "tnt_A",
  name: "Sarah Al Hashimi",
  role: "am",
};

// Fixed "now" so the demo is reproducible — SLA math doesn't drift between runs.
export const NOW_ISO = "2026-05-21T14:00:00+04:00";

function hoursFromNow(hours: number): string {
  const ms = new Date(NOW_ISO).getTime() + hours * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export const REQUESTS: RequestRecord[] = [
  // --- Tenant A — Sarah's customers — these render on the dashboard ---

  // VIP customer — Nour Logistics — at-risk on a high-pri request
  {
    id: "req_01",
    tenantId: "tnt_A",
    customerName: "Nour Logistics",
    customerTier: "vip",
    title: "Driver app crash on cold start",
    status: "in_progress",
    priority: "high",
    assignedTeam: "Mobile",
    version: 4,
    createdAt: hoursFromNow(-30),
    slaDueAt: hoursFromNow(3),
    timeline: [
      { id: "ev_01a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-30) },
      { id: "ev_01b", fromStatus: "new", toStatus: "triage", actorName: "Layla Mansour", actorRole: "engineer", note: "Repro confirmed on Android 14.", at: hoursFromNow(-26) },
      { id: "ev_01c", fromStatus: "triage", toStatus: "in_progress", actorName: "Khalid Othman", actorRole: "engineer", note: "Tracked to a null token on cold start.", at: hoursFromNow(-18) },
      { id: "ev_01d", fromStatus: "in_progress", toStatus: "in_progress", actorName: "Khalid Othman", actorRole: "engineer", note: "Fix in code review.", at: hoursFromNow(-2) },
    ],
    notifications: [
      { id: "ntf_01a", channel: "whatsapp", statusAtSend: "triage", actorName: "Sarah Al Hashimi", sentAt: hoursFromNow(-25) },
    ],
  },

  // Nour Logistics — second open request — already breached
  {
    id: "req_02",
    tenantId: "tnt_A",
    customerName: "Nour Logistics",
    customerTier: "vip",
    title: "Invoice export missing VAT column",
    status: "blocked",
    priority: "normal",
    assignedTeam: "Platform",
    version: 3,
    createdAt: hoursFromNow(-72),
    slaDueAt: hoursFromNow(-6),
    timeline: [
      { id: "ev_02a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-72) },
      { id: "ev_02b", fromStatus: "new", toStatus: "in_progress", actorName: "Reem Saleh", actorRole: "engineer", note: "Investigating CSV writer.", at: hoursFromNow(-60) },
      { id: "ev_02c", fromStatus: "in_progress", toStatus: "blocked", actorName: "Reem Saleh", actorRole: "engineer", note: "Need sample export from customer to reproduce.", at: hoursFromNow(-40) },
    ],
    notifications: [],
  },

  // Mid-tier customer — Falcon Retail — healthy
  {
    id: "req_03",
    tenantId: "tnt_A",
    customerName: "Falcon Retail",
    customerTier: "pro",
    title: "Add bulk CSV import to product catalog",
    status: "triage",
    priority: "normal",
    assignedTeam: "Platform",
    version: 1,
    createdAt: hoursFromNow(-8),
    slaDueAt: hoursFromNow(40),
    timeline: [
      { id: "ev_03a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-8) },
      { id: "ev_03b", fromStatus: "new", toStatus: "triage", actorName: "Layla Mansour", actorRole: "engineer", note: "Scoping with platform team.", at: hoursFromNow(-2) },
    ],
    notifications: [],
  },

  // Falcon Retail — second — at-risk
  {
    id: "req_04",
    tenantId: "tnt_A",
    customerName: "Falcon Retail",
    customerTier: "pro",
    title: "POS reconciliation fails for store #14",
    status: "in_progress",
    priority: "high",
    assignedTeam: "Payments",
    version: 2,
    createdAt: hoursFromNow(-20),
    slaDueAt: hoursFromNow(2),
    timeline: [
      { id: "ev_04a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-20) },
      { id: "ev_04b", fromStatus: "new", toStatus: "in_progress", actorName: "Khalid Othman", actorRole: "engineer", note: "Looking at the reconciliation job logs.", at: hoursFromNow(-14) },
    ],
    notifications: [],
  },

  // Falcon Retail — third — resolved
  {
    id: "req_05",
    tenantId: "tnt_A",
    customerName: "Falcon Retail",
    customerTier: "pro",
    title: "Add Arabic locale to receipt template",
    status: "resolved",
    priority: "low",
    assignedTeam: "Mobile",
    version: 5,
    createdAt: hoursFromNow(-96),
    slaDueAt: hoursFromNow(-48),
    timeline: [
      { id: "ev_05a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-96) },
      { id: "ev_05b", fromStatus: "new", toStatus: "in_progress", actorName: "Layla Mansour", actorRole: "engineer", at: hoursFromNow(-80) },
      { id: "ev_05c", fromStatus: "in_progress", toStatus: "resolved", actorName: "Layla Mansour", actorRole: "engineer", note: "Shipped in v2.4.1.", at: hoursFromNow(-50) },
    ],
    notifications: [
      { id: "ntf_05a", channel: "email", statusAtSend: "resolved", actorName: "Sarah Al Hashimi", sentAt: hoursFromNow(-49) },
    ],
  },

  // Standard customer — Pearl Clinics — healthy
  {
    id: "req_06",
    tenantId: "tnt_A",
    customerName: "Pearl Clinics",
    customerTier: "standard",
    title: "Two-factor auth not sending SMS",
    status: "new",
    priority: "urgent",
    assignedTeam: "Platform",
    version: 0,
    createdAt: hoursFromNow(-1),
    slaDueAt: hoursFromNow(1.5),
    timeline: [
      { id: "ev_06a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-1) },
    ],
    notifications: [],
  },

  // Pearl Clinics — second — breached
  {
    id: "req_07",
    tenantId: "tnt_A",
    customerName: "Pearl Clinics",
    customerTier: "standard",
    title: "Patient export to PDF cuts off long names",
    status: "in_progress",
    priority: "normal",
    assignedTeam: "Platform",
    version: 2,
    createdAt: hoursFromNow(-60),
    slaDueAt: hoursFromNow(-12),
    timeline: [
      { id: "ev_07a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-60) },
      { id: "ev_07b", fromStatus: "new", toStatus: "in_progress", actorName: "Reem Saleh", actorRole: "engineer", note: "PDF library upgrade needed.", at: hoursFromNow(-30) },
    ],
    notifications: [],
  },

  // Pearl Clinics — third — healthy
  {
    id: "req_08",
    tenantId: "tnt_A",
    customerName: "Pearl Clinics",
    customerTier: "standard",
    title: "Add weekly utilization report",
    status: "triage",
    priority: "low",
    assignedTeam: "Analytics",
    version: 1,
    createdAt: hoursFromNow(-10),
    slaDueAt: hoursFromNow(60),
    timeline: [
      { id: "ev_08a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-10) },
      { id: "ev_08b", fromStatus: "new", toStatus: "triage", actorName: "Khalid Othman", actorRole: "engineer", at: hoursFromNow(-4) },
    ],
    notifications: [],
  },

  // Nour Logistics — fourth — healthy
  {
    id: "req_09",
    tenantId: "tnt_A",
    customerName: "Nour Logistics",
    customerTier: "vip",
    title: "Driver onboarding webhook missing payload field",
    status: "in_progress",
    priority: "normal",
    assignedTeam: "Platform",
    version: 2,
    createdAt: hoursFromNow(-14),
    slaDueAt: hoursFromNow(22),
    timeline: [
      { id: "ev_09a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-14) },
      { id: "ev_09b", fromStatus: "new", toStatus: "in_progress", actorName: "Reem Saleh", actorRole: "engineer", note: "Adding `vehicle_class` to the payload.", at: hoursFromNow(-6) },
    ],
    notifications: [
      { id: "ntf_09a", channel: "whatsapp", statusAtSend: "in_progress", actorName: "Sarah Al Hashimi", sentAt: hoursFromNow(-5) },
    ],
  },

  // Falcon Retail — fourth — at-risk
  {
    id: "req_10",
    tenantId: "tnt_A",
    customerName: "Falcon Retail",
    customerTier: "pro",
    title: "Loyalty points not accruing on Apple Pay",
    status: "in_progress",
    priority: "high",
    assignedTeam: "Payments",
    version: 3,
    createdAt: hoursFromNow(-22),
    slaDueAt: hoursFromNow(3.5),
    timeline: [
      { id: "ev_10a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-22) },
      { id: "ev_10b", fromStatus: "new", toStatus: "triage", actorName: "Layla Mansour", actorRole: "engineer", at: hoursFromNow(-18) },
      { id: "ev_10c", fromStatus: "triage", toStatus: "in_progress", actorName: "Khalid Othman", actorRole: "engineer", note: "Reproed in staging. Investigating tokenization.", at: hoursFromNow(-12) },
    ],
    notifications: [],
  },

  // Pearl Clinics — fourth — healthy
  {
    id: "req_11",
    tenantId: "tnt_A",
    customerName: "Pearl Clinics",
    customerTier: "standard",
    title: "Branding update on patient invite email",
    status: "resolved",
    priority: "low",
    assignedTeam: "Platform",
    version: 4,
    createdAt: hoursFromNow(-120),
    slaDueAt: hoursFromNow(-72),
    timeline: [
      { id: "ev_11a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-120) },
      { id: "ev_11b", fromStatus: "new", toStatus: "in_progress", actorName: "Layla Mansour", actorRole: "engineer", at: hoursFromNow(-110) },
      { id: "ev_11c", fromStatus: "in_progress", toStatus: "resolved", actorName: "Layla Mansour", actorRole: "engineer", at: hoursFromNow(-80) },
    ],
    notifications: [
      { id: "ntf_11a", channel: "email", statusAtSend: "resolved", actorName: "Sarah Al Hashimi", sentAt: hoursFromNow(-79) },
    ],
  },

  // Nour Logistics — fifth — healthy
  {
    id: "req_12",
    tenantId: "tnt_A",
    customerName: "Nour Logistics",
    customerTier: "vip",
    title: "Add bulk reassignment for fleet managers",
    status: "triage",
    priority: "normal",
    assignedTeam: "Mobile",
    version: 1,
    createdAt: hoursFromNow(-6),
    slaDueAt: hoursFromNow(36),
    timeline: [
      { id: "ev_12a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-6) },
      { id: "ev_12b", fromStatus: "new", toStatus: "triage", actorName: "Reem Saleh", actorRole: "engineer", note: "Scoping with mobile lead.", at: hoursFromNow(-1) },
    ],
    notifications: [],
  },

  // --- Tenant B — Omar's customers — present but filtered out by tenant scope ---

  {
    id: "req_b01",
    tenantId: "tnt_B",
    customerName: "Atlas Manufacturing",
    customerTier: "pro",
    title: "Shift scheduling collision in night shift",
    status: "in_progress",
    priority: "high",
    assignedTeam: "Platform",
    version: 2,
    createdAt: hoursFromNow(-18),
    slaDueAt: hoursFromNow(4),
    timeline: [
      { id: "ev_b01a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-18) },
      { id: "ev_b01b", fromStatus: "new", toStatus: "in_progress", actorName: "Reem Saleh", actorRole: "engineer", at: hoursFromNow(-10) },
    ],
    notifications: [],
  },
  {
    id: "req_b02",
    tenantId: "tnt_B",
    customerName: "Atlas Manufacturing",
    customerTier: "pro",
    title: "Export schedule to PDF",
    status: "new",
    priority: "normal",
    assignedTeam: "Platform",
    version: 0,
    createdAt: hoursFromNow(-3),
    slaDueAt: hoursFromNow(30),
    timeline: [
      { id: "ev_b02a", fromStatus: null, toStatus: "new", actorName: "System", actorRole: "engineer", at: hoursFromNow(-3) },
    ],
    notifications: [],
  },
];

export function getVisibleRequests(): RequestRecord[] {
  // Tenant scoping at the data layer — Tenant B never reaches the screen.
  return REQUESTS.filter((r) => r.tenantId === CURRENT_USER.tenantId);
}

export function hoursToSla(slaDueAtIso: string): number {
  const due = new Date(slaDueAtIso).getTime();
  const now = new Date(NOW_ISO).getTime();
  return (due - now) / (1000 * 60 * 60);
}

export type SlaState = "healthy" | "at_risk" | "breached";

export function slaState(slaDueAtIso: string): SlaState {
  const h = hoursToSla(slaDueAtIso);
  if (h <= 0) return "breached";
  if (h <= 4) return "at_risk";
  return "healthy";
}

export function lastNotifiedAt(req: RequestRecord): string | null {
  if (req.notifications.length === 0) return null;
  return req.notifications
    .map((n) => n.sentAt)
    .sort()
    .at(-1)!;
}
