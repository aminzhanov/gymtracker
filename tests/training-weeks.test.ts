import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assignTrainingWeeks,
  trainingWeeks,
  suggestTrainingWeek,
} from "../src/trainingWeeks.ts";
import { trainingWeekVolume, calendarVolume } from "../src/planning.ts";
import {
  emptyData,
  newSession,
  newExercise,
  validateBackup,
} from "../src/model.ts";
import type { Session } from "../src/types.ts";

function legacy(
  date: string,
  week: "A" | "B" = "A",
  status: "done" | "planned" = "planned",
): Session {
  const session = newSession(emptyData(), date);
  delete session.trainingWeek;
  session.id = date;
  session.week = week;
  session.status = status;
  const lift = newExercise("bench", "Bench Press");
  lift.sets = [
    { id: date, weight: 100, reps: 5, done: true },
    { id: date + "2", weight: 80, reps: 10, done: false },
  ];
  session.exercises = [lift];
  return session;
}

test("Sunday plus two following A sessions share volume, followed by a separate B group", () => {
  const sessions = [
    legacy("2026-10-04", "A", "done"),
    legacy("2026-10-06"),
    legacy("2026-10-08"),
    legacy("2026-10-10", "B"),
    legacy("2026-10-12", "B"),
    legacy("2026-10-14", "B"),
  ];
  const original = structuredClone(sessions);
  const rows = trainingWeekVolume(sessions, "2026-10");
  assert.deepEqual(
    rows.map((row) => [row.label, row.from, row.to, row.done, row.planned]),
    [
      ["Week A · 1", "2026-10-04", "2026-10-08", 500, 2600],
      ["Week B · 1", "2026-10-10", "2026-10-14", 0, 3900],
    ],
  );
  assert.equal(calendarVolume(sessions, "2026-10")[0].total, 500);
  assert.deepEqual(sessions, original);
});

test("legacy suggestions cap at three and split on tag changes; explicit groups have no cap", () => {
  const sessions = [
    legacy("2026-10-01"),
    legacy("2026-10-02"),
    legacy("2026-10-03"),
    legacy("2026-10-04"),
    legacy("2026-10-05", "B"),
    legacy("2026-10-06"),
  ];
  assert.deepEqual(
    trainingWeeks(sessions).map((row) => [row.label, row.sessions.length]),
    [
      ["Week A · 1", 3],
      ["Week A · 2", 1],
      ["Week B · 1", 1],
      ["Week A · 3", 1],
    ],
  );
  for (const session of sessions) {
    session.week = "A";
    session.trainingWeek = "custom";
  }
  assert.equal(trainingWeeks(sessions).length, 1);
  assert.equal(trainingWeeks(sessions)[0].sessions.length, 6);
});

test("assignments survive moving dates, month boundaries, backups and toggling split off", () => {
  const assigned = assignTrainingWeeks([
    legacy("2026-10-30"),
    legacy("2026-11-02"),
    legacy("2026-11-04"),
  ]);
  assert.equal(trainingWeekVolume(assigned, "2026-10")[0].total, 3900);
  assert.equal(trainingWeekVolume(assigned, "2026-11")[0].total, 3900);
  assert.equal(trainingWeekVolume(assigned, "2026-12").length, 0);
  const groupId = assigned[0].trainingWeek;
  assigned[0].date = "2026-11-09";
  assert.ok(
    assignTrainingWeeks(assigned).every(
      (session) => session.trainingWeek === groupId,
    ),
  );
  const data = emptyData();
  data.sessions = assigned;
  data.settings.useABSplit = false;
  assert.deepEqual(validateBackup(data).sessions, assigned);
  assert.equal(trainingWeeks(validateBackup(data).sessions).length, 1);
});

test("new session suggests an unfinished group and then the next A/B program", () => {
  const data = emptyData();
  data.sessions = assignTrainingWeeks([legacy("2026-10-04")]);
  const tuesday = newSession(data, "2026-10-06");
  assert.equal(tuesday.week, "A");
  assert.equal(tuesday.trainingWeek, data.sessions[0].trainingWeek);
  data.sessions.push(tuesday);
  const thursday = newSession(data, "2026-10-08");
  assert.equal(thursday.trainingWeek, tuesday.trainingWeek);
  data.sessions.push(thursday);
  const next = newSession(data, "2026-10-10");
  assert.equal(next.week, "B");
  assert.notEqual(next.trainingWeek, tuesday.trainingWeek);
  assert.equal(
    suggestTrainingWeek(data.sessions, "2026-10-10", "A"),
    undefined,
  );
  data.settings.useABSplit = false;
  assert.equal(newSession(data, "2026-10-10").trainingWeek, undefined);
});

test("completed plans replace planned totals and empty groups remain visible", () => {
  const sessions = assignTrainingWeeks([
    legacy("2026-10-04"),
    legacy("2026-10-06"),
  ]);
  assert.equal(trainingWeekVolume(sessions, "2026-10")[0].planned, 2600);
  sessions[0].status = "done";
  const row = trainingWeekVolume(sessions, "2026-10")[0];
  assert.equal(row.done, 500);
  assert.equal(row.planned, 1300);
  sessions.forEach((session) => {
    session.exercises = [];
  });
  assert.equal(trainingWeekVolume(sessions, "2026-10")[0].total, 0);
  assert.equal(trainingWeekVolume([], "2026-10").length, 0);
});
