import { t, exerciseName } from "./i18n";
import { useState } from "react";
import { Plus, Trash2, Save, Check, Dumbbell, ChevronDown } from "lucide-react";
import type {
  AppData,
  Session,
  Template,
  WorkoutExercise,
  TechniqueVideos,
} from "./types";
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
import { ExerciseReorderList } from "./ExerciseReorder";
import { trainingWeeks } from "./trainingWeeks";
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
  trainingWeeksReady = true,
  onCustom,
  techniqueVideos,
  techniqueReady,
  onSaveTechnique,
}: {
  initial: Session;
  data: AppData;
  onSave: (s: Session) => void;
  onDelete?: () => void;
  onTemplate?: (t: Template) => void;
  onClose: () => void;
  isTemplate?: boolean;
  trainingWeeksReady?: boolean;
  onCustom: (name: string) => Promise<string>;
  techniqueVideos: TechniqueVideos;
  techniqueReady: boolean;
  onSaveTechnique?: (exerciseId: string, url: string) => Promise<void>;
}) {
  const [s, setS] = useState<Session>(structuredClone(initial));
  const [addedExercise, setAddedExercise] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<WorkoutExercise["kind"]>("strength");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState(false);
  const [customBusy, setCustomBusy] = useState(false);
  const [customError, setCustomError] = useState("");
  const weekGroups = trainingWeeks([
    ...data.sessions.filter((session) => session.id !== s.id),
    s,
  ]).filter((group) => group.week === s.week);
  const patch = (change: Partial<Session>) =>
    setS((old) => ({ ...old, ...change }));
  const changeExercise = (e: WorkoutExercise) =>
    setS(updateSessionExercise(s, e));
  const add = (exerciseId: string, name: string) => {
    const exercise = newExercise(exerciseId, name, kind);
    setS((current) => ({
      ...current,
      exercises: [...current.exercises, exercise],
    }));
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
      title={isTemplate ? t("Edit template") : t("Your workout")}
      onClose={onClose}
      wide
    >
      <div className="editor-grid">
        <div className="editor-main">
          <div className="workout-heading">
            <button
              className="big-icon tint-yellow"
              onClick={() => setPicker(!picker)}
              aria-label={t("Choose emoji")}
            >
              {s.icon}
            </button>
            <div>
              <input
                className="title-input"
                aria-label={t("Session name")}
                value={s.name}
                maxLength={100}
                onChange={(e) => patch({ name: e.target.value })}
              />
              <div className="flex">
                {data.settings.useABSplit && <WeekBadge week={s.week} />}
                <span className="muted">
                  {isTemplate
                    ? t("Reusable training plan")
                    : s.status === "done"
                      ? t("Completed · nice work!")
                      : t("Planned · ready when you are")}
                </span>
              </div>
            </div>
          </div>
          {picker && (
            <div className="emoji-picker">
              <strong>{t("Choose your energy")}</strong>
              <div className="emoji-grid">
                {icons.map((icon) => (
                  <button
                    key={icon}
                    aria-label={t(`Choose ${icon}`)}
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
                {t("Or enter an icon")}
                <input
                  value={s.icon}
                  maxLength={16}
                  onChange={(e) => patch({ icon: e.target.value })}
                />
              </label>
            </div>
          )}
          <div className="section-label">
            <Dumbbell size={17} />
            {t(" Exercises & sets")}
          </div>
          {s.exercises.length === 0 && (
            <Empty
              title={t("Let's build your session")}
              detail={t("Add strength work, a warm-up or a cool-down.")}
            />
          )}
          <ExerciseReorderList
            exercises={s.exercises}
            onReorder={(exercises) => patch({ exercises })}
            render={(exercise, controls) => (
              <WorkoutExerciseCard
                key={exercise.id}
                exercise={exercise}
                library={data.exercises}
                onCustom={onCustom}
                session={s}
                sessions={data.sessions}
                isTemplate={isTemplate}
                initiallyExpanded={exercise.id === addedExercise}
                canSave={Boolean(s.name.trim())}
                orderControls={controls}
                techniqueUrl={techniqueVideos[exercise.exerciseId]}
                techniqueReady={techniqueReady}
                onSaveTechnique={
                  onSaveTechnique
                    ? (url) => onSaveTechnique(exercise.exerciseId, url)
                    : undefined
                }
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
            )}
          />
          <button
            className="button secondary full"
            onClick={() => setAdding(!adding)}
          >
            <Plus size={17} />
            {t(" Add exercise ")}
            <ChevronDown size={15} />
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
                      ? t("Strength")
                      : k === "warmup"
                        ? t("Warm-up")
                        : t("Cool-down")}
                  </button>
                ))}
              </div>
              <input
                autoFocus
                placeholder={
                  kind === "strength"
                    ? t("Find an exercise…")
                    : t("Name this activity…")
                }
                aria-label={t("Search or name exercise")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="exercise-options">
                {kind === "strength" ? (
                  data.exercises
                    .filter((e) =>
                      exerciseName(e.name, e.id)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((e) => (
                      <button key={e.id} onClick={() => add(e.id, e.name)}>
                        {exerciseName(e.name, e.id)}
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
                    {t("Add ")}
                    {search || kind}
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
                    disabled={customBusy}
                    onClick={async () => {
                      setCustomBusy(true);
                      setCustomError("");
                      const name = search.trim();
                      try {
                        add(await onCustom(name), name);
                      } catch (error) {
                        setCustomError((error as Error).message);
                      } finally {
                        setCustomBusy(false);
                      }
                    }}
                  >
                    {customBusy
                      ? t("Adding exercise…")
                      : t(`Create custom exercise: ${search}`)}
                  </button>
                )}
              {customError && (
                <p role="alert" className="danger-text">
                  {customError}
                </p>
              )}
            </div>
          )}
        </div>
        <aside className="editor-details">
          <h3>{isTemplate ? t("Template details") : t("Session details")}</h3>
          {!isTemplate && (
            <DateField
              label={t("Move to date")}
              value={s.date}
              onChange={(date) => patch({ date })}
            />
          )}
          {data.settings.useABSplit && (
            <>
              <label>
                {t("Program week")}
                <select
                  value={s.week}
                  onChange={(e) =>
                    patch({
                      week: e.target.value as "A" | "B",
                      ...(!isTemplate ? { trainingWeek: id() } : {}),
                    })
                  }
                >
                  <option value="A">{t("Week A")}</option>
                  <option value="B">{t("Week B")}</option>
                </select>
              </label>
              {!isTemplate && (
                <>
                  <label>
                    {t("Training week")}
                    <select
                      aria-label={t("Training week")}
                      disabled={!trainingWeeksReady}
                      value={
                        s.trainingWeek ||
                        weekGroups.find((group) =>
                          group.sessions.some((session) => session.id === s.id),
                        )?.key
                      }
                      onChange={(event) =>
                        patch({
                          trainingWeek:
                            event.target.value === "new"
                              ? id()
                              : event.target.value,
                        })
                      }
                    >
                      {weekGroups.map((group) => (
                        <option key={group.key} value={group.key}>
                          {group.label} · {group.sessions.length}{" "}
                          {t(
                            group.sessions.length === 1
                              ? "session"
                              : "sessions",
                          )}
                        </option>
                      ))}
                      <option value="new">
                        {t("Start a new Week ")}
                        {s.week}
                      </option>
                    </select>
                  </label>
                  <p className="footnote">
                    {trainingWeeksReady
                      ? t(
                          "Group sessions regardless of dates. Three sessions is the default suggestion; add more or fewer as needed.",
                        )
                      : t(
                          "Your coach needs to run database upgrade 007 to save custom training-week assignments. The chart uses suggested groups meanwhile.",
                        )}
                  </p>
                </>
              )}
            </>
          )}
          {!isTemplate && (
            <>
              <label>
                {t("Status")}
                <select
                  value={s.status}
                  onChange={(e) =>
                    e.target.value === "done"
                      ? setS(completeSession(s))
                      : patch({ status: "planned" })
                  }
                >
                  <option value="planned">{t("Planned")}</option>
                  <option value="done">{t("Done")}</option>
                </select>
              </label>
              <label>
                {t("How did it feel?")}
                <select
                  value={s.difficulty}
                  onChange={(e) =>
                    patch({
                      difficulty: e.target.value as Session["difficulty"],
                    })
                  }
                >
                  <option value="">{t("Not rated")}</option>
                  <option value="easy">{t("😌 Easy")}</option>
                  <option value="solid">{t("🙂 Solid")}</option>
                  <option value="hard">{t("😤 Hard")}</option>
                  <option value="brutal">{t("🔥 Brutal")}</option>
                </select>
              </label>
            </>
          )}
          <label>
            {t("Notes")}
            <textarea
              rows={4}
              placeholder={t("Form cues, goals, how you felt…")}
              value={s.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </label>
          {!isTemplate && (
            <div className="session-totals">
              <div>
                <span>{t("Completed sets")}</span>
                <strong>{doneSets(s).length}</strong>
              </div>
              <div>
                <span>{t("Volume")}</span>
                <strong>
                  {number(volume(s))}
                  {t(" kg")}
                </strong>
              </div>
              <div>
                <span>{t("Best e1RM")}</span>
                <strong>
                  {number(bestMax(s), 1)}
                  {t(" kg")}
                </strong>
              </div>
            </div>
          )}
          <button
            className="button primary full"
            disabled={!s.name.trim()}
            onClick={save}
          >
            <Save size={16} />
            {t(" Save ")}
            {t(isTemplate ? "template" : "session")}
          </button>
          {!isTemplate && (
            <button
              className="button secondary full"
              onClick={() => {
                onSave(completeSession(s));
                onClose();
              }}
            >
              <Check size={17} />
              {t(" Complete session")}
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
              {savedTemplate ? t("✓ Template saved") : t("Save as template")}
            </button>
          )}
          {onDelete &&
            (confirmDelete ? (
              <div className="confirm">
                <p>
                  {t("Delete this ")}
                  {t(isTemplate ? "template" : "session")}?
                </p>
                <button
                  className="button danger"
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                >
                  {t("Yes, delete")}
                </button>
                <button
                  className="text-button"
                  onClick={() => setConfirmDelete(false)}
                >
                  {t("Cancel")}
                </button>
              </div>
            ) : (
              <button
                className="text-button danger-text"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} />
                {t(" Delete")} {t(isTemplate ? "template" : "session")}
              </button>
            ))}
        </aside>
      </div>
    </Modal>
  );
}
