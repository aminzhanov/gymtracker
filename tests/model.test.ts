import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyData,
  newSession,
  newExercise,
  volume,
  bestMax,
  completeSession,
  records,
  weekComparison,
  bodyweightHistory,
  validateBackup,
  currentWeek,
  volumeHistory,
  cloneExercises,
  recoveryMinutes,
  changePercent,
} from "../src/model.ts";
const fixture = () => {
  const d = emptyData();
  const s = newSession(d, "2026-09-28");
  const e = newExercise("bench", "Bench Press");
  e.sets = [
    { id: "one", weight: 80, reps: 8, done: true },
    { id: "two", weight: 999, reps: 99, done: false },
  ];
  s.exercises = [e];
  return s;
};
test("unfinished sets never contribute to volume, e1RM or records", () => {
  const s = fixture();
  assert.equal(volume(s), 640);
  assert.equal(bestMax(s), 80 * (1 + 8 / 30));
  assert.equal(records([s]).rows[0].heaviest, 80);
});
test("completion uses current values for every remaining set", () => {
  const s = fixture();
  s.exercises[0].sets[1].weight = 82.5;
  s.exercises[0].sets[1].reps = 7;
  const done = completeSession(s);
  assert.equal(done.status, "done");
  assert.equal(volume(done), 640 + 577.5);
  assert.equal(s.status, "planned");
});
test("warmups and cooldowns tracked separately even if they contain weights", () => {
  const s = fixture();
  const e = newExercise("warm", "Warm-up", "warmup");
  e.done = true;
  e.duration = 10;
  e.sets = [{ id: "warm-set", weight: 500, reps: 99, done: true }];
  s.exercises.push(e);
  assert.equal(volume(s), 640);
  assert.equal(recoveryMinutes(s), 10);
  assert.equal(records([s]).rows.length, 1);
});
test("records this month are new record events, not all current exercise records", () => {
  const a = fixture();
  a.date = "2026-08-01";
  const b = structuredClone(a);
  b.id = "new";
  b.date = "2026-09-01";
  const c = structuredClone(b);
  c.id = "third";
  c.date = "2026-09-04";
  c.exercises[0].sets[0].weight = 85;
  assert.equal(
    records([c, b, a]).events.filter((e) => e.date.startsWith("2026-09"))
      .length,
    1,
  );
});
test("Week A/B average uses weekly total and handles missing side", () => {
  const a = fixture();
  a.week = "A";
  const b = fixture();
  b.id = "b";
  b.week = "B";
  b.date = "2026-10-05";
  b.exercises[0].sets[0].weight = 64;
  assert.equal(weekComparison([a, b]).difference, 25);
  assert.equal(weekComparison([a]).difference, null);
  assert.equal(changePercent(100, 0), null);
});
test("Monday buckets include empty intervening weeks", () => {
  const a = fixture();
  const b = fixture();
  b.id = "b";
  b.date = "2026-10-12";
  const rows = volumeHistory([a, b], "week");
  assert.equal(rows.length, 3);
  assert.equal(rows[1].value, 0);
});
test("7 day moving average uses calendar days, not last 7 entries", () => {
  const rows = bodyweightHistory([
    { date: "2026-09-01", weight: 100 },
    { date: "2026-09-20", weight: 80 },
    { date: "2026-09-21", weight: 82 },
  ]);
  assert.equal(rows[2].average, 81);
});
test("templates preserve values and reset completion and identities", () => {
  const ex = fixture().exercises;
  const copy = cloneExercises(ex);
  assert.equal(copy[0].sets[0].done, false);
  assert.equal(copy[0].sets[0].weight, 80);
  assert.notEqual(copy[0].id, ex[0].id);
});
test("backup roundtrip preserves all data and rejects corrupt nested sets", () => {
  const d = emptyData();
  d.sessions = [fixture()];
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(d))), d);
  const bad = structuredClone(d);
  bad.sessions[0].exercises[0].sets[0].weight = -2;
  assert.throws(() => validateBackup(bad));
  assert.throws(() => validateBackup({ version: 1 }));
});
test("week alternation works before anchor and across years", () => {
  const d = emptyData();
  d.settings.anchorDate = "2026-12-28";
  d.settings.anchorWeek = "A";
  assert.equal(currentWeek(d, "2027-01-04"), "B");
  assert.equal(currentWeek(d, "2026-12-21"), "B");
});

test("backup rejects duplicate identities across sessions and invalid calendar dates", () => {
  const d = emptyData();
  const a = fixture();
  const b = structuredClone(a);
  b.id = "another";
  d.sessions = [a, b];
  assert.throws(() => validateBackup(d));
  d.sessions = [a];
  a.date = "2026-02-31";
  assert.throws(() => validateBackup(d));
});
