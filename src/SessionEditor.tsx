import { useState } from "react";
import { Plus, Trash2, Save, Check, Dumbbell, ChevronDown } from "lucide-react";
import type { AppData, Session, Template, WorkoutExercise } from "./types";
import { Modal, WeekBadge, Empty, DateField } from "./components";
import {
  id,
  newExercise,
  completeSession,
  volume,
  bestMax,
  doneSets,
  number,
  cloneExercises,
  updateSessionExercise,
} from "./model";
import { WorkoutExerciseCard } from "./WorkoutExerciseCard";
const icons = [
  "🏋️",
  "💪",
  "🦵",
  "🦍",
  "🏃",
  "🧘",
  "🏒",
  "⛸️",
  "⚽",
  "🏀",
  "🎾",
  "🚴",
  "🏊",
  "🥊",
  "🏆",
  "🎯",
  "⚡",
  "🔥",
  "🌟",
  "❤️",
  "💙",
  "💚",
  "🟡",
  "🟣",
  "🐻",
  "🐯",
  "🦊",
  "🐸",
  "🦈",
  "🐧",
  "😌",
  "🙂",
  "😤",
  "🚀",
  "🌈",
  "✦",
];
export function SessionEditor({
  initial,
  data,
  onSave,
  onDelete,
  onTemplate,
  onClose,
  isTemplate = false,
  onCustom,
}: {
  initial: Session;
  data: AppData;
  onSave: (s: Session) => void;
  onDelete?: () => void;
  onTemplate?: (t: Template) => void;
  onClose: () => void;
  isTemplate?: boolean;
  onCustom: (name: string) => string;
}) {
  const [s, setS] = useState<Session>(structuredClone(initial));
  const [addedExercise, setAddedExercise] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<WorkoutExercise["kind"]>("strength");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState(false);
  const patch = (change: Partial<Session>) =>
    setS((old) => ({ ...old, ...change }));
  const changeExercise = (e: WorkoutExercise) =>
    setS(updateSessionExercise(s, e));
  const add = (exerciseId: string, name: string) => {
    const exercise = newExercise(exerciseId, name, kind);
    patch({ exercises: [...s.exercises, exercise] });
    setAddedExercise(exercise.id);
    setAdding(false);
    setSearch("");
  };
  const save = () => {
    onSave(s);
    onClose();
  };
  return (
    <Modal
      title={isTemplate ? "Edit template" : "Your workout"}
      onClose={onClose}
      wide
    >
      <div className="editor-grid">
        <div className="editor-main">
          <div className="workout-heading">
            <button
              className="big-icon tint-yellow"
              onClick={() => setPicker(!picker)}
              aria-label="Choose emoji"
            >
              {s.icon}
            </button>
            <div>
              <input
                className="title-input"
                aria-label="Session name"
                value={s.name}
                maxLength={100}
                onChange={(e) => patch({ name: e.target.value })}
              />
              <div className="flex">
                {data.settings.useABSplit && <WeekBadge week={s.week} />}
                <span className="muted">
                  {isTemplate
                    ? "Reusable training plan"
                    : s.status === "done"
                      ? "Completed · nice work!"
                      : "Planned · ready when you are"}
                </span>
              </div>
            </div>
          </div>
          {picker && (
            <div className="emoji-picker">
              <strong>Choose your energy</strong>
              <div className="emoji-grid">
                {icons.map((icon) => (
                  <button
                    key={icon}
                    aria-label={`Choose ${icon}`}
                    onClick={() => {
                      patch({ icon });
                      setPicker(false);
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <label>
                Or enter an icon
                <input
                  value={s.icon}
                  maxLength={16}
                  onChange={(e) => patch({ icon: e.target.value })}
                />
              </label>
            </div>
          )}
          <div className="section-label">
            <Dumbbell size={17} /> Exercises & sets
          </div>
          {s.exercises.length === 0 && (
            <Empty
              title="Let's build your session"
              detail="Add strength work, a warm-up or a cool-down."
            />
          )}
          {s.exercises.map((exercise) => (
            <WorkoutExerciseCard
              key={exercise.id}
              exercise={exercise}
              session={s}
              sessions={data.sessions}
              isTemplate={isTemplate}
              initiallyExpanded={exercise.id === addedExercise}
              canSave={Boolean(s.name.trim())}
              onChange={changeExercise}
              onSave={() => onSave(s)}
              onRemove={() =>
                patch({
                  exercises: s.exercises.filter(
                    (old) => old.id !== exercise.id,
                  ),
                })
              }
            />
          ))}
          <button
            className="button secondary full"
            onClick={() => setAdding(!adding)}
          >
            <Plus size={17} /> Add exercise <ChevronDown size={15} />
          </button>
          {adding && (
            <div className="exercise-picker">
              <div className="segmented">
                {(["strength", "warmup", "cooldown"] as const).map((k) => (
                  <button
                    key={k}
                    className={kind === k ? "active" : ""}
                    onClick={() => setKind(k)}
                  >
                    {k === "strength"
                      ? "Strength"
                      : k === "warmup"
                        ? "Warm-up"
                        : "Cool-down"}
                  </button>
                ))}
              </div>
              <input
                autoFocus
                placeholder={
                  kind === "strength"
                    ? "Find an exercise…"
                    : "Name this activity…"
                }
                aria-label="Search or name exercise"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="exercise-options">
                {kind === "strength" ? (
                  data.exercises
                    .filter((e) =>
                      e.name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((e) => (
                      <button key={e.id} onClick={() => add(e.id, e.name)}>
                        {e.name}
                        <Plus size={15} />
                      </button>
                    ))
                ) : (
                  <button
                    onClick={() =>
                      add(
                        id(),
                        search.trim() ||
                          (kind === "warmup"
                            ? "Light cardio & mobility"
                            : "Stretch & breathe"),
                      )
                    }
                  >
                    Add {search || kind}
                    <Plus size={15} />
                  </button>
                )}
              </div>
              {kind === "strength" &&
                search.trim() &&
                !data.exercises.some(
                  (e) => e.name.toLowerCase() === search.trim().toLowerCase(),
                ) && (
                  <button
                    className="button secondary full"
                    onClick={() => add(onCustom(search.trim()), search.trim())}
                  >
                    Create custom exercise: {search}
                  </button>
                )}
            </div>
          )}
        </div>
        <aside className="editor-details">
          <h3>{isTemplate ? "Template details" : "Session details"}</h3>
          {!isTemplate && (
            <DateField
              label="Move to date"
              value={s.date}
              onChange={(date) => patch({ date })}
            />
          )}
          {data.settings.useABSplit && (
            <>
              <label>
                Program week
                <select
                  value={s.week}
                  onChange={(e) => patch({ week: e.target.value as "A" | "B" })}
                >
                  <option value="A">Week A</option>
                  <option value="B">Week B</option>
                </select>
              </label>
            </>
          )}
          {!isTemplate && (
            <>
              <label>
                Status
                <select
                  value={s.status}
                  onChange={(e) =>
                    e.target.value === "done"
                      ? setS(completeSession(s))
                      : patch({ status: "planned" })
                  }
                >
                  <option value="planned">Planned</option>
                  <option value="done">Done</option>
                </select>
              </label>
              <label>
                How did it feel?
                <select
                  value={s.difficulty}
                  onChange={(e) =>
                    patch({
                      difficulty: e.target.value as Session["difficulty"],
                    })
                  }
                >
                  <option value="">Not rated</option>
                  <option value="easy">😌 Easy</option>
                  <option value="solid">🙂 Solid</option>
                  <option value="hard">😤 Hard</option>
                  <option value="brutal">🔥 Brutal</option>
                </select>
              </label>
            </>
          )}
          <label>
            Notes
            <textarea
              rows={4}
              placeholder="Form cues, goals, how you felt…"
              value={s.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </label>
          {!isTemplate && (
            <div className="session-totals">
              <div>
                <span>Completed sets</span>
                <strong>{doneSets(s).length}</strong>
              </div>
              <div>
                <span>Volume</span>
                <strong>{number(volume(s))} kg</strong>
              </div>
              <div>
                <span>Best e1RM</span>
                <strong>{number(bestMax(s), 1)} kg</strong>
              </div>
            </div>
          )}
          <button
            className="button primary full"
            disabled={!s.name.trim()}
            onClick={save}
          >
            <Save size={16} /> Save {isTemplate ? "template" : "session"}
          </button>
          {!isTemplate && (
            <button
              className="button secondary full"
              onClick={() => {
                onSave(completeSession(s));
                onClose();
              }}
            >
              <Check size={17} /> Complete session
            </button>
          )}
          {onTemplate && (
            <button
              className="button secondary full"
              onClick={() => {
                onTemplate({
                  id: id(),
                  name: s.name,
                  icon: s.icon,
                  week: s.week,
                  notes: s.notes,
                  exercises: cloneExercises(s.exercises),
                });
                setSavedTemplate(true);
              }}
            >
              {savedTemplate ? "✓ Template saved" : "Save as template"}
            </button>
          )}
          {onDelete &&
            (confirmDelete ? (
              <div className="confirm">
                <p>Delete this {isTemplate ? "template" : "session"}?</p>
                <button
                  className="button danger"
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                >
                  Yes, delete
                </button>
                <button
                  className="text-button"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="text-button danger-text"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} /> Delete{" "}
                {isTemplate ? "template" : "session"}
              </button>
            ))}
        </aside>
      </div>
    </Modal>
  );
}
