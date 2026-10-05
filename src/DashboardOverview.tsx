import { t } from "./i18n";
import type { AppData } from "./types";
import {
  strengthTrend,
  completedVolume30,
  STRENGTH_TREND_INFO,
} from "./analyticsVolume";
import { dateKey, fullDate, number, records } from "./model";
import { InfoButton, DumbbellArt } from "./components";
import { Dumbbell, Trophy, TrendingUp } from "lucide-react";

export function DashboardOverview({
  data,
  message,
}: {
  data: AppData;
  message: string;
}) {
  const today = dateKey();
  const actual = data.sessions.filter((s) => s.date <= today);
  const trend = strengthTrend(actual, today);
  const lifting = completedVolume30(actual, today);
  const prs = records(actual).events.filter((e) =>
    e.date.startsWith(today.slice(0, 7)),
  ).length;
  return (
    <section className="welcome dashboard-welcome">
      <div className="welcome-content">
        <span className="eyebrow">{t("LET'S MAKE TODAY A GOOD ONE")}</span>
        <h1>
          {t("Hey ")}
          {data.settings.name} <span>💪</span>
        </h1>
        <p className="personal-message">
          {message === "Ready to move today?" ? t(message) : message}
        </p>
        <span className="welcome-date">{fullDate(today)}</span>
        <div className="welcome-stat-tags">
          <span className="welcome-stat-tag welcome-stat-strength">
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
          </span>
          <span className="welcome-stat-tag welcome-stat-volume">
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
          </span>
          <span className="welcome-stat-tag welcome-stat-records">
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
          </span>
        </div>
      </div>
      <DumbbellArt />
    </section>
  );
}
