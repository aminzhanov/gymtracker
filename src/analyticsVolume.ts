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
  estimatedMax,
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
export const STRENGTH_TREND_INFO =
  "Average percentage change in daily best estimated 1RM from each exercise's first to latest log within the last 30 days. Each exercise needs at least two different logged days and receives equal weight. Checked strength sets only; plans and zero-weight sets are excluded. This is an estimate from your logs, not a measured change in maximal strength.";
export function last30Sessions(sessions: Session[], today = dateKey()) {
  const from = addDays(today, -29);
  return sessions.filter((s) => s.date >= from && s.date <= today);
}
export function completedVolume30(sessions: Session[], today = dateKey()) {
  return last30Sessions(sessions, today).reduce(
    (sum, s) =>
      sum + doneSets(s).reduce((n, set) => n + set.weight * set.reps, 0),
    0,
  );
}
export function strengthTrendHistory(
  sessions: Session[],
  range: "30" | "all" = "30",
  today = dateKey(),
) {
  const actual =
    range === "30"
      ? last30Sessions(sessions, today)
      : sessions.filter((s) => s.date <= today);
  const ids = [
    ...new Set(actual.flatMap((s) => doneSets(s).map((set) => set.exerciseId))),
  ];
  const histories = ids.flatMap((id) => {
    const history = exerciseHistory(actual, id, "e1rm");
    return history.length < 2 ? [] : [{ id, history }];
  });
  const changes = new Map<string, { id: string; value: number }[]>();
  for (const { id, history } of histories)
    for (const point of history) {
      const day = changes.get(point.date) ?? [];
      day.push({ id, value: changePercent(point.value, history[0].value)! });
      changes.set(point.date, day);
    }
  const dates = [...changes.keys()].sort();
  const latest = new Map<string, number>();
  const rows = dates.map((date) => {
    for (const { id, value } of changes.get(date)!) latest.set(id, value);
    const values = [...latest.values()];
    return {
      date,
      value: values.reduce((sum, value) => sum + value, 0) / values.length,
      count: values.length,
    };
  });
  const exercises = histories.map(({ id, history }) => ({
    id,
    change: changePercent(history.at(-1)!.value, history[0].value)!,
    first: history[0].value,
    latest: history.at(-1)!.value,
  }));
  return {
    rows,
    exercises,
    value: rows.at(-1)?.value ?? null,
    count: histories.length,
    from: range === "30" ? addDays(today, -29) : (dates[0] ?? today),
    to: today,
  };
}
export function strengthTrend(sessions: Session[], today = dateKey()) {
  return strengthTrendHistory(sessions, "30", today);
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

/** Explain a plotted point, including dilution from exercises joining at 0%. */
export function strengthPointDetails(
  sessions: Session[],
  range: "30" | "all",
  date: string,
  today = dateKey(),
) {
  const graph = strengthTrendHistory(sessions, range, today);
  const index = graph.rows.findIndex((row) => row.date === date);
  if (index < 0) return null;
  const point = graph.rows[index],
    previous = graph.rows[index - 1];
  const actual =
    range === "30"
      ? last30Sessions(sessions, today)
      : sessions.filter((s) => s.date <= today);
  const details = graph.exercises
    .flatMap((exercise) => {
      const daily = new Map<
        string,
        {
          date: string;
          value: number;
          weight: number;
          reps: number;
          sessionId: string;
          sessionName: string;
          name: string;
        }
      >();
      for (const session of actual)
        for (const set of doneSets(session)) {
          if (
            set.exerciseId !== exercise.id ||
            set.weight <= 0 ||
            set.reps <= 0
          )
            continue;
          const value = estimatedMax(set.weight, set.reps);
          if (
            !daily.has(session.date) ||
            value > daily.get(session.date)!.value
          )
            daily.set(session.date, {
              date: session.date,
              value,
              weight: set.weight,
              reps: set.reps,
              sessionId: session.id,
              sessionName: session.name,
              name: set.name,
            });
        }
      const logs = [...daily.values()].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      const current = logs.filter((log) => log.date <= date).at(-1);
      if (!current) return [];
      const prior = logs.filter((log) => log.date < date).at(-1);
      const growth = changePercent(current.value, logs[0].value)!;
      const previousGrowth = prior
        ? changePercent(prior.value, logs[0].value)!
        : null;
      const joined = !prior;
      // All new contributors enter at zero. Dividing each existing delta by
      // the new count, plus -oldMean/newCount for each join, reconciles exactly.
      const effect = previous
        ? joined
          ? -previous.value / point.count
          : (growth - previousGrowth!) / point.count
        : 0;
      return [
        {
          id: exercise.id,
          current,
          prior: prior ?? null,
          growth,
          previousGrowth,
          joined,
          updated: current.date === date,
          effect,
        },
      ];
    })
    .sort(
      (a, b) =>
        Math.abs(b.effect) - Math.abs(a.effect) || a.id.localeCompare(b.id),
    );
  return {
    ...point,
    previousValue: previous?.value ?? null,
    previousDate: previous?.date ?? null,
    delta: previous ? point.value - previous.value : null,
    details,
    affected: details.filter(
      (row) => row.joined || Math.abs(row.effect) > 1e-9,
    ),
  };
}
