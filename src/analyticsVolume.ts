import { appLocale } from "./i18n.ts";
import type { Session, Week } from "./types.ts";
import {
  addDays,
  changePercent,
  monday,
  parseDate,
  dateKey,
  shortDate,
  volume,
  exerciseHistory,
  doneSets,
} from "./model.ts";
import { trainingWeeks } from "./trainingWeeks.ts";

export type VolumePeriod = "session" | "week" | "month";
export type VolumeRow = {
  key: string;
  label: string;
  from: string;
  to: string;
  week?: Week;
  done: number;
  planned: number;
  total: number;
  a: { done: number; planned: number };
  b: { done: number; planned: number };
  closed: boolean;
  change: number | null;
  baseline: string | null;
};

// Count checked sets once, and project only the remaining prescribed sets.
export function volumeRows(
  sessions: Session[],
  period: VolumePeriod,
  split: boolean,
): VolumeRow[] {
  const sorted = [...sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const groups =
    period === "week" && split
      ? trainingWeeks(sorted)
      : (() => {
          const buckets = new Map<
            string,
            {
              key: string;
              label: string;
              from: string;
              to: string;
              sessions: Session[];
            }
          >();
          for (const session of sorted) {
            const key =
              period === "session"
                ? session.id
                : period === "week"
                  ? monday(session.date)
                  : session.date.slice(0, 7);
            if (!buckets.has(key)) {
              const from =
                period === "week"
                  ? key
                  : period === "month"
                    ? `${key}-01`
                    : session.date;
              const to =
                period === "week"
                  ? addDays(from, 6)
                  : period === "month"
                    ? dateKey(
                        new Date(
                          parseDate(from).getFullYear(),
                          parseDate(from).getMonth() + 1,
                          0,
                        ),
                      )
                    : from;
              buckets.set(key, {
                key,
                from,
                to,
                label:
                  period === "session"
                    ? `${shortDate(from)} · ${session.name}`
                    : period === "week"
                      ? `${shortDate(from)}–${shortDate(to)}`
                      : parseDate(from).toLocaleDateString(appLocale(), {
                          month: "short",
                          year: "numeric",
                        }),
                sessions: [],
              });
            }
            buckets.get(key)!.sessions.push(session);
          }
          return [...buckets.values()];
        })();
  const baselines = new Map<string, VolumeRow>();
  return groups.map((group) => {
    const a = { done: 0, planned: 0 },
      b = { done: 0, planned: 0 };
    for (const session of group.sessions) {
      const bucket = session.week === "A" ? a : b;
      bucket.done += volume(session);
      if (session.status === "planned")
        bucket.planned += session.exercises
          .filter((e) => e.kind === "strength")
          .flatMap((e) => e.sets)
          .filter((s) => !s.done)
          .reduce((sum, s) => sum + s.weight * s.reps, 0);
    }
    const done = a.done + b.done,
      planned = a.planned + b.planned;
    const week = "week" in group ? (group.week as Week) : undefined;
    const baselineKey = period === "week" && split ? week! : "all";
    const previous = baselines.get(baselineKey);
    const row: VolumeRow = {
      key: group.key,
      label: group.label,
      from: group.from,
      to: group.to,
      week,
      a,
      b,
      done,
      planned,
      total: done + planned,
      closed: group.sessions.every((s) => s.status === "done"),
      change: done > 0 && previous ? changePercent(done, previous.done) : null,
      baseline: done > 0 ? (previous?.label ?? null) : null,
    };
    // An unfinished training group may show a change, but is never a baseline
    // for the next group. Pure future plans never change actual-only metrics.
    if (done > 0 && (period !== "week" || !split || row.closed))
      baselines.set(baselineKey, row);
    return row;
  });
}
export function strengthTrend(sessions: Session[], today = dateKey()) {
  const from = addDays(today, -29);
  const actual = sessions.filter((s) => s.date >= from && s.date <= today);
  const ids = [
    ...new Set(actual.flatMap((s) => doneSets(s).map((set) => set.exerciseId))),
  ];
  const exercises = ids.flatMap((id) => {
    const history = exerciseHistory(actual, id, "e1rm");
    if (history.length < 2) return [];
    const first = history[0],
      last = history.at(-1)!;
    const change = changePercent(last.value, first.value);
    return change === null
      ? []
      : [{ id, change, first: first.value, latest: last.value }];
  });
  return {
    value: exercises.length
      ? exercises.reduce((sum, e) => sum + e.change, 0) / exercises.length
      : null,
    count: exercises.length,
    exercises,
    from,
    to: today,
  };
}

export function filterVolumeRange<T extends { from: string; to: string }>(
  rows: T[],
  range: "month" | "three" | "all",
  today = dateKey(),
): T[] {
  if (range === "all") return rows;
  const date = parseDate(today);
  const from = dateKey(
    new Date(
      date.getFullYear(),
      date.getMonth() - (range === "three" ? 2 : 0),
      1,
    ),
  );
  const to = dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  return rows.filter((row) => row.to >= from && row.from <= to);
}

export function trainingAverages(sessions: Session[]) {
  const rows = volumeRows(sessions, "week", true).filter(
    (r) => r.closed && r.done > 0,
  );
  const mean = (week: Week) => {
    const values = rows.filter((r) => r.week === week);
    return values.length
      ? values.reduce((sum, r) => sum + r.done, 0) / values.length
      : null;
  };
  const a = mean("A"),
    b = mean("B");
  return {
    a,
    b,
    difference: a !== null && b !== null ? changePercent(a, b) : null,
  };
}

export function activeVolumeGroup(
  sessions: Session[],
  split: boolean,
  today: string,
) {
  if (!split)
    return {
      label: "This calendar week",
      sessions: sessions.filter(
        (s) => s.date >= monday(today) && s.date <= addDays(monday(today), 6),
      ),
    };
  const groups = trainingWeeks(sessions);
  return (
    groups.filter((g) => g.from <= today).at(-1) ??
    groups[0] ?? { label: "This training week", sessions: [] }
  );
}
