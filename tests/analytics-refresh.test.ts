import { test } from "node:test";
import assert from "node:assert/strict";
import { strengthTrend, filterVolumeRange } from "../src/analyticsVolume.ts";
import { chartLabelIndices } from "../src/chartDomain.ts";
import {
  emptyData,
  newSession,
  newExercise,
  validateBackup,
  fullDate,
  number,
} from "../src/model.ts";
import { setAppLanguage, t, exerciseName } from "../src/i18n.ts";
function log(date: string, id: string, weight: number, done = true) {
  const s = newSession(emptyData(), date),
    e = newExercise(id, id);
  e.sets = [{ id: crypto.randomUUID(), weight, reps: 5, done }];
  s.exercises = [e];
  return s;
}
test("Strength trend averages exercise changes equally and excludes future, unchecked, zero and one-day logs", () => {
  const sessions = [
    log("2026-09-05", "heavy", 100),
    log("2026-10-04", "heavy", 110),
    log("2026-09-05", "light", 10),
    log("2026-10-04", "light", 13),
    log("2026-10-04", "single", 30),
    log("2026-10-05", "heavy", 1000),
    log("2026-10-03", "heavy", 1000, false),
    log("2026-09-04", "light", 1),
    log("2026-09-05", "zero", 0),
    log("2026-10-04", "zero", 10),
  ];
  const before = structuredClone(sessions),
    trend = strengthTrend(sessions, "2026-10-04");
  assert.equal(trend.count, 2);
  assert.ok(Math.abs(trend.value! - 20) < 1e-8);
  assert.equal(trend.from, "2026-09-05");
  assert.deepEqual(sessions, before);
  assert.equal(
    strengthTrend(
      [log("2026-10-04", "same", 10), log("2026-10-04", "same", 20)],
      "2026-10-04",
    ).value,
    null,
  );
  assert.ok(
    strengthTrend(
      [log("2026-09-05", "x", 10), log("2026-10-04", "x", 8)],
      "2026-10-04",
    ).value! < 0,
  );
});
test("Volume ranges preserve complete crossing groups and all history has no cap", () => {
  const rows = [
    { from: "2026-07-01", to: "2026-07-30" },
    { from: "2026-09-30", to: "2026-10-06" },
    { from: "2026-10-30", to: "2026-11-03" },
    { from: "2026-11-04", to: "2026-11-10" },
  ];
  assert.deepEqual(
    filterVolumeRange(rows, "month", "2026-10-04"),
    rows.slice(1, 3),
  );
  assert.equal(filterVolumeRange(rows, "three", "2026-10-04").length, 2);
  assert.equal(
    filterVolumeRange(
      Array.from({ length: 200 }, () => rows[0]),
      "all",
    ).length,
    200,
  );
});
test("Dense charts show bounded labels including both ends", () => {
  assert.equal(chartLabelIndices(0, 4).size, 0);
  assert.deepEqual([...chartLabelIndices(1, 4)], [0]);
  const labels = chartLabelIndices(10000, 6);
  assert.equal(labels.size, 6);
  assert.ok(labels.has(0) && labels.has(9999));
});
test("Russian translates interface and built-ins while preserving custom names and backup compatibility", () => {
  try {
    setAppLanguage("ru");
    assert.equal(t("Show breakdown"), "Показать подробности");
    assert.notEqual(exerciseName("Bench Press", "default-0"), "Bench Press");
    assert.equal(exerciseName("Bench Press", "custom-1"), "Bench Press");
    assert.match(fullDate("2026-10-04"), /октябр/);
    assert.match(number(1234.5, 1), /1\s234,5/);
    const data = emptyData();
    delete data.settings.language;
    assert.equal(validateBackup(data).settings.language, "en");
    data.settings.language = "invalid" as never;
    assert.throws(() => validateBackup(data));
  } finally {
    setAppLanguage("en");
  }
});
