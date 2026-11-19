// Shared types. Safe to import from client components: no data lives here.

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

export type SlaState = "healthy" | "at_risk" | "breached";
