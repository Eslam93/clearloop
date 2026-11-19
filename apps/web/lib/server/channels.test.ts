import { afterEach, describe, expect, it, vi } from "vitest";
import { nextAttemptDelay, TransientChannelError, whatsappAdapter, type OutgoingMessage } from "./channels";

const message: OutgoingMessage = {
  notificationId: "n-1",
  channel: "whatsapp",
  template: "status_update",
  language: "ar",
  body: "Hello",
  freeText: false,
  to: { name: "Faisal" },
};

function stubFetch(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status, headers }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("the WhatsApp Cloud API adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does not exist without credentials", () => {
    vi.stubEnv("WHATSAPP_TOKEN", "");
    expect(whatsappAdapter(() => "971500000000")).toBeNull();
  });

  describe("with credentials", () => {
    const adapter = () => {
      vi.stubEnv("WHATSAPP_TOKEN", "test-token");
      vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "12345");
      return whatsappAdapter(() => "971500000000")!;
    };

    it("sends the approved template outside the 24-hour window", async () => {
      const fetch = stubFetch(200, { messages: [{ id: "wamid.1" }] });
      await expect(adapter().send(message, { offline: false })).resolves.toEqual({ providerMessageId: "wamid.1" });
      const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toContain("/12345/messages");
      expect(JSON.parse(String(init.body))).toMatchObject({
        to: "971500000000",
        type: "template",
        template: { name: "clearloop_status_update", language: { code: "ar" } },
      });
    });

    it("sends free text inside the window", async () => {
      const fetch = stubFetch(200, { messages: [{ id: "wamid.2" }] });
      await adapter().send({ ...message, freeText: true }, { offline: false });
      const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(JSON.parse(String(init.body))).toMatchObject({ type: "text", text: { body: "Hello" } });
    });

    it("treats 429 and 5xx as transient and honours Retry-After", async () => {
      stubFetch(429, {}, { "retry-after": "30" });
      const error = await adapter().send(message, { offline: false }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(TransientChannelError);
      expect((error as TransientChannelError).retryAfterMs).toBe(30_000);
      stubFetch(503);
      await expect(adapter().send(message, { offline: false })).rejects.toBeInstanceOf(TransientChannelError);
    });

    it("fails for good on other errors", async () => {
      stubFetch(400, { error: { message: "bad template" } });
      const error = await adapter().send(message, { offline: false }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(TransientChannelError);
    });
  });
});

describe("retry backoff", () => {
  it("doubles from five seconds with jitter, caps at ten minutes, and prefers Retry-After", () => {
    expect(nextAttemptDelay(1, null, () => 0)).toBe(2_500);
    expect(nextAttemptDelay(1, null, () => 1)).toBe(5_000);
    expect(nextAttemptDelay(3, null, () => 1)).toBe(20_000);
    expect(nextAttemptDelay(30, null, () => 1)).toBe(600_000);
    expect(nextAttemptDelay(2, 30_000)).toBe(30_000);
  });
});
