import type { DayLog } from "@domain/entities/day-log.js";

export type KnownDayLogRevision = number | null;

export interface DayLogSyncQueryInput {
  userId: string;
  startDate: string;
  endDate: string;
  known: Readonly<Record<string, KnownDayLogRevision>>;
}

export interface ChangedDayLogSyncSlot {
  date: string;
  versionNumber: number | null;
  dayLog: DayLog | null;
}

export type DayLogSyncQueryResult =
  | { status: "unchanged" }
  | { status: "changed"; slots: ChangedDayLogSyncSlot[] };

export interface IDayLogSyncQuery {
  readCoherentSnapshot(input: DayLogSyncQueryInput): Promise<DayLogSyncQueryResult>;
}
