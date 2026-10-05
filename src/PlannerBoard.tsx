import { CheckCircle2, Clock3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AppData, Session, WorkoutExercise } from "./types";
import { t, exerciseName } from "./i18n";
import { CalendarVolume } from "./CalendarVolume";
import { DateField, useMediaQuery } from "./components";
import { calendarVolume, trainingWeekVolume } from "./planning";
import { trainingWeeks } from "./trainingWeeks";
import {
  shortDate,
  number,
  newExercise,
  parseDate,
  exerciseSummary,
} from "./model";
import {
  matchingSets,
  resizeSets,
  editPrescription,
  previousPlannerExercise,
} from "./plannerEditing";

function Numeric({
  value,
  label,
  integer = false,
  onDraft,
  onSave,
}: {
  value: number;
  label: string;
  integer?: boolean;
  onDraft: (n: number) => void;
  onSave: () => void;
}) {
  const [text, setText] = useState(String(value));
  const valid =
    text.trim() !== "" &&
    Number.isFinite(Number(text)) &&
    Number(text) >= 0 &&
    (!integer || Number.isInteger(Number(text)));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      className="planner-number"
      aria-label={label}
      aria-invalid={!valid}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      value={text}
      onChange={(e) => {
        const v = e.target.value.replace(",", ".");
        setText(v);
        const n = Number(v);
        if (
          v.trim() &&
          Number.isFinite(n) &&
          n >= 0 &&
          (!integer || Number.isInteger(n))
        )
          onDraft(n);
      }}
      onBlur={() => {
        if (!valid) setText(String(value));
        onSave();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
function ExerciseRow({
  e,
  s,
  onDraft,
  onSave,
  previous,
}: {
  previous: ReturnType<typeof previousPlannerExercise>;
  e: WorkoutExercise;
  s: Session;
  onDraft: (e: WorkoutExercise) => void;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [remove, setRemove] = useState<number | null>(null);
  const same = matchingSets(e);
  const total = e.sets.reduce((v, z) => v + z.weight * z.reps, 0);
  return (
    <div className="planner-exercise">
      <div className="planner-exercise-row">
        <button
          className="planner-exercise-name"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {exerciseName(e.name, e.exerciseId)}{" "}
          <small>
            {open ? "▴" : "▾"} {same ? t("Edit sets") : t("Varied sets")}
          </small>
        </button>
        {e.kind === "strength" ? (
          <>
            <div className="planner-count">
              <span className="planner-field-label">{t("Sets")}</span>
              <div>
                <button
                  aria-label={t("Remove last set")}
                  disabled={!e.sets.length}
                  onClick={() => setRemove(e.sets.length - 1)}
                >
                  −
                </button>
                <strong>{e.sets.length}</strong>
                <button
                  aria-label={t("Add set")}
                  disabled={e.sets.length >= 100}
                  onClick={() => {
                    onDraft(resizeSets(e, e.sets.length + 1));
                    onSave();
                  }}
                >
                  +
                </button>
              </div>
            </div>
            {same ? (
              <>
                <label>
                  {t("Reps")}
                  <Numeric
                    label={`${s.name} · ${e.name} · ${t("Reps")}`}
                    integer
                    value={e.sets[0].reps}
                    onDraft={(v) => onDraft(editPrescription(e, "reps", v))}
                    onSave={onSave}
                  />
                </label>
                <label>
                  {t("Weight")}
                  <Numeric
                    label={`${s.name} · ${e.name} · ${t("Weight")}`}
                    value={e.sets[0].weight}
                    onDraft={(v) => onDraft(editPrescription(e, "weight", v))}
                    onSave={onSave}
                  />
                </label>
              </>
            ) : (
              <button
                className="button secondary compact planner-varied"
                onClick={() => setOpen(!open)}
              >
                {t("Edit individual sets")}
              </button>
            )}
            <span className="planner-row-volume">
              <small>{t("Volume")}</small>
              <strong>{number(total)} kg</strong>
            </span>
          </>
        ) : (
          <label>
            {t("Minutes")}
            <Numeric
              label={`${e.name} · ${t("Minutes")}`}
              value={e.duration}
              onDraft={(v) => onDraft({ ...e, duration: v })}
              onSave={onSave}
            />
          </label>
        )}
      </div>
      <div
        className={`planner-previous ${previous?.session.status === "done" ? "previous-done" : ""}`}
      >
        {previous ? (
          <>
            <span className="planner-previous-label">
              {previous.session.status === "done" ? (
                <CheckCircle2 size={15} />
              ) : (
                <Clock3 size={15} />
              )}{" "}
              {t(
                previous.session.status === "done"
                  ? "Previous completed"
                  : "Previous planned",
              )}
            </span>
            <span className="planner-previous-context">
              {shortDate(previous.session.date)},{" "}
              {parseDate(previous.session.date).getFullYear()} ·{" "}
              {previous.session.name}
            </span>
            <strong>{exerciseSummary(previous.exercise)}</strong>
          </>
        ) : (
          <span className="muted">
            {t("No earlier session for this exercise")}
          </span>
        )}
      </div>
      {remove !== null && (
        <div className="planner-remove">
          {t("Remove last set")} · {e.sets.at(-1)?.weight} kg ×{" "}
          {e.sets.at(-1)?.reps}{" "}
          {e.sets.at(-1)?.done ? ` · ${t("Completed")}` : ""}
          <button
            className="button secondary compact"
            onClick={() => {
              onDraft(resizeSets(e, remove));
              onSave();
              setRemove(null);
            }}
          >
            {t("Confirm removal")}
          </button>
          <button
            className="button secondary compact"
            onClick={() => setRemove(null)}
          >
            {t("Cancel")}
          </button>
        </div>
      )}
      {open && (
        <div className="planner-set-list">
          {e.sets.map((z, i) => (
            <div className="planner-set" key={z.id}>
              <span>
                {t("Set")} {i + 1}
                {z.done ? " ✓" : ""}
              </span>
              <label>
                {t("Reps")}
                <Numeric
                  integer
                  label={`${e.name} · ${t("Set")} ${i + 1} · ${t("Reps")}`}
                  value={z.reps}
                  onDraft={(v) => onDraft(editPrescription(e, "reps", v, z.id))}
                  onSave={onSave}
                />
              </label>
              <label>
                {t("Weight")}
                <Numeric
                  label={`${e.name} · ${t("Set")} ${i + 1} · ${t("Weight")}`}
                  value={z.weight}
                  onDraft={(v) =>
                    onDraft(editPrescription(e, "weight", v, z.id))
                  }
                  onSave={onSave}
                />
              </label>
            </div>
          ))}
          {e.notes && <p>{e.notes}</p>}
        </div>
      )}
    </div>
  );
}
export function PlannerBoard({
  data,
  month,
  onSave,
  onOpen,
  onDuplicate,
  onCreate,
}: {
  data: AppData;
  month: string;
  onSave: (s: Session) => void;
  onOpen: (s: Session) => void;
  onDuplicate: (s: Session) => void;
  onCreate: (date: string) => void;
}) {
  const compact = useMediaQuery("(max-width: 1150px)");
  const [drafts, setDrafts] = useState<Record<string, Session>>({});
  const draftRef = useRef(drafts);
  const dataRef = useRef(data);
  dataRef.current = data;
  const draft = (s: Session) => {
    draftRef.current = { ...draftRef.current, [s.id]: s };
    setDrafts(draftRef.current);
  };
  const current = (s: Session) =>
    draftRef.current[s.id] ??
    dataRef.current.sessions.find((x) => x.id === s.id) ??
    s;
  const save = (s: Session) => {
    if (!draftRef.current[s.id]) return;
    onSave(current(s));
    const next = { ...draftRef.current };
    delete next[s.id];
    draftRef.current = next;
    setDrafts(next);
  };
  const preview = {
    ...data,
    sessions: data.sessions.map((s) => drafts[s.id] ?? s),
  };
  const split = data.settings.useABSplit;
  const rows = split
    ? trainingWeekVolume(preview.sessions, month)
    : calendarVolume(preview.sessions, month);
  const initial = useRef(rows.reduce((v, r) => v + r.total, 0));
  const delta = rows.reduce((v, r) => v + r.total, 0) - initial.current;
  const groups = split
    ? trainingWeeks(preview.sessions).filter((g) =>
        g.sessions.some((s) => s.date.startsWith(month)),
      )
    : calendarVolume(preview.sessions, month).map((r, i) => ({
        ...r,
        label: `${t("Week")} ${i + 1}`,
        sessions: preview.sessions
          .filter((s) => s.date >= r.from && s.date <= r.to)
          .sort((a, b) => a.date.localeCompare(b.date)),
      }));
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const aRows = split
    ? trainingWeekVolume(preview.sessions, month).filter((r) => r.week === "A")
    : [];
  const bRows = split
    ? trainingWeekVolume(preview.sessions, month).filter((r) => r.week === "B")
    : [];
  const a = aRows.find((r) => r.key === pairA) ?? aRows[0];
  const b = bRows.find((r) => r.key === pairB) ?? bRows[0];
  return (
    <div className="planner-workspace">
      <div className="planner-table-area">
        <p className="muted">
          {t(
            "Edit weight and reps here. Changes preview immediately and save when you leave a field.",
          )}
        </p>
        {groups.map((g) => (
          <section className="planner-week" key={g.key}>
            <h2>
              {t(g.label)}{" "}
              <small>
                {shortDate(g.from)} – {shortDate(g.to)}
              </small>
              {!!g.sessions.length && (
                <span className="planner-week-completion">
                  {g.sessions.filter((s) => s.status === "done").length}/
                  {g.sessions.length} {t("completed")}
                </span>
              )}
            </h2>
            {g.sessions.map((original) => {
              const s = current(original);
              return (
                <article
                  className={`planner-session ${s.status === "done" ? "planner-session-done" : ""}`}
                  key={s.id}
                >
                  <header>
                    <div className="planner-session-identity">
                      <h3>
                        {s.icon} {s.name}
                      </h3>
                      <span
                        className={`planner-status ${s.status === "done" ? "status-done" : ""}`}
                      >
                        {s.status === "done" ? (
                          <CheckCircle2 size={17} />
                        ) : (
                          <Clock3 size={17} />
                        )}
                        {t(s.status === "done" ? "Completed" : "Planned")}
                      </span>
                    </div>
                    <div className="planner-session-toolbar">
                      <DateField
                        label={t("Move to date")}
                        value={s.date}
                        onChange={(date) => {
                          draft({ ...current(s), date });
                          save(s);
                        }}
                      />
                      <div className="planner-session-actions">
                        <button
                          className="button secondary compact"
                          onClick={() => {
                            const latest = current(s);
                            save(s);
                            onDuplicate(latest);
                          }}
                        >
                          {t("Duplicate")}
                        </button>
                        <button
                          className="button secondary compact"
                          onClick={() => {
                            const latest = current(s);
                            save(s);
                            onOpen(latest);
                          }}
                        >
                          {t("Open full editor")}
                        </button>
                      </div>
                    </div>
                  </header>
                  {s.exercises.map((e) => (
                    <ExerciseRow
                      key={e.id}
                      e={e}
                      s={s}
                      previous={previousPlannerExercise(preview.sessions, s, e)}
                      onDraft={(next) => {
                        const latest = current(s);
                        draft({
                          ...latest,
                          exercises: latest.exercises.map((x) =>
                            x.id === e.id ? next : x,
                          ),
                        });
                      }}
                      onSave={() => save(s)}
                    />
                  ))}
                  <select
                    aria-label={`${t("Add exercise")} · ${s.name}`}
                    value=""
                    onChange={(ev) => {
                      const found = data.exercises.find(
                        (x) => x.id === ev.target.value,
                      );
                      if (found) {
                        const latest = current(s);
                        draft({
                          ...latest,
                          exercises: [
                            ...latest.exercises,
                            newExercise(found.id, found.name),
                          ],
                        });
                        save(s);
                      }
                    }}
                  >
                    <option value="">+ {t("Add exercise")}</option>
                    {data.exercises.map((e) => (
                      <option key={e.id} value={e.id}>
                        {exerciseName(e.name, e.id)}
                      </option>
                    ))}
                  </select>
                </article>
              );
            })}
            {!g.sessions.length && (
              <p className="muted">{t("No session planned")}</p>
            )}
            <button
              className="button secondary compact"
              onClick={() =>
                onCreate(g.from.startsWith(month) ? g.from : `${month}-01`)
              }
            >
              + {t("Add session")}
            </button>
          </section>
        ))}
      </div>
      <aside className="planner-outlook">
        <div className="planner-live-summary">
          <strong>{number(rows.reduce((v, r) => v + r.total, 0))} kg</strong>
          <span>
            {t("Projection")} · {delta >= 0 ? "+" : ""}
            {number(delta)} kg {t("since opening planner")}
          </span>
        </div>
        {split && a && b && (
          <div className="planner-compare">
            <label>
              {t("Compare training weeks")}
              <select
                aria-label={t("Compare week A")}
                value={a.key}
                onChange={(e) => setPairA(e.target.value)}
              >
                {aRows.map((r) => (
                  <option value={r.key} key={r.key}>
                    {t(r.label)}
                  </option>
                ))}
              </select>
            </label>
            <select
              aria-label={t("Compare week B")}
              value={b.key}
              onChange={(e) => setPairB(e.target.value)}
            >
              {bRows.map((r) => (
                <option value={r.key} key={r.key}>
                  {t(r.label)}
                </option>
              ))}
            </select>
            <p>
              {t(b.label)} − {t(a.label)}:{" "}
              <strong>
                {b.total - a.total >= 0 ? "+" : ""}
                {number(b.total - a.total)} kg
                {a.total > 0
                  ? ` (${((b.total / a.total - 1) * 100).toFixed(1)}%)`
                  : ""}
              </strong>
            </p>
          </div>
        )}
        <details className="planner-chart" open={!compact}>
          <summary>{t("Volume outlook")}</summary>
          <CalendarVolume data={preview} month={month} />
        </details>
      </aside>
    </div>
  );
}
