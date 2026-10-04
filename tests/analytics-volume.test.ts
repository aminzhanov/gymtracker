import { test } from "node:test";
import assert from "node:assert/strict";
import {
  volumeRows,
  trainingAverages,
  activeVolumeGroup,
} from "../src/analyticsVolume.ts";
import { bodyweightDomain, readExerciseSelection } from "../src/chartDomain.ts";
import {
  emptyData,
  newSession,
  newExercise,
  duplicateSession,
  records,
  recoveryHistory,
} from "../src/model.ts";
import type { Session, Week } from "../src/types.ts";

function session(
  date: string,
  week: Week,
  key: string,
  weight = 100,
  done = true,
): Session {
  const s = newSession(emptyData(), date);
  s.week = week;
  s.trainingWeek = key;
  s.status = done ? "done" : "planned";
  const e = newExercise("bench", "Bench");
  e.sets = [{ id: crypto.randomUUID(), weight, reps: 10, done }];
  s.exercises = [e];
  return s;
}

test("Analytics uses assigned training groups across Sunday and month boundaries", () => {
  const sessions = [
    session("2026-09-30", "A", "a1"),
    session("2026-10-04", "A", "a1"),
    session("2026-10-06", "A", "a1"),
  ];
  const rows = volumeRows(sessions, "week", true);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].done, 3000);
  assert.equal(rows[0].from, "2026-09-30");
  assert.equal(rows[0].to, "2026-10-06");
  assert.equal(volumeRows(sessions, "week", false).length, 2);
  assert.equal(
    activeVolumeGroup(sessions, true, "2026-10-04").sessions.length,
    3,
  );
});

test("Changes compare A to A and B to B instead of adjacent opposing weeks", () => {
  const rows = volumeRows(
    [
      session("2026-09-01", "A", "a1", 100),
      session("2026-09-08", "B", "b1", 200),
      session("2026-09-15", "A", "a2", 110),
      session("2026-09-22", "B", "b2", 240),
    ],
    "week",
    true,
  );
  assert.deepEqual(
    rows.map((r) => r.change),
    [null, null, 10, 20],
  );
  assert.equal(rows[2].baseline, "Week A · 1");
  assert.equal(rows[3].baseline, "Week B · 1");
});

test("Future projections don't change latest actual change, records or recovery", () => {
  const past = [
    session("2026-09-01", "A", "a1"),
    session("2026-09-08", "A", "a2", 110),
  ];
  const future = session("2026-10-30", "A", "a3", 1000, false);
  const rows = volumeRows([...past, future], "week", true);
  assert.equal(rows.at(-1)!.planned, 10000);
  assert.equal(rows.at(-1)!.change, null);
  assert.equal(rows.filter((r) => r.done > 0).at(-1)!.change, 10);
  assert.deepEqual(records([...past, future]), records(past));
  assert.deepEqual(recoveryHistory([...past, future]), recoveryHistory(past));
});

test("Checked sets in a planned session aren't counted twice in the projection", () => {
  const s = session("2026-10-04", "A", "a1", 100, false);
  s.exercises[0].sets[0].done = true;
  s.exercises[0].sets.push({
    id: "remaining",
    weight: 80,
    reps: 10,
    done: false,
  });
  const row = volumeRows([s], "week", true)[0];
  assert.deepEqual([row.done, row.planned, row.total], [1000, 800, 1800]);
});

test("Partial training groups don't become comparison baselines or enter averages", () => {
  const partial = session("2026-09-08", "A", "a2", 50, false);
  partial.exercises[0].sets[0].done = true;
  const sessions = [
    session("2026-09-01", "A", "a1", 100),
    partial,
    session("2026-09-15", "A", "a3", 120),
    session("2026-09-22", "B", "b1", 200),
  ];
  assert.equal(volumeRows(sessions, "week", true)[2].change, 20);
  assert.deepEqual(trainingAverages(sessions), {
    a: 1100,
    b: 2000,
    difference: -45,
  });
});

test("Duplicate keeps plan and notes but gets fresh IDs and clears completion", () => {
  const data = emptyData();
  const source = session("2026-10-04", "A", "source");
  source.notes = "Keep form";
  source.difficulty = "hard";
  source.createdBy = "coach";
  source.exercises[0].notes = "Grip cue";
  source.exercises[0].done = true;
  const recovery = newExercise("warmup", "Warm up", "warmup");
  recovery.done = true;
  source.exercises.push(recovery);
  data.sessions = [source];
  const snapshot = structuredClone(source);
  const copy = duplicateSession(data, source, "2026-10-11", "B");
  assert.equal(copy.date, "2026-10-11");
  assert.equal(copy.week, "B");
  assert.notEqual(copy.id, source.id);
  assert.notEqual(copy.trainingWeek, source.trainingWeek);
  assert.equal(copy.status, "planned");
  assert.equal(copy.difficulty, "");
  assert.equal(copy.createdBy, undefined);
  assert.equal(copy.notes, source.notes);
  assert.equal(copy.exercises[0].notes, "Grip cue");
  assert.equal(copy.exercises[0].sets[0].weight, 100);
  assert.notEqual(copy.exercises[0].id, source.exercises[0].id);
  assert.notEqual(copy.exercises[0].sets[0].id, source.exercises[0].sets[0].id);
  assert.ok(
    copy.exercises.every((e) => !e.done && e.sets.every((s) => !s.done)),
  );
  assert.deepEqual(source, snapshot);
});

test("Duplicate joins a matching target training group without inheriting the source group", () => {
  const data = emptyData();
  const source = session("2026-10-04", "A", "a1");
  const target = session("2026-10-11", "B", "b1", 100, false);
  data.sessions = [source, target];
  assert.equal(
    duplicateSession(data, source, "2026-10-13", "B").trainingWeek,
    "b1",
  );
  data.settings.useABSplit = false;
  assert.equal(
    duplicateSession(data, source, "2026-10-13").trainingWeek,
    undefined,
  );
});

test("Bodyweight scale centers constant values and covers changes without a zero baseline", () => {
  const [low, high] = bodyweightDomain([80, 80, 80]);
  assert.ok(low > 0 && low < 80 && high > 80);
  assert.equal((high + low) / 2, 80);
  const changing = bodyweightDomain([72.3, 74.1, 73]);
  assert.ok(changing[0] > 0 && changing[0] < 72.3 && changing[1] > 74.1);
  assert.deepEqual(bodyweightDomain([]), [0, 1]);
});

test("Saved selection supports multiple exercises, empty selection and invalid storage", () => {
  const values = new Map([
    ["coach:athlete1", '["bench","squat","bench"]'],
    ["coach:athlete2", "[]"],
    ["broken", "{}"],
  ]);
  const storage = { getItem: (key: string) => values.get(key) ?? null };
  assert.deepEqual(readExerciseSelection(storage, "coach:athlete1"), [
    "bench",
    "squat",
  ]);
  assert.deepEqual(readExerciseSelection(storage, "coach:athlete2"), []);
  assert.deepEqual(readExerciseSelection(storage, "broken"), ["default-0"]);
  assert.deepEqual(
    readExerciseSelection(
      {
        getItem: () => {
          throw new Error("blocked");
        },
      },
      "x",
    ),
    ["default-0"],
  );
});
