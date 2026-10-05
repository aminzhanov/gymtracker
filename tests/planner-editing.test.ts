import { test } from "node:test";
import assert from "node:assert/strict";
import { newExercise, emptyData, newSession } from "../src/model.ts";
import {
  previousPlannerExercise,
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

test("previous planner reference follows exercise chronology across months and future plans", () => {
  const data = emptyData();
  const make = (
    date: string,
    weight: number,
    status: "planned" | "done" = "planned",
  ) => {
    const s = newSession(data, date);
    s.id = date;
    s.status = status;
    s.exercises = [newExercise("bench", "Bench")];
    s.exercises[0].sets = [
      { id: date, weight, reps: 8, done: status === "done" },
    ];
    return s;
  };
  const september = make("2026-09-29", 20, "done");
  const earlierPlan = make("2026-10-20", 30);
  const current = make("2026-10-27", 40);
  const later = make("2026-10-30", 50);
  const sameDay = make("2026-10-27", 60);
  sameDay.id = "other";
  let ref = previousPlannerExercise(
    [later, current, september, sameDay, earlierPlan],
    current,
    current.exercises[0],
  );
  assert.equal(ref?.session.id, earlierPlan.id);
  assert.equal(ref?.session.status, "planned");
  assert.equal(ref?.exercise.sets[0].weight, 30);
  ref = previousPlannerExercise(
    [september, current],
    current,
    current.exercises[0],
  );
  assert.equal(ref?.session.id, september.id);
  assert.equal(
    previousPlannerExercise(
      [current, sameDay, later],
      current,
      current.exercises[0],
    ),
    undefined,
  );
});
test("completed references include checked sets only and skip skipped exercises", () => {
  const data = emptyData();
  const current = newSession(data, "2026-10-27");
  const e = newExercise("bench", "Bench");
  current.exercises = [e];
  const earlier = {
    ...newSession(data, "2026-10-20"),
    status: "done" as const,
    exercises: [
      {
        ...e,
        sets: [
          { id: "checked", weight: 80, reps: 8, done: true },
          { id: "unchecked", weight: 90, reps: 8, done: false },
        ],
      },
      {
        ...e,
        id: "duplicate",
        sets: [{ id: "extra", weight: 70, reps: 10, done: true }],
      },
    ],
  };
  const skipped = {
    ...newSession(data, "2026-10-25"),
    status: "done" as const,
    exercises: [
      { ...e, sets: [{ id: "skip", weight: 95, reps: 8, done: false }] },
    ],
  };
  const unrelated = {
    ...newSession(data, "2026-10-26"),
    exercises: [{ ...e, exerciseId: "different", name: "Bench" }],
  };
  const ref = previousPlannerExercise(
    [earlier, skipped, unrelated],
    current,
    e,
  );
  assert.equal(ref?.session.id, earlier.id);
  assert.deepEqual(
    ref?.exercise.sets.map((s) => s.id),
    ["checked", "extra"],
  );
  assert.equal(earlier.exercises[0].sets.length, 2);
});
