import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyData,
  newExercise,
  newSession,
  exerciseProgress,
  records,
  estimatedMax,
} from "../src/model.ts";
import { exercisePointDetails } from "../src/exercisePoints.ts";
import { findExerciseByName, relinkExercise } from "../src/exerciseIdentity.ts";
import { counterValue, stepCounter } from "../src/numericInput.ts";
import { searchSessions } from "../src/trainingSearch.ts";
import { setAppLanguage, exerciseName } from "../src/i18n.ts";

test("duration editing allows an empty draft, exact replacement and five-minute steps with bounds", () => {
  assert.equal(counterValue("", 5, 1440), null);
  assert.equal(counterValue(" ", 5, 1440), null);
  assert.equal(counterValue("12", 5, 1440), 12);
  assert.equal(counterValue("2,5", 5, 1440), 2.5);
  for (const draft of ["-1", "1441", "abc", "Infinity"])
    assert.equal(counterValue(draft, 5, 1440), null);
  assert.equal(stepCounter(12, 5, 1440), 17);
  assert.equal(stepCounter(12, -5, 1440), 7);
  assert.equal(stepCounter(2, -5, 1440), 0);
  assert.equal(stepCounter(1438, 5, 1440), 1440);
  assert.equal(counterValue("8.4", 1, 1000), 8);
  assert.equal(counterValue("22,5", 2.5, 2000), 22.5);
});

test("changing a workout exercise relinks search, records and charts without renaming history or losing sets", () => {
  const data = emptyData();
  const bench = data.exercises.find((e) => e.name === "Bench Press")!;
  const leg = findExerciseByName(data.exercises, "  LEG   press ")!;
  const first = newSession(data, "2026-09-28");
  first.name = "Monday";
  first.exercises = [newExercise(bench.id, bench.name)];
  first.exercises[0].sets[0].done = true;
  first.exercises[0].notes = "Keep this note";
  const original = structuredClone(first);
  const second = structuredClone(first);
  second.id = "second";
  second.date = "2026-10-07";
  second.exercises[0] = relinkExercise(second.exercises[0], leg);
  data.sessions = [first, second];
  assert.equal(second.exercises[0].exerciseId, leg.id);
  assert.deepEqual(second.exercises[0].sets, original.exercises[0].sets);
  assert.equal(second.exercises[0].notes, "Keep this note");
  assert.equal(second.exercises[0].id, original.exercises[0].id);
  assert.deepEqual(
    searchSessions(data, "Bench Press").map((s) => s.id),
    [first.id],
  );
  assert.deepEqual(
    searchSessions(data, "Leg Press").map((s) => s.id),
    [second.id],
  );
  assert.equal(
    exerciseProgress(data.sessions, leg.id, "weight", "kg", "").rows[0].date,
    second.date,
  );
  assert.ok(records(data.sessions).rows.some((r) => r.exerciseId === leg.id));
  assert.deepEqual(first, original);
  const custom = relinkExercise(second.exercises[0], {
    id: "new-custom",
    name: "My new exercise",
  });
  assert.equal(custom.exerciseId, "new-custom");
  assert.throws(() => relinkExercise(custom, { id: "", name: "Bad" }));
  setAppLanguage("ru");
  try {
    assert.equal(
      findExerciseByName(data.exercises, exerciseName(leg.name, leg.id))?.id,
      leg.id,
    );
  } finally {
    setAppLanguage("en");
  }
});

function log(date: string, id: string, weights: number[], checked = true) {
  const s = newSession(emptyData(), date);
  s.id = id;
  s.name = id;
  s.exercises = [newExercise("bench", "Bench Press")];
  s.exercises[0].sets = weights.map((weight, i) => ({
    id: `${id}:${i}`,
    weight,
    reps: 10,
    done: checked,
  }));
  return s;
}
test("exercise volume sums same-day workouts and occurrences, including checked sets in unfinished sessions", () => {
  const first = log("2026-09-28", "first", [20, 25]);
  const a = log("2026-10-03", "a", [30, 40]);
  a.exercises.push(
    newExercise("bench", "Bench Press"),
    newExercise("bench", "Recovery", "warmup"),
    newExercise("curl", "Curl"),
  );
  a.exercises[1].sets = [{ id: "repeat", weight: 10, reps: 5, done: true }];
  a.exercises[2].done = true;
  const b = log("2026-10-03", "b", [50]);
  const plan = log("2026-10-03", "plan", [1000], false);
  const zero = log("2026-10-07", "zero", [0]);
  const sessions = [zero, plan, b, a, first],
    before = structuredClone(sessions);
  const history = exerciseProgress(sessions, "bench", "volume", "kg", "");
  assert.deepEqual(
    history.rows.map((r) => r.value),
    [450, 1250, 0],
  );
  const d = exercisePointDetails(
    sessions,
    "bench",
    "volume",
    "kg",
    "2026-10",
    "2026-10-03",
  )!;
  assert.equal(d.value, 1250);
  assert.equal(d.previous, null);
  assert.equal(d.logs.length, 2);
  assert.equal(
    d.logs.flatMap((l) => l.sets).reduce((v, z) => v + z.weight * z.reps, 0),
    d.rawValue,
  );
  assert.ok(d.logs.flatMap((l) => l.sets).every((z) => z.contributes));
  assert.equal(
    exercisePointDetails(sessions, "bench", "weight", "kg", "", "2026-10-07"),
    null,
  );
  assert.deepEqual(sessions, before);
});

test("progress point details reconcile top weight, estimated max and growth baselines for sparse histories", () => {
  const sessions = [
    log("2026-09-28", "before", [20]),
    log("2026-10-03", "start", [40, 30]),
    log("2026-10-07", "latest", [30, 50]),
    log("2026-10-06", "other", [999], false),
  ];
  for (const metric of ["weight", "e1rm"] as const)
    for (const scale of ["kg", "percent"] as const) {
      const chart = exerciseProgress(
        sessions,
        "bench",
        metric,
        scale,
        "2026-10",
      );
      for (const row of chart.rows)
        assert.equal(
          exercisePointDetails(
            sessions,
            "bench",
            metric,
            scale,
            "2026-10",
            row.date,
          )?.value,
          row.value,
        );
      const d = exercisePointDetails(
        sessions,
        "bench",
        metric,
        scale,
        "2026-10",
        "2026-10-07",
      )!;
      assert.equal(d.previous?.date, "2026-10-03");
      assert.equal(d.baseline.date, "2026-10-03");
      assert.equal(Math.round(d.growth!), 25);
      assert.equal(d.logs[0].sets.filter((z) => z.contributes).length, 1);
      assert.equal(d.rawValue, metric === "weight" ? 50 : estimatedMax(50, 10));
    }
  assert.equal(
    exercisePointDetails(sessions, "missing", "weight", "kg", "", "2026-10-07"),
    null,
  );
});
