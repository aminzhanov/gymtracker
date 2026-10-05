import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardStats } from "../src/dashboardStats.ts";
import { emptyData, newSession, newExercise, records } from "../src/model.ts";
import { completedVolume30 } from "../src/analyticsVolume.ts";
function log(date: string, weight: number, reps = 5, done = true) {
  const s = newSession(emptyData(), date);
  s.exercises = [newExercise("default-0", "Bench Press")];
  s.exercises[0].sets = [{ id: crypto.randomUUID(), weight, reps, done }];
  return s;
}
test("Dashboard detail lists reconcile to 30-day volume and monthly record events without using all-time best prescriptions", () => {
  const sessions = [
    log("2026-08-01", 50),
    log("2026-09-05", 60),
    log("2026-09-06", 70),
    log("2026-10-01", 80),
    log("2026-10-03", 90),
    log("2026-10-04", 85),
    log("2026-10-04", 500, 5, false),
    log("2026-10-06", 1000),
  ];
  const before = structuredClone(sessions),
    stats = dashboardStats(sessions, "2026-10-05");
  assert.equal(stats.recordEvents.length, 2);
  assert.deepEqual(
    stats.recordEvents.map((e) => e.weight),
    [90, 80],
  );
  assert.deepEqual(
    stats.recordEvents.map((e) => e.reps),
    [5, 5],
  );
  assert.ok(stats.recordEvents.every((e) => e.session.id === e.sessionId));
  assert.equal(stats.lifting, completedVolume30(sessions, "2026-10-05"));
  assert.equal(stats.volumeSessions.length, 4);
  assert.equal(stats.volumeSessions[0].date, "2026-10-04");
  assert.equal(
    stats.recordEvents.length,
    records(sessions.filter((s) => s.date <= "2026-10-05")).events.filter((e) =>
      e.date.startsWith("2026-10"),
    ).length,
  );
  assert.deepEqual(sessions, before);
});
test("Breakdowns preserve first records and multiple improvements for one exercise and handle empty stats", () => {
  const sessions = [
    log("2026-10-01", 50),
    log("2026-10-01", 50),
    log("2026-10-02", 55),
  ];
  const stats = dashboardStats(sessions, "2026-10-05");
  assert.equal(stats.recordEvents.length, 2);
  assert.equal(stats.recordEvents[0].weight, 55);
  assert.equal(stats.recordEvents[1].weight, 50);
  const empty = dashboardStats([], "2026-10-05");
  assert.equal(empty.lifting, 0);
  assert.equal(empty.recordEvents.length, 0);
  assert.equal(empty.trend.value, null);
});
