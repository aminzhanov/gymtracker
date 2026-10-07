import type { Exercise, WorkoutExercise } from "./types.ts";
import { exerciseName } from "./i18n.ts";
import { exerciseNameKey } from "./library.ts";

export function findExerciseByName(exercises: Exercise[], name: string) {
  const key = exerciseNameKey(name);
  if (!key) return undefined;
  return exercises.find(
    (e) =>
      exerciseNameKey(e.name) === key ||
      exerciseNameKey(exerciseName(e.name, e.id)) === key,
  );
}

/** Change only this workout occurrence, preserving sets, checks, notes and order. */
export function relinkExercise(
  exercise: WorkoutExercise,
  target: Pick<Exercise, "id" | "name">,
): WorkoutExercise {
  if (!target.id || !target.name.trim())
    throw new Error("Choose an exercise name.");
  return { ...exercise, exerciseId: target.id, name: target.name.trim() };
}
