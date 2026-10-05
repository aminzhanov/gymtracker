import type { Session } from "./types.ts";
import { dateKey, doneSets, estimatedMax, records, volume } from "./model.ts";
import { last30Sessions, strengthTrend } from "./analyticsVolume.ts";
export function dashboardStats(sessions: Session[], today = dateKey()) {
  const actual = sessions.filter((s) => s.date <= today);
  const volumeSessions = last30Sessions(actual, today)
    .filter((s) => doneSets(s).length > 0)
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const byId = new Map(actual.map((s) => [s.id, s]));
  const recordEvents = records(actual)
    .events.filter((e) => e.date.startsWith(today.slice(0, 7)))
    .map((event) => {
      const session = byId.get(event.sessionId)!;
      const set = doneSets(session)
        .filter(
          (s) =>
            s.exerciseId === event.exerciseId && s.weight > 0 && s.reps > 0,
        )
        .sort(
          (a, b) =>
            estimatedMax(b.weight, b.reps) - estimatedMax(a.weight, a.reps),
        )[0];
      return {
        ...event,
        session,
        name: set.name,
        weight: set.weight,
        reps: set.reps,
      };
    })
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name),
    );
  return {
    trend: strengthTrend(actual, today),
    lifting: volumeSessions.reduce((n, s) => n + volume(s), 0),
    volumeSessions,
    recordEvents,
  };
}
