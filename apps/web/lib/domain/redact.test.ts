import { describe, expect, it } from "vitest";
import { customerTimeline } from "./redact";
import type { DomainEvent } from "./types";

const base = { requestId: "r", actorUserId: "u" };
const events: DomainEvent[] = [
  { ...base, id: 1, at: 1, visibility: "customer", type: "created" },
  { ...base, id: 2, at: 2, visibility: "customer", type: "status_changed", from: "new", to: "in_progress" },
  { ...base, id: 3, at: 3, visibility: "internal", type: "note_added", text: "Their MDM profile strips the keychain" },
  { ...base, id: 4, at: 4, visibility: "customer", type: "note_added", text: "A fix is in code review." },
  { ...base, id: 5, at: 5, visibility: "customer", type: "update_sent", notificationId: "n", channel: "whatsapp", status: "in_progress" },
  { ...base, id: 6, at: 6, visibility: "internal", type: "delivery_updated", notificationId: "n", state: "read" },
  { ...base, id: 7, at: 7, visibility: "customer", type: "update_sent", notificationId: "m", channel: "out_of_band", status: "in_progress" },
];

describe("the customer timeline", () => {
  const timeline = customerTimeline(events);

  it("never contains an internal note", () => {
    expect(JSON.stringify(timeline)).not.toContain("keychain");
  });

  it("keeps customer-visible changes and real updates, in order", () => {
    expect(timeline.map((e) => e.kind)).toEqual(["created", "status", "note", "update"]);
  });

  it("drops delivery mechanics and updates logged as told another way", () => {
    expect(timeline.filter((e) => e.kind === "update")).toHaveLength(1);
  });
});
