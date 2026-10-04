import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarVolume,
  trainingGroups,
  trainingMonths,
} from "../src/planning.ts";
import { emptyData, newExercise, newSession } from "../src/model.ts";

function session(
  date: string,
  status: "planned" | "done" = "planned",
  week: "A" | "B" = "A",
) {
  const session = newSession(emptyData(), date);
  session.id = date + status + week;
  session.status = status;
  session.week = week;
  const lift = newExercise("bench", "Bench Press");
  lift.sets = [
    { id: "1", weight: 100, reps: 5, done: true },
    { id: "2", weight: 80, reps: 10, done: false },
  ];
  const warm = newExercise("warm", "Warm-up", "warmup");
  warm.sets = [{ id: "ignored", weight: 999, reps: 999, done: true }];
  session.exercises = [lift, warm];
  return session;
}

test("calendar projection separates completed sessions from prescribed plans and program weeks", () => {
  const sessions = [
    session("2026-10-01", "done", "A"),
    session("2026-10-02", "planned", "A"),
    session("2026-10-03", "planned", "B"),
  ];
  const original = structuredClone(sessions);
  const rows = calendarVolume(sessions, "2026-10");
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0], {
    key: "2026-09-28",
    from: "2026-10-01",
    to: "2026-10-04",
    a: { done: 500, planned: 1300 },
    b: { done: 0, planned: 1300 },
    done: 500,
    planned: 2600,
    total: 3100,
  });
  assert.equal(rows[1].total, 0);
  assert.deepEqual(sessions, original);
});

test("calendar weeks clip month edges and handle leap years and six-week months", () => {
  const rows = calendarVolume(
    [session("2026-09-30"), session("2026-10-31"), session("2026-11-01")],
    "2026-10",
  );
  assert.equal(
    rows.reduce((sum, row) => sum + row.total, 0),
    1300,
  );
  assert.equal(rows.at(-1)?.to, "2026-10-31");
  assert.equal(calendarVolume([], "2028-02").at(-1)?.to, "2028-02-29");
  const dec = calendarVolume(
    [session("2026-12-31"), session("2027-01-01")],
    "2026-12",
  );
  assert.equal(
    dec.reduce((sum, row) => sum + row.total, 0),
    1300,
  );
  assert.equal(dec[0].from, "2026-12-01");
  const six = calendarVolume([], "2026-03");
  assert.equal(six.length, 6);
  assert.equal(six[0].to, "2026-03-01");
  assert.equal(six.at(-1)?.to, "2026-03-31");
});

test("marking a session done replaces its projection without double counting unchecked sets", () => {
  const plan = session("2026-10-05");
  assert.equal(calendarVolume([plan], "2026-10")[1].planned, 1300);
  plan.status = "done";
  const row = calendarVolume([plan], "2026-10")[1];
  assert.equal(row.planned, 0);
  assert.equal(row.done, 500);
  assert.equal(row.total, 500);
  plan.exercises[0].sets[1].done = true;
  assert.equal(calendarVolume([plan], "2026-10")[1].done, 1300);
});

test("zero-volume and empty sessions keep a complete, zero-filled month", () => {
  const empty = session("2026-10-15");
  empty.exercises = [];
  assert.ok(calendarVolume([empty], "2026-10").every((row) => row.total === 0));
});

test("training periods include current, strictly past and future months only where appropriate", () => {
  const sessions = [
    session("2025-12-01"),
    session("2026-09-28"),
    session("2026-10-01"),
    session("2026-10-31", "done"),
    session("2026-11-01"),
  ];
  const original = structuredClone(sessions);
  const groups = (
    scope: "current" | "past" | "all",
    month = "all",
    status = "all",
    search = "",
  ) => trainingGroups(sessions, scope, month, status, search, "2026-10-04");
  assert.deepEqual(
    groups("current").map((group) => group.month),
    ["2026-10"],
  );
  assert.deepEqual(
    groups("current")[0].sessions.map((s) => s.date),
    ["2026-10-31", "2026-10-01"],
  );
  assert.deepEqual(
    groups("past").map((group) => group.month),
    ["2026-09", "2025-12"],
  );
  assert.equal(groups("all").length, 4);
  assert.equal(groups("past", "2026-11").length, 0);
  assert.deepEqual(
    groups("all", "2026-11")[0].sessions.map((s) => s.date),
    ["2026-11-01"],
  );
  assert.equal(groups("all", "all", "done")[0].sessions.length, 1);
  sessions[0].name = "Leg DAY";
  assert.equal(groups("past", "all", "all", " leg day ")[0].month, "2025-12");
  assert.equal(groups("current", "all", "all", "missing").length, 0);
  sessions[0].name = original[0].name;
  assert.deepEqual(sessions, original);
});

test("month choices are unique, newest first and retain an empty current month", () => {
  assert.deepEqual(
    trainingMonths(
      [session("2026-09-02"), session("2026-09-30"), session("2026-11-01")],
      "2026-10-04",
    ),
    ["2026-11", "2026-10", "2026-09"],
  );
});
