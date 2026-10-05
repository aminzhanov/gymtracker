import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyData, newSession, newExercise } from "../src/model.ts";
import {
  strengthTrendHistory,
  strengthTrend,
  completedVolume30,
} from "../src/analyticsVolume.ts";
import {
  syncLocalReviewEvents,
  localReviewInbox,
  setLocalReview,
  capReviewed,
} from "../src/reviews.ts";
import type { Profile } from "../src/types.ts";
function log(date: string, id: string, weight: number, done = true) {
  const s = newSession(emptyData(), date),
    e = newExercise(id, id);
  e.sets = [{ id: crypto.randomUUID(), weight, reps: 5, done }];
  s.exercises = [e];
  return s;
}
test("Combined strength carries prior observations forward and uses fixed per-exercise baselines", () => {
  const sessions = [
    log("2026-08-01", "a", 50),
    log("2026-09-06", "a", 100),
    log("2026-09-10", "b", 10),
    log("2026-09-20", "a", 110),
    log("2026-10-05", "b", 12),
    log("2026-10-06", "a", 999),
    log("2026-10-04", "x", 30),
  ];
  const before = structuredClone(sessions),
    history = strengthTrendHistory(sessions, "30", "2026-10-05");
  assert.deepEqual(
    history.rows.map((x) => [x.date, x.count]),
    [
      ["2026-09-06", 1],
      ["2026-09-10", 2],
      ["2026-09-20", 2],
      ["2026-10-05", 2],
    ],
  );
  assert.ok(Math.abs(history.rows[2].value - 5) < 1e-8);
  assert.ok(Math.abs(history.value! - 15) < 1e-8);
  assert.equal(history.value, strengthTrend(sessions, "2026-10-05").value);
  const all = strengthTrendHistory(sessions, "all", "2026-10-05");
  assert.equal(all.rows[0].value, 0);
  assert.ok(Math.abs(all.value! - 70) < 1e-8);
  assert.equal(all.count, 2);
  assert.deepEqual(sessions, before);
  assert.equal(
    strengthTrendHistory(
      [log("2026-10-04", "x", 0), log("2026-10-05", "x", 20)],
      "all",
      "2026-10-05",
    ).value,
    null,
  );
});
test("30-day completed volume includes both boundaries, partial actuals and excludes plans and future", () => {
  const sessions = [
    log("2026-09-05", "x", 100),
    log("2026-09-06", "x", 10),
    log("2026-10-05", "x", 20),
    log("2026-10-05", "x", 50, false),
    log("2026-10-06", "x", 80),
  ];
  assert.equal(completedVolume30(sessions, "2026-10-05"), 150);
});
test("Demo inbox baselines history, preserves receipts, requeues changes and rejects stale reviews", () => {
  const values = new Map<string, string>(),
    storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
  const profile = { id: "athlete", name: "Friend", role: "athlete" } as Profile,
    data = emptyData();
  const old = log("2026-09-01", "x", 10);
  old.status = "done";
  data.sessions = [old];
  const load = () => localReviewInbox(storage, "coach", [profile], () => data);
  assert.equal(load().length, 0);
  old.notes = "historical edit";
  syncLocalReviewEvents(storage, profile.id, data.sessions);
  assert.equal(load().length, 0);
  const s = log("2026-10-05", "x", 20);
  data.sessions.push(s);
  syncLocalReviewEvents(storage, profile.id, data.sessions);
  assert.equal(load().length, 0);
  s.status = "done";
  syncLocalReviewEvents(
    storage,
    profile.id,
    data.sessions,
    false,
    "2026-10-05T12:00:00Z",
  );
  let item = load()[0];
  assert.equal(item.version, 1);
  assert.equal(item.session.exercises[0].sets[0].done, true);
  setLocalReview(storage, "coach", item, true);
  assert.equal(load()[0].reviewed, true);
  syncLocalReviewEvents(storage, profile.id, data.sessions);
  assert.equal(load()[0].version, 1);
  s.exercises[0].notes = "Knee felt good";
  syncLocalReviewEvents(storage, profile.id, data.sessions);
  assert.equal(load()[0].reviewed, false);
  assert.throws(
    () => setLocalReview(storage, "coach", item, true),
    /Workout changed/,
  );
  item = load()[0];
  setLocalReview(storage, "coach", item, true);
  setLocalReview(storage, "coach", item, false);
  assert.equal(load()[0].reviewed, false);
  s.status = "planned";
  syncLocalReviewEvents(storage, profile.id, data.sessions);
  assert.equal(load().length, 0);
  s.status = "done";
  syncLocalReviewEvents(storage, profile.id, data.sessions);
  assert.equal(load()[0].version, 3);
  const extras = Array.from({ length: 5 }, (_, i) => ({
    ...load()[0],
    session: { ...s, id: `s${i}` },
    reviewed: true,
    reviewedAt: `2026-10-05T12:00:0${i}Z`,
  }));
  const capped = capReviewed([
    ...extras,
    { ...extras[0], ownerId: "other" },
    { ...load()[0], reviewed: false },
  ]);
  assert.equal(
    capped.filter((x) => x.ownerId === "athlete" && x.reviewed).length,
    3,
  );
  assert.equal(capped.length, 5);
  data.sessions = [];
  syncLocalReviewEvents(storage, profile.id, data.sessions);
  assert.equal(load().length, 0);
});
