// One clock for everything. The demo runs on a virtual clock: real time plus the sandbox's offset.
// Every timestamp the product writes (events, sends) and every "now" it reads (SLA, debt age)
// comes from here, so the server and the browser never disagree about what time it is.

export function virtualNow(clockOffsetMs: number, realNow: number = Date.now()): number {
  return realNow + clockOffsetMs;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
