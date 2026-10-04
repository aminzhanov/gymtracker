import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import type { AppData, Session } from "./types";
import { Panel, ExerciseNames, useMediaQuery } from "./components";
import { dateKey, parseDate, addDays, monday, shortDate } from "./model";

export function Calendar({
  data,
  onOpen,
  onCreate,
  onMove,
}: {
  data: AppData;
  onOpen: (session: Session) => void;
  onCreate: (date: string) => void;
  onMove: (id: string, date: string) => void;
}) {
  const compact = useMediaQuery("(max-width: 850px)");
  const [view, setView] = useState<"month" | "week" | null>(null);
  const [focusDate, setFocusDate] = useState(dateKey());
  const activeView = view ?? (compact ? "week" : "month");
  const month = focusDate.slice(0, 7);
  const first = `${month}-01`;
  const weekStart = monday(focusDate);
  const start = activeView === "week" ? weekStart : monday(first);
  const days = Array.from({ length: activeView === "week" ? 7 : 42 }, (_, i) =>
    addDays(start, i),
  );
  const showWeek = data.settings.useABSplit;
  const title =
    activeView === "week"
      ? `${shortDate(weekStart)} – ${shortDate(addDays(weekStart, 6))}, ${parseDate(addDays(weekStart, 6)).getFullYear()}`
      : parseDate(first).toLocaleDateString(undefined, {
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
          <span className="eyebrow">PLAN. TRAIN. PROGRESS.</span>
          <h1>
            Your training calendar <span>↗</span>
          </h1>
          <p>Make a little space for getting stronger.</p>
        </div>
        <button className="button primary" onClick={() => onCreate(dateKey())}>
          <Plus size={17} /> Add session
        </button>
      </div>
      <Panel
        title={title}
        className="calendar-panel"
        action={
          <div className="calendar-controls">
            <div className="segmented" aria-label="Calendar view">
              <button
                aria-pressed={activeView === "week"}
                className={activeView === "week" ? "active" : ""}
                onClick={() => setView("week")}
              >
                Week
              </button>
              <button
                aria-pressed={activeView === "month"}
                className={activeView === "month" ? "active" : ""}
                onClick={() => setView("month")}
              >
                Month
              </button>
            </div>
            <div className="flex">
              <button
                className="icon-button"
                aria-label={`Previous ${activeView}`}
                onClick={() => move(-1)}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                className="button secondary compact"
                onClick={() => setFocusDate(dateKey())}
              >
                Today
              </button>
              <button
                className="icon-button"
                aria-label={`Next ${activeView}`}
                onClick={() => move(1)}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        }
      >
        <div
          className={`calendar-scroll ${activeView === "week" ? "agenda-scroll" : ""}`}
        >
          <div
            className={
              activeView === "week" ? "calendar-agenda" : "calendar-grid"
            }
          >
            {activeView === "month" &&
              ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div className="calendar-label" key={day}>
                  {day}
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
                      aria-label={`Create session on ${date}`}
                      onClick={() => onCreate(date)}
                    >
                      {parseDate(date).getDate()}
                    </button>
                    {activeView === "week" && (
                      <span>
                        {parseDate(date).toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "short",
                        })}
                        {date === dateKey() && <small>Today</small>}
                      </span>
                    )}
                  </div>
                  <div className="calendar-workouts">
                    {sessions.map((session) => (
                      <button
                        key={session.id}
                        draggable
                        className={`calendar-session ${showWeek ? `week-${session.week.toLowerCase()}` : "tint-blue"}`}
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
                          {showWeek && `Week ${session.week} · `}
                          {session.status === "done" ? "✓ Done" : "Planned"}
                        </small>
                        <ExerciseNames exercises={session.exercises} />
                      </button>
                    ))}
                    {activeView === "week" && !sessions.length && (
                      <span className="calendar-rest">No session planned</span>
                    )}
                  </div>
                  <button
                    className="day-add"
                    aria-label={`Add session on ${date}`}
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
          Tap a date to plan, or a session to open it. Drag a session to
          reschedule on desktop. Use “Move to date” in the editor on mobile.
        </p>
      </Panel>
    </>
  );
}
