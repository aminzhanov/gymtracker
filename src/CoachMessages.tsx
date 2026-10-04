import { t } from "./i18n";
import { useState } from "react";
import { Save } from "lucide-react";
import type { CoachMessages } from "./types";

import { validateMessages } from "./messages";
export function CoachMessageEditor({
  messages,
  ready,
  appNameReady,
  onSave,
}: {
  messages: CoachMessages;
  ready: boolean;
  appNameReady: boolean;
  onSave: (messages: CoachMessages) => Promise<void>;
}) {
  const [draft, setDraft] = useState(messages);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setFeedback("");
        setFailed(false);
        try {
          await onSave(validateMessages(draft));
          setFeedback("Personalization saved.");
        } catch (error) {
          setFailed(true);
          setFeedback(
            error instanceof Error
              ? error.message
              : "Could not save personalization.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset className="message-fields" disabled={!ready || busy}>
        <label>
          {t("App name")}
          <input
            aria-label={t("App name")}
            maxLength={40}
            value={draft.appName}
            disabled={!appNameReady}
            onChange={(event) => {
              setDraft({ ...draft, appName: event.target.value });
              setFeedback("");
            }}
          />
        </label>
        {!appNameReady && ready && (
          <p className="muted">
            {t(
              "Personal app names will be available after the account update.",
            )}
          </p>
        )}
        <label>
          {t("Dashboard message")}
          <textarea
            maxLength={180}
            rows={2}
            value={draft.dashboard}
            onChange={(event) => {
              setDraft({ ...draft, dashboard: event.target.value });
              setFeedback("");
            }}
          />
        </label>
        <label>
          {t("Menu message")}
          <textarea
            maxLength={120}
            rows={3}
            value={draft.sidebar}
            onChange={(event) => {
              setDraft({ ...draft, sidebar: event.target.value });
              setFeedback("");
            }}
          />
        </label>
        <button className="button primary" type="submit">
          <Save size={17} />
          {busy ? t("Saving…") : t("Save personalization")}
        </button>
      </fieldset>
      {!ready && (
        <p className="muted">
          {t("Personal messages will be available after the account update.")}
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
