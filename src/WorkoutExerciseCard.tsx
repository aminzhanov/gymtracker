import { useState } from "react";
import {
  Check,
  ChevronDown,
  Dumbbell,
  Plus,
  Save,
  Timer,
  Trash2,
} from "lucide-react";
import type { Session, WorkoutExercise } from "./types";
import { LastTime, SetRow } from "./components";
import { exerciseSummary, id } from "./model";

export function WorkoutExerciseCard({
  exercise,
  session,
  sessions,
  isTemplate,
  initiallyExpanded = false,
  canSave,
  onChange,
  onSave,
  onRemove,
}: {
  exercise: WorkoutExercise;
  session: Session;
  sessions: Session[];
  isTemplate: boolean;
  initiallyExpanded?: boolean;
  canSave: boolean;
  onChange: (exercise: WorkoutExercise) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const completed =
    exercise.kind === "strength"
      ? exercise.sets.filter((set) => set.done).length
      : Number(exercise.done);
  const total = exercise.kind === "strength" ? exercise.sets.length : 1;
  return (
    <section
      className={`exercise-block ${exercise.kind !== "strength" ? "recovery-block" : ""} ${expanded ? "expanded" : "collapsed"}`}
    >
      {!expanded ? (
        <button
          className="exercise-overview"
          aria-label={`Edit ${exercise.name}`}
          aria-expanded={false}
          onClick={() => setExpanded(true)}
        >
          <span
            className={`exercise-symbol ${exercise.kind === "strength" ? "tint-blue" : "tint-pink"}`}
          >
            {exercise.kind === "strength" ? (
              <Dumbbell size={20} />
            ) : (
              <Timer size={20} />
            )}
          </span>
          <span className="exercise-overview-copy">
            <strong>{exercise.name}</strong>
            <span className="exercise-prescription">
              {exerciseSummary(exercise)}
            </span>
            {!isTemplate && (
              <span
                className={`exercise-completion ${completed === total && total > 0 ? "positive" : ""}`}
              >
                {exercise.kind === "strength"
                  ? `${completed}/${total} sets done`
                  : exercise.done
                    ? "Completed"
                    : "Planned"}{" "}
                · Tap to edit
              </span>
            )}
            {isTemplate && (
              <span className="exercise-completion">Tap to edit</span>
            )}
          </span>
          <ChevronDown size={20} />
        </button>
      ) : (
        <>
          <div className="exercise-head">
            <span
              className={`exercise-symbol ${exercise.kind === "strength" ? "tint-blue" : "tint-pink"}`}
            >
              {exercise.kind === "strength" ? (
                <Dumbbell size={20} />
              ) : (
                <Timer size={20} />
              )}
            </span>
            <div className="grow">
              <label className="exercise-name-label">
                Exercise name
                <input
                  aria-label="Exercise name"
                  className="exercise-name"
                  value={exercise.name}
                  maxLength={100}
                  onChange={(event) =>
                    onChange({ ...exercise, name: event.target.value })
                  }
                />
              </label>
              {exercise.kind === "strength" && !isTemplate && (
                <LastTime
                  exercise={exercise}
                  session={session}
                  sessions={sessions}
                />
              )}
            </div>
            <button
              className="icon-button danger-text"
              aria-label={`Remove ${exercise.name}`}
              onClick={onRemove}
            >
              <Trash2 size={18} />
            </button>
          </div>
          {exercise.kind === "strength" ? (
            <>
              <div className="set-labels">
                <span>Set</span>
                <span>Weight (kg)</span>
                <span>Reps</span>
                <span>Done</span>
              </div>
              {exercise.sets.map((set, index) => (
                <SetRow
                  key={set.id}
                  set={set}
                  index={index}
                  onChange={(updated) =>
                    onChange({
                      ...exercise,
                      sets: exercise.sets.map((old) =>
                        old.id === set.id ? updated : old,
                      ),
                    })
                  }
                  onRemove={() =>
                    onChange({
                      ...exercise,
                      sets: exercise.sets.filter((old) => old.id !== set.id),
                    })
                  }
                />
              ))}
              <button
                className="text-button"
                onClick={() =>
                  onChange({
                    ...exercise,
                    sets: [
                      ...exercise.sets,
                      {
                        id: id(),
                        weight: exercise.sets.at(-1)?.weight ?? 20,
                        reps: exercise.sets.at(-1)?.reps ?? 8,
                        done: false,
                      },
                    ],
                  })
                }
              >
                <Plus size={17} /> Add set
              </button>
            </>
          ) : (
            <div className="recovery-fields">
              <label>
                Duration (minutes)
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={exercise.duration}
                  onChange={(event) =>
                    onChange({
                      ...exercise,
                      duration: Math.max(
                        0,
                        Math.min(1440, Number(event.target.value)),
                      ),
                    })
                  }
                />
              </label>
              <label className="grow">
                Notes
                <input
                  placeholder="Light cardio, mobility…"
                  value={exercise.notes}
                  onChange={(event) =>
                    onChange({ ...exercise, notes: event.target.value })
                  }
                />
              </label>
              {!isTemplate && (
                <button
                  className={`done-button ${exercise.done ? "checked" : ""}`}
                  aria-label={`${exercise.name} complete`}
                  aria-pressed={exercise.done}
                  onClick={() =>
                    onChange({ ...exercise, done: !exercise.done })
                  }
                >
                  <Check size={18} />
                </button>
              )}
            </div>
          )}
          <div className="exercise-save">
            <button
              className="button primary"
              disabled={!canSave || !exercise.name.trim()}
              onClick={() => {
                onSave();
                setExpanded(false);
              }}
            >
              <Save size={17} /> Save exercise
            </button>
          </div>
        </>
      )}
    </section>
  );
}
