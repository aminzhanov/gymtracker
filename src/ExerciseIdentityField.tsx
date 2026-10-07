import { useEffect, useRef, useState } from "react";
import type { Exercise, WorkoutExercise } from "./types";
import { t, exerciseName } from "./i18n";
import { findExerciseByName, relinkExercise } from "./exerciseIdentity";

export function ExerciseIdentityField({
  exercise,
  library,
  onCustom,
  onChange,
  onBusy,
}: {
  exercise: WorkoutExercise;
  library: Exercise[];
  onCustom?: (name: string) => Promise<string>;
  onChange: (exercise: WorkoutExercise) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = useRef({ exercise, onChange, library, onBusy });
  current.current = { exercise, onChange, library, onBusy };
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const matched = findExerciseByName(library, name);
  const apply = async () => {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed || busy) return;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const id = matched?.id ?? (await onCustom!(trimmed));
      if (!alive.current) return;
      const target = matched ??
        current.current.library.find((e) => e.id === id) ?? {
          id,
          name: trimmed,
        };
      current.current.onChange(
        relinkExercise(current.current.exercise, target),
      );
      setOpen(false);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) {
        setBusy(false);
        current.current.onBusy(false);
      }
    }
  };
  if (exercise.kind !== "strength")
    return (
      <label className="exercise-name-label">
        {t("Exercise name")}
        <input
          aria-label={t("Exercise name")}
          className="exercise-name"
          value={exercise.name}
          maxLength={100}
          onChange={(e) => onChange({ ...exercise, name: e.target.value })}
        />
      </label>
    );
  return (
    <div className="exercise-identity">
      <strong>{exerciseName(exercise.name, exercise.exerciseId)}</strong>
      {onCustom && !open && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setName(exerciseName(exercise.name, exercise.exerciseId));
            setError("");
            setOpen(true);
          }}
        >
          {t("Change exercise")}
        </button>
      )}
      {open && (
        <div className="exercise-identity-editor">
          <label>
            {t("Choose or create exercise")}
            <input
              aria-label={t("Choose or create exercise")}
              maxLength={100}
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <select
            aria-label={t("Choose from exercise library")}
            value={matched?.id ?? ""}
            disabled={busy}
            onChange={(e) => {
              const target = library.find((x) => x.id === e.target.value);
              if (target) setName(target.name);
            }}
          >
            <option value="">{t("Choose from exercise library")}</option>
            {library.map((e) => (
              <option key={e.id} value={e.id}>
                {exerciseName(e.name, e.id)}
              </option>
            ))}
          </select>
          <p className="muted">
            {t(
              "Changes this exercise in this workout only. Sets and notes are kept; search and analytics use the new exercise.",
            )}
          </p>
          <div className="flex">
            <button
              type="button"
              className="button secondary compact"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="button primary compact"
              disabled={busy || !name.trim()}
              onClick={apply}
            >
              {busy
                ? t("Adding exercise…")
                : matched
                  ? t("Use exercise")
                  : t("Create and use exercise")}
            </button>
          </div>
          {error && (
            <p role="alert" className="danger-text">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
