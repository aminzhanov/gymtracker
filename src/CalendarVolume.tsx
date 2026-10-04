import { VolumePlot } from "./VolumePlot";
import { useState } from "react";
import type { AppData } from "./types";
import { InfoButton, Panel } from "./components";
import { number, parseDate, shortDate } from "./model";
import { calendarVolume, monthLabel, trainingWeekVolume } from "./planning";

export function CalendarVolume({
  data,
  month,
}: {
  data: AppData;
  month: string;
}) {
  const [view, setView] = useState<"bars" | "line">("bars");
  const split = data.settings.useABSplit;
  const [grouping, setGrouping] = useState<"training" | "calendar">("training");
  const training = split && grouping === "training";
  const rows = training
    ? trainingWeekVolume(data.sessions, month)
    : calendarVolume(data.sessions, month).map((row) => ({
        ...row,
        label: "",
        week: undefined,
      }));
  const done = rows.reduce((sum, row) => sum + row.done, 0);
  const planned = rows.reduce((sum, row) => sum + row.planned, 0);
  const range = (row: { from: string; to: string }) =>
    training
      ? row.from === row.to
        ? shortDate(row.from)
        : `${shortDate(row.from)}–${shortDate(row.to)}`
      : `${parseDate(row.from).getDate()}–${parseDate(row.to).getDate()}`;
  return (
    <Panel
      title={`Volume outlook · ${monthLabel(month)}`}
      className="calendar-volume"
      action={
        <div className="segmented" aria-label="Calendar volume chart view">
          <button
            aria-pressed={view === "bars"}
            className={view === "bars" ? "active" : ""}
            onClick={() => setView("bars")}
          >
            Bars
          </button>
          <button
            aria-pressed={view === "line"}
            className={view === "line" ? "active" : ""}
            onClick={() => setView("line")}
          >
            Line
          </button>
        </div>
      }
    >
      {split && (
        <div
          className="segmented volume-grouping"
          aria-label="Volume week grouping"
        >
          <button
            aria-pressed={training}
            className={training ? "active" : ""}
            onClick={() => setGrouping("training")}
          >
            Training weeks
          </button>
          <button
            aria-pressed={!training}
            className={!training ? "active" : ""}
            onClick={() => setGrouping("calendar")}
          >
            Calendar weeks
          </button>
        </div>
      )}
      <div className="volume-outlook-summary">
        <span>
          <strong>{number(done)} kg</strong> Completed
        </span>
        <span>
          <strong>{number(planned)} kg</strong> Planned
        </span>
        <span>
          <strong>{number(done + planned)} kg</strong>{" "}
          {training ? "Training-week projection" : "Month projection"}
        </span>
        <InfoButton title="Calendar volume outlook">
          <p>
            Weekly lifting volume, calculated as weight × reps. Completed
            sessions use only checked sets. Planned sessions use all prescribed
            sets, including checked sets until the session is marked done. These
            are estimates, not additional completed volume.
          </p>
          <p>
            Bars stack lighter planned volume above solid completed volume. Week
            A and B use the session’s assigned program week. Lines show
            completed volume and the combined projection.{" "}
            {training
              ? "Training weeks combine assigned sessions, regardless of weekdays. Unassigned history is suggested in consecutive groups of up to three sessions with the same A/B tag. Whole groups with a session in this month are shown, including sessions outside the month. Change assignments in the session editor."
              : `Only dates inside ${monthLabel(month)} count; the first and last Monday–Sunday weeks may be partial.`}{" "}
            Warm-ups and cool-downs do not add lifting volume.
          </p>
        </InfoButton>
      </div>
      <VolumePlot
        rows={rows}
        view={view}
        split={split}
        training={training}
        title={`${monthLabel(month)} ${training ? "training-week" : "calendar-week"}`}
        range={range}
        caption={`Dates in ${monthLabel(month)} · Monday–Sunday weeks · kg`}
      />
      {training &&
        rows.some(
          (row) =>
            row.from.slice(0, 7) !== month || row.to.slice(0, 7) !== month,
        ) && (
          <p className="footnote">
            Some training weeks cross month boundaries. Their totals include the
            whole group; date ranges show which sessions are included.
          </p>
        )}
      {!done && !planned && (
        <p className="muted">
          No lifting volume yet for this month. Add weight and reps to planned
          sessions to see your projection.
        </p>
      )}
      <details className="volume-breakdown">
        <summary>Weekly breakdown</summary>
        <div className="volume-table-scroll">
          <table>
            <caption className="sr-only">
              Weekly lifting volume for {monthLabel(month)}
            </caption>
            <thead>
              <tr>
                <th scope="col">Dates</th>
                {split && <th scope="col">Week</th>}
                <th scope="col">Completed</th>
                <th scope="col">Planned</th>
                <th scope="col">Projection</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((row) =>
                (training
                  ? [{ week: row.label, done: row.done, planned: row.planned }]
                  : split
                    ? [
                        { week: "A", ...row.a },
                        { week: "B", ...row.b },
                      ]
                    : [{ week: "", done: row.done, planned: row.planned }]
                ).map((bucket) => (
                  <tr key={`${row.key}-${bucket.week}`}>
                    <th scope="row">{range(row)}</th>
                    {split && (
                      <td>{training ? bucket.week : `Week ${bucket.week}`}</td>
                    )}
                    <td>{number(bucket.done)} kg</td>
                    <td>{number(bucket.planned)} kg</td>
                    <td>{number(bucket.done + bucket.planned)} kg</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </Panel>
  );
}
