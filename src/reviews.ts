import type { Profile, Session, AppData } from "./types.ts";
export interface ReviewItem {
  ownerId: string;
  athleteName: string;
  session: Session;
  version: number;
  completedAt: string;
  updatedAt: string;
  reviewed: boolean;
  reviewedAt: string | null;
  useABSplit: boolean;
}
type StorageLike = Pick<Storage, "getItem" | "setItem">;
type Event = {
  version: number;
  notifiable: boolean;
  snapshot: Session;
  completedAt: string | null;
  updatedAt: string;
};
type Events = Record<string, Record<string, Event>>;
type Receipt = { version: number; at: string };
const eventKey = "liftlog-review-events-v1";
function read<T>(storage: StorageLike, key: string, fallback: T): T {
  try {
    const value = JSON.parse(storage.getItem(key) ?? "null");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : fallback;
  } catch {
    return fallback;
  }
}
export function reviewSnapshot(s: Session): Session {
  return {
    id: s.id,
    date: s.date,
    name: s.name,
    icon: s.icon,
    week: s.week,
    trainingWeek: s.trainingWeek ?? null,
    status: s.status,
    difficulty: s.difficulty,
    notes: s.notes,
    exercises: s.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      name: e.name,
      kind: e.kind,
      duration: e.duration,
      notes: e.notes,
      done: s.status === "done" && e.kind === "strength" ? true : e.done,
      sets: e.sets.map((z) => ({
        id: z.id,
        weight: z.weight,
        reps: z.reps,
        done: s.status === "done" && e.kind === "strength" ? true : z.done,
      })),
    })),
  };
}
export function syncLocalReviewEvents(
  storage: StorageLike,
  owner: string,
  sessions: Session[],
  baseline = false,
  now = new Date().toISOString(),
) {
  const events = read<Events>(storage, eventKey, {}),
    previous = events[owner] ?? {},
    next: Record<string, Event> = {};
  for (const session of sessions) {
    const snapshot = reviewSnapshot(session),
      old = previous[session.id],
      done = snapshot.status === "done";
    if (!old)
      next[session.id] = {
        version: done && !baseline ? 1 : 0,
        notifiable: done && !baseline,
        snapshot,
        completedAt: done && !baseline ? now : null,
        updatedAt: now,
      };
    else if (baseline) next[session.id] = old;
    else if (
      done &&
      (old.snapshot.status !== "done" ||
        (old.notifiable &&
          JSON.stringify(old.snapshot) !== JSON.stringify(snapshot)))
    )
      next[session.id] = {
        version: old.version + 1,
        notifiable: true,
        snapshot,
        completedAt:
          old.snapshot.status === "done" && old.notifiable
            ? old.completedAt
            : now,
        updatedAt: now,
      };
    else
      next[session.id] =
        JSON.stringify(old.snapshot) === JSON.stringify(snapshot)
          ? old
          : { ...old, snapshot, updatedAt: now };
  }
  events[owner] = next;
  storage.setItem(eventKey, JSON.stringify(events));
}
export function capReviewed(items: ReviewItem[]): ReviewItem[] {
  const count = new Map<string, number>();
  return [...items]
    .sort(
      (a, b) =>
        (b.reviewedAt ?? b.updatedAt).localeCompare(
          a.reviewedAt ?? a.updatedAt,
        ) || a.session.id.localeCompare(b.session.id),
    )
    .filter((item) => {
      if (!item.reviewed) return true;
      const n = count.get(item.ownerId) ?? 0;
      count.set(item.ownerId, n + 1);
      return n < 3;
    });
}
export function localReviewInbox(
  storage: StorageLike,
  coach: string,
  profiles: Profile[],
  getData: (owner: string, name: string) => AppData,
): ReviewItem[] {
  const receipts = read<Record<string, Record<string, Receipt>>>(
      storage,
      `liftlog-reviewed-v1:${coach}`,
      {},
    ),
    items: ReviewItem[] = [];
  for (const profile of profiles.filter(
    (p) => p.role === "athlete" && p.id !== coach,
  )) {
    const data = getData(profile.id, profile.name),
      before = read<Events>(storage, eventKey, {});
    syncLocalReviewEvents(
      storage,
      profile.id,
      data.sessions,
      before[profile.id] === undefined,
    );
    const events = read<Events>(storage, eventKey, {});
    for (const event of Object.values(events[profile.id] ?? {}))
      if (event.notifiable && event.snapshot.status === "done") {
        const receipt = receipts[profile.id]?.[event.snapshot.id];
        items.push({
          ownerId: profile.id,
          athleteName: profile.name,
          session: event.snapshot,
          version: event.version,
          completedAt: event.completedAt!,
          updatedAt: event.updatedAt,
          reviewed: receipt?.version === event.version,
          reviewedAt: receipt?.at ?? null,
          useABSplit: data.settings.useABSplit,
        });
      }
  }
  return capReviewed(items);
}
export function setLocalReview(
  storage: StorageLike,
  coach: string,
  item: ReviewItem,
  reviewed: boolean,
  now = new Date().toISOString(),
) {
  const events = read<Events>(storage, eventKey, {}),
    event = events[item.ownerId]?.[item.session.id];
  if (!event?.notifiable || event.snapshot.status !== "done")
    throw new Error("This workout is no longer in the inbox");
  if (event.version !== item.version)
    throw new Error("Workout changed. Refresh the inbox before reviewing.");
  const key = `liftlog-reviewed-v1:${coach}`,
    receipts = read<Record<string, Record<string, Receipt>>>(storage, key, {});
  receipts[item.ownerId] ??= {};
  if (reviewed)
    receipts[item.ownerId][item.session.id] = {
      version: item.version,
      at: now,
    };
  else delete receipts[item.ownerId][item.session.id];
  storage.setItem(key, JSON.stringify(receipts));
}
