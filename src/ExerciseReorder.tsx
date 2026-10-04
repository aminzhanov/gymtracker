import { t } from "./i18n";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import type { WorkoutExercise } from "./types";
import { reorderExercises } from "./model";

export function ExerciseReorderList({
  exercises,
  onReorder,
  render,
}: {
  exercises: WorkoutExercise[];
  onReorder: (exercises: WorkoutExercise[]) => void;
  render: (exercise: WorkoutExercise, controls: ReactNode) => ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    target: string;
    pointer: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const frame = useRef<number | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const stopFrame = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  const cancel = () => {
    stopFrame();
    drag.current = null;
    setActive(null);
    setTarget(null);
  };
  const move = (fromId: string, toId: string) => {
    const next = reorderExercises(exercises, fromId, toId);
    if (next === exercises) return;
    onReorder(next);
    setAnnouncement(
      `${next.find((e) => e.id === fromId)?.name} moved to position ${next.findIndex((e) => e.id === fromId) + 1}. Save the exercise or session to keep this order.`,
    );
  };
  const track = () => {
    const current = drag.current;
    if (!current || !current.moved) return;
    const hit = document
      .elementFromPoint(current.x, current.y)
      ?.closest<HTMLElement>("[data-reorder-id]");
    if (
      hit &&
      list.current?.contains(hit) &&
      hit.dataset.reorderId &&
      hit.dataset.reorderId !== current.target
    ) {
      current.target = hit.dataset.reorderId;
      setTarget(current.target);
    }
  };
  const scroll = () => {
    const current = drag.current;
    if (!current) return;
    if (current.moved) {
      const modal = list.current?.closest<HTMLElement>(".modal");
      if (modal) {
        const rect = modal.getBoundingClientRect();
        const top = Math.max(0, rect.top),
          bottom = Math.min(innerHeight, rect.bottom);
        const delta =
          current.y < top + 48 ? -12 : current.y > bottom - 48 ? 12 : 0;
        if (delta) modal.scrollTop += delta;
      }
      track();
    }
    frame.current = requestAnimationFrame(scroll);
  };
  const start = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0 || drag.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id,
      target: id,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    setAnnouncement("");
    frame.current = requestAnimationFrame(scroll);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    current.x = event.clientX;
    current.y = event.clientY;
    if (
      !current.moved &&
      Math.hypot(current.x - current.startX, current.y - current.startY) > 6
    ) {
      current.moved = true;
      setActive(current.id);
      setTarget(current.id);
    }
    track();
  };
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (current.moved) {
      track();
      move(current.id, current.target);
    }
    cancel();
  };
  return (
    <div ref={list} className="exercise-sort-list">
      {exercises.length > 1 && (
        <p className="footnote reorder-hint">
          {t("Drag the grip to rearrange exercises, or use the arrows.")}
        </p>
      )}
      {exercises.map((exercise, index) => (
        <div
          key={exercise.id}
          data-reorder-id={exercise.id}
          className={`reorderable-exercise ${active === exercise.id ? "dragging-exercise" : ""} ${active && target === exercise.id && active !== target ? "exercise-drop-target" : ""}`}
        >
          {render(
            exercise,
            <div className="exercise-order-controls">
              <button
                type="button"
                className="icon-button exercise-drag-handle"
                aria-label={t(`Drag to reorder ${exercise.name}`)}
                disabled={exercises.length < 2}
                onPointerDown={(event) => start(event, exercise.id)}
                onPointerMove={pointerMove}
                onPointerUp={finish}
                onPointerCancel={cancel}
                onLostPointerCapture={cancel}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && drag.current) {
                    event.stopPropagation();
                    cancel();
                  }
                }}
              >
                <GripVertical size={19} />
              </button>
              <span>
                {t("Exercise ")}
                {index + 1}
                {t(" of ")}
                {exercises.length}
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label={t(`Move ${exercise.name} up`)}
                disabled={index === 0 || Boolean(active)}
                onClick={() => move(exercise.id, exercises[index - 1].id)}
              >
                <ArrowUp size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={t(`Move ${exercise.name} down`)}
                disabled={index === exercises.length - 1 || Boolean(active)}
                onClick={() => move(exercise.id, exercises[index + 1].id)}
              >
                <ArrowDown size={17} />
              </button>
            </div>,
          )}
        </div>
      ))}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
