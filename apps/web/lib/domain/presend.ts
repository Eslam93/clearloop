// Checks that run on the account manager's own words before a message goes out. Rules only, no
// model: each one names a real way a status update goes wrong.
//
// - internal_note: text copied from an internal-only note. This is the one that blocks.
// - engineer_name: names someone the customer never deals with.
// - time_promise: promises a time ("today", "by Thursday", "اليوم") when the request has no ETA.
// - status_claim: says it is fixed or done while the status says otherwise.
// - number_mismatch: the Arabic and English versions disagree on a number or date.

import type { Status } from "./types";

export type FindingId =
  | "internal_note"
  | "engineer_name"
  | "time_promise"
  | "status_claim"
  | "number_mismatch";

export interface Finding {
  id: FindingId;
  severity: "block" | "warn";
  /** The words that triggered it, for highlighting. */
  match: string;
}

export interface PresendInput {
  note: string | null;
  /** An optional second version of the note in the other language. */
  otherNote?: string | null;
  status: Status;
  hasEta: boolean;
  internalNotes: string[];
  engineerNames: string[];
}

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

function toLatinDigits(text: string): string {
  return text.replace(ARABIC_DIGITS, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

function words(text: string): string[] {
  return toLatinDigits(text)
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // Arabic diacritics and tatweel
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The first run of `size` consecutive words from `source` that also appears in `text`. */
function sharedRun(source: string, text: string, size: number): string | null {
  const s = words(source);
  const haystack = ` ${words(text).join(" ")} `;
  if (s.length < size) {
    const whole = s.join(" ");
    return whole.length >= 12 && haystack.includes(` ${whole} `) ? whole : null;
  }
  for (let i = 0; i + size <= s.length; i++) {
    const run = s.slice(i, i + size).join(" ");
    if (haystack.includes(` ${run} `)) return run;
  }
  return null;
}

const TIME_PROMISE = [
  /\b(today|tonight|tomorrow|this (?:morning|afternoon|evening|week)|end of (?:the )?(?:day|week)|eod|asap|within \d+ ?(?:min(?:ute)?s?|h(?:ou)?rs?|days?)|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|noon|tomorrow|\d{1,2}(?::\d{2})? ?(?:am|pm)?))\b/i,
  /(اليوم|الليلة|غد[اًا]?|بكرة|هذا الأسبوع|نهاية اليوم|نهاية الأسبوع|خلال \d+ ?(?:دقيقة|دقائق|ساعة|ساعات|يوم|أيام)|بحلول)/,
];

const DONE_CLAIM = [
  /\b(resolved|fixed|done|deployed|shipped|closed|solved)\b/i,
  /(تم الحل|تم حل|تم إصلاح|تم الإصلاح|انتهينا|اكتمل|تم الانتهاء)/,
];

function firstMatch(patterns: RegExp[], text: string): string | null {
  for (const pattern of patterns) {
    const m = toLatinDigits(text).match(pattern);
    if (m) return m[0];
  }
  return null;
}

function digits(text: string): string[] {
  return (toLatinDigits(text).match(/\d+/g) ?? []).sort();
}

export function checkMessage(input: PresendInput): Finding[] {
  const findings: Finding[] = [];
  const texts = [input.note, input.otherNote].filter((t): t is string => !!t && !!t.trim());
  if (texts.length === 0) return findings;

  for (const text of texts) {
    for (const internal of input.internalNotes) {
      const run = sharedRun(internal, text, 5);
      if (run) {
        findings.push({ id: "internal_note", severity: "block", match: run });
        break;
      }
    }
    for (const name of input.engineerNames) {
      const parts = name.split(/\s+/).filter((p) => p.length >= 3);
      const hit = parts.find((p) => new RegExp(`(^|[^\\p{L}])${p}([^\\p{L}]|$)`, "iu").test(text));
      if (hit) {
        findings.push({ id: "engineer_name", severity: "warn", match: hit });
        break;
      }
    }
    if (!input.hasEta) {
      const promise = firstMatch(TIME_PROMISE, text);
      if (promise) findings.push({ id: "time_promise", severity: "warn", match: promise });
    }
    if (input.status !== "resolved") {
      const claim = firstMatch(DONE_CLAIM, text);
      if (claim) findings.push({ id: "status_claim", severity: "warn", match: claim });
    }
  }

  if (texts.length === 2) {
    const [a, b] = texts.map(digits);
    if (a!.join(",") !== b!.join(",")) {
      findings.push({ id: "number_mismatch", severity: "warn", match: `${a!.join(" ")} ≠ ${b!.join(" ")}` });
    }
  }

  // One finding per id is enough to show.
  return findings.filter((f, i) => findings.findIndex((g) => g.id === f.id) === i);
}

export function blocks(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === "block");
}
