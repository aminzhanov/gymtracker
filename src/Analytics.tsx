import { useState } from "react";
import { Plus, TrendingUp, ChevronDown, Trash2 } from "lucide-react";
import type { AppData, Week } from "./types";
import { Chart, Panel, Empty, Modal, InfoButton } from "./components";
import {
  filterSessions,
  volumeHistory,
  weekComparison,
  records,
  exerciseProgress,
  parseDate,
  bodyweightHistory,
  recoveryHistory,
  number,
  shortDate,
  dateKey,
  changePercent,
} from "./model";
import { RecoveryChecklist } from "./RecoveryChecklist";
const colors = ["#1673ff", "#f17bb4", "#16b895", "#ad80ed", "#f2ad32"];
const pct = (n: number | null) =>
  n === null ? "No previous data" : `${n >= 0 ? "+" : ""}${number(n, 1)}%`;
export function Analytics({
  data,
  onChange,
}: {
  data: AppData;
  onChange: (d: AppData) => void;
}) {
  const [week, setWeek] = useState<"All" | Week>("All");
  const [period, setPeriod] = useState<"session" | "week" | "month">("week");
  const [selected, setSelected] = useState<string[]>(["default-0"]);
  const [metric, setMetric] = useState<"e1rm" | "weight">("e1rm");
  const [scale, setScale] = useState<"kg" | "percent">("kg");
  const [progressMonth, setProgressMonth] = useState("");
  const useABSplit = data.settings.useABSplit;
  const effectiveWeek = useABSplit ? week : "All";
  const [expanded, setExpanded] = useState(false);
  const [bodyModal, setBodyModal] = useState(false);
  const [bodyDate, setBodyDate] = useState(dateKey());
  const [bodyValue, setBodyValue] = useState("");
  const sessions = filterSessions(data, effectiveWeek);
  const rows = volumeHistory(sessions, period);
  const comp = weekComparison(data.sessions);
  const prs = records(sessions);
  const allRecords = records(data.sessions);
  const bw = bodyweightHistory(data.bodyweight);
  const exerciseOptions = [
    ...new Map(
      [
        ...data.exercises,
        ...allRecords.rows.map((r) => ({
          id: r.exerciseId,
          name: r.name,
          custom: false,
        })),
      ].map((e) => [e.id, e]),
    ).values(),
  ];
  const months = [
    ...new Set([
      dateKey().slice(0, 7),
      ...sessions.map((session) => session.date.slice(0, 7)),
    ]),
  ]
    .sort()
    .reverse();
  const histories = selected.map((eid) => ({
    id: eid,
    name: exerciseOptions.find((e) => e.id === eid)?.name || eid,
    ...exerciseProgress(sessions, eid, metric, scale, progressMonth),
  }));
  const dates = [
    ...new Set(histories.flatMap((h) => h.rows.map((r) => r.date))),
  ].sort();
  const latest = rows.at(-1);
  const recovery = recoveryHistory(sessions);
  const recoveryChecks = recovery
    .flatMap((row) => [row.warmup, row.cooldown])
    .filter((check) => check.status !== "unplanned");
  const recoveryDone = recoveryChecks.filter(
    (check) => check.status === "done",
  ).length;
  const saveBody = () => {
    const weight = Number(bodyValue);
    if (!(weight > 0 && weight <= 600)) return;
    onChange({
      ...data,
      bodyweight: [
        ...data.bodyweight.filter((x) => x.date !== bodyDate),
        { date: bodyDate, weight },
      ],
    });
    setBodyModal(false);
  };
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">THE BIGGER PICTURE</span>
          <h1>
            Small steps. Stronger you <span>↗</span>
          </h1>
          <p>Your progress, from every rep to every week.</p>
        </div>
        {useABSplit && (
          <select
            aria-label="Analytics week filter"
            value={week}
            onChange={(e) => setWeek(e.target.value as "All" | Week)}
          >
            <option value="All">All weeks</option>
            <option value="A">Week A</option>
            <option value="B">Week B</option>
          </select>
        )}
      </div>
      <div className="analytics-top">
        <div className="metric-card tint-blue">
          <span className="metric-label">
            Completed lifting volume{" "}
            <InfoButton title="Completed lifting volume">
              Total weight × reps for completed strength sets, respecting the
              program-week filter.
            </InfoButton>
          </span>
          <strong>
            {number(
              sessions.reduce(
                (n, s) =>
                  n +
                  s.exercises
                    .filter((e) => e.kind === "strength")
                    .flatMap((e) => e.sets)
                    .filter((x) => x.done)
                    .reduce((a, x) => a + x.weight * x.reps, 0),
                0,
              ),
            )}
            <small> kg</small>
          </strong>
          <p>
            {effectiveWeek === "All"
              ? "All training weeks"
              : `Week ${effectiveWeek} only`}
          </p>
        </div>
        <div className="metric-card tint-mint">
          <span className="metric-label">
            Latest {period} change{" "}
            <InfoButton title="Latest training change">
              Percentage change from the previous period. A previous value of
              zero has no percentage baseline. The period is chosen in Training
              volume.
            </InfoButton>
          </span>
          <strong>{pct(latest?.change ?? null)}</strong>
          <p>{latest?.label || "Log a completed set to begin"}</p>
        </div>
        <div className="metric-card tint-yellow">
          <span className="metric-label">
            Recovery completed{" "}
            <InfoButton title="Recovery completed">
              The number of fully completed warm-up and cool-down routines out
              of planned routines in sessions you have started. See the
              checklist for skipped and partial routines.
            </InfoButton>
          </span>
          <strong>
            {recoveryDone}
            <small> / {recoveryChecks.length}</small>
          </strong>
          <p>Warm-ups & cool-downs</p>
        </div>
      </div>
      <Panel
        title="Training volume"
        info={
          <p>
            Completed strength sets only. Weeks start on Monday. A change from
            zero has no percentage baseline.
            {rows.length > 24
              ? " Chart shows the latest 24 periods; the table contains every period."
              : ""}
          </p>
        }
        action={
          <div className="segmented">
            {(["session", "week", "month"] as const).map((p) => (
              <button
                key={p}
                className={period === p ? "active" : ""}
                onClick={() => setPeriod(p)}
              >
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        }
      >
        {rows.length ? (
          <>
            <Chart
              bar
              labels={rows.slice(-24).map((r) => r.label)}
              series={[
                {
                  name: "Completed volume",
                  color: "#2581ff",
                  values: rows.slice(-24).map((r) => r.value),
                },
              ]}
            />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Volume</th>
                    <th>Change</th>
                    <th>Workload</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((r) => (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td>{number(r.value)} kg</td>
                      <td>{pct(r.change)}</td>
                      <td>
                        {period === "week" &&
                        r.change !== null &&
                        r.change > data.settings.spikeThreshold ? (
                          <span className="badge alert">↑ Workload spike</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty
            title="Your progress starts with a rep"
            detail="Complete a lifting set to populate volume history."
          />
        )}
      </Panel>
      <div className="two-col">
        {useABSplit && (
          <Panel
            title="Week A vs Week B"
            info={
              <p>
                Average calendar-week volume with completed lifting sets in each
                program. This comparison always shows both weeks.
              </p>
            }
          >
            <div className="comparison">
              <div>
                <span className="badge week-a">Week A</span>
                <strong>
                  {comp.a === null ? "—" : number(comp.a)}
                  <small> kg / week</small>
                </strong>
              </div>
              <div>
                <span className="badge week-b">Week B</span>
                <strong>
                  {comp.b === null ? "—" : number(comp.b)}
                  <small> kg / week</small>
                </strong>
              </div>
            </div>
            {comp.difference === null ? (
              <p className="muted">
                Complete workouts in both weeks to compare your program.
              </p>
            ) : (
              <p className="positive">
                Week A {pct(comp.difference)} compared with Week B
              </p>
            )}
            {volumeHistory(data.sessions, "week").length > 0 && (
              <Chart
                bar
                labels={volumeHistory(data.sessions, "week")
                  .slice(-12)
                  .map((r) => r.label)}
                series={[
                  {
                    name: "Week A",
                    color: "#2581ff",
                    values: volumeHistory(data.sessions, "week")
                      .slice(-12)
                      .map((r) => r.a),
                  },
                  {
                    name: "Week B",
                    color: "#f17bb4",
                    values: volumeHistory(data.sessions, "week")
                      .slice(-12)
                      .map((r) => r.b),
                  },
                ]}
              />
            )}
          </Panel>
        )}
        <Panel
          title="Recovery checklist"
          className={useABSplit ? "" : "span-full"}
          info={
            <>
              <p>
                Shows warm-ups and cool-downs for sessions with completed sets
                or activities. Future plans that have not started are excluded.
              </p>
              <p>
                Done means every activity in that routine was marked complete.
                Partial means only some were completed. Skipped means it was not
                marked complete in a finished or past training session. Pending
                means today’s session is still in progress. Not planned means
                the session contains no activity of that kind.
              </p>
              <p>
                Recovery completion stays separate from lifting volume,
                estimated 1RM and records.
              </p>
            </>
          }
        >
          <RecoveryChecklist rows={recovery} />
        </Panel>
      </div>
      <Panel
        title="Exercise progress"
        info={
          <>
            <p>
              Lines connect recorded training days. An exercise with one
              recorded day has one point; missing days are not treated as zero.
            </p>
            <p>
              Epley estimate: weight × (1 + reps ÷ 30). Bodyweight movements
              need a entered lifting weight to produce a weight-based estimate.
            </p>{" "}
            {scale === "percent" && (
              <div className="progress-baselines">
                <p className="muted">
                  0% is each exercise’s first completed{" "}
                  {metric === "weight" ? "top weight" : "estimated 1RM"} in the
                  selected month.
                </p>
                {histories
                  .filter((history) => history.baseline)
                  .map((history) => (
                    <span key={history.id}>
                      <i
                        style={{
                          background:
                            colors[
                              selected.indexOf(history.id) % colors.length
                            ],
                        }}
                      />
                      {history.name}: {number(history.baseline.value, 1)} kg on{" "}
                      {shortDate(history.baseline.date)}
                    </span>
                  ))}
              </div>
            )}
          </>
        }
        action={
          <select
            aria-label="Exercise progress metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as "e1rm" | "weight")}
          >
            <option value="e1rm">Estimated 1RM</option>
            <option value="weight">Top weight</option>
          </select>
        }
      >
        <div className="progress-controls">
          <label>
            Display
            <select
              aria-label="Exercise progress scale"
              value={scale}
              onChange={(event) => {
                const next = event.target.value as "kg" | "percent";
                setScale(next);
                if (next === "percent" && !progressMonth)
                  setProgressMonth(dateKey().slice(0, 7));
              }}
            >
              <option value="kg">Weight (kg)</option>
              <option value="percent">Growth (%)</option>
            </select>
          </label>
          <label>
            Period
            <select
              aria-label="Exercise progress period"
              value={progressMonth}
              onChange={(event) => setProgressMonth(event.target.value)}
            >
              {scale === "kg" && <option value="">All history</option>}
              {months.map((month) => (
                <option key={month} value={month}>
                  {parseDate(`${month}-01`).toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="exercise-chips">
          {exerciseOptions.map((e) => (
            <button
              key={e.id}
              className={`chip ${selected.includes(e.id) ? "selected" : ""}`}
              aria-pressed={selected.includes(e.id)}
              onClick={() =>
                setSelected((old) =>
                  old.includes(e.id)
                    ? old.filter((x) => x !== e.id)
                    : [...old, e.id],
                )
              }
            >
              {e.name}
            </button>
          ))}
        </div>
        {dates.length ? (
          <>
            <Chart
              connectGaps
              unit={scale === "percent" ? "%" : "kg"}
              labels={dates.map(shortDate)}
              series={histories.map((h, i) => ({
                name: h.name,
                color: colors[i % colors.length],
                values: dates.map(
                  (date) => h.rows.find((r) => r.date === date)?.value ?? null,
                ),
              }))}
            />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    {histories.map((h) => (
                      <th key={h.id}>{h.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dates.map((date) => (
                    <tr key={date}>
                      <td>{shortDate(date)}</td>
                      {histories.map((h) => (
                        <td key={h.id}>
                          {h.rows.find((r) => r.date === date)
                            ? scale === "percent"
                              ? pct(h.rows.find((r) => r.date === date)!.value)
                              : `${number(h.rows.find((r) => r.date === date)!.value, 1)} kg`
                            : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty
            title={
              selected.length
                ? "No completed history for this selection"
                : "Pick your exercises"
            }
            detail="Select one or more exercises to compare completed performance."
          />
        )}
      </Panel>
      <Panel
        title="Personal records"
        info={
          <p>
            The first five exercises are ranked by completed-set frequency.
            Records respect the week filter.
          </p>
        }
        action={
          prs.rows.length > 5 ? (
            <button
              className="text-button"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show less" : "More exercises"}
              <ChevronDown size={15} />
            </button>
          ) : undefined
        }
      >
        {prs.rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th>Best e1RM</th>
                  <th>Heaviest</th>
                  <th>Best set</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(expanded ? prs.rows : prs.rows.slice(0, 5)).map((r) => (
                  <tr key={r.exerciseId}>
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td>{number(r.best, 1)} kg</td>
                    <td>{number(r.heaviest, 1)} kg</td>
                    <td>
                      {number(r.weight, 1)} × {r.reps}
                    </td>
                    <td>{shortDate(r.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Your first record is waiting"
            detail="Finish a set with weight and reps to get started."
          />
        )}
      </Panel>
      <Panel
        title="Bodyweight"
        info={
          <p>
            Average of measurements in the preceding seven calendar days,
            including the entry date. Bodyweight is independent of the
            program-week filter.
          </p>
        }
        action={
          <button
            className="button secondary"
            onClick={() => {
              setBodyDate(dateKey());
              setBodyValue(
                String(
                  data.bodyweight.find((e) => e.date === dateKey())?.weight ||
                    "",
                ),
              );
              setBodyModal(true);
            }}
          >
            <Plus size={16} /> Log bodyweight
          </button>
        }
      >
        {bw.length ? (
          <>
            <div className="body-summary">
              <strong>
                {number(bw.at(-1)!.weight, 1)} <small>kg</small>
              </strong>
              <span className="muted">
                Latest · {shortDate(bw.at(-1)!.date)} · 7-day average{" "}
                {number(bw.at(-1)!.average, 1)} kg
              </span>
            </div>
            <Chart
              labels={bw.map((e) => shortDate(e.date))}
              series={[
                {
                  name: "Bodyweight",
                  color: "#bfa0ef",
                  values: bw.map((e) => e.weight),
                },
                {
                  name: "7-day moving average",
                  color: "#7552bb",
                  values: bw.map((e) => e.average),
                },
              ]}
            />
            <details>
              <summary>Bodyweight entries</summary>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Weight</th>
                    <th>7-day average</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...bw].reverse().map((e) => (
                    <tr key={e.date}>
                      <td>{shortDate(e.date)}</td>
                      <td>{number(e.weight, 1)} kg</td>
                      <td>{number(e.average, 1)} kg</td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Delete bodyweight on ${e.date}`}
                          onClick={() =>
                            onChange({
                              ...data,
                              bodyweight: data.bodyweight.filter(
                                (x) => x.date !== e.date,
                              ),
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <Empty
            title="A little more context"
            detail="Log your bodyweight to see its history and 7-day trend."
          />
        )}
      </Panel>
      {bodyModal && (
        <Modal title="Log bodyweight" onClose={() => setBodyModal(false)}>
          <label>
            Date
            <input
              type="date"
              value={bodyDate}
              onChange={(e) => {
                setBodyDate(e.target.value);
                setBodyValue(
                  String(
                    data.bodyweight.find((x) => x.date === e.target.value)
                      ?.weight || "",
                  ),
                );
              }}
            />
          </label>
          <label>
            Bodyweight (kg)
            <input
              type="number"
              autoFocus
              min="1"
              max="600"
              step="0.1"
              value={bodyValue}
              onChange={(e) => setBodyValue(e.target.value)}
            />
          </label>
          <p className="muted">
            An existing entry on this date will be updated.
          </p>
          <button
            className="button primary full"
            disabled={
              !bodyDate || Number(bodyValue) <= 0 || Number(bodyValue) > 600
            }
            onClick={saveBody}
          >
            Save bodyweight
          </button>
        </Modal>
      )}
    </>
  );
}
