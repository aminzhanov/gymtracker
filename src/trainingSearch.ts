import type { AppData, Session, WorkoutExercise } from "./types.ts";
import { exerciseName } from "./i18n.ts";
const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
export function matchesSearch(text: string, query: string) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  return (
    tokens.length > 0 &&
    tokens.every((token) => normalize(text).includes(token))
  );
}
export function exerciseMatches(
  e: WorkoutExercise,
  query: string,
  data: AppData,
) {
  const library = data.exercises.find((x) => x.id === e.exerciseId);
  return [
    e.name,
    exerciseName(e.name, e.exerciseId),
    library?.name ?? "",
    library ? exerciseName(library.name, library.id) : "",
  ].some((name) => matchesSearch(name, query));
}
export function searchSessions(data: AppData, query: string) {
  return data.sessions.filter(
    (s) =>
      matchesSearch(s.name, query) ||
      s.exercises.some((e) => exerciseMatches(e, query, data)),
  );
}
export function searchExerciseOptions(data: AppData, query: string) {
  const found = new Map<string, { id: string; name: string; count: number }>();
  for (const s of data.sessions)
    for (const e of s.exercises)
      if (exerciseMatches(e, query, data)) {
        const item = found.get(e.exerciseId) ?? {
          id: e.exerciseId,
          name:
            data.exercises.find((x) => x.id === e.exerciseId)?.name ?? e.name,
          count: 0,
        };
        item.count++;
        found.set(item.id, item);
      }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function searchResultGroups(
  sessions: Session[],
  status: string,
  month: string,
) {
  const filtered = sessions.filter(
    (s) =>
      (status === "all" || s.status === status) &&
      (month === "all" || s.date.startsWith(month)),
  );
  return [
    {
      status: "planned",
      sessions: filtered
        .filter((s) => s.status === "planned")
        .sort(
          (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
        ),
    },
    {
      status: "done",
      sessions: filtered
        .filter((s) => s.status === "done")
        .sort(
          (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
        ),
    },
  ].filter((g) => g.sessions.length);
}
