import "server-only";

// Channel adapters behind one interface. The public demo runs only the sandbox adapter: the
// deployment has no WhatsApp or email credentials, so it cannot send a real message.

import { whatsappConfig } from "./config";

export interface OutgoingMessage {
  notificationId: string;
  channel: "whatsapp" | "email";
  template: string;
  language: "ar" | "en";
  body: string;
  /** Free text is allowed inside WhatsApp's 24-hour window; otherwise the template is sent. */
  freeText: boolean;
  to: { name: string };
}

export interface SendResult {
  providerMessageId: string;
}

/** A failure worth retrying (timeouts, 429, 5xx). Anything else fails the message for good. */
export class TransientChannelError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
  }
}

export interface ChannelAdapter {
  name: string;
  send(message: OutgoingMessage, options: { offline: boolean }): Promise<SendResult>;
}

/** Delivers to the customer device simulator. "Offline" makes every send fail transiently. */
export const sandboxAdapter: ChannelAdapter = {
  name: "sandbox",
  async send(message, { offline }) {
    if (offline) throw new TransientChannelError("The customer's phone is offline.");
    return { providerMessageId: `sbx.${message.notificationId}` };
  },
};

/** WhatsApp Cloud API. Used only when WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set. */
export function whatsappAdapter(recipientFor: (message: OutgoingMessage) => string): ChannelAdapter | null {
  const config = whatsappConfig();
  if (!config) return null;
  return {
    name: "whatsapp",
    async send(message) {
      const payload = message.freeText
        ? { type: "text", text: { body: message.body } }
        : {
            type: "template",
            template: { name: `clearloop_${message.template}`, language: { code: message.language } },
          };
      const response = await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: recipientFor(message), ...payload }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        throw new TransientChannelError(`WhatsApp answered ${response.status}`, retryAfter > 0 ? retryAfter * 1000 : null);
      }
      if (!response.ok) throw new Error(`WhatsApp refused the message (${response.status})`);
      const data = (await response.json()) as { messages?: Array<{ id?: string }> };
      const id = data.messages?.[0]?.id;
      if (!id) throw new Error("WhatsApp returned no message id");
      return { providerMessageId: id };
    },
  };
}

/** Backoff with jitter: 5s, 10s, 20s ... capped at 10 minutes. Honours Retry-After when given. */
export function nextAttemptDelay(attempts: number, retryAfterMs: number | null, random = Math.random): number {
  if (retryAfterMs) return retryAfterMs;
  const base = Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 600_000);
  return Math.round(base / 2 + random() * (base / 2));
}

export const MAX_ATTEMPTS = 6;
