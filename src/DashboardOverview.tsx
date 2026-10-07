import { illustrationSource } from "./illustrationAssets";
import { useState, type CSSProperties } from "react";
import { DEFAULT_ILLUSTRATIONS, illustrationVariables } from "./illustrations";
import type { ProfileIllustration } from "./types";
import { dashboardStats } from "./dashboardStats";
import { t, exerciseName } from "./i18n";
import type { AppData, Session } from "./types";
import { STRENGTH_TREND_INFO } from "./analyticsVolume";
import {
  dateKey,
  fullDate,
  number,
  shortDate,
  doneSets,
  volume,
} from "./model";
import catFace from "./assets/cat-face.webp";
import { InfoButton, Modal, Empty } from "./components";
import { Dumbbell, Trophy, TrendingUp } from "lucide-react";

export function DashboardOverview({
  data,
  message,
  onSession,
  illustration = DEFAULT_ILLUSTRATIONS.dashboard,
}: {
  data: AppData;
  message: string;
  onSession: (session: Session) => void;
  illustration?: ProfileIllustration;
}) {
  const today = dateKey();
  const { trend, lifting, volumeSessions, recordEvents } = dashboardStats(
    data.sessions,
    today,
  );
  const [detail, setDetail] = useState<
    "strength" | "volume" | "records" | null
  >(null);
  const prs = recordEvents.length;
  const percent = (value: number) =>
    `${value >= 0 ? "+" : ""}${number(value, 1)}%`;
  const openSession = (session: Session) => {
    setDetail(null);
    onSession(session);
  };
  return (
    <>
      <section className="welcome dashboard-welcome">
        <div className="welcome-content">
          <div className="welcome-intro">
            <span className="eyebrow">{t("LET'S MAKE TODAY A GOOD ONE")}</span>
            <h1>
              {t("Hey ")}
              {data.settings.name} <span>💪</span>
            </h1>
            <p className="personal-message">
              {message === "Ready to move today?" ? t(message) : message}
            </p>
            <span className="welcome-date">{fullDate(today)}</span>
            <img
              className="dashboard-cat"
              src={illustrationSource(illustration, catFace)}
              style={illustrationVariables(illustration) as CSSProperties}
              width={512}
              height={512}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
          </div>
          <div className="welcome-stat-tags">
            <div className="welcome-stat-tag welcome-stat-strength">
              <button
                type="button"
                className="welcome-stat-hit"
                aria-label={t("View strength breakdown")}
                aria-haspopup="dialog"
                onClick={() => setDetail("strength")}
              />
              <TrendingUp size={18} />
              <span className="welcome-stat-copy">
                <strong>
                  {trend.value === null
                    ? "—"
                    : `${trend.value >= 0 ? "+" : ""}${number(trend.value, 1)}%`}
                </strong>
                <span>{t("Strength · 30 days")}</span>
              </span>
              <InfoButton title={t("Strength trend")}>
                {t(STRENGTH_TREND_INFO)}
              </InfoButton>
            </div>
            <div className="welcome-stat-tag welcome-stat-volume">
              <button
                type="button"
                className="welcome-stat-hit"
                aria-label={t("View volume breakdown")}
                aria-haspopup="dialog"
                onClick={() => setDetail("volume")}
              />
              <Dumbbell size={18} />
              <span className="welcome-stat-copy">
                <strong>
                  {number(lifting)}
                  {t(" kg")}
                </strong>
                <span>{t("Volume · 30 days")}</span>
              </span>
              <InfoButton title={t("Training volume")}>
                {t(
                  "Checked strength sets in the last 30 days, including today. Planned sets and future logs are excluded.",
                )}
              </InfoButton>
            </div>
            <div className="welcome-stat-tag welcome-stat-records">
              <button
                type="button"
                className="welcome-stat-hit"
                aria-label={t("View records this month")}
                aria-haspopup="dialog"
                onClick={() => setDetail("records")}
              />
              <Trophy size={18} />
              <span className="welcome-stat-copy">
                <strong>{prs}</strong>
                <span>{t("records this month")}</span>
              </span>
              <InfoButton title={t("Records this month")}>
                {t(
                  "New estimated 1RM records this month from checked strength sets.",
                )}
              </InfoButton>
            </div>
          </div>
        </div>
      </section>
      {detail && (
        <Modal
          title={t(
            detail === "strength"
              ? "Strength · 30 days"
              : detail === "volume"
                ? "Volume · 30 days"
                : "Records this month",
          )}
          onClose={() => setDetail(null)}
        >
          <div className="stat-detail-summary">
            <strong>
              {detail === "strength"
                ? trend.value === null
                  ? "—"
                  : percent(trend.value)
                : detail === "volume"
                  ? `${number(lifting)} ${t("kg")}`
                  : prs}
            </strong>
            <span>
              {t(
                detail === "records"
                  ? "New estimated 1RM records this month"
                  : "Last 30 days",
              )}
            </span>
          </div>
          {detail === "strength" && (
            <>
              <p className="stat-detail-caption">
                {t(
                  "Each exercise contributes equally. First and latest daily best estimated 1RM are shown below.",
                )}
              </p>
              {trend.exercises.length ? (
                <div className="stat-detail-list">
                  {trend.exercises.map((e) => {
                    const name =
                      data.exercises.find((x) => x.id === e.id)?.name ??
                      data.sessions
                        .flatMap((s) => s.exercises)
                        .find((x) => x.exerciseId === e.id)?.name ??
                      e.id;
                    return (
                      <div className="stat-detail-row" key={e.id}>
                        <span>
                          <strong>{exerciseName(name, e.id)}</strong>
                          <small>
                            {t("Estimated 1RM")} · {number(e.first, 1)} →{" "}
                            {number(e.latest, 1)} {t("kg")}
                          </small>
                        </span>
                        <b>{percent(e.change)}</b>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  title={t("More training needed")}
                  detail={t(
                    "Log an exercise on at least two different days to see its strength trend.",
                  )}
                />
              )}
            </>
          )}
          {detail === "volume" && (
            <>
              <p className="stat-detail-caption">
                {t(
                  "Only checked strength sets count. Tap a workout to open it.",
                )}
              </p>
              {volumeSessions.length ? (
                <div className="stat-detail-list">
                  {volumeSessions.map((s) => (
                    <button
                      type="button"
                      className="stat-detail-row"
                      key={s.id}
                      onClick={() => openSession(s)}
                      aria-label={`${t("Open workout")}: ${s.name}, ${shortDate(s.date)}`}
                    >
                      <span>
                        <strong>
                          {s.icon} {s.name}
                        </strong>
                        <small>
                          {shortDate(s.date)} · {doneSets(s).length}{" "}
                          {t("completed sets")}
                        </small>
                      </span>
                      <b>
                        {number(volume(s))} {t("kg")}
                      </b>
                    </button>
                  ))}
                </div>
              ) : (
                <Empty
                  title={t("No completed sets yet")}
                  detail={t(
                    "Complete a lifting set to populate volume history.",
                  )}
                />
              )}
            </>
          )}
          {detail === "records" && (
            <>
              <p className="stat-detail-caption">
                {t(
                  "Each entry is a new estimated 1RM record, including your first recorded result. Tap to open its workout.",
                )}
              </p>
              {recordEvents.length ? (
                <div className="stat-detail-list">
                  {recordEvents.map((e) => (
                    <button
                      type="button"
                      className="stat-detail-row"
                      key={`${e.sessionId}:${e.exerciseId}`}
                      onClick={() => openSession(e.session)}
                      aria-label={`${t("Open record workout")}: ${exerciseName(e.name, e.exerciseId)}, ${shortDate(e.date)}`}
                    >
                      <span>
                        <strong>{exerciseName(e.name, e.exerciseId)}</strong>
                        <small>
                          {shortDate(e.date)} · {e.session.name}
                        </small>
                        <small>
                          {number(e.weight, 1)} {t("kg")} × {e.reps}{" "}
                          {t("Reps").toLowerCase()}
                        </small>
                      </span>
                      <span className="stat-record-value">
                        <b>
                          {number(e.value, 1)} {t("kg")}
                        </b>
                        <small>{t("Estimated 1RM")}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <Empty
                  title={t("No new records this month")}
                  detail={t("Your next personal record will appear here.")}
                />
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
