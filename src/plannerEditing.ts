import type { Session, WorkoutExercise } from "./types.ts";
import { id } from "./model.ts";
export function matchingSets(e: WorkoutExercise) {
  return (
    e.sets.length > 0 &&
    e.sets.every(
      (s) => s.weight === e.sets[0].weight && s.reps === e.sets[0].reps,
    )
  );
}
export function resizeSets(e: WorkoutExercise, count: number): WorkoutExercise {
  if (!Number.isInteger(count) || count < 0 || count > 100) return e;
  const sets = e.sets.slice(0, count);
  const last = e.sets.at(-1);
  while (sets.length < count)
    sets.push({
      id: id(),
      weight: last?.weight ?? 20,
      reps: last?.reps ?? 8,
      done: false,
    });
  return { ...e, sets };
}
export function editPrescription(
  e: WorkoutExercise,
  field: "weight" | "reps",
  value: number,
  setId?: string,
): WorkoutExercise {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    (field === "reps" && !Number.isInteger(value))
  )
    return e;
  if (!setId && !matchingSets(e)) return e;
  return {
    ...e,
    sets: e.sets.map((s) =>
      !setId || s.id === setId ? { ...s, [field]: value } : s,
    ),
  };
}

// Date-only sessions have no reliable within-day order. Use strictly earlier
// dates and the whole history, including plans that are still in the future.
export function previousPlannerExercise(
  sessions: Session[],
  current: Session,
  exercise: WorkoutExercise,
) {
  for (const session of sessions
    .filter((s) => s.id !== current.id && s.date < current.date)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))) {
    const matches = session.exercises.filter(
      (e) => e.exerciseId === exercise.exerciseId && e.kind === exercise.kind,
    );
    if (!matches.length) continue;
    if (exercise.kind === "strength") {
      const sets = matches
        .flatMap((e) => e.sets)
        .filter((s) => session.status !== "done" || s.done);
      if (!sets.length) continue;
      return { session, exercise: { ...matches[0], sets } };
    }
    const previous = matches.find((e) => session.status !== "done" || e.done);
    if (previous) return { session, exercise: previous };
  }
  return undefined;
}
