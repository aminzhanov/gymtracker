import type { WorkoutExercise } from "./types.ts";
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
