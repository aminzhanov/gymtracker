import type { AppData } from "./types";
import { activeVolumeGroup } from "./analyticsVolume";
import { dateKey, doneSets, fullDate, number, records, volume } from "./model";
import { InfoButton } from "./components";
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
    <section className="dashboard-overview">
      <div className="overview-greeting">
        <div>
          <span className="eyebrow">LET'S MAKE TODAY A GOOD ONE</span>
          <h1>
            Hey {data.settings.name} <span>💪</span>
          </h1>
          <p className="personal-message">{message}</p>
        </div>
        <span className="overview-date">{fullDate(today)}</span>
      </div>
      <div className="overview-stats">
        <div className="overview-stat tint-pink">
          <Layers size={21} />
          <span>Completed sets total</span>
          <strong>{number(sets)}</strong>
          <small>All time</small>
        </div>
        <div className="overview-stat tint-blue">
          <Dumbbell size={21} />
          <span>
            Training volume{" "}
            <InfoButton title="Training volume">
              Checked strength sets in your active assigned training week, or
              the current Monday–Sunday week when A/B is off. Weight × reps;
              planned sets are excluded.
            </InfoButton>
          </span>
          <strong>
            {number(lifting)}
            <small> kg</small>
          </strong>
          <small>{group.label}</small>
        </div>
        <div className="overview-stat tint-yellow">
          <Trophy size={21} />
          <span>
            Records this month{" "}
            <InfoButton title="Records this month">
              New estimated 1RM records achieved this month from checked
              strength sets.
            </InfoButton>
          </span>
          <strong>{prs}</strong>
          <small>
            {new Date().toLocaleDateString(undefined, { month: "long" })}
          </small>
        </div>
      </div>
    </section>
  );
}
