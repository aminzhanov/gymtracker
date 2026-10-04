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
  exerciseProgress,
  chartLinePath,
  exerciseSummary,
  filterSessions,
  exerciseComplete,
  setExerciseCompletion,
  updateSessionExercise,
  recoveryHistory,
  fullDate,
  reorderExercises,
} from "../src/model.ts";
import { validateMessages } from "../src/messages.ts";
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
test("moving exercises preserves every set, note, identity and completion without mutating history", () => {
  const session = fixture();
  const warmup = newExercise("warm", "Warm-up", "warmup");
  warmup.notes = "Shoulder felt better after mobility.";
  warmup.done = true;
  const last = newExercise("curl", "Biceps Curl");
  session.exercises.push(warmup, last);
  session.exercises[0].notes = "Controlled descent.\nTry 82.5 kg next time.";
  const before = structuredClone(session);
  const moved = reorderExercises(
    session.exercises,
    last.id,
    session.exercises[0].id,
  );
  assert.deepEqual(moved, [last, session.exercises[0], warmup]);
  assert.deepEqual(session, before);
  assert.deepEqual(
    reorderExercises(moved, last.id, warmup.id),
    session.exercises,
  );
  assert.equal(reorderExercises(moved, "missing", warmup.id), moved);
  assert.equal(reorderExercises(moved, last.id, last.id), moved);
  const data = emptyData();
  data.sessions = [{ ...session, exercises: moved }];
  assert.deepEqual(
    validateBackup(JSON.parse(JSON.stringify(data))).sessions[0].exercises,
    moved,
  );
});
test("overview completion preserves weight and reps, and reopening marks the session planned", () => {
  const session = fixture();
  const original = structuredClone(session);
  const completed = setExerciseCompletion(session.exercises[0], true);
  assert.equal(exerciseComplete(completed), true);
  assert.deepEqual(
    completed.sets.map(({ weight, reps }) => ({ weight, reps })),
    original.exercises[0].sets.map(({ weight, reps }) => ({ weight, reps })),
  );
  const done = completeSession(updateSessionExercise(session, completed));
  const reopened = updateSessionExercise(
    done,
    setExerciseCompletion(done.exercises[0], false),
  );
  assert.equal(reopened.status, "planned");
  assert.equal(exerciseComplete(reopened.exercises[0]), false);
  assert.deepEqual(session, original);
  assert.equal(exerciseComplete({ ...completed, sets: [] }), false);
});
test("recovery completion uses its own checkbox and includes zero-minute activities", () => {
  const recovery = newExercise("warm", "Mobility", "warmup");
  recovery.duration = 0;
  const completed = setExerciseCompletion(recovery, true);
  assert.equal(exerciseComplete(completed), true);
  assert.equal(recovery.done, false);
  assert.equal(
    exerciseComplete(setExerciseCompletion(completed, false)),
    false,
  );
});
test("finishing lifting preserves skipped recovery and recovery edits do not reopen a completed workout", () => {
  const session = fixture();
  const warmup = newExercise("warm", "Warm-up", "warmup");
  const cooldown = setExerciseCompletion(
    newExercise("cool", "Stretch", "cooldown"),
    true,
  );
  session.exercises.push(warmup, cooldown);
  const done = completeSession(session);
  assert.equal(done.exercises[1].done, false);
  assert.equal(done.exercises[2].done, true);
  const updated = updateSessionExercise(
    done,
    setExerciseCompletion(done.exercises[2], false),
  );
  assert.equal(updated.status, "done");
  assert.equal(updated.exercises[2].done, false);
});
test("recovery checklist shows actual training, partial and skipped routines, without treating unplanned work as skipped", () => {
  const session = fixture();
  session.exercises.push(
    setExerciseCompletion(newExercise("warm", "Warm-up", "warmup"), true),
    newExercise("warm2", "Mobility", "warmup"),
    newExercise("cool", "Stretch", "cooldown"),
  );
  const future = newSession(emptyData(), "2026-10-10");
  future.exercises = [newExercise("warm", "Warm-up", "warmup")];
  const noRecovery = fixture();
  noRecovery.id = "no-recovery";
  const rows = recoveryHistory([session, future, noRecovery], "2026-10-04");
  assert.equal(rows.length, 2);
  const row = rows.find((row) => row.id === session.id)!;
  assert.deepEqual(row.warmup, { status: "partial", completed: 1, total: 2 });
  assert.equal(row.cooldown.status, "skipped");
  assert.equal(
    rows.find((row) => row.id === noRecovery.id)!.warmup.status,
    "unplanned",
  );
});
test("unfinished recovery is pending today and skipped only after the training is finished or past", () => {
  const session = fixture();
  session.date = "2026-10-04";
  session.exercises.push(newExercise("cool", "Stretch", "cooldown"));
  assert.equal(
    recoveryHistory([session], session.date)[0].cooldown.status,
    "pending",
  );
  session.status = "done";
  assert.equal(
    recoveryHistory([session], session.date)[0].cooldown.status,
    "skipped",
  );
  session.exercises[1].done = true;
  assert.equal(
    recoveryHistory([session], session.date)[0].cooldown.status,
    "done",
  );
});
test("full session date has an English weekday, day, month and year", () => {
  assert.equal(fullDate("2026-10-02"), "Friday 2, October 2026");
});
test("coach message validation preserves line breaks and rejects empty or oversized text", () => {
  assert.deepEqual(
    validateMessages({
      dashboard: "  Keep going!  ",
      sidebar: "Strong friends.\nStronger days.",
    }),
    {
      appName: "LiftLog",
      dashboard: "Keep going!",
      sidebar: "Strong friends.\nStronger days.",
    },
  );
  for (const messages of [
    { dashboard: " ", sidebar: "Go" },
    { dashboard: "Go", sidebar: "x".repeat(121) },
    { dashboard: 123, sidebar: "Go" },
    null,
  ])
    assert.throws(() => validateMessages(messages));
});
test("app names normalize legacy settings and reject invalid personal names", () => {
  const messages = { dashboard: "Go!", sidebar: "Strong!" };
  assert.equal(validateMessages(messages).appName, "LiftLog");
  assert.equal(
    validateMessages({ ...messages, appName: "  Maya Moves  " }).appName,
    "Maya Moves",
  );
  for (const appName of [
    null,
    4,
    "",
    " ",
    "x".repeat(41),
    "First\nSecond",
    "First\rSecond",
  ])
    assert.throws(() => validateMessages({ ...messages, appName }));
});
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

test("exercise lines join sparse dates without inventing zero observations", () => {
  assert.equal(
    chartLinePath(
      [null, 10, null, 15, null],
      (index) => index * 10,
      (value) => 100 - value,
    ),
    "M10,90 L30,85",
  );
  assert.equal(
    chartLinePath(
      [null, null],
      (index) => index,
      (value) => value,
    ),
    "",
  );
});
test("monthly growth uses each exercise's first completed daily best", () => {
  const data = emptyData();
  const record = (date: string, weight: number, eid = "bench", done = true) => {
    const session = newSession(data, date);
    session.exercises = [newExercise(eid, eid)];
    session.exercises[0].sets = [
      { id: crypto.randomUUID(), weight, reps: 5, done },
    ];
    return session;
  };
  const sessions = [
    record("2026-09-29", 50),
    record("2026-10-02", 100),
    record("2026-10-02", 110),
    record("2026-10-12", 121),
    record("2026-10-16", 99),
    record("2026-10-20", 1000, "bench", false),
    record("2026-10-04", 20, "curl"),
    record("2026-10-18", 25, "curl"),
  ];
  const allHistory = exerciseProgress(
    sessions.slice().reverse(),
    "bench",
    "weight",
    "percent",
    "",
  );
  assert.equal(allHistory.baseline.date, "2026-09-29");
  assert.equal(allHistory.baseline.value, 50);
  assert.deepEqual(
    allHistory.rows.map((row) => Math.round(row.value)),
    [0, 120, 142, 98],
  );
  assert.deepEqual(
    exerciseProgress(sessions, "curl", "weight", "percent", "").rows.map(
      (row) => row.value,
    ),
    [0, 25],
  );
  const bench = exerciseProgress(
    sessions,
    "bench",
    "weight",
    "percent",
    "2026-10",
  );
  assert.equal(bench.baseline.value, 110);
  assert.deepEqual(
    bench.rows.map((row) => Math.round(row.value)),
    [0, 10, -10],
  );
  const curl = exerciseProgress(
    sessions,
    "curl",
    "weight",
    "percent",
    "2026-10",
  );
  assert.deepEqual(
    curl.rows.map((row) => row.value),
    [0, 25],
  );
  assert.deepEqual(
    exerciseProgress(sessions, "bench", "weight", "percent", "2026-11").rows,
    [],
  );
  assert.equal(
    exerciseProgress(sessions, "bench", "e1rm", "kg", "2026-10").rows[0].value,
    110 * (1 + 5 / 30),
  );
});
test("optional split preserves history, ignores week filter and roundtrips older backups", () => {
  const data = emptyData();
  data.sessions = [fixture()];
  data.sessions[0].week = "B";
  data.settings.useABSplit = false;
  assert.equal(filterSessions(data, "A").length, 1);
  assert.equal(newSession(data).week, "A");
  assert.equal(validateBackup(data).settings.useABSplit, false);
  assert.equal(data.sessions[0].week, "B");
  const legacy = structuredClone(data) as any;
  delete legacy.settings.useABSplit;
  assert.equal(validateBackup(legacy).settings.useABSplit, true);
  legacy.settings.useABSplit = "false";
  assert.throws(() => validateBackup(legacy));
});
test("exercise overview groups matching prescriptions and keeps varying sets visible", () => {
  const exercise = newExercise("bench", "Bench");
  exercise.sets = [
    { id: "one", weight: 87.5, reps: 6, done: false },
    { id: "two", weight: 87.5, reps: 6, done: false },
    { id: "three", weight: 0, reps: 8, done: true },
  ];
  assert.equal(
    exerciseSummary(exercise),
    "2 sets × 6 reps · 87.5 kg / 1 set × 8 reps · 0 kg",
  );
  const warmup = newExercise("warm", "Warm", "warmup");
  assert.equal(exerciseSummary(warmup), "5 min · Warm-up");
});
