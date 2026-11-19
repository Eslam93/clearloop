import { describe, expect, it } from "vitest";
import { computeDebt, owedOrder } from "./debt";
import { episodes, summarize } from "./metrics";
import { blocks, checkMessage } from "./presend";
import { renderMessage, templateFor } from "./templates";
import type { DomainEvent, Status } from "./types";
import { noteRule, WHATSAPP_WINDOW_MS } from "./window";

const H = 3_600_000;
let nextId = 1;
const R = "req-1";

function ev(at: number, event: Partial<DomainEvent> & { type: DomainEvent["type"] }): DomainEvent {
  return {
    id: nextId++,
    requestId: R,
    at: at * H,
    visibility: "customer",
    actorUserId: null,
    ...event,
  } as DomainEvent;
}
const status = (at: number, from: Status, to: Status, visibility: "customer" | "internal" = "customer") =>
  ev(at, { type: "status_changed", from, to, visibility });
const told = (at: number, s: Status) =>
  ev(at, { type: "update_sent", notificationId: `n${at}`, channel: "whatsapp", status: s });
const ping = (at: number) => ev(at, { type: "customer_pinged", text: "any update?" });
const note = (at: number, visibility: "customer" | "internal" = "customer") =>
  ev(at, { type: "note_added", text: "note", visibility });

describe("update debt", () => {
  it("is empty when the customer was told after every change", () => {
    const debt = computeDebt([ev(0, { type: "created" }), status(1, "new", "triage"), told(2, "triage")]);
    expect(debt.items).toEqual([]);
    expect(debt.since).toBeNull();
    expect(debt.knownStatus).toBe("triage");
  });

  it("counts customer-visible changes since the last update, oldest first", () => {
    const debt = computeDebt([
      told(1, "triage"),
      status(2, "triage", "in_progress"),
      note(3),
      note(4, "internal"),
    ]);
    expect(debt.items.map((e) => e.type)).toEqual(["status_changed", "note_added"]);
    expect(debt.since).toBe(2 * H);
    expect(debt.knownStatus).toBe("triage");
  });

  it("ignores internal changes entirely", () => {
    const debt = computeDebt([told(1, "triage"), status(2, "triage", "blocked", "internal")]);
    expect(debt.items).toEqual([]);
  });

  it("flags a customer who asked after our last update", () => {
    expect(computeDebt([told(1, "triage"), ping(2)]).customerAsked).toBe(true);
    expect(computeDebt([ping(1), told(2, "triage")]).customerAsked).toBe(false);
  });

  it("assumes the customer knows the request is new when never told", () => {
    const debt = computeDebt([ev(0, { type: "created" }), status(1, "new", "in_progress")]);
    expect(debt.knownStatus).toBe("new");
    expect(debt.lastToldAt).toBeNull();
    expect(debt.items).toHaveLength(1);
  });

  it("puts a waiting customer first, then older debt weighted by tier", () => {
    const now = 100 * H;
    const old = { debt: computeDebt([status(10, "new", "triage")]), tier: "standard" as const, slaRemainingMs: 0 };
    const vip = { debt: computeDebt([status(40, "new", "triage")]), tier: "vip" as const, slaRemainingMs: 0 };
    const asked = { debt: computeDebt([told(90, "triage"), ping(95)]), tier: "standard" as const, slaRemainingMs: 0 };
    const sorted = [old, vip, asked].sort((a, b) => owedOrder(a, b, now));
    // standard debt is 90h old (score 90); vip debt is 60h old (score 120).
    expect(sorted).toEqual([asked, vip, old]);
  });
});

describe("loop metrics", () => {
  it("splits a request's history into episodes", () => {
    const list = episodes(R, [
      status(1, "new", "triage"),
      status(2, "triage", "in_progress"),
      told(3, "in_progress"),
      status(5, "in_progress", "resolved"),
      ping(6),
      told(7, "resolved"),
      note(9),
    ]);
    expect(list).toEqual([
      { requestId: R, startedAt: 1 * H, toldAt: 3 * H, askedAt: null },
      { requestId: R, startedAt: 5 * H, toldAt: 7 * H, askedAt: 6 * H },
      { requestId: R, startedAt: 9 * H, toldAt: null, askedAt: null },
    ]);
  });

  it("computes the ask-first rate over decided episodes and the median time to tell", () => {
    const m = summarize([
      { requestId: R, startedAt: 0, toldAt: 2 * H, askedAt: null },
      { requestId: R, startedAt: 0, toldAt: 4 * H, askedAt: 1 * H },
      { requestId: R, startedAt: 0, toldAt: null, askedAt: 3 * H },
      { requestId: R, startedAt: 0, toldAt: null, askedAt: null },
    ]);
    expect(m.decided).toBe(3);
    expect(m.askedFirst).toBe(2);
    expect(m.askFirstRate).toBeCloseTo(2 / 3);
    expect(m.medianTimeToTellMs).toBe(3 * H);
    expect(m.open).toBe(2);
  });

  it("has no rate before anything is decided", () => {
    expect(summarize([]).askFirstRate).toBeNull();
  });
});

describe("templates", () => {
  const input = {
    contactName: "Faisal",
    requestNumber: 1042,
    requestTitle: "Driver app crash on cold start",
    status: "in_progress" as Status,
    amName: "Sarah Al Hashimi",
    eta: null,
    note: null,
  };

  it("picks the template from the status", () => {
    expect(templateFor("waiting_on_customer")).toBe("request_info");
    expect(templateFor("resolved")).toBe("resolved");
    expect(templateFor("in_progress")).toBe("status_update");
  });

  it("is signed by the account manager, in both languages", () => {
    for (const language of ["en", "ar"] as const) {
      const body = renderMessage("status_update", language, input);
      expect(body.trim().split("\n").at(-1)).toBe("Sarah Al Hashimi");
      expect(body).toContain("1042");
    }
  });

  it("includes the ETA and the note only when given", () => {
    const plain = renderMessage("status_update", "en", input);
    expect(plain).not.toContain("Expected by");
    const full = renderMessage("status_update", "en", { ...input, eta: "Sun 12 Jan, 14:00", note: "A fix is in review." });
    expect(full).toContain("Expected by Sun 12 Jan, 14:00.");
    expect(full).toContain("A fix is in review.");
  });
});

describe("the WhatsApp window", () => {
  const now = 100 * H;
  it("allows free text within 24 hours of the customer's last message", () => {
    expect(noteRule("whatsapp", "status_update", now - 2 * H, now).allowed).toBe(true);
    expect(noteRule("whatsapp", "status_update", now - 2 * H, now).windowClosesAt).toBe(now - 2 * H + WHATSAPP_WINDOW_MS);
  });

  it("allows only template slots once the window has closed", () => {
    expect(noteRule("whatsapp", "status_update", now - 25 * H, now).allowed).toBe(false);
    expect(noteRule("whatsapp", "status_update", null, now).allowed).toBe(false);
    expect(noteRule("whatsapp", "request_info", null, now).allowed).toBe(true);
  });

  it("does not apply to email", () => {
    expect(noteRule("email", "status_update", null, now).allowed).toBe(true);
  });
});

describe("pre-send checks", () => {
  const base = {
    note: null as string | null,
    status: "in_progress" as Status,
    hasEta: false,
    internalNotes: ["Customer's export job is misconfigured on their side, do not tell them yet"],
    engineerNames: ["Khalid Othman", "Reem Saleh"],
  };
  const ids = (note: string, extra: Partial<typeof base> & { otherNote?: string } = {}) =>
    checkMessage({ ...base, ...extra, note }).map((f) => f.id);

  it("passes an ordinary note", () => {
    expect(ids("We found the cause and a fix is in review.")).toEqual([]);
  });

  it("blocks text copied from an internal note", () => {
    const findings = checkMessage({ ...base, note: "Heads up: export job is misconfigured on their side." });
    expect(findings.map((f) => f.id)).toEqual(["internal_note"]);
    expect(blocks(findings)).toBe(true);
  });

  it("warns on an engineer's name, in any case", () => {
    expect(ids("khalid is on it")).toEqual(["engineer_name"]);
  });

  it("warns on a time promise without an ETA, in English and Arabic", () => {
    expect(ids("You will have it by Thursday.")).toEqual(["time_promise"]);
    expect(ids("سيكون جاهزاً اليوم")).toEqual(["time_promise"]);
    expect(ids("You will have it by Thursday.", { hasEta: true })).toEqual([]);
  });

  it("warns when the note says done but the status does not", () => {
    expect(ids("This is fixed now.")).toEqual(["status_claim"]);
    expect(ids("تم إصلاح المشكلة")).toEqual(["status_claim"]);
    expect(ids("This is fixed now.", { status: "resolved" })).toEqual([]);
  });

  it("warns when the two language versions disagree on numbers, with either digit set", () => {
    expect(ids("Store 14 is back.", { otherNote: "المتجر ١٤ يعمل الآن" })).toEqual([]);
    expect(ids("Store 14 is back.", { otherNote: "المتجر ١٥ يعمل الآن" })).toEqual(["number_mismatch"]);
  });
});
