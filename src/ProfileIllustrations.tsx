import { useState, type CSSProperties } from "react";
import { Save, Plus } from "lucide-react";
import { t } from "./i18n";
import type { ProfileIllustrations, CoachMessages, AppData } from "./types";
import {
  IllustratedPageHead,
  TodayEmpty,
  InboxEmpty,
} from "./SectionIllustrations";
import { Panel } from "./components";
import type { IllustrationSlot } from "./illustrations";
import { DashboardIllustrationPreview } from "./DashboardIllustrationPreview";
import {
  DEFAULT_ILLUSTRATIONS,
  illustrationVariables,
  prepareIllustration,
  validateIllustrations,
} from "./illustrations";
import catBack from "./assets/cat-back.webp";

export function IllustrationEditor({
  value,
  ready,
  sectionsReady,
  messages,
  data,
  onSave,
}: {
  value: ProfileIllustrations;
  ready: boolean;
  sectionsReady: boolean;
  messages: CoachMessages;
  data: AppData;
  onSave: (value: ProfileIllustrations) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [target, setTarget] = useState<IllustrationSlot>("dashboard");
  const [mode, setMode] = useState<"desktop" | "phone">("desktop");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const item = draft[target];
  const device = target === "menu" ? "desktop" : mode;
  const setPlacement = (field: "scale" | "x" | "y", n: number) => {
    setDraft((old) => ({
      ...old,
      [target]: {
        ...old[target],
        [device]: { ...old[target][device], [field]: n },
      },
    }));
    setFeedback("");
  };
  return (
    <form
      className="illustration-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setFeedback("");
        setFailed(false);
        try {
          await onSave(validateIllustrations(draft));
          setFeedback(t("Illustrations saved."));
        } catch (error) {
          setFailed(true);
          setFeedback(
            error instanceof Error
              ? error.message
              : t("Could not save illustrations."),
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{t("Illustrations")}</h3>
      <p className="muted">
        {t("Customize images for this profile. Transparent images work best.")}
      </p>
      <fieldset className="message-fields" disabled={!ready || busy}>
        <div className="illustration-controls">
          <label>
            {t("Placement")}
            <select
              value={target}
              onChange={(e) => {
                setTarget(e.target.value as typeof target);
                setFeedback("");
              }}
            >
              <option value="dashboard">{t("Dashboard")}</option>
              <option value="menu">{t("Menu message")}</option>
              <option value="planner" disabled={!sectionsReady}>
                {t("Planner header")}
              </option>
              <option value="analytics" disabled={!sectionsReady}>
                {t("Analytics header")}
              </option>
              <option value="inboxEmpty" disabled={!sectionsReady}>
                {t("Unread inbox · empty")}
              </option>
              <option value="todayEmpty" disabled={!sectionsReady}>
                {t("Today's workout · empty")}
              </option>
            </select>
          </label>
          {target !== "menu" && (
            <label>
              {t("Layout")}
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="desktop">{t("Desktop")}</option>
                <option value="phone">{t("Phone")}</option>
              </select>
            </label>
          )}
          <label>
            {t("Upload image")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (!file) return;
                const slot = target;
                setBusy(true);
                setFeedback("");
                setFailed(false);
                try {
                  const image = await prepareIllustration(file);
                  setDraft((old) => ({
                    ...old,
                    [slot]: { ...old[slot], image },
                  }));
                } catch (error) {
                  setFailed(true);
                  setFeedback(
                    error instanceof Error
                      ? error.message
                      : t("Could not read this image."),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        </div>
        <div className="illustration-preview-wrap">
          {target !== "menu" ? (
            <DashboardIllustrationPreview
              key={target}
              data={data}
              message={messages.dashboard}
              illustration={item}
              mode={mode}
              title={
                target === "dashboard"
                  ? "Dashboard"
                  : target === "planner"
                    ? "Planner header"
                    : target === "analytics"
                      ? "Analytics header"
                      : target === "inboxEmpty"
                        ? "Unread inbox · empty"
                        : "Today's workout · empty"
              }
              selector={
                target === "dashboard"
                  ? ".dashboard-welcome"
                  : target === "planner" || target === "analytics"
                    ? ".illustrated-page-head"
                    : ".illustration-preview-panel"
              }
            >
              {target === "planner" ? (
                <IllustratedPageHead
                  kind="planner"
                  illustration={item}
                  action={
                    <button className="button primary">
                      <Plus size={17} />
                      {t(" Add session")}
                    </button>
                  }
                />
              ) : target === "analytics" ? (
                <IllustratedPageHead
                  kind="analytics"
                  illustration={item}
                  action={
                    data.settings.useABSplit ? (
                      <select aria-label={t("Analytics week filter")}>
                        <option>{t("All weeks")}</option>
                      </select>
                    ) : undefined
                  }
                />
              ) : target === "inboxEmpty" ? (
                <section className="panel illustration-preview-panel">
                  <InboxEmpty illustration={item} />
                </section>
              ) : target === "todayEmpty" ? (
                <div className="dashboard-grid">
                  <Panel
                    title={t("Today's workout")}
                    className="today-panel illustration-preview-panel"
                    action={
                      <button className="text-button">
                        <Plus size={16} />
                        {t(" Plan")}
                      </button>
                    }
                  >
                    <TodayEmpty illustration={item} onPlan={() => {}} />
                  </Panel>
                </div>
              ) : undefined}
            </DashboardIllustrationPreview>
          ) : (
            <div className="illustration-menu-preview">
              <div className="sidebar-cheer-scene">
                <img
                  className="sidebar-cat"
                  src={item.image || catBack}
                  style={illustrationVariables(item) as CSSProperties}
                  alt=""
                  draggable={false}
                />
                <div className="sidebar-cheer">
                  <strong className="personal-message">
                    {messages.sidebar}
                  </strong>
                  <small>{t("One rep at a time.")}</small>
                </div>
              </div>
            </div>
          )}
        </div>
        {target !== "dashboard" && target !== "menu" && (
          <label className="illustration-visible">
            <input
              type="checkbox"
              checked={item.enabled !== false}
              onChange={(e) => {
                setDraft((old) => ({
                  ...old,
                  [target]: { ...old[target], enabled: e.target.checked },
                }));
                setFeedback("");
              }}
            />
            {t("Show illustration")}
          </label>
        )}
        <div className="illustration-controls">
          {(
            [
              ["scale", "Image size", 60, 150, "%"],
              ["x", "Left / right", -100, 100, "px"],
              ["y", "Up / down", -100, 100, "px"],
            ] as const
          ).map(([field, label, min, max, unit]) => (
            <label key={field}>
              {t(label)}
              <span className="illustration-range">
                <input
                  type="range"
                  aria-label={t(label)}
                  min={min}
                  max={max}
                  value={item[device][field]}
                  onChange={(e) => setPlacement(field, Number(e.target.value))}
                />
                <output>
                  {item[device][field]}
                  {unit}
                </output>
              </span>
            </label>
          ))}
        </div>
        <p className="footnote">
          {t(
            "Move right or down with positive values. Phone placement is saved separately.",
          )}
        </p>
        <div className="flex wrap">
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setDraft((old) => ({
                ...old,
                [target]: DEFAULT_ILLUSTRATIONS[target],
              }));
              setFeedback("");
            }}
          >
            {t("Reset illustration")}
          </button>
          <button type="submit" className="button primary">
            <Save size={17} />
            {t(busy ? "Saving…" : "Save illustrations")}
          </button>
        </div>
      </fieldset>
      {!ready && (
        <p className="muted">
          {t(
            "Illustration controls will be available after the account update.",
          )}
        </p>
      )}
      {ready && !sectionsReady && (
        <p className="notice">
          {t(
            "New placements need the illustration sections account update (012).",
          )}
        </p>
      )}
      {feedback && (
        <p
          className={failed ? "danger-text" : "positive"}
          role={failed ? "alert" : "status"}
        >
          {feedback}
        </p>
      )}
    </form>
  );
}
