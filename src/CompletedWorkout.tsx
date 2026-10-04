import { useEffect, useRef } from "react";
import { Check, Cloud, AlertCircle, Pencil, X } from "lucide-react";
import type { Session } from "./types";
import { ExerciseNames, WeekBadge } from "./components";
import { doneSets, number, shortDate, volume } from "./model";

type SaveState = "saved" | "saving" | "error";
const saveLabel = (state: SaveState) =>
  state === "saved"
    ? "Saved"
    : state === "saving"
      ? "Saving…"
      : "Not saved · check the error above";

export function CompletedWorkout({
  session,
  showWeek,
  saveState,
  celebrate,
  onEdit,
}: {
  session: Session;
  showWeek: boolean;
  saveState: SaveState;
  celebrate: boolean;
  onEdit: () => void;
}) {
  const edit = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // The Complete button disappears with the editable workout. Keep keyboard
    // focus on the replacement action, without moving the user's scroll position.
    if (celebrate && !document.querySelector('[role="dialog"]'))
      edit.current?.focus({ preventScroll: true });
  }, [celebrate]);
  return (
    <article
      className={`completed-workout ${celebrate ? "just-completed" : ""}`}
      aria-label={`${session.name} · Workout complete`}
    >
      <div className="completed-workout-heading">
        <span className="completion-check" aria-hidden="true">
          <Check size={32} strokeWidth={3} />
        </span>
        <div>
          <h3>
            <span aria-hidden="true">{session.icon}</span> {session.name}
          </h3>
          <span className="completion-badge">Workout complete</span>
          <div className="completed-workout-date">
            <span>{shortDate(session.date)}</span>
            {showWeek && <WeekBadge week={session.week} />}
          </div>
        </div>
      </div>
      <ExerciseNames exercises={session.exercises} />
      <dl className="completed-workout-totals">
        <div>
          <dt>Completed sets</dt>
          <dd>{doneSets(session).length}</dd>
        </div>
        <div>
          <dt>Total volume</dt>
          <dd>
            {number(volume(session))} <span>kg</span>
          </dd>
        </div>
      </dl>
      <div className="completed-workout-footer">
        <span className={`completion-save ${saveState}`}>
          {saveState === "error" ? (
            <AlertCircle size={16} />
          ) : saveState === "saving" ? (
            <Cloud size={16} />
          ) : (
            <Check size={16} />
          )}
          {saveLabel(saveState)}
        </span>
        <button
          ref={edit}
          className="button secondary"
          onClick={onEdit}
          aria-label={`Edit workout: ${session.name}`}
        >
          <Pencil size={16} /> Edit workout
        </button>
      </div>
    </article>
  );
}

export function CompletionToast({
  name,
  saveState,
  onDismiss,
}: {
  name: string;
  saveState: SaveState;
  onDismiss: () => void;
}) {
  return (
    <div className="completion-toast">
      <span className="completion-toast-icon" aria-hidden="true">
        <Check size={23} />
      </span>
      <div role="status" aria-live="polite" aria-atomic="true">
        <strong>Nice work! Workout complete.</strong>
        <span>
          {name} · {saveLabel(saveState)}
        </span>
      </div>
      <button
        className="icon-button"
        aria-label="Dismiss workout confirmation"
        onClick={onDismiss}
      >
        <X size={18} />
      </button>
    </div>
  );
}
