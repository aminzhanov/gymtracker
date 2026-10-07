import type { CSSProperties, ReactNode } from "react";
import { Plus } from "lucide-react";
import { Empty } from "./components";
import { t } from "./i18n";
import { illustrationVariables } from "./illustrations";
import type { ProfileIllustration } from "./types";
import catFace from "./assets/cat-face.webp";
import catBack from "./assets/cat-back.webp";

export function SectionArt({
  illustration,
  back = false,
}: {
  illustration: ProfileIllustration;
  back?: boolean;
}) {
  if (illustration.enabled === false) return null;
  return (
    <div className="section-art" aria-hidden="true">
      <img
        src={illustration.image || (back ? catBack : catFace)}
        style={illustrationVariables(illustration) as CSSProperties}
        alt=""
        draggable={false}
        width={512}
        height={512}
      />
    </div>
  );
}

// Shared with Settings previews so controls use the same wrapping and crop.
export function IllustratedPageHead({
  kind,
  illustration,
  action,
}: {
  kind: "planner" | "analytics";
  illustration: ProfileIllustration;
  action?: ReactNode;
}) {
  return (
    <div
      className={`page-head illustrated-page-head ${illustration.enabled === false ? "without-art" : ""}`}
    >
      <div className="head-copy">
        <span className="eyebrow">
          {t(
            kind === "planner"
              ? "PLAN. TRAIN. PROGRESS."
              : "THE BIGGER PICTURE",
          )}
        </span>
        <h1>
          {t(
            kind === "planner" ? "Your planner " : "Small steps. Stronger you ",
          )}
          <span>↗</span>
        </h1>
        <p>
          {t(
            kind === "planner"
              ? "Make a little space for getting stronger."
              : "Your progress, from every rep to every week.",
          )}
        </p>
      </div>
      <SectionArt illustration={illustration} back={kind === "planner"} />
      {action && <div className="head-action">{action}</div>}
    </div>
  );
}

export function TodayEmpty({
  illustration,
  onPlan,
}: {
  illustration: ProfileIllustration;
  onPlan: () => void;
}) {
  return (
    <div className="personalized-empty">
      <Empty
        title={t("A fresh page for today")}
        detail={t("Plan a session, or enjoy your recovery day.")}
        visual={
          illustration.enabled === false ? undefined : (
            <SectionArt illustration={illustration} />
          )
        }
        action={
          <button className="button primary" onClick={onPlan}>
            <Plus size={16} />
            {t(" Plan today's session")}
          </button>
        }
      />
    </div>
  );
}

export function InboxEmpty({
  illustration,
}: {
  illustration: ProfileIllustration;
}) {
  return (
    <div className="personalized-empty">
      <Empty
        title={t("All caught up")}
        detail={t(
          "New completions will appear here. Existing workout history stays in Training.",
        )}
        visual={
          illustration.enabled === false ? undefined : (
            <SectionArt illustration={illustration} back />
          )
        }
      />
    </div>
  );
}
