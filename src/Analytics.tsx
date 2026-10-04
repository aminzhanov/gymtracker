import { appLocale } from "./i18n";
import { t, exerciseName } from "./i18n";
import {
  volumeRows,
  trainingAverages,
  strengthTrend,
  filterVolumeRange,
} from "./analyticsVolume";
import { readExerciseSelection } from "./chartDomain";
import { VolumePlot } from "./VolumePlot";
import { useEffect, useState } from "react";
import {
  Plus,
  TrendingUp,
  ChevronDown,
  Trash2,
  ListFilter,
} from "lucide-react";
import type { AppData, Week } from "./types";
import { Chart, Panel, Empty, Modal, InfoButton } from "./components";
import {
  filterSessions,
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
  n === null ? t("No previous data") : `${n >= 0 ? "+" : ""}${number(n, 1)}%`;
export function Analytics({
  data,
  onChange,
  preferenceKey,
}: {
  preferenceKey: string;
  data: AppData;
  onChange: (d: AppData) => void;
}) {
  const [week, setWeek] = useState<"All" | Week>("All");
  const [period, setPeriod] = useState<"session" | "week" | "month">("week");
  const storageKey = `liftlog:progress-exercises:${preferenceKey}`;
  const [selected, setSelected] = useState<string[]>(() =>
    readExerciseSelection(localStorage, storageKey),
  );
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(selected));
    } catch {
      /* Optional browser preference. */
    }
  }, [selected, storageKey]);
  const [volumeView, setVolumeView] = useState<"bars" | "line">("bars");
  const [metric, setMetric] = useState<"e1rm" | "weight">("e1rm");
  const [scale, setScale] = useState<"kg" | "percent">("kg");
  const [progressMonth, setProgressMonth] = useState("");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const useABSplit = data.settings.useABSplit;
  const effectiveWeek = useABSplit ? week : "All";
  const [expanded, setExpanded] = useState(false);
  const [bodyModal, setBodyModal] = useState(false);
  const [bodyDate, setBodyDate] = useState(dateKey());
  const [bodyValue, setBodyValue] = useState("");
  const sessions = filterSessions(data, effectiveWeek);
  const [volumeRange, setVolumeRange] = useState<"month" | "three" | "all">(
    "all",
  );
  const rows = filterVolumeRange(
    volumeRows(sessions, period, useABSplit),
    volumeRange,
  );
  const trend = strengthTrend(sessions);
  const comp = trainingAverages(data.sessions);
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
    name: exerciseName(
      exerciseOptions.find((e) => e.id === eid)?.name || eid,
      eid,
    ),
    ...exerciseProgress(sessions, eid, metric, scale, progressMonth),
  }));
  const dates = [
    ...new Set(histories.flatMap((h) => h.rows.map((r) => r.date))),
  ].sort();
  const recovery = recoveryHistory(sessions);
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
          <span className="eyebrow">{t("THE BIGGER PICTURE")}</span>
          <h1>
            {t("Small steps. Stronger you ")}
            <span>↗</span>
          </h1>
          <p>{t("Your progress, from every rep to every week.")}</p>
        </div>
        {useABSplit && (
          <select
            aria-label={t("Analytics week filter")}
            value={week}
            onChange={(e) => setWeek(e.target.value as "All" | Week)}
          >
            <option value="All">{t("All weeks")}</option>
            <option value="A">{t("Week A")}</option>
            <option value="B">{t("Week B")}</option>
          </select>
        )}
      </div>
      <div className="analytics-top">
        <div className="metric-card tint-blue">
          <span className="metric-label">
            {t("Completed lifting volume")}{" "}
            <InfoButton title={t("Completed lifting volume")}>
              {t(
                "Total weight × reps for completed strength sets, respecting the program-week filter.",
              )}
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
            <small>{t(" kg")}</small>
          </strong>
          <p>
            {effectiveWeek === "All"
              ? t("All training weeks")
              : t(`Week ${effectiveWeek} only`)}
          </p>
        </div>
        <div className="metric-card tint-mint">
          <span className="metric-label">
            {t("Strength trend")}{" "}
            <InfoButton title={t("Strength trend")}>
              {t(
                "Average percentage change in daily best estimated 1RM from each exercise's first to latest log within the last 30 days. Each exercise needs at least two different logged days and receives equal weight. Checked strength sets only; plans and zero-weight sets are excluded. This is an estimate from your logs, not a measured change in maximal strength.",
              )}
            </InfoButton>
          </span>
          <strong>{trend.value === null ? "—" : pct(trend.value)}</strong>
          <p>
            {t("Last 30 days · ")}
            {trend.count}
            {t(" comparable exercises")}
          </p>
        </div>
      </div>
      <Panel
        title={t("Training volume")}
        info={
          <p>
            {t(
              "Solid bars show checked strength sets. Lighter bars show remaining planned sets; the dashed line shows the combined projection. Planned sets affect only this chart. A/B week view uses assigned training groups across weekdays and month boundaries. Changes and spikes use actual volume, comparing A with the previous completed A group and B with the previous completed B group. An unfinished group can show a provisional change. Averages include only fully completed training groups, always showing both A and B averages.",
            )}
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
                {t(p[0].toUpperCase() + p.slice(1))}
              </button>
            ))}
          </div>
        }
      >
        <div className="volume-controls">
          <div className="volume-filter-row">
            <label className="volume-range-label">
              {t("Range")}
              <select
                aria-label={t("Training volume range")}
                value={volumeRange}
                onChange={(e) =>
                  setVolumeRange(e.target.value as "month" | "three" | "all")
                }
              >
                <option value="month">{t("This month")}</option>
                <option value="three">{t("Last 3 months")}</option>
                <option value="all">{t("All history")}</option>
              </select>
            </label>
            <div
              className="segmented"
              aria-label={t("Analytics volume chart view")}
            >
              <button
                className={volumeView === "bars" ? "active" : ""}
                aria-pressed={volumeView === "bars"}
                onClick={() => setVolumeView("bars")}
              >
                {t("Bars")}
              </button>
              <button
                className={volumeView === "line" ? "active" : ""}
                aria-pressed={volumeView === "line"}
                onClick={() => setVolumeView("line")}
              >
                {t("Line")}
              </button>
            </div>
          </div>
          {period === "week" && useABSplit && (
            <div className="volume-week-averages">
              <span>
                {t("Week A avg")}{" "}
                <strong>
                  {comp.a === null ? "—" : t(`${number(comp.a)} kg`)}
                </strong>
              </span>
              <span>
                {t("Week B avg")}{" "}
                <strong>
                  {comp.b === null ? "—" : t(`${number(comp.b)} kg`)}
                </strong>
              </span>
              {comp.difference !== null && (
                <span>
                  {t("Week A ")}
                  <strong>{pct(comp.difference)}</strong>
                  {t(" compared with Week B")}
                </span>
              )}
            </div>
          )}
        </div>
        {rows.length ? (
          <>
            <VolumePlot
              rows={rows}
              view={volumeView}
              split={useABSplit}
              training={period === "week" && useABSplit}
              title={t("Training volume")}
              range={(row) =>
                period === "week" && useABSplit
                  ? `${shortDate(row.from)}–${shortDate(row.to)}`
                  : period === "session"
                    ? shortDate(row.from)
                    : row.label
              }
            />
            <details className="volume-breakdown">
              <summary>{t("Show breakdown")}</summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Period")}</th>
                      <th>{t("Completed")}</th>
                      <th>{t("Planned")}</th>
                      <th>{t("Projection")}</th>
                      <th>{t("Change")}</th>
                      <th>{t("Workload")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows].reverse().map((r) => (
                      <tr key={r.key}>
                        <td>{t(r.label)}</td>
                        <td>
                          {number(r.done)}
                          {t(" kg")}
                        </td>
                        <td>
                          {number(r.planned)}
                          {t(" kg")}
                        </td>
                        <td>
                          {number(r.total)}
                          {t(" kg")}
                        </td>
                        <td>
                          {pct(r.change)}
                          {r.done > 0 &&
                            !r.closed &&
                            period === "week" &&
                            useABSplit && (
                              <small className="muted">
                                {t(" · In progress")}
                              </small>
                            )}
                        </td>
                        <td>
                          {period === "week" &&
                          r.change !== null &&
                          r.change > data.settings.spikeThreshold ? (
                            <span className="badge alert">
                              {t("↑ Workload spike")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <Empty
            title={t("Your progress starts with a rep")}
            detail={t("Complete a lifting set to populate volume history.")}
          />
        )}
      </Panel>
      <div className="two-col">
        <Panel
          title={t("Warm-up checklist")}
          className="span-full"
          info={
            <>
              <p>
                {t(
                  "Each column is one session: warm-up on top and cool-down below. Tap a box for details. Green means done, amber means partial, gray means skipped, pending or not planned. Shows warm-ups and cool-downs for sessions with completed sets or activities. Future plans that have not started are excluded.",
                )}
              </p>
              <p>
                {t(
                  "Done means every activity in that routine was marked complete. Partial means only some were completed. Skipped means it was not marked complete in a finished or past training session. Pending means today’s session is still in progress. Not planned means the session contains no activity of that kind.",
                )}
              </p>
              <p>
                {t(
                  "Recovery completion stays separate from lifting volume, estimated 1RM and records.",
                )}
              </p>
            </>
          }
        >
          <RecoveryChecklist rows={recovery} />
        </Panel>
      </div>
      <Panel
        title={t("Exercise progress")}
        info={
          <>
            <p>
              {t(
                "Lines connect recorded training days. An exercise with one recorded day has one point; missing days are not treated as zero.",
              )}
            </p>
            <p>
              {t(
                "Epley estimate: weight × (1 + reps ÷ 30). Bodyweight movements need a entered lifting weight to produce a weight-based estimate.",
              )}
            </p>{" "}
            {scale === "percent" && (
              <div className="progress-baselines">
                <p className="muted">
                  {t("0% is each exercise’s first completed")}{" "}
                  {metric === "weight" ? t("top weight") : t("estimated 1RM")}{" "}
                  {progressMonth
                    ? t("in the selected month")
                    : t("across all recorded history")}
                  .
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
                      {history.name}: {number(history.baseline.value, 1)}
                      {t(" kg on")} {shortDate(history.baseline.date)}
                    </span>
                  ))}
              </div>
            )}
          </>
        }
        action={
          <select
            aria-label={t("Exercise progress metric")}
            value={metric}
            onChange={(e) => setMetric(e.target.value as "e1rm" | "weight")}
          >
            <option value="e1rm">{t("Estimated 1RM")}</option>
            <option value="weight">{t("Top weight")}</option>
          </select>
        }
      >
        <div className="progress-controls">
          <label>
            {t("Display")}
            <select
              aria-label={t("Exercise progress scale")}
              value={scale}
              onChange={(event) => {
                const next = event.target.value as "kg" | "percent";
                setScale(next);
              }}
            >
              <option value="kg">{t("Weight (kg)")}</option>
              <option value="percent">{t("Growth (%)")}</option>
            </select>
          </label>
          <label>
            {t("Period")}
            <select
              aria-label={t("Exercise progress period")}
              value={progressMonth}
              onChange={(event) => setProgressMonth(event.target.value)}
            >
              <option value="">{t("All history")}</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {parseDate(`${month}-01`).toLocaleDateString(appLocale(), {
                    month: "long",
                    year: "numeric",
                  })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <details className="exercise-filter">
          <summary>
            <ListFilter size={18} aria-hidden="true" />
            <span>{t("Exercises")}</span>
            <span className="exercise-filter-count" aria-live="polite">
              {selected.length} {t("selected")}
            </span>
          </summary>
          <div className="exercise-filter-content">
            <div className="exercise-filter-tools">
              <input
                type="search"
                aria-label={t("Search exercises")}
                placeholder={t("Search exercises")}
                value={exerciseSearch}
                onChange={(e) => setExerciseSearch(e.target.value)}
              />
              <button
                type="button"
                className="text-button"
                disabled={!selected.length}
                onClick={() => setSelected([])}
              >
                {t("Clear selection")}
              </button>
            </div>
            <div className="exercise-filter-list">
              {exerciseOptions
                .filter((e) =>
                  `${exerciseName(e.name, e.id)} ${e.name}`
                    .toLocaleLowerCase(appLocale())
                    .includes(
                      exerciseSearch.trim().toLocaleLowerCase(appLocale()),
                    ),
                )
                .map((e) => (
                  <label key={e.id} className="exercise-filter-option">
                    <input
                      type="checkbox"
                      checked={selected.includes(e.id)}
                      onChange={() =>
                        setSelected((old) =>
                          old.includes(e.id)
                            ? old.filter((x) => x !== e.id)
                            : [...old, e.id],
                        )
                      }
                    />
                    <span>{exerciseName(e.name, e.id)}</span>
                    {selected.includes(e.id) && (
                      <i
                        aria-hidden="true"
                        style={{
                          background:
                            colors[selected.indexOf(e.id) % colors.length],
                        }}
                      />
                    )}
                  </label>
                ))}
            </div>
            {!exerciseOptions.some((e) =>
              `${exerciseName(e.name, e.id)} ${e.name}`
                .toLocaleLowerCase(appLocale())
                .includes(exerciseSearch.trim().toLocaleLowerCase(appLocale())),
            ) && <p className="muted">{t("No matching exercises")}</p>}
          </div>
        </details>
        {dates.length ? (
          <>
            <Chart
              connectGaps
              unit={scale === "percent" ? "%" : t("kg")}
              labels={dates.map(shortDate)}
              series={histories.map((h, i) => ({
                name: h.name,
                color: colors[i % colors.length],
                values: dates.map(
                  (date) => h.rows.find((r) => r.date === date)?.value ?? null,
                ),
              }))}
            />
            <details className="volume-breakdown progress-breakdown">
              <summary>{t("Show breakdown")}</summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Date")}</th>
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
                                ? pct(
                                    h.rows.find((r) => r.date === date)!.value,
                                  )
                                : t(
                                    `${number(h.rows.find((r) => r.date === date)!.value, 1)} kg`,
                                  )
                              : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <Empty
            title={
              selected.length
                ? t("No completed history for this selection")
                : t("Pick your exercises")
            }
            detail={t(
              "Select one or more exercises to compare completed performance.",
            )}
          />
        )}
      </Panel>
      <Panel
        title={t("Personal records")}
        info={
          <p>
            {t(
              "The first five exercises are ranked by completed-set frequency. Records respect the week filter.",
            )}
          </p>
        }
        action={
          prs.rows.length > 5 ? (
            <button
              className="text-button"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? t("Show less") : t("More exercises")}
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
                  <th>{t("Exercise")}</th>
                  <th>{t("Best e1RM")}</th>
                  <th>{t("Heaviest")}</th>
                  <th>{t("Best set")}</th>
                  <th>{t("Date")}</th>
                </tr>
              </thead>
              <tbody>
                {(expanded ? prs.rows : prs.rows.slice(0, 5)).map((r) => (
                  <tr key={r.exerciseId}>
                    <td>
                      <strong>{exerciseName(r.name, r.exerciseId)}</strong>
                    </td>
                    <td>
                      {number(r.best, 1)}
                      {t(" kg")}
                    </td>
                    <td>
                      {number(r.heaviest, 1)}
                      {t(" kg")}
                    </td>
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
            title={t("Your first record is waiting")}
            detail={t("Finish a set with weight and reps to get started.")}
          />
        )}
      </Panel>
      <Panel
        title={t("Bodyweight")}
        info={
          <p>
            {t(
              "Average of measurements in the preceding seven calendar days, including the entry date. Bodyweight is independent of the program-week filter.",
            )}
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
            <Plus size={16} />
            {t(" Log bodyweight")}
          </button>
        }
      >
        {bw.length ? (
          <>
            <div className="body-summary">
              <strong>
                {number(bw.at(-1)!.weight, 1)} <small>{t("kg")}</small>
              </strong>
              <span className="muted">
                {t("Latest · ")}
                {shortDate(bw.at(-1)!.date)}
                {t(" · 7-day average")} {number(bw.at(-1)!.average, 1)}
                {t(" kg")}
              </span>
            </div>
            <Chart
              zeroBaseline={false}
              axisDecimals={1}
              labels={bw.map((e) => shortDate(e.date))}
              series={[
                {
                  name: t("Bodyweight"),
                  color: "#bfa0ef",
                  values: bw.map((e) => e.weight),
                },
                {
                  name: t("7-day moving average"),
                  color: "#7552bb",
                  values: bw.map((e) => e.average),
                },
              ]}
            />
            <details>
              <summary>{t("Bodyweight entries")}</summary>
              <table>
                <thead>
                  <tr>
                    <th>{t("Date")}</th>
                    <th>{t("Weight")}</th>
                    <th>{t("7-day average")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...bw].reverse().map((e) => (
                    <tr key={e.date}>
                      <td>{shortDate(e.date)}</td>
                      <td>
                        {number(e.weight, 1)}
                        {t(" kg")}
                      </td>
                      <td>
                        {number(e.average, 1)}
                        {t(" kg")}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={t(`Delete bodyweight on ${e.date}`)}
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
            title={t("A little more context")}
            detail={t(
              "Log your bodyweight to see its history and 7-day trend.",
            )}
          />
        )}
      </Panel>
      {bodyModal && (
        <Modal title={t("Log bodyweight")} onClose={() => setBodyModal(false)}>
          <label>
            {t("Date")}
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
            {t("Bodyweight (kg)")}
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
            {t("An existing entry on this date will be updated.")}
          </p>
          <button
            className="button primary full"
            disabled={
              !bodyDate || Number(bodyValue) <= 0 || Number(bodyValue) > 600
            }
            onClick={saveBody}
          >
            {t("Save bodyweight")}
          </button>
        </Modal>
      )}
    </>
  );
}
