import { useEffect, useRef, useState } from "react";
import { Search, CheckCircle2, Clock3 } from "lucide-react";
import type { AppData, Session } from "./types";
import { t, exerciseName } from "./i18n";
import { fullDate } from "./model";
import { monthLabel, trainingMonths } from "./planning";
import { trainingWeeks } from "./trainingWeeks";
import { previousPlannerExercise } from "./plannerEditing";
import { ExerciseRow } from "./PlannerBoard";
import { SessionCard } from "./components";
import {
  exerciseMatches,
  searchSessions,
  searchExerciseOptions,
  searchResultGroups,
} from "./trainingSearch";
export function SearchResults({
  data,
  query,
  onQuery,
  onSave,
  onOpen,
  onDuplicate,
}: {
  data: AppData;
  query: string;
  onQuery: (v: string) => void;
  onSave: (s: Session) => void;
  onOpen: (s: Session) => void;
  onDuplicate: (s: Session) => void;
}) {
  const [mode, setMode] = useState<"sessions" | "exercises">("sessions");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState("all");
  const [selected, setSelected] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Session>>({});
  const draftRef = useRef(drafts);
  const dataRef = useRef(data);
  dataRef.current = data;
  const current = (s: Session) =>
    draftRef.current[s.id] ??
    dataRef.current.sessions.find((x) => x.id === s.id) ??
    s;
  const draft = (s: Session) => {
    draftRef.current = { ...draftRef.current, [s.id]: s };
    setDrafts(draftRef.current);
  };
  const save = (s: Session) => {
    if (!draftRef.current[s.id]) return;
    onSave(current(s));
    const next = { ...draftRef.current };
    delete next[s.id];
    draftRef.current = next;
    setDrafts(next);
  };
  useEffect(() => setSelected(""), [query]);
  const preview = {
    ...data,
    sessions: data.sessions.map((s) => drafts[s.id] ?? s),
  };
  const options = searchExerciseOptions(preview, query);
  const selectedId = options.some((e) => e.id === selected) ? selected : "";
  const matches =
    mode === "sessions"
      ? searchSessions(preview, query)
      : preview.sessions.filter((s) =>
          s.exercises.some(
            (e) =>
              exerciseMatches(e, query, preview) &&
              (!selectedId || e.exerciseId === selectedId),
          ),
        );
  const groups = searchResultGroups(matches, status, month);
  const count = groups.reduce(
    (v, g) =>
      v +
      (mode === "sessions"
        ? g.sessions.length
        : g.sessions.reduce(
            (n, s) =>
              n +
              s.exercises.filter(
                (e) =>
                  exerciseMatches(e, query, preview) &&
                  (!selectedId || e.exerciseId === selectedId),
              ).length,
            0,
          )),
    0,
  );
  const weeks = new Map(
    trainingWeeks(preview.sessions).flatMap((g) =>
      g.sessions.map((s) => [s.id, g.label] as const),
    ),
  );
  const available = trainingMonths(data.sessions);
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("FIND. ADJUST. PROGRESS.")}</span>
          <h1>{t("Search your training")}</h1>
          <p>
            {t(
              "Find workouts or edit an exercise across your history and plans.",
            )}
          </p>
        </div>
      </div>
      <div className="search-field search-mobile-field">
        <Search size={18} />
        <input
          aria-label={t("Search sessions and exercises")}
          placeholder={t("Find a session or exercise…")}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>
      <div className="training-search-filters">
        <div className="segmented" aria-label={t("Search result type")}>
          <button
            aria-pressed={mode === "sessions"}
            className={mode === "sessions" ? "active" : ""}
            onClick={() => setMode("sessions")}
          >
            {t("Sessions")}
          </button>
          <button
            aria-pressed={mode === "exercises"}
            className={mode === "exercises" ? "active" : ""}
            onClick={() => setMode("exercises")}
          >
            {t("Exercises")}
          </button>
        </div>
        <label>
          {t("Status")}
          <select
            aria-label={t("Search status filter")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">{t("All sessions")}</option>
            <option value="planned">{t("Planned")}</option>
            <option value="done">{t("Completed")}</option>
          </select>
        </label>
        <label>
          {t("Month")}
          <select
            aria-label={t("Search month filter")}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="all">{t("All history")}</option>
            {available.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        {mode === "exercises" && options.length > 1 && (
          <label>
            {t("Exercise")}
            <select
              aria-label={t("Matching exercise")}
              value={selectedId}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">{t("All matching exercises")}</option>
              {options.map((e) => (
                <option key={e.id} value={e.id}>
                  {exerciseName(e.name, e.id)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!query.trim() ? (
        <p className="search-empty">
          {t("Type a workout or exercise name to search all your sessions.")}
        </p>
      ) : (
        <>
          <p className="search-result-count" role="status">
            {count}{" "}
            {t(
              mode === "sessions"
                ? "matching sessions"
                : "exercise occurrences",
            )}
          </p>
          <div
            className={
              mode === "exercises"
                ? "search-exercise-results"
                : "search-session-results"
            }
          >
            <div>
              {!count && (
                <p className="search-empty">
                  {t("No matches. Try another name or change the filters.")}
                </p>
              )}
              {groups.map((g) => (
                <section className="search-result-group" key={g.status}>
                  <h2>{t(g.status === "done" ? "Completed" : "Planned")}</h2>
                  {g.sessions.map((original) => {
                    const s = current(original);
                    if (mode === "sessions")
                      return (
                        <SessionCard
                          key={s.id}
                          session={s}
                          showWeek={data.settings.useABSplit}
                          onOpen={onOpen}
                          onDuplicate={onDuplicate}
                        />
                      );
                    const exercises = s.exercises.filter(
                      (e) =>
                        exerciseMatches(e, query, preview) &&
                        (!selectedId || e.exerciseId === selectedId),
                    );
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
                              )}{" "}
                              {t(s.status === "done" ? "Completed" : "Planned")}
                            </span>
                          </div>
                          <div className="search-occurrence-context">
                            <span>
                              {fullDate(s.date)}
                              {data.settings.useABSplit
                                ? ` · ${t(weeks.get(s.id) ?? `Week ${s.week}`)}`
                                : ""}
                            </span>
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
                        </header>
                        {exercises.map((e) => (
                          <ExerciseRow
                            key={e.id}
                            e={e}
                            s={s}
                            previous={previousPlannerExercise(
                              preview.sessions,
                              s,
                              e,
                            )}
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
                      </article>
                    );
                  })}
                </section>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
