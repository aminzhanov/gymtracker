import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { TechniqueVideo, TechniqueVideoEditor } from "./TechniqueVideo";
import {
  exerciseSummary,
  exerciseComplete,
  setExerciseCompletion,
  id,
} from "./model";

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
  techniqueUrl,
  techniqueReady = false,
  onSaveTechnique,
  orderControls,
}: {
  exercise: WorkoutExercise;
  session: Session;
  sessions: Session[];
  isTemplate: boolean;
  initiallyExpanded?: boolean;
  canSave: boolean;
  onChange: (exercise: WorkoutExercise) => void;
  onSave: () => void;
  onRemove?: () => void;
  techniqueUrl?: string;
  techniqueReady?: boolean;
  onSaveTechnique?: (url: string) => Promise<void>;
  orderControls?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [notesOpen, setNotesOpen] = useState(false);
  const overview = useRef<HTMLButtonElement>(null);
  const wasExpanded = useRef(expanded);
  useEffect(() => {
    if (wasExpanded.current && !expanded) overview.current?.focus();
    wasExpanded.current = expanded;
  }, [expanded]);
  const collapse = () => {
    if (!canSave || !exercise.name.trim()) return;
    onSave();
    setExpanded(false);
  };
  const completed =
    exercise.kind === "strength"
      ? exercise.sets.filter((set) => set.done).length
      : Number(exercise.done);
  const total = exercise.kind === "strength" ? exercise.sets.length : 1;
  return (
    <section
      className={`exercise-block ${exercise.kind !== "strength" ? "recovery-block" : ""} ${expanded ? "expanded" : "collapsed"}`}
      onClick={(event) => {
        if (!expanded || !(event.target instanceof Element)) return;
        if (
          event.target.closest(
            "button,input,textarea,select,label,a,iframe,[role='button'],.technique-video,.technique-editor",
          )
        )
          return;
        collapse();
      }}
    >
      {orderControls}
      {!expanded ? (
        <div className="exercise-overview-row">
          <button
            className="exercise-overview"
            ref={overview}
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
          {!isTemplate && (
            <button
              className={`done-button exercise-quick-complete ${exerciseComplete(exercise) ? "checked" : ""}`}
              aria-label={`${exerciseComplete(exercise) ? "Reopen" : "Complete"} ${exercise.name}`}
              aria-pressed={exerciseComplete(exercise)}
              disabled={exercise.kind === "strength" && total === 0}
              onClick={() =>
                onChange(
                  setExerciseCompletion(exercise, !exerciseComplete(exercise)),
                )
              }
            >
              <Check size={20} />
            </button>
          )}
        </div>
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
              type="button"
              className="exercise-collapse-toggle"
              aria-label={`Close ${exercise.name} and save`}
              aria-expanded={true}
              disabled={!canSave || !exercise.name.trim()}
              onClick={collapse}
            >
              <ChevronDown size={20} className="rotated" />
              <span>Close</span>
            </button>
            {onRemove && (
              <button
                className="icon-button danger-text"
                aria-label={`Remove ${exercise.name}`}
                onClick={onRemove}
              >
                <Trash2 size={18} />
              </button>
            )}
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
          <label className="exercise-notes-label">
            Exercise notes
            <textarea
              aria-label={`Notes for ${exercise.name}`}
              rows={3}
              maxLength={4000}
              placeholder={
                isTemplate
                  ? "Form cues or instructions…"
                  : "How it felt, technique, what to adjust next time…"
              }
              value={exercise.notes}
              onChange={(event) =>
                onChange({ ...exercise, notes: event.target.value })
              }
            />
          </label>
          {onSaveTechnique && (
            <TechniqueVideoEditor
              name={exercise.name}
              url={techniqueUrl}
              ready={techniqueReady}
              onSave={onSaveTechnique}
            />
          )}
          <div className="exercise-save">
            <button
              className="button primary"
              disabled={!canSave || !exercise.name.trim()}
              onClick={collapse}
            >
              <Save size={17} /> Save exercise
            </button>
          </div>
        </>
      )}
      {!expanded && exercise.notes.trim() && (
        <div
          className={`exercise-note-preview ${notesOpen ? "notes-open" : ""}`}
        >
          <div className="flex">
            <strong>Exercise notes</strong>
            <button
              type="button"
              className="text-button"
              aria-label={`${notesOpen ? "Hide" : "Read"} notes for ${exercise.name}`}
              aria-expanded={notesOpen}
              onClick={() => setNotesOpen(!notesOpen)}
            >
              {notesOpen ? "Show less" : "Read note"}
            </button>
          </div>
          <p>{exercise.notes}</p>
        </div>
      )}
      <TechniqueVideo name={exercise.name} url={techniqueUrl} />
    </section>
  );
}
