import { t, exerciseName } from "./i18n";
import { Modal } from "./components";
import { fullDate, shortDate, number } from "./model";
import type { strengthPointDetails } from "./analyticsVolume";
type Detail = NonNullable<ReturnType<typeof strengthPointDetails>>;
const percent = (value: number) =>
  `${value >= 0 ? "+" : ""}${number(value, 1)}%`;
const points = (value: number) =>
  `${value >= 0 ? "+" : ""}${number(value, 2)} ${t("pp")}`;
export function StrengthPointDetail({
  detail,
  onClose,
  onSession,
}: {
  detail: Detail;
  onClose: () => void;
  onSession: (id: string) => void;
}) {
  const renderRow = (row: Detail["details"][number]) => (
    <article className="strength-driver" key={row.id}>
      <div className="strength-driver-head">
        <strong>{exerciseName(row.current.name, row.id)}</strong>
        <b>{points(row.effect)}</b>
      </div>
      <p className="strength-driver-reason">
        {row.joined
          ? t("New exercise joined at its 0% baseline.")
          : row.updated
            ? t("Daily best estimated 1RM updated.")
            : t(
                "Previous performance carried forward; no effect on this change.",
              )}
      </p>
      <div className="strength-log-comparison">
        <span>
          <small>{t("Previous log")}</small>
          {row.prior ? (
            <>
              <strong>
                {number(row.prior.weight, 1)} {t("kg")} × {row.prior.reps}
              </strong>
              <small>
                {shortDate(row.prior.date)} {row.prior.date.slice(0, 4)} ·{" "}
                {number(row.prior.value, 1)} {t("kg")} {t("Estimated 1RM")}
              </small>
            </>
          ) : (
            <strong>—</strong>
          )}
        </span>
        <span>
          <small>{t("Latest log")}</small>
          <strong>
            {number(row.current.weight, 1)} {t("kg")} × {row.current.reps}
          </strong>
          <small>
            {shortDate(row.current.date)} {row.current.date.slice(0, 4)} ·{" "}
            {number(row.current.value, 1)} {t("kg")} {t("Estimated 1RM")}
          </small>
        </span>
      </div>
      <p className="strength-driver-growth">
        {t("Growth from baseline")}:{" "}
        {row.previousGrowth === null ? "—" : percent(row.previousGrowth)} →{" "}
        <strong>{percent(row.growth)}</strong>
      </p>
      <button
        className="text-button"
        onClick={() => onSession(row.current.sessionId)}
      >
        {t("Open workout")}: {row.current.sessionName}
      </button>
    </article>
  );
  return (
    <Modal
      title={`${t("Strength trend")} · ${fullDate(detail.date)}`}
      onClose={onClose}
    >
      <div className="strength-point-summary">
        <strong>{percent(detail.value)}</strong>
        <span>
          {detail.delta === null ? t("Starting point") : points(detail.delta)} ·{" "}
          {t("Change from previous point")}
        </span>
        <small>
          {detail.count} {t("comparable exercises")}
          {detail.previousDate
            ? ` · ${t("Previous point")}: ${shortDate(detail.previousDate)}`
            : ""}
        </small>
      </div>
      <p className="stat-detail-caption">
        {t(
          "Contributions below add up to the movement of the combined line. Percentage points describe the change in that average.",
        )}
      </p>
      {detail.details.some((row) => row.joined) &&
        detail.previousValue !== null && (
          <p className="notice">
            {t(
              "New exercises enter at 0%. Adding them can pull a positive average down, or a negative average up, even without a lower logged performance.",
            )}
          </p>
        )}
      {detail.delta === null && (
        <p className="notice">
          {t(
            "This is the first plotted date. Exercises begin at their own 0% baselines; there is no previous point to compare.",
          )}
        </p>
      )}
      <div className="strength-driver-list">
        {detail.affected.length ? (
          detail.affected.map(renderRow)
        ) : (
          <p>{t("No exercise changed its contribution at this point.")}</p>
        )}
      </div>
      <details className="strength-full-breakdown">
        <summary>{t("Show full breakdown")}</summary>
        <div className="strength-driver-list">
          {detail.details.map(renderRow)}
        </div>
      </details>
      <p className="footnote">
        {t(
          "This explains recorded performance, not measured strength loss. Lighter weights or fewer reps may reflect a deliberately easier workout.",
        )}
      </p>
    </Modal>
  );
}
