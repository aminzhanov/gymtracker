import { t } from "./i18n";
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
      title={t(`Volume outlook · ${monthLabel(month)}`)}
      className="calendar-volume"
      action={
        <div className="segmented" aria-label={t("Calendar volume chart view")}>
          <button
            aria-pressed={view === "bars"}
            className={view === "bars" ? "active" : ""}
            onClick={() => setView("bars")}
          >
            {t("Bars")}
          </button>
          <button
            aria-pressed={view === "line"}
            className={view === "line" ? "active" : ""}
            onClick={() => setView("line")}
          >
            {t("Line")}
          </button>
        </div>
      }
    >
      {split && (
        <div
          className="segmented volume-grouping"
          aria-label={t("Volume week grouping")}
        >
          <button
            aria-pressed={training}
            className={training ? "active" : ""}
            onClick={() => setGrouping("training")}
          >
            {t("Training weeks")}
          </button>
          <button
            aria-pressed={!training}
            className={!training ? "active" : ""}
            onClick={() => setGrouping("calendar")}
          >
            {t("Calendar weeks")}
          </button>
        </div>
      )}
      <div className="volume-outlook-summary">
        <span>
          <strong>
            {number(done)}
            {t(" kg")}
          </strong>
          {t(" Completed")}
        </span>
        <span>
          <strong>
            {number(planned)}
            {t(" kg")}
          </strong>
          {t(" Planned")}
        </span>
        <span>
          <strong>
            {number(done + planned)}
            {t(" kg")}
          </strong>{" "}
          {training ? t("Training-week projection") : t("Month projection")}
        </span>
        <InfoButton title={t("Calendar volume outlook")}>
          <p>
            {t(
              "Weekly lifting volume, calculated as weight × reps. Completed sessions use only checked sets. Planned sessions use all prescribed sets, including checked sets until the session is marked done. These are estimates, not additional completed volume.",
            )}
          </p>
          <p>
            {t(
              "Bars stack lighter planned volume above solid completed volume. Week A and B use the session’s assigned program week. Lines show completed volume and the combined projection.",
            )}{" "}
            {training
              ? t(
                  "Training weeks combine assigned sessions, regardless of weekdays. Unassigned history is suggested in consecutive groups of up to three sessions with the same A/B tag. Whole groups with a session in this month are shown, including sessions outside the month. Change assignments in the session editor.",
                )
              : t(
                  `Only dates inside ${monthLabel(month)} count; the first and last Monday–Sunday weeks may be partial.`,
                )}{" "}
            {t("Warm-ups and cool-downs do not add lifting volume.")}
          </p>
        </InfoButton>
      </div>
      <VolumePlot
        rows={rows}
        view={view}
        split={split}
        training={training}
        title={t(
          `${monthLabel(month)} ${training ? "training-week" : "calendar-week"}`,
        )}
        range={range}
      />
      {training &&
        rows.some(
          (row) =>
            row.from.slice(0, 7) !== month || row.to.slice(0, 7) !== month,
        ) && (
          <p className="footnote">
            {t(
              "Some training weeks cross month boundaries. Their totals include the whole group; date ranges show which sessions are included.",
            )}
          </p>
        )}
      {!done && !planned && (
        <p className="muted">
          {t(
            "No lifting volume yet for this month. Add weight and reps to planned sessions to see your projection.",
          )}
        </p>
      )}
      <details className="volume-breakdown">
        <summary>{t("Show breakdown")}</summary>
        <div className="volume-table-scroll">
          <table>
            <caption className="sr-only">
              {t("Weekly lifting volume for ")}
              {monthLabel(month)}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("Dates")}</th>
                {split && <th scope="col">{t("Week")}</th>}
                <th scope="col">{t("Completed")}</th>
                <th scope="col">{t("Planned")}</th>
                <th scope="col">{t("Projection")}</th>
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
                      <td>
                        {training ? bucket.week : t(`Week ${bucket.week}`)}
                      </td>
                    )}
                    <td>
                      {number(bucket.done)}
                      {t(" kg")}
                    </td>
                    <td>
                      {number(bucket.planned)}
                      {t(" kg")}
                    </td>
                    <td>
                      {number(bucket.done + bucket.planned)}
                      {t(" kg")}
                    </td>
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
