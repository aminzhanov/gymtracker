import type { Session } from "./types.ts";
import { addDays, dateKey, monday, parseDate, volume } from "./model.ts";
import { trainingWeeks } from "./trainingWeeks.ts";

export function trainingWeekVolume(sessions: Session[], month: string) {
  return trainingWeeks(sessions)
    .filter((group) =>
      group.sessions.some((session) => session.date.slice(0, 7) === month),
    )
    .map((group) => {
      let done = 0,
        planned = 0;
      for (const session of group.sessions) {
        if (session.status === "done") done += volume(session);
        else
          planned += session.exercises
            .filter((e) => e.kind === "strength")
            .flatMap((e) => e.sets)
            .reduce((sum, set) => sum + set.weight * set.reps, 0);
      }
      const bucket = { done, planned };
      return {
        ...group,
        done,
        planned,
        total: done + planned,
        a: group.week === "A" ? bucket : { done: 0, planned: 0 },
        b: group.week === "B" ? bucket : { done: 0, planned: 0 },
      };
    });
}

export const monthLabel = (month: string) =>
  parseDate(`${month}-01`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

export function calendarVolume(sessions: Session[], month: string) {
  const first = `${month}-01`;
  const next = parseDate(first);
  next.setMonth(next.getMonth() + 1);
  const end = addDays(dateKey(next), -1);
  const rows = [];
  for (let start = monday(first); start <= end; start = addDays(start, 7)) {
    const from = start < first ? first : start;
    const to = addDays(start, 6) > end ? end : addDays(start, 6);
    const a = { done: 0, planned: 0 };
    const b = { done: 0, planned: 0 };
    for (const session of sessions) {
      if (session.date < from || session.date > to) continue;
      const bucket = session.week === "A" ? a : b;
      if (session.status === "done") bucket.done += volume(session);
      else
        bucket.planned += session.exercises
          .filter((exercise) => exercise.kind === "strength")
          .flatMap((exercise) => exercise.sets)
          .reduce((sum, set) => sum + set.weight * set.reps, 0);
    }
    const done = a.done + b.done;
    const planned = a.planned + b.planned;
    rows.push({
      key: start,
      from,
      to,
      a,
      b,
      done,
      planned,
      total: done + planned,
    });
  }
  return rows;
}

export type TrainingScope = "current" | "past" | "all";
export function trainingMonths(sessions: Session[], today = dateKey()) {
  return [
    ...new Set([today.slice(0, 7), ...sessions.map((s) => s.date.slice(0, 7))]),
  ]
    .sort()
    .reverse();
}

export function trainingGroups(
  sessions: Session[],
  scope: TrainingScope,
  selectedMonth: string,
  status: string,
  search: string,
  today = dateKey(),
) {
  const current = today.slice(0, 7);
  const filtered = sessions
    .filter((s) => {
      const month = s.date.slice(0, 7);
      return (
        (scope === "current"
          ? month === current
          : scope === "past"
            ? month < current
            : true) &&
        (scope === "current" ||
          selectedMonth === "all" ||
          month === selectedMonth) &&
        (status === "all" || s.status === status) &&
        s.name.toLowerCase().includes(search.trim().toLowerCase())
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const groups = new Map<string, Session[]>();
  for (const session of filtered) {
    const month = session.date.slice(0, 7);
    const group = groups.get(month) ?? [];
    group.push(session);
    groups.set(month, group);
  }
  return [...groups].map(([month, sessions]) => ({ month, sessions }));
}
