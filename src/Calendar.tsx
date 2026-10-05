import { appLocale } from "./i18n";
import { t } from "./i18n";
import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import type { AppData, Session } from "./types";
import { Panel, useMediaQuery } from "./components";
import { dateKey, parseDate, addDays, monday, shortDate } from "./model";
import { PlannerBoard } from "./PlannerBoard";
import { CalendarVolume } from "./CalendarVolume";

export function Calendar({
  data,
  onOpen,
  onCreate,
  onMove,
  onDuplicate,
  onSave,
}: {
  data: AppData;
  onOpen: (session: Session) => void;
  onCreate: (date: string) => void;
  onMove: (id: string, date: string) => void;
  onDuplicate: (s: Session) => void;
  onSave: (s: Session) => void;
}) {
  const [workspace, setWorkspace] = useState<"calendar" | "table">("calendar");
  const compact = useMediaQuery("(max-width: 850px)");
  const [view, setView] = useState<"month" | "week" | null>(null);
  const [focusDate, setFocusDate] = useState(dateKey());
  const activeView =
    workspace === "table" ? "month" : (view ?? (compact ? "week" : "month"));
  const month = focusDate.slice(0, 7);
  const first = `${month}-01`;
  const weekStart = monday(focusDate);
  const start = activeView === "week" ? weekStart : monday(first);
  const monthEnd = parseDate(first);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);
  const monthDays =
    Math.ceil(
      (((parseDate(first).getDay() + 6) % 7) + monthEnd.getDate()) / 7,
    ) * 7;
  const days = Array.from(
    { length: activeView === "week" ? 7 : monthDays },
    (_, i) => addDays(start, i),
  );
  const showWeek = data.settings.useABSplit;
  const title =
    activeView === "week"
      ? `${shortDate(weekStart)} – ${shortDate(addDays(weekStart, 6))}, ${parseDate(addDays(weekStart, 6)).getFullYear()}`
      : parseDate(first).toLocaleDateString(appLocale(), {
          month: "long",
          year: "numeric",
        });
  const move = (direction: number) => {
    if (activeView === "week") setFocusDate(addDays(focusDate, direction * 7));
    else {
      const date = parseDate(first);
      date.setMonth(date.getMonth() + direction);
      setFocusDate(dateKey(date));
    }
  };
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("PLAN. TRAIN. PROGRESS.")}</span>
          <h1>
            {t("Your planner ")}
            <span>↗</span>
          </h1>
          <p>{t("Make a little space for getting stronger.")}</p>
        </div>
        <button className="button primary" onClick={() => onCreate(dateKey())}>
          <Plus size={17} />
          {t(" Add session")}
        </button>
      </div>
      <div
        className="segmented planner-view-switch"
        aria-label={t("Planner view")}
      >
        <button
          aria-pressed={workspace === "calendar"}
          className={workspace === "calendar" ? "active" : ""}
          onClick={() => setWorkspace("calendar")}
        >
          {t("Calendar")}
        </button>
        <button
          aria-pressed={workspace === "table"}
          className={workspace === "table" ? "active" : ""}
          onClick={() => setWorkspace("table")}
        >
          {t("Table planner")}
        </button>
      </div>
      <Panel
        title={title}
        className={`calendar-panel ${workspace === "table" ? "planner-month-panel" : ""}`}
        action={
          <div className="calendar-controls">
            {workspace === "calendar" && (
              <div className="segmented" aria-label={t("Calendar view")}>
                <button
                  aria-pressed={activeView === "week"}
                  className={activeView === "week" ? "active" : ""}
                  onClick={() => setView("week")}
                >
                  {t("Week")}
                </button>
                <button
                  aria-pressed={activeView === "month"}
                  className={activeView === "month" ? "active" : ""}
                  onClick={() => setView("month")}
                >
                  {t("Month")}
                </button>
              </div>
            )}
            <div className="flex">
              <button
                className="icon-button"
                aria-label={t(`Previous ${activeView}`)}
                onClick={() => move(-1)}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                className="button secondary compact"
                onClick={() => setFocusDate(dateKey())}
              >
                {t("Today")}
              </button>
              <button
                className="icon-button"
                aria-label={t(`Next ${activeView}`)}
                onClick={() => move(1)}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        }
      >
        {workspace === "calendar" && (
          <>
            <div
              className={`calendar-scroll ${activeView === "week" ? "agenda-scroll" : ""}`}
            >
              <div
                className={
                  activeView === "week" ? "calendar-agenda" : "calendar-grid"
                }
              >
                {activeView === "month" &&
                  [
                    t("Mon"),
                    t("Tue"),
                    t("Wed"),
                    t("Thu"),
                    t("Fri"),
                    t("Sat"),
                    t("Sun"),
                  ].map((day) => (
                    <div className="calendar-label" key={t(day)}>
                      {t(day)}
                    </div>
                  ))}
                {days.map((date) => {
                  const sessions = data.sessions.filter(
                    (session) => session.date === date,
                  );
                  return (
                    <div
                      key={date}
                      className={`calendar-day ${activeView === "month" && date.slice(0, 7) !== month ? "other-month" : ""} ${date === dateKey() ? "today" : ""}`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const id = event.dataTransfer.getData(
                          "text/liftlog-session",
                        );
                        if (id) onMove(id, date);
                      }}
                    >
                      <div className="calendar-date">
                        <button
                          className="day-number"
                          aria-label={t(`Create session on ${date}`)}
                          onClick={() => onCreate(date)}
                        >
                          {parseDate(date).getDate()}
                        </button>
                        {activeView === "week" && (
                          <span>
                            {parseDate(date).toLocaleDateString(appLocale(), {
                              weekday: "long",
                              month: "short",
                            })}
                            {date === dateKey() && <small>{t("Today")}</small>}
                          </span>
                        )}
                      </div>
                      <div className="calendar-workouts">
                        {sessions.map((session) => (
                          <div
                            className="calendar-session-wrap"
                            key={session.id}
                          >
                            <button
                              draggable
                              className={`calendar-session ${session.status === "done" ? "calendar-session-done" : ""} ${showWeek ? `week-${session.week.toLowerCase()}` : "tint-blue"}`}
                              onDragStart={(event) =>
                                event.dataTransfer.setData(
                                  "text/liftlog-session",
                                  session.id,
                                )
                              }
                              onClick={() => onOpen(session)}
                            >
                              <span className="calendar-session-title">
                                <span aria-hidden="true">{session.icon}</span>
                                <strong>{session.name}</strong>
                              </span>
                              <small>
                                {showWeek && `${t(`Week ${session.week}`)} · `}
                                {session.status === "done"
                                  ? t("✓ Done")
                                  : t("Planned")}
                              </small>
                            </button>
                            <button
                              className="duplicate-session-button"
                              aria-label={t(
                                `Duplicate ${session.name} on ${session.date}`,
                              )}
                              title={t("Duplicate session")}
                              onClick={() => onDuplicate(session)}
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                        ))}
                        {activeView === "week" && !sessions.length && (
                          <span className="calendar-rest">
                            {t("No session planned")}
                          </span>
                        )}
                      </div>
                      <button
                        className="day-add"
                        aria-label={t(`Add session on ${date}`)}
                        onClick={() => onCreate(date)}
                      >
                        <Plus size={17} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="footnote">
              {t(
                "Tap a date to plan, or a session to open it. Drag a session to reschedule on desktop. Use “Move to date” in the editor on mobile.",
              )}
            </p>
          </>
        )}
      </Panel>
      {workspace === "table" ? (
        <PlannerBoard
          key={`${month}:${showWeek}`}
          data={data}
          month={month}
          onSave={onSave}
          onOpen={onOpen}
          onCreate={onCreate}
          onDuplicate={onDuplicate}
        />
      ) : (
        <CalendarVolume data={data} month={month} />
      )}
    </>
  );
}
