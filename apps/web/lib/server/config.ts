import "server-only";

// Server configuration. Production must set SESSION_SECRET; development and tests get a fixed
// local value so the project runs with no setup.

const DEV_SECRET = "clearloop-local-development-secret-not-for-production";

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production" && !process.env.CLEARLOOP_LOCAL) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  return DEV_SECRET;
}

/** Secret for the sweeper and purge endpoints (Vercel Cron sends it as a bearer token). */
export function cronSecret(): string | null {
  return process.env.CRON_SECRET ?? null;
}

/** WhatsApp Cloud API credentials. Absent in the public demo, which uses the sandbox channel. */
export function whatsappConfig() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  return token && phoneNumberId ? { token, phoneNumberId, appSecret, verifyToken } : null;
}

/**
 * The app secret used to sign and verify delivery webhooks. The sandbox channel signs its own
 * simulated receipts with the same secret, so they go through the exact verification path a real
 * provider's would.
 */
export function webhookSecret(): string {
  return process.env.WHATSAPP_APP_SECRET ?? `${sessionSecret()}:webhooks`;
}

export const SANDBOX_TTL_MS = 24 * 60 * 60 * 1000;
