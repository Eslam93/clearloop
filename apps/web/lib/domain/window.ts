// WhatsApp's customer-service window: a business may send free text only within 24 hours of the
// customer's last message. Outside it, only pre-approved templates go through.

import { TEMPLATE_HAS_NOTE_SLOT } from "./templates";
import type { Channel, TemplateId } from "./types";

export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface NoteRule {
  /** The account manager may add their own words to this message. */
  allowed: boolean;
  /** Why not, as an i18n key, when not allowed. */
  reason: string | null;
  /** When the window closes, if it is open. */
  windowClosesAt: number | null;
}

export function noteRule(
  channel: Channel,
  template: TemplateId,
  lastInboundAt: number | null,
  now: number,
): NoteRule {
  if (channel !== "whatsapp") return { allowed: true, reason: null, windowClosesAt: null };
  const closesAt = lastInboundAt === null ? null : lastInboundAt + WHATSAPP_WINDOW_MS;
  const open = closesAt !== null && now < closesAt;
  if (open) return { allowed: true, reason: null, windowClosesAt: closesAt };
  if (TEMPLATE_HAS_NOTE_SLOT[template]) return { allowed: true, reason: null, windowClosesAt: null };
  return { allowed: false, reason: "composer.windowClosed", windowClosesAt: null };
}
