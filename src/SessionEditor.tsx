import { useState } from "react";
import {
  Plus,
  Trash2,
  Save,
  Check,
  Dumbbell,
  Timer,
  ChevronDown,
} from "lucide-react";
import type { AppData, Session, Template, WorkoutExercise } from "./types";
import { Modal, SetRow, LastTime, WeekBadge, Empty } from "./components";
import {
  id,
  newExercise,
  completeSession,
  volume,
  bestMax,
  doneSets,
  number,
  cloneExercises,
} from "./model";
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
  const [picker, setPicker] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<WorkoutExercise["kind"]>("strength");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState(false);
  const patch = (change: Partial<Session>) =>
    setS((old) => ({ ...old, ...change }));
  const changeExercise = (index: number, e: WorkoutExercise) =>
    patch({ exercises: s.exercises.map((old, i) => (i === index ? e : old)) });
  const add = (exerciseId: string, name: string) => {
    patch({ exercises: [...s.exercises, newExercise(exerciseId, name, kind)] });
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
                <WeekBadge week={s.week} />
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
          {s.exercises.map((e, index) => (
            <section
              className={`exercise-block ${e.kind !== "strength" ? "recovery-block" : ""}`}
              key={e.id}
            >
              <div className="exercise-head">
                <span
                  className={`exercise-symbol ${e.kind === "strength" ? "tint-blue" : "tint-pink"}`}
                >
                  {e.kind === "strength" ? (
                    <Dumbbell size={20} />
                  ) : (
                    <Timer size={20} />
                  )}
                </span>
                <div className="grow">
                  <input
                    aria-label="Exercise name"
                    className="exercise-name"
                    value={e.name}
                    onChange={(ev) =>
                      changeExercise(index, { ...e, name: ev.target.value })
                    }
                  />
                  {e.kind === "strength" && !isTemplate && (
                    <LastTime
                      exercise={e}
                      session={s}
                      sessions={data.sessions}
                    />
                  )}
                  <span className="last-time">
                    {e.kind === "warmup"
                      ? "Warm-up · recovery analytics only"
                      : e.kind === "cooldown"
                        ? "Cool-down · recovery analytics only"
                        : ""}
                  </span>
                </div>
                <button
                  className="icon-button"
                  onClick={() => {
                    setAdding(true);
                    setKind(e.kind);
                    setSearch("");
                  }}
                  title="Add another exercise"
                  aria-label="Add exercise"
                >
                  <Plus size={18} />
                </button>
                <button
                  className="icon-button danger-text"
                  aria-label={`Remove ${e.name}`}
                  onClick={() =>
                    patch({
                      exercises: s.exercises.filter((x) => x.id !== e.id),
                    })
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
              {e.kind === "strength" ? (
                <>
                  <div className="set-labels">
                    <span>Set</span>
                    <span>Weight</span>
                    <span>Reps</span>
                    <span>Done</span>
                  </div>
                  {e.sets.map((set, si) => (
                    <SetRow
                      key={set.id}
                      set={set}
                      index={si}
                      onChange={(updated) => {
                        const exercises = s.exercises.map((old, i) =>
                          i === index
                            ? {
                                ...e,
                                sets: e.sets.map((old) =>
                                  old.id === set.id ? updated : old,
                                ),
                              }
                            : old,
                        );
                        patch({
                          exercises,
                          ...(!updated.done
                            ? { status: "planned" as const }
                            : {}),
                        });
                      }}
                      onRemove={() =>
                        changeExercise(index, {
                          ...e,
                          sets: e.sets.filter((x) => x.id !== set.id),
                        })
                      }
                    />
                  ))}
                  <button
                    className="text-button"
                    onClick={() =>
                      changeExercise(index, {
                        ...e,
                        sets: [
                          ...e.sets,
                          {
                            id: id(),
                            weight: e.sets.at(-1)?.weight || 20,
                            reps: e.sets.at(-1)?.reps || 8,
                            done: false,
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={15} /> Add set
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
                      value={e.duration}
                      onChange={(ev) =>
                        changeExercise(index, {
                          ...e,
                          duration: Math.max(
                            0,
                            Math.min(1440, Number(ev.target.value)),
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="grow">
                    Notes
                    <input
                      placeholder="Light cardio, mobility…"
                      value={e.notes}
                      onChange={(ev) =>
                        changeExercise(index, { ...e, notes: ev.target.value })
                      }
                    />
                  </label>
                  {!isTemplate && (
                    <button
                      className={`done-button ${e.done ? "checked" : ""}`}
                      aria-label={`${e.name} complete`}
                      aria-pressed={e.done}
                      onClick={() =>
                        patch({
                          exercises: s.exercises.map((old, i) =>
                            i === index ? { ...e, done: !e.done } : old,
                          ),
                          ...(!e.done ? {} : { status: "planned" as const }),
                        })
                      }
                    >
                      <Check size={18} />
                    </button>
                  )}
                </div>
              )}
            </section>
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
            <label>
              Move to date
              <input
                type="date"
                value={s.date}
                onChange={(e) => {
                  if (e.target.value) patch({ date: e.target.value });
                }}
              />
            </label>
          )}
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
