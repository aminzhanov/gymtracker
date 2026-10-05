import type { Session, Week } from "./types.ts";
import { calendarVolume } from "./planning.ts";
import { trainingWeeks } from "./trainingWeeks.ts";

export type LibrarySessionWeek = {
  key: string;
  label: string;
  week?: Week;
  from: string;
  to: string;
  sessions: Session[];
};

// Derive assignments and numbering from all history before applying view filters.
// Month sections show only their own sessions, including crossing training weeks.
export function librarySessionWeeks(
  allSessions: Session[],
  visibleSessions: Session[],
  month: string,
  useABSplit: boolean,
): LibrarySessionWeek[] {
  const visible = new Map(
    visibleSessions
      .filter((s) => s.date.startsWith(month))
      .map((s) => [s.id, s]),
  );
  const groups: LibrarySessionWeek[] = useABSplit
    ? trainingWeeks(allSessions).map((g) => ({
        key: `${g.week}:${g.key}`,
        label: g.label,
        week: g.week,
        from: g.from,
        to: g.to,
        sessions: g.sessions.flatMap((s) => {
          const match = visible.get(s.id);
          return match ? [match] : [];
        }),
      }))
    : calendarVolume([], month).map((g, i) => ({
        key: g.key,
        label: `Week ${i + 1}`,
        from: g.from,
        to: g.to,
        sessions: [...visible.values()].filter(
          (s) => s.date >= g.from && s.date <= g.to,
        ),
      }));
  return groups
    .filter((g) => g.sessions.length)
    .map((g) => ({
      ...g,
      sessions: [...g.sessions].sort(
        (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
      ),
    }))
    .sort((a, b) => b.from.localeCompare(a.from) || a.key.localeCompare(b.key));
}
