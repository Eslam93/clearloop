// View models the server builds and the browser renders. Plain data, times as epoch ms.

import type { SlaView } from "@/lib/domain/sla";
import type {
  Channel,
  DeliveryState,
  EventType,
  Language,
  Priority,
  Status,
  TemplateId,
  Tier,
  Visibility,
} from "@/lib/domain/types";

export type ViewId = "owed" | "breaching" | "waiting" | "open" | "resolved";
export const VIEW_IDS: ViewId[] = ["owed", "breaching", "waiting", "open", "resolved"];

export interface UserView {
  id: string;
  handle: string;
  name: string;
  role: "am" | "engineer" | "lead";
  team: string | null;
}

export interface CustomerView {
  id: string;
  name: string;
  tier: Tier;
  language: Language;
  channel: "whatsapp" | "email";
  contactName: string;
  ownerId: string;
  ownerName: string;
  calendarName: string;
  timeZone: string;
  lastInboundAt: number | null;
}

export interface TimelineItem {
  id: number;
  type: EventType;
  at: number;
  visibility: Visibility;
  actorName: string | null;
  actorRole: UserView["role"] | null;
  from?: Status;
  to?: Status;
  text?: string;
  eta?: number | null;
  channel?: Channel;
  state?: DeliveryState;
  notificationId?: string;
}

export interface NotificationView {
  id: string;
  channel: Channel;
  template: string;
  language: Language;
  body: string;
  statusAtSend: Status;
  deliveryState: DeliveryState;
  attempts: number;
  lastError: string | null;
  sentAt: number;
  deliveredAt: number | null;
  readAt: number | null;
  actorName: string;
}

export interface DebtView {
  count: number;
  since: number | null;
  customerAsked: boolean;
  askedAt: number | null;
  knownStatus: Status;
  lastToldAt: number | null;
  /** Ids of the timeline items the customer has not been told about. */
  untoldIds: number[];
}

export interface RequestView {
  id: string;
  number: number;
  title: string;
  status: Status;
  priority: Priority;
  team: string;
  version: number;
  etaAt: number | null;
  openedAt: number;
  resolvedAt: number | null;
  customer: CustomerView;
  sla: SlaView;
  debt: DebtView;
  template: TemplateId;
  timeline: TimelineItem[];
  notifications: NotificationView[];
  internalNotes: string[];
}

export interface PhoneMessage {
  id: string;
  direction: "in" | "out";
  at: number;
  text: string;
  state?: DeliveryState;
  requestNumber?: number;
}

export interface PhoneThread {
  customer: CustomerView;
  messages: PhoneMessage[];
}

export interface ConsoleData {
  tenant: {
    id: string;
    name: string;
    expiresAt: number | null;
    clockOffsetMs: number;
    portalEnabled: boolean;
    deviceOffline: boolean;
  };
  now: number;
  actor: UserView;
  users: UserView[];
  engineerNames: string[];
  requests: RequestView[];
  phones: PhoneThread[];
}
