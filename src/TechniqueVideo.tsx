import { useEffect, useId, useState } from "react";
import { Play, ChevronDown, ExternalLink, Save, Trash2 } from "lucide-react";
import { driveVideoLink } from "./technique";

export function TechniqueVideo({ name, url }: { name: string; url?: string }) {
  const [open, setOpen] = useState(false);
  const playerId = useId();
  useEffect(() => setOpen(false), [url]);
  if (!url) return null;
  let video: ReturnType<typeof driveVideoLink>;
  try {
    video = driveVideoLink(url);
  } catch {
    return null;
  }
  return (
    <div className="technique-video">
      <button
        type="button"
        className="technique-toggle"
        aria-label={`Watch technique for ${name}`}
        aria-expanded={open}
        aria-controls={playerId}
        onClick={() => setOpen(!open)}
      >
        <Play size={17} /> {open ? "Hide technique" : "Watch technique"}{" "}
        <ChevronDown size={17} className={open ? "rotated" : ""} />
      </button>
      {open && (
        <div id={playerId} className="technique-content">
          <div className="technique-player">
            <iframe
              src={video.embedUrl}
              title={`${name} technique video`}
              allow="fullscreen; picture-in-picture"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <a
            className="text-button"
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} /> Open in Google Drive
          </a>
          <p className="footnote">
            If playback is unavailable, open the video in Drive. Your coach may
            need to update sharing access.
          </p>
        </div>
      )}
    </div>
  );
}

export function TechniqueVideoEditor({
  name,
  url = "",
  ready,
  onSave,
}: {
  name: string;
  url?: string;
  ready: boolean;
  onSave: (url: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(url);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setDraft(url);
  }, [url]);
  const save = async (value: string) => {
    setBusy(true);
    setFailed(false);
    setFeedback("");
    try {
      const canonical = value.trim() ? driveVideoLink(value).url : "";
      await onSave(canonical);
      setDraft(canonical);
      setFeedback(
        canonical ? "Technique video saved." : "Technique video removed.",
      );
    } catch (error) {
      setFailed(true);
      setFeedback(
        error instanceof Error ? error.message : "Could not save the video.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="technique-editor">
      <label>
        Technique video (Google Drive)
        <input
          aria-label={`Technique video link for ${name}`}
          type="url"
          inputMode="url"
          maxLength={2000}
          placeholder="Paste your Google Drive video link…"
          value={draft}
          disabled={!ready || busy}
          onChange={(event) => {
            setDraft(event.target.value);
            setFeedback("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (ready && !busy) void save(draft);
            }
          }}
        />
      </label>
      <p className="footnote">
        Upload your demonstration to Drive and give your athlete access. “Anyone
        with the link → Viewer” lets anyone holding the link view it. This link
        is reused for this exercise across their workouts.
      </p>
      <div className="flex wrap">
        <button
          type="button"
          className="button secondary"
          disabled={!ready || busy}
          onClick={() => void save(draft)}
        >
          <Save size={16} /> {busy ? "Saving…" : "Save video"}
        </button>
        {url && (
          <button
            type="button"
            className="text-button danger-text"
            disabled={!ready || busy}
            onClick={() => void save("")}
          >
            <Trash2 size={16} /> Remove video
          </button>
        )}
      </div>
      {!ready && (
        <p className="muted">
          Technique videos will be available after the account update.
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
    </div>
  );
}
