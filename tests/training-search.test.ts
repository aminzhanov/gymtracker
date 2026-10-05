import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyData, newExercise, newSession } from "../src/model.ts";
import { setAppLanguage } from "../src/i18n.ts";
import {
  searchSessions,
  searchExerciseOptions,
  exerciseMatches,
  searchResultGroups,
} from "../src/trainingSearch.ts";
function fixture() {
  const d = emptyData();
  const make = (
    date: string,
    name: string,
    eid: string,
    ename: string,
    status: "planned" | "done" = "planned",
  ) => {
    const s = newSession(d, date);
    s.name = name;
    s.status = status;
    s.exercises = [newExercise(eid, ename)];
    return s;
  };
  d.sessions = [
    make("2026-09-01", "Back day", "cable", "Seated Cable Row", "done"),
    make("2026-10-12", "Pull", "cable", "Seated Cable Row"),
    make("2026-10-19", "Pull", "wide", "Wide Grip Seated Cable Row"),
    make("2026-10-06", "Seated cable technique", "bench", "Bench Press"),
    make("2026-10-01", "Leg day", "squat", "Squat", "done"),
  ];
  return d;
}
test("session search matches workout names and exercise names across all history", () => {
  const d = fixture();
  assert.equal(searchSessions(d, "  CABLE seated  ").length, 4);
  assert.equal(searchSessions(d, "squat")[0].name, "Leg day");
  assert.equal(searchSessions(d, " ").length, 0);
  assert.equal(searchSessions(d, "bench row").length, 0);
  const options = searchExerciseOptions(d, "seated cable");
  assert.equal(options.length, 2);
  assert.equal(options.find((e) => e.id === "cable")?.count, 2);
  assert.equal(options.find((e) => e.id === "wide")?.count, 1);
});
test("exercise matching supports canonical library names and Russian built-ins", () => {
  const d = fixture();
  d.exercises.push({ id: "cable", name: "Cable seated row", custom: true });
  assert.equal(
    exerciseMatches(d.sessions[0].exercises[0], "cable row", d),
    true,
  );
  const e = newExercise("default-6", "Seated Cable Row");
  setAppLanguage("ru");
  try {
    const translated = searchExerciseOptions(
      { ...d, sessions: [{ ...d.sessions[0], exercises: [e] }] },
      "тяга",
    );
    assert.equal(translated.length, 1);
  } finally {
    setAppLanguage("en");
  }
});
test("search filters preserve upcoming chronological order and reverse completed order", () => {
  const d = fixture();
  const groups = searchResultGroups(searchSessions(d, "row"), "all", "all");
  assert.deepEqual(
    groups[0].sessions.map((s) => s.date),
    ["2026-10-12", "2026-10-19"],
  );
  assert.equal(groups[1].sessions[0].date, "2026-09-01");
  assert.equal(
    searchResultGroups(d.sessions, "done", "2026-10")[0].sessions[0].name,
    "Leg day",
  );
  assert.equal(searchResultGroups(d.sessions, "planned", "2026-09").length, 0);
});
