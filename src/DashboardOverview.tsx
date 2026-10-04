import { t } from "./i18n";
import type { AppData } from "./types";
import { activeVolumeGroup } from "./analyticsVolume";
import { dateKey, doneSets, fullDate, number, records, volume } from "./model";
import { InfoButton, DumbbellArt } from "./components";
import { Dumbbell, Trophy, Layers } from "lucide-react";

export function DashboardOverview({
  data,
  message,
}: {
  data: AppData;
  message: string;
}) {
  const today = dateKey();
  const actual = data.sessions.filter((s) => s.date <= today);
  const group = activeVolumeGroup(
    data.sessions,
    data.settings.useABSplit,
    today,
  );
  const sets = actual.reduce((sum, s) => sum + doneSets(s).length, 0);
  const lifting = group.sessions
    .filter((s) => s.date <= today)
    .reduce((sum, s) => sum + volume(s), 0);
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
          <span className="welcome-stat-tag">
            <Layers size={18} />
            <strong>{number(sets)}</strong>
            {t(" completed sets · all time")}
          </span>
          <span className="welcome-stat-tag">
            <Dumbbell size={18} />
            <strong>
              {number(lifting)}
              {t(" kg")}
            </strong>
            <span>{t(group.label)}</span>
            <InfoButton title={t("Training volume")}>
              {t(
                "Checked strength sets in the active training week. Planned sets are excluded.",
              )}
            </InfoButton>
          </span>
          <span className="welcome-stat-tag">
            <Trophy size={18} />
            <strong>{prs}</strong>
            {t(" records this month")}
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
