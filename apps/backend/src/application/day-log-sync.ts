import type { KnownDayLogRevision } from "./ports/day-log-sync-query.js";

export function listInclusiveDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const end = Temporal.PlainDate.from(endDate);
  let date = Temporal.PlainDate.from(startDate);

  while (Temporal.PlainDate.compare(date, end) <= 0) {
    dates.push(date.toString());
    date = date.add({ days: 1 });
  }

  return dates;
}

export function datesNeedingSyncPayload(
  rangeDates: readonly string[],
  known: Readonly<Record<string, KnownDayLogRevision>>,
  serverVersionsByDate: ReadonlyMap<string, number>,
): string[] {
  return rangeDates.filter((date) => {
    if (!(date in known)) {
      return true;
    }

    const knownRevision = known[date];
    const serverVersion = serverVersionsByDate.get(date);

    if (knownRevision === null) {
      return serverVersion !== undefined;
    }

    return serverVersion !== knownRevision;
  });
}
