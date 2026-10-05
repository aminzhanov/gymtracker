import { test } from "node:test";
import assert from "node:assert/strict";
import { newExercise, emptyData, newSession } from "../src/model.ts";
import {
  matchingSets,
  resizeSets,
  editPrescription,
} from "../src/plannerEditing.ts";
import { trainingWeekVolume } from "../src/planning.ts";
test("planner preserves existing sets and completion while extending prescriptions", () => {
  const e = newExercise("bench", "Bench");
  e.sets = [
    { id: "one", weight: 80, reps: 8, done: true },
    { id: "two", weight: 60, reps: 10, done: false },
  ];
  assert.equal(matchingSets(e), false);
  assert.equal(editPrescription(e, "weight", 100), e);
  const next = editPrescription(e, "weight", 85, "one");
  assert.equal(next.sets[0].done, true);
  assert.equal(next.sets[1].weight, 60);
  const longer = resizeSets(next, 4);
  assert.deepEqual(longer.sets.slice(0, 2), next.sets);
  assert.equal(new Set(longer.sets.map((s) => s.id)).size, 4);
  assert.equal(longer.sets[3].done, false);
  assert.equal(longer.sets[3].weight, 60);
  assert.deepEqual(resizeSets(longer, 1).sets, [next.sets[0]]);
  assert.equal(resizeSets(e, -1), e);
  assert.equal(editPrescription(e, "reps", 2.5, "one"), e);
});
test("inline prescription edits change planned projection without changing status or completed totals", () => {
  const data = emptyData();
  const s = newSession(data, "2026-10-05");
  s.trainingWeek = "a";
  s.exercises = [newExercise("bench", "Bench")];
  s.exercises[0].sets = [{ id: "one", weight: 80, reps: 8, done: false }];
  const updated = {
    ...s,
    exercises: [editPrescription(s.exercises[0], "weight", 90)],
  };
  const before = trainingWeekVolume([s], "2026-10")[0];
  const after = trainingWeekVolume([updated], "2026-10")[0];
  assert.equal(after.planned - before.planned, 80);
  assert.equal(after.done, 0);
  assert.equal(updated.status, "planned");
  assert.equal(updated.trainingWeek, "a");
  assert.equal(updated.exercises[0].sets[0].id, "one");
});
