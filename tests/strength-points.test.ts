import { test } from "node:test";
import assert from "node:assert/strict";
import {
  strengthPointDetails,
  strengthTrendHistory,
} from "../src/analyticsVolume.ts";
import { emptyData, newSession, newExercise } from "../src/model.ts";
function log(date: string, id: string, weight: number, reps = 5, done = true) {
  const s = newSession(emptyData(), date);
  s.exercises = [newExercise(id, id)];
  s.exercises[0].sets = [{ id: crypto.randomUUID(), weight, reps, done }];
  return s;
}
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test("Point attribution reconciles simultaneous performance changes and new-contributor dilution", () => {
  const sessions = [
    log("2026-09-06", "a", 100),
    log("2026-09-10", "a", 120),
    log("2026-09-15", "a", 110),
    log("2026-09-15", "b", 10),
    log("2026-10-05", "b", 12),
  ];
  const before = structuredClone(sessions),
    detail = strengthPointDetails(sessions, "30", "2026-09-15", "2026-10-05")!;
  close(detail.previousValue!, 20);
  close(detail.value, 5);
  close(detail.delta!, -15);
  close(
    detail.details.reduce((n, r) => n + r.effect, 0),
    detail.delta!,
  );
  close(detail.details.find((r) => r.id === "a")!.effect, -5);
  close(detail.details.find((r) => r.id === "b")!.effect, -10);
  assert.equal(detail.details[0].id, "b");
  assert.equal(detail.details[0].joined, true);
  assert.equal(detail.details[0].prior, null);
  const a = detail.details.find((r) => r.id === "a")!;
  assert.equal(a.prior!.weight, 120);
  assert.equal(a.current.weight, 110);
  assert.equal(a.current.sessionId, sessions[2].id);
  for (const row of strengthTrendHistory(sessions, "30", "2026-10-05").rows) {
    const d = strengthPointDetails(sessions, "30", row.date, "2026-10-05")!;
    close(d.value, row.value);
    if (d.delta !== null)
      close(
        d.details.reduce((n, r) => n + r.effect, 0),
        d.delta,
      );
  }
  const last = strengthPointDetails(
    sessions,
    "30",
    "2026-10-05",
    "2026-10-05",
  )!;
  assert.equal(last.affected.length, 1);
  assert.equal(last.affected[0].id, "b");
  assert.equal(last.details.find((r) => r.id === "a")!.updated, false);
  assert.deepEqual(sessions, before);
});
test("New exercises can raise a negative average without improved logs; first point has no comparison", () => {
  const sessions = [
    log("2026-09-06", "a", 100),
    log("2026-09-10", "a", 80),
    log("2026-09-15", "b", 10),
    log("2026-10-05", "b", 10),
  ];
  const d = strengthPointDetails(sessions, "30", "2026-09-15", "2026-10-05")!;
  close(d.value, -10);
  close(d.delta!, 10);
  close(d.affected[0].effect, 10);
  assert.equal(d.affected[0].joined, true);
  const first = strengthPointDetails(
    sessions,
    "30",
    "2026-09-06",
    "2026-10-05",
  )!;
  const zeroJoin = strengthPointDetails(
    [
      log("2026-09-06", "a", 10),
      log("2026-09-10", "a", 10),
      log("2026-09-15", "b", 20),
      log("2026-10-05", "b", 20),
    ],
    "30",
    "2026-09-15",
    "2026-10-05",
  )!;
  assert.ok(zeroJoin.details.every((row) => !Object.is(row.effect, -0)));
  assert.equal(first.delta, null);
  assert.equal(first.previousDate, null);
  assert.ok(first.details.every((row) => !Object.is(row.effect, -0)));
  close(first.value, 0);
  assert.equal(
    strengthPointDetails(sessions, "30", "2026-09-17", "2026-10-05"),
    null,
  );
});
test("Explanations use the daily best checked positive set and the baseline of the selected range", () => {
  const sessions = [
    log("2026-08-01", "a", 50),
    log("2026-09-06", "a", 100),
    log("2026-10-05", "a", 110),
    log("2026-10-05", "a", 120, 5),
    log("2026-10-05", "a", 500, 5, false),
    log("2026-10-06", "a", 900),
    log("2026-10-05", "single", 10),
    log("2026-09-06", "zero", 0),
    log("2026-10-05", "zero", 20),
  ];
  const d = strengthPointDetails(sessions, "30", "2026-10-05", "2026-10-05")!;
  assert.equal(d.details.length, 1);
  assert.equal(d.details[0].current.weight, 120);
  assert.equal(d.details[0].current.sessionId, sessions[3].id);
  close(d.value, 20);
  const all = strengthPointDetails(
    sessions,
    "all",
    "2026-10-05",
    "2026-10-05",
  )!;
  close(all.value, 140);
  close(all.delta!, 40);
  const unchanged = strengthPointDetails(
    [log("2026-09-06", "a", 10), log("2026-10-05", "a", 10)],
    "all",
    "2026-10-05",
    "2026-10-05",
  )!;
  assert.equal(unchanged.affected.length, 0);
  assert.equal(unchanged.details.length, 1);
});
