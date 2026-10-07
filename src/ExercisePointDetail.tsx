import { t, exerciseName } from "./i18n";
import { Modal } from "./components";
import { number, fullDate, shortDate } from "./model";
import type { exercisePointDetails } from "./exercisePoints";
type Detail = NonNullable<ReturnType<typeof exercisePointDetails>>;
const percent = (n: number) => `${n >= 0 ? "+" : ""}${number(n, 1)}%`;
export function ExercisePointDetail({
  detail,
  name,
  onClose,
  onSession,
}: {
  detail: Detail;
  name: string;
  onClose: () => void;
  onSession: (id: string) => void;
}) {
  const metricName =
    detail.metric === "volume"
      ? t("Completed lifting volume")
      : detail.metric === "e1rm"
        ? t("Estimated 1RM")
        : t("Top weight");
  return (
    <Modal title={`${name} · ${fullDate(detail.date)}`} onClose={onClose}>
      <div className="strength-point-summary">
        <strong>
          {detail.scale === "percent"
            ? percent(detail.value)
            : `${number(detail.value, 1)} ${t("kg")}`}
        </strong>
        <span>{metricName}</span>
        <small>
          {detail.previous
            ? `${t("Previous point")}: ${shortDate(detail.previous.date)} · ${number(detail.previous.value, 1)} ${t("kg")}`
            : t("Starting point")}
        </small>
        {detail.change !== null && (
          <span>
            {t("Change from previous point")}: {detail.change >= 0 ? "+" : ""}
            {number(detail.change, 1)} {t("kg")}
          </span>
        )}
        {detail.growth !== null && (
          <small>
            {t("Growth from baseline")}: {percent(detail.growth)} ·{" "}
            {number(detail.baseline.value, 1)} {t("kg")} ·{" "}
            {shortDate(detail.baseline.date)}
          </small>
        )}
      </div>
      <p className="stat-detail-caption">
        {t(
          detail.metric === "volume"
            ? "Volume adds weight × reps for all completed sets of this exercise on this day, across workouts. Unchecked sets are excluded."
            : "This point uses the best completed set on this day. Highlighted sets determine the plotted value; unchecked sets are excluded.",
        )}
      </p>
      <div className="strength-driver-list">
        {detail.logs.map((log) => (
          <article key={log.sessionId} className="strength-driver">
            <div className="strength-driver-head">
              <strong>{log.sessionName}</strong>
              <button
                className="text-button"
                onClick={() => onSession(log.sessionId)}
              >
                {t("Open workout")}
              </button>
            </div>
            <div className="exercise-point-sets">
              {log.sets.map((set) => (
                <div
                  key={set.id}
                  className={set.contributes ? "contributing-set" : ""}
                >
                  <strong>
                    {number(set.weight, 1)} {t("kg")} × {set.reps}
                  </strong>
                  <span>
                    {detail.metric === "volume"
                      ? `${number(set.weight * set.reps, 1)} ${t("kg")}`
                      : detail.metric === "e1rm"
                        ? `${number(set.estimated, 1)} ${t("kg")} ${t("Estimated 1RM")}`
                        : exerciseName(set.name, set.exerciseId)}
                  </span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      <p className="footnote">
        {t(
          "Lighter weights or fewer reps may reflect a deliberately easier workout. This chart describes your logs.",
        )}
      </p>
    </Modal>
  );
}
