import { useState } from "react";
import type { AppData } from "./types";
import { InfoButton, Panel, useMediaQuery } from "./components";
import { number, parseDate, shortDate } from "./model";
import { calendarVolume, monthLabel, trainingWeekVolume } from "./planning";

const A = "#1369df",
  B = "#b54c9b",
  DONE = "#16836a";
export function CalendarVolume({
  data,
  month,
}: {
  data: AppData;
  month: string;
}) {
  const [view, setView] = useState<"bars" | "line">("bars");
  const compact = useMediaQuery("(max-width: 640px)");
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
  const width = Math.max(compact ? 360 : 760, rows.length * 105 + 70),
    height = 260;
  const left = 55,
    right = 15,
    top = 18,
    bottom = training ? 63 : 43;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const max = Math.max(1, ...rows.map((row) => row.total)) * 1.1;
  const x = (index: number) => left + ((index + 0.5) * plotWidth) / rows.length;
  const y = (value: number) => top + (1 - value / max) * plotHeight;
  const path = (field: "done" | "total") =>
    rows
      .map((row, index) => `${index ? "L" : "M"}${x(index)},${y(row[field])}`)
      .join(" ");
  const range = (row: (typeof rows)[number]) =>
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
      <div className="chart-wrap calendar-volume-chart">
        <div className="volume-chart-scroll">
          <svg
            style={{ minWidth: width, width: "100%" }}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${monthLabel(month)} ${training ? "training-week" : "calendar-week"} completed and planned training volume in kg, ${view}`}
          >
            <title>
              Weekly completed volume and planned volume · {monthLabel(month)}
            </title>
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={top + t * plotHeight}
                  y2={top + t * plotHeight}
                  stroke="#e9e6e1"
                  strokeDasharray="4 4"
                />
                <text
                  x={left - 7}
                  y={top + t * plotHeight + 4}
                  textAnchor="end"
                  fill="#767184"
                  fontSize={compact ? 14 : 12}
                >
                  {number(max * (1 - t))}
                </text>
              </g>
            ))}
            {view === "bars" ? (
              rows.map((row, index) => {
                const buckets = training
                  ? [
                      {
                        name: row.label,
                        color: row.week === "A" ? A : B,
                        done: row.done,
                        planned: row.planned,
                      },
                    ]
                  : split
                    ? [
                        { name: "Week A", color: A, ...row.a },
                        { name: "Week B", color: B, ...row.b },
                      ]
                    : [
                        {
                          name: "All sessions",
                          color: A,
                          done: row.done,
                          planned: row.planned,
                        },
                      ];
                const barWidth = Math.min(
                  28,
                  plotWidth / rows.length / (split && !training ? 3.2 : 2),
                );
                return (
                  <g key={row.key}>
                    {buckets.map((bucket, bi) => {
                      const bx =
                        x(index) +
                        (bi - (buckets.length - 1) / 2) * (barWidth + 4) -
                        barWidth / 2;
                      return (
                        <g key={bucket.name}>
                          <rect
                            x={bx}
                            y={y(bucket.done)}
                            width={barWidth}
                            height={Math.max(0, y(0) - y(bucket.done))}
                            fill={bucket.color}
                          >
                            <title>
                              {range(row)} · {bucket.name} completed:{" "}
                              {number(bucket.done)} kg
                            </title>
                          </rect>
                          <rect
                            x={bx}
                            y={y(bucket.done + bucket.planned)}
                            width={barWidth}
                            height={Math.max(
                              0,
                              y(bucket.done) - y(bucket.done + bucket.planned),
                            )}
                            fill={bucket.color}
                            fillOpacity="0.25"
                            stroke={bucket.color}
                            strokeDasharray="3 3"
                          >
                            <title>
                              {range(row)} · {bucket.name} planned:{" "}
                              {number(bucket.planned)} kg; projection:{" "}
                              {number(bucket.done + bucket.planned)} kg
                            </title>
                          </rect>
                        </g>
                      );
                    })}
                  </g>
                );
              })
            ) : (
              <>
                <path
                  d={path("total")}
                  fill="none"
                  stroke={A}
                  strokeWidth="3"
                  strokeDasharray="7 5"
                  opacity="0.6"
                />
                <path
                  d={path("done")}
                  fill="none"
                  stroke={DONE}
                  strokeWidth="3"
                />
                {rows.map((row, index) => (
                  <g key={row.key}>
                    <circle
                      cx={x(index)}
                      cy={y(row.total)}
                      r="4"
                      fill="white"
                      stroke={training && row.week === "B" ? B : A}
                      strokeWidth="2"
                    >
                      <title>
                        {range(row)} projection: {number(row.total)} kg
                      </title>
                    </circle>
                    <circle
                      cx={x(index)}
                      cy={y(row.done)}
                      r="3.5"
                      fill={training ? (row.week === "B" ? B : A) : DONE}
                    >
                      <title>
                        {range(row)} completed: {number(row.done)} kg
                      </title>
                    </circle>
                  </g>
                ))}
              </>
            )}
            {rows.map((row, index) => (
              <text
                key={row.key}
                x={x(index)}
                y={height - 21}
                textAnchor="middle"
                fontSize={compact ? 14 : 12}
                fill="#767184"
              >
                {training ? (
                  <>
                    <tspan x={x(index)} dy={-18}>
                      {row.label}
                    </tspan>
                    <tspan x={x(index)} dy={18}>
                      {range(row)}
                    </tspan>
                  </>
                ) : (
                  range(row)
                )}
              </text>
            ))}
            <text
              x={width / 2}
              y={height - 3}
              textAnchor="middle"
              fontSize="11"
              fill="#767184"
            >
              {training
                ? "Assigned training weeks · whole-group volume · kg"
                : `Dates in ${monthLabel(month)} · Monday–Sunday weeks · kg`}
            </text>
          </svg>
        </div>
        <div className="chart-legend">
          {view === "bars" ? (
            <>
              <span>
                <i style={{ background: A }} />
                {split ? "Week A" : "Sessions"}
              </span>
              {split && (
                <span>
                  <i style={{ background: B }} />
                  Week B
                </span>
              )}
              <span>
                <i style={{ background: "#767184" }} />
                Completed · solid
              </span>
              <span>
                <i className="planned-legend" />
                Planned · lighter
              </span>
            </>
          ) : (
            <>
              <span>
                <i style={{ background: DONE }} />
                Completed
              </span>
              <span>
                <i className="projection-legend" />
                Completed + planned · dashed
              </span>
            </>
          )}
        </div>
      </div>
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
