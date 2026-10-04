import type { Session, Week } from "./types.ts";

// Only unassigned history is inferred. Explicit groups survive date changes and
// can contain any number of sessions; three is a suggestion, never a limit.
export function assignTrainingWeeks(sessions: Session[]): Session[] {
  const assigned = new Map<string, string>();
  let previous: Session | undefined;
  let key = "";
  let count = 0;
  for (const session of [...sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )) {
    if (session.trainingWeek) {
      if (key === session.trainingWeek && previous?.week === session.week)
        count++;
      else count = 1;
      key = session.trainingWeek;
    } else {
      if (!previous || previous.week !== session.week || count >= 3) {
        key = `legacy:${session.id}`;
        count = 0;
      }
      count++;
      assigned.set(session.id, key);
    }
    previous = session;
  }
  return sessions.map((session) =>
    assigned.has(session.id)
      ? { ...session, trainingWeek: assigned.get(session.id)! }
      : session,
  );
}

export function trainingWeeks(sessions: Session[]) {
  const groups = new Map<
    string,
    { key: string; week: Week; sessions: Session[] }
  >();
  for (const session of assignTrainingWeeks(sessions)) {
    const mapKey = `${session.week}:${session.trainingWeek}`;
    const group = groups.get(mapKey) ?? {
      key: session.trainingWeek!,
      week: session.week,
      sessions: [],
    };
    group.sessions.push(session);
    groups.set(mapKey, group);
  }
  const counts = { A: 0, B: 0 };
  return [...groups.values()]
    .map((group) => ({
      ...group,
      sessions: [...group.sessions].sort(
        (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
      ),
    }))
    .sort(
      (a, b) =>
        a.sessions[0].date.localeCompare(b.sessions[0].date) ||
        a.key.localeCompare(b.key),
    )
    .map((group) => ({
      ...group,
      label: `Week ${group.week} · ${++counts[group.week]}`,
      from: group.sessions[0].date,
      to: group.sessions.at(-1)!.date,
    }));
}

export function suggestTrainingWeek(
  sessions: Session[],
  date: string,
  week?: Week,
) {
  const groups = trainingWeeks(sessions);
  const containing = groups.find(
    (group) =>
      group.from <= date && group.to >= date && (!week || group.week === week),
  );
  if (containing) return containing;
  const preceding = groups.filter((group) => group.from <= date).at(-1);
  if (
    preceding &&
    preceding.sessions.length < 3 &&
    (!week || preceding.week === week)
  )
    return preceding;
  return undefined;
}

export function suggestedProgramWeek(
  sessions: Session[],
  date: string,
  fallback: Week,
): Week {
  const group = suggestTrainingWeek(sessions, date);
  if (group) return group.week;
  const previous = trainingWeeks(sessions)
    .filter((group) => group.from <= date)
    .at(-1);
  return previous ? (previous.week === "A" ? "B" : "A") : fallback;
}
