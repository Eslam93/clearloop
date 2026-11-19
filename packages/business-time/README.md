# @clearloop/business-time

A business-hours SLA engine for GCC customers. It counts time the way the customer's office does: in their time zone, on their work week, around their public holidays and Ramadan hours.

It is pure TypeScript with no runtime dependencies. It runs wherever `Intl` has full ICU data, which includes Node and every modern browser.

## Usage

Every instant is a number of epoch milliseconds. Every local date is a `"YYYY-MM-DD"` string.

```ts
import { addBusinessTime, presetCalendar, slaClock } from "@clearloop/business-time";

const HOUR = 60 * 60 * 1000;
const riyadh = presetCalendar("SA");

// Thursday 16:30 in Riyadh plus one business hour is Sunday 08:30.
const due = addBusinessTime(riyadh, Date.parse("2026-11-12T16:30+03:00"), HOUR);
new Date(due).toISOString(); // "2026-11-15T05:30:00.000Z"

// A 4-hour SLA that has been waiting on the customer since Sunday 08:00.
const clock = slaClock(riyadh, {
  startedAt: Date.parse("2026-11-12T15:00+03:00"),
  targetMs: 4 * HOUR,
  now: Date.parse("2026-11-15T11:00+03:00"),
  pauses: [{ from: Date.parse("2026-11-15T08:00+03:00"), to: null }],
});
clock.paused; // true
clock.remainingMs; // 2 hours. Thursday used 2 of the 4.

// A tenant's calendar: a preset plus the dates the government announced.
const tenantCalendar = {
  ...presetCalendar("SA"),
  overrides: [{ date: "2026-03-19", hours: [], name: "Eid al-Fitr holiday, as announced" }],
};
```

## API

| Function | Returns |
| --- | --- |
| `workingIntervals(cal, localDate)` | The working intervals of a local date as instants, sorted. |
| `isWorkingTime(cal, at)` | Whether an instant falls inside working time. |
| `nextWorkingInstant(cal, from)` | The first working instant at or after `from`. |
| `addBusinessTime(cal, from, ms)` | The instant at which `ms` of working time has elapsed after `from`. |
| `businessTimeBetween(cal, from, to)` | Working milliseconds in `[from, to)`. Negative when `to` is before `from`. |
| `slaClock(cal, input)` | The state of an SLA clock at `input.now`. |
| `parseCalendar(value)` | A checked copy of a calendar read from JSON. |
| `PRESETS`, `presetCalendar(id)` | Calendars for the GCC and Egypt. |
| `localDateOf(at, timeZone)` | The local date of an instant. |
| `localToInstant(timeZone, date, time)` | The instant of a local date and `"HH:MM"` time. |
| `hijriDateOf(localDate)`, `isRamadan(localDate)` | The Umm al-Qura date of a civil date. |

## Calendars

A calendar is plain JSON, so it can live in a database column.

```ts
interface CalendarDefinition {
  id: string;
  name: string;
  timeZone: string; // IANA, for example "Asia/Riyadh"
  week: Partial<Record<Weekday, TimeRange[]>>; // 0 is Sunday. Missing or [] is a day off.
  ramadanHours?: TimeRange[];
  hijriHolidays?: HijriHolidayRule[]; // { name, month, day, days }
  fixedHolidays?: FixedHolidayRule[]; // { name, month, day, days? }
  overrides?: DateOverride[]; // { date, hours, name? }
}
```

Times are `"HH:MM"` in 24-hour local wall time. A range starts before it ends, on the same day. An end of `"24:00"` means midnight at the end of the day, so a round-the-clock calendar uses `00:00` to `24:00`.

## Semantics

### Intervals are half-open

Working time is a list of half-open intervals, `[start, end)`. On an 08:00 to 17:00 day, 08:00 is working time and 17:00 is not. Ranges on the same day that overlap or touch are merged.

### Precedence

The hours of a local date come from the first rule that applies:

1. **An override** for that date. An empty `hours` list closes the day, and an override can also open a day off. If two overrides share a date, the later one wins.
2. **A holiday**, fixed or Hijri. The day is closed.
3. **Ramadan hours**, but only on days the week marks as working. Ramadan is Hijri month 9.
4. **The week's hours.**

A holiday rule covers `days` consecutive civil days, starting on its date. So a Hijri rule can run into the next Hijri month.

### Adding and measuring

`addBusinessTime(cal, from, ms)` walks forward through working time. Zero returns `from` unchanged, even outside working hours. A negative duration throws a `RangeError`. When the time runs out exactly at the end of an interval, the result is that end, not the start of the next interval. That keeps the arithmetic consistent:

- `addBusinessTime(addBusinessTime(t, a), b) === addBusinessTime(t, a + b)`
- `businessTimeBetween(t, addBusinessTime(t, h)) === h`

Property tests check these laws and others for every preset.

### SLA clock

`slaClock(cal, { startedAt, targetMs, now, pauses, stoppedAt })` counts business time from `startedAt`.

- **Pauses.** Time inside a pause does not count. A pause with `to: null` is still open. Pauses may overlap and may come in any order.
- **Stop.** The clock stops for good at `stoppedAt`, for example when the request is resolved. `elapsedMs` counts up to `now` or `stoppedAt`, whichever is earlier.
- **Time travel.** Pauses and stops after `now` have not happened yet. Reading the clock at an earlier `now` shows it as it was then.

| Field | Meaning |
| --- | --- |
| `elapsedMs` | Business time counted so far. |
| `remainingMs` | `targetMs - elapsedMs`. Negative once breached. |
| `paused` | A pause covers `now`. |
| `stopped` | `stoppedAt` is set and not after `now`. |
| `breachedAt` | The instant elapsed time first reached the target, or null. |
| `dueAt` | When the target will be reached if the clock is not paused again. |

While the clock runs with time left, `dueAt` is `addBusinessTime(now, remainingMs)`. Once the target is breached, it is `breachedAt`. While the clock is paused or stopped, it is null, because nothing is due until the clock runs again. Adding a pause never makes `dueAt` earlier.

### Guards

A search for working time gives up after 3 years without any and throws an `Error` that names the calendar. No walk covers more than 100 years. Bad instants, durations, dates and times throw a `RangeError`.

## Presets

`PRESETS` holds a calendar for each GCC country and Egypt. They are frozen, so one tenant can never change another tenant's calendar by accident. `presetCalendar(id)` returns a copy that is safe to change.

| Id | Country | Time zone | Work week | Hours | Ramadan hours |
| --- | --- | --- | --- | --- | --- |
| SA | Saudi Arabia | Asia/Riyadh | Sun to Thu | 08:00 to 17:00 | 10:00 to 15:00 |
| AE | United Arab Emirates | Asia/Dubai | Mon to Fri | 09:00 to 18:00 | 09:00 to 16:00 |
| QA | Qatar | Asia/Qatar | Sun to Thu | 08:00 to 17:00 | 09:00 to 14:00 |
| KW | Kuwait | Asia/Kuwait | Sun to Thu | 08:00 to 17:00 | 09:00 to 14:00 |
| BH | Bahrain | Asia/Bahrain | Sun to Thu | 08:00 to 17:00 | 09:00 to 14:00 |
| OM | Oman | Asia/Muscat | Sun to Thu | 08:00 to 17:00 | 09:00 to 14:00 |
| EG | Egypt | Africa/Cairo | Sun to Thu | 09:00 to 17:00 | 09:00 to 15:00 |

Each preset lists its main fixed and Hijri public holidays in `src/presets.ts`.

**The holiday lengths are defaults.** Governments announce the real dates each year, and they can differ from a simple rule by a day or more. An Eid holiday, for example, can start before the Eid itself. Add the announced dates as overrides. Movable holidays are not in the presets. Oman's National Day is left out because its date changed recently.

## Validation

`parseCalendar(value)` checks a calendar read from untrusted JSON, such as a jsonb column, and returns a clean copy. It checks the time zone, every time and range, every weekday key and every date. On bad input it throws an `Error` that names the field:

```
Invalid calendar at week.0[0]: start must be before end, got 17:00 to 08:00.
```

Unknown fields are rejected. A typo such as `fixedHoliday` fails loudly instead of dropping every holiday. Optional fields may be absent or null.

## Limits

- **No overnight shifts.** A range starts and ends on the same local day. To model a night shift, split it into 22:00 to 24:00 on one day and 00:00 to 06:00 on the next. Holidays and overrides then apply to each half by its own date.
- **Hijri dates are computed, not observed.** They come from the Umm al-Qura calendar through `Intl`. Official dates follow moon sightings and can differ by a day. Egypt, for one, sights the moon itself. Use overrides for the announced dates.
- **DST edges.** A wall time inside a DST gap moves forward by the length of the gap. A wall time that happens twice resolves to one of the two. Business hours rarely sit at those times. Of the presets, only Cairo has DST.
- **Runtime.** `Intl` must support the `islamic-umalqura` calendar. If it does not, the engine throws a clear error instead of returning Gregorian dates.

## Development

```sh
pnpm --filter @clearloop/business-time test       # Vitest, with fast-check property tests
pnpm --filter @clearloop/business-time typecheck
```

The package exports its TypeScript source and has no build step. Next.js compiles it through `transpilePackages`.
