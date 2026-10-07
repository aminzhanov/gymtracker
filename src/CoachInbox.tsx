import { InboxEmpty } from "./SectionIllustrations";
import type { ProfileIllustration } from "./types";
import { useRef, useState } from "react";
import {
  Inbox,
  CheckCheck,
  RefreshCw,
  StickyNote,
  ChevronDown,
  Undo2,
} from "lucide-react";
import { t, appLocale, exerciseName } from "./i18n";
import { Modal, Empty, WeekBadge } from "./components";
import {
  fullDate,
  shortDate,
  number,
  volume,
  doneSets,
  exerciseSummary,
} from "./model";
import type { ReviewItem } from "./reviews";
export function CoachInbox({
  items,
  illustration,
  ready,
  loading,
  error,
  onRefresh,
  onSetReview,
}: {
  items: ReviewItem[];
  illustration: ProfileIllustration;
  ready: boolean;
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
  onSetReview: (item: ReviewItem, reviewed: boolean) => Promise<void>;
}) {
  const [tab, setTab] = useState<"unread" | "reviewed">("unread"),
    [athlete, setAthlete] = useState("all");
  const [selected, setSelected] = useState<ReviewItem | null>(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const [openedExercises, setOpenedExercises] = useState<Set<string>>(
    new Set(),
  );
  const request = useRef(0);
  const unread = items.filter((item) => !item.reviewed).length;
  const athletes = [
    ...new Map(items.map((item) => [item.ownerId, item.athleteName])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], appLocale()));
  const visible = items
    .filter(
      (item) =>
        item.reviewed === (tab === "reviewed") &&
        (athlete === "all" || item.ownerId === athlete),
    )
    .sort((a, b) =>
      (tab === "reviewed"
        ? (b.reviewedAt ?? b.updatedAt)
        : b.updatedAt
      ).localeCompare(
        tab === "reviewed" ? (a.reviewedAt ?? a.updatedAt) : a.updatedAt,
      ),
    );
  const close = () => {
    request.current++;
    setSelected(null);
    setBusy(false);
    setActionError("");
  };
  const open = async (item: ReviewItem) => {
    const token = ++request.current;
    setSelected(item);
    setOpenedExercises(new Set());
    setActionError("");
    setBusy(!item.reviewed);
    if (item.reviewed) return;
    try {
      await onSetReview(item, true);
      if (token === request.current) setSelected({ ...item, reviewed: true });
    } catch (e) {
      if (token === request.current) setActionError((e as Error).message);
    } finally {
      if (token === request.current) setBusy(false);
    }
  };
  const markUnread = async () => {
    if (!selected) return;
    const token = ++request.current;
    setBusy(true);
    setActionError("");
    try {
      await onSetReview(selected, false);
      if (token === request.current) {
        setTab("unread");
        close();
      }
    } catch (e) {
      if (token === request.current) setActionError((e as Error).message);
    } finally {
      if (token === request.current) setBusy(false);
    }
  };
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("COACH CHECK-IN")}</span>
          <h1>{t("Workout inbox")}</h1>
          <p>{t("New completed workouts and later changes appear here.")}</p>
        </div>
        <button
          className="button secondary"
          disabled={loading}
          onClick={() => void onRefresh()}
        >
          <RefreshCw size={16} />
          {t("Refresh")}
        </button>
      </div>
      {!ready && !loading && (
        <p className="notice">
          {t(
            "Coach inbox needs an account update before notifications can appear.",
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="notice">
          {t(error)}
        </p>
      )}
      <div className="inbox-toolbar">
        <div className="segmented" aria-label={t("Inbox tabs")}>
          <button
            aria-pressed={tab === "unread"}
            className={tab === "unread" ? "active" : ""}
            onClick={() => setTab("unread")}
          >
            {t("Unread")} <span>{unread}</span>
          </button>
          <button
            aria-pressed={tab === "reviewed"}
            className={tab === "reviewed" ? "active" : ""}
            onClick={() => setTab("reviewed")}
          >
            {t("Reviewed")}
          </button>
        </div>
        <select
          aria-label={t("Inbox athlete filter")}
          value={athlete}
          onChange={(e) => setAthlete(e.target.value)}
        >
          <option value="all">{t("All athletes")}</option>
          {athletes.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {tab === "reviewed" && (
        <p className="footnote">
          {t(
            "The latest three reviewed workouts per athlete are shown here. Older review status is kept.",
          )}
        </p>
      )}
      {visible.length ? (
        <div className="inbox-list">
          {visible.map((item) => (
            <button
              className={`inbox-card ${item.reviewed ? "reviewed" : ""}`}
              key={`${item.ownerId}:${item.session.id}`}
              onClick={() => void open(item)}
            >
              <span className="session-icon tint-blue">
                {item.session.icon}
              </span>
              <span className="inbox-card-copy">
                <strong>
                  {item.athleteName} · {item.session.name}
                </strong>
                <span>
                  {shortDate(item.session.date)} ·{" "}
                  {number(volume(item.session))} {t("kg")}
                </span>
                {(item.session.notes.trim() ||
                  item.session.exercises.some((e) => e.notes.trim())) && (
                  <span className="inbox-notes-indicator">
                    <StickyNote size={14} />
                    {t("Notes left")}
                  </span>
                )}
              </span>
              {item.useABSplit && <WeekBadge week={item.session.week} />}
              <span
                className={`badge ${item.reviewed ? "tint-mint" : "tint-blue"}`}
              >
                {item.reviewed
                  ? t("Reviewed")
                  : item.updatedAt !== item.completedAt
                    ? t("Updated")
                    : t("New")}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <section className="panel">
          {ready && !loading && !error && tab === "unread" && unread === 0 ? (
            <InboxEmpty illustration={illustration} />
          ) : (
            <Empty
              title={
                loading
                  ? t("Loading inbox…")
                  : tab === "unread"
                    ? t("All caught up")
                    : t("No reviewed workouts yet")
              }
              detail={
                tab === "unread"
                  ? t(
                      "New completions will appear here. Existing workout history stays in Training.",
                    )
                  : t(
                      "Open an unread workout to review its exercises and notes.",
                    )
              }
              action={<Inbox size={28} aria-hidden="true" />}
            />
          )}
        </section>
      )}
      {selected && (
        <Modal
          wide
          title={`${selected.athleteName} · ${selected.session.name}`}
          onClose={close}
        >
          <div className="inbox-session-header">
            <span>{fullDate(selected.session.date)}</span>
            {selected.useABSplit && <WeekBadge week={selected.session.week} />}
            <span
              className={`badge ${selected.reviewed ? "tint-mint" : "tint-blue"}`}
            >
              {busy
                ? t("Saving review…")
                : selected.reviewed
                  ? t("Reviewed")
                  : t("Unread")}
            </span>
          </div>
          {actionError && (
            <p role="alert" className="notice">
              {t(actionError)}
            </p>
          )}
          <div className="inbox-session-summary">
            <span>
              {doneSets(selected.session).length} {t("completed sets")}
            </span>
            <span>
              {number(volume(selected.session))} {t("kg")}
            </span>
          </div>
          {selected.session.notes.trim() && (
            <div className="inbox-note">
              <strong>{t("Session notes")}</strong>
              <p>{selected.session.notes}</p>
            </div>
          )}
          <div className="inbox-exercises">
            {selected.session.exercises.map((e) => (
              <section className="inbox-exercise" key={e.id}>
                <button
                  className="inbox-exercise-toggle"
                  aria-expanded={openedExercises.has(e.id)}
                  onClick={() =>
                    setOpenedExercises((old) => {
                      const next = new Set(old);
                      if (next.has(e.id)) next.delete(e.id);
                      else next.add(e.id);
                      return next;
                    })
                  }
                >
                  <span>
                    <strong>{exerciseName(e.name, e.exerciseId)}</strong>
                    <small>{exerciseSummary(e)}</small>
                  </span>
                  <ChevronDown size={18} />
                </button>
                {e.notes.trim() && (
                  <p className="inbox-exercise-note">
                    <StickyNote size={15} />
                    <span>{e.notes}</span>
                  </p>
                )}
                {openedExercises.has(e.id) && (
                  <div className="inbox-exercise-detail">
                    {e.kind === "strength" ? (
                      e.sets.map((set, i) => (
                        <div key={set.id}>
                          <span>
                            {t("Set")} {i + 1}
                          </span>
                          <strong>
                            {number(set.weight, 1)} {t("kg")} × {set.reps}{" "}
                            {t("Reps").toLowerCase()}
                          </strong>
                          <span>{set.done ? t("Done") : t("Not done")}</span>
                        </div>
                      ))
                    ) : (
                      <p>
                        {number(e.duration)} {t("min")} ·{" "}
                        {e.done ? t("Done") : t("Not done")}
                      </p>
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
          <div className="inbox-review-actions">
            {selected.reviewed && !busy && (
              <button
                className="button secondary"
                onClick={() => void markUnread()}
              >
                <Undo2 size={16} />
                {t("Mark unread")}
              </button>
            )}
            <button className="button primary" onClick={close}>
              <CheckCheck size={17} />
              {t("Close")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
