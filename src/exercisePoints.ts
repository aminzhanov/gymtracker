import type { Session } from "./types.ts";
import {
  exerciseHistory,
  doneSets,
  changePercent,
  estimatedMax,
} from "./model.ts";

export function exercisePointDetails(
  sessions: Session[],
  exerciseId: string,
  metric: "e1rm" | "weight" | "volume",
  scale: "kg" | "percent",
  month: string,
  date: string,
) {
  const history = exerciseHistory(sessions, exerciseId, metric).filter(
    (row) => !month || row.date.startsWith(month),
  );
  const index = history.findIndex((row) => row.date === date);
  if (index < 0) return null;
  const row = history[index],
    previous = history[index - 1] ?? null,
    baseline = history[0];
  const display = (value: number) =>
    scale === "percent" ? (changePercent(value, baseline.value) ?? 0) : value;
  const logs = sessions
    .filter((s) => s.date === date)
    .map((session) => ({
      sessionId: session.id,
      sessionName: session.name,
      sets: doneSets(session)
        .filter(
          (set) =>
            set.exerciseId === exerciseId &&
            set.reps > 0 &&
            (metric === "volume" ? set.weight >= 0 : set.weight > 0),
        )
        .map((set) => ({
          ...set,
          estimated: estimatedMax(set.weight, set.reps),
          contributes:
            metric === "volume" ||
            (metric === "e1rm"
              ? estimatedMax(set.weight, set.reps)
              : set.weight) === row.value,
        })),
    }))
    .filter((log) => log.sets.length)
    .sort((a, b) => a.sessionId.localeCompare(b.sessionId));
  return {
    exerciseId,
    metric,
    scale,
    date,
    rawValue: row.value,
    value: display(row.value),
    previous: previous
      ? { ...previous, displayed: display(previous.value) }
      : null,
    baseline,
    change: previous ? row.value - previous.value : null,
    growth: changePercent(row.value, baseline.value),
    logs,
  };
}
