import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyData, newSession } from "../src/model.ts";
import { librarySessionWeeks } from "../src/libraryWeeks.ts";
import { trainingGroups } from "../src/planning.ts";
import { setAppLanguage, t } from "../src/i18n.ts";
import type { Week } from "../src/types.ts";

const data = emptyData();
function session(
  id: string,
  date: string,
  week: Week,
  group: string,
  status: "planned" | "done" = "planned",
) {
  return { ...newSession(data, date), id, week, trainingWeek: group, status };
}

test("Library keeps Sunday and later assigned A sessions together and filters without renumbering", () => {
  const sessions = [
    session("old", "2026-09-10", "A", "old", "done"),
    session("sun", "2026-10-04", "A", "current", "done"),
    session("tue", "2026-10-06", "A", "current"),
    session("thu", "2026-10-08", "A", "current"),
    session("b", "2026-10-11", "B", "next"),
  ];
  const original = structuredClone(sessions);
  const weeks = librarySessionWeeks(sessions, sessions, "2026-10", true);
  assert.deepEqual(
    weeks.map((w) => w.label),
    ["Week B · 1", "Week A · 2"],
  );
  assert.deepEqual(
    weeks[1].sessions.map((s) => s.id),
    ["thu", "tue", "sun"],
  );
  const completed = librarySessionWeeks(
    sessions,
    sessions.filter((s) => s.status === "done"),
    "2026-10",
    true,
  );
  assert.equal(completed[0].label, "Week A · 2");
  assert.equal(completed[0].from, "2026-10-04");
  assert.equal(completed[0].to, "2026-10-08");
  assert.deepEqual(
    completed[0].sessions.map((s) => s.id),
    ["sun"],
  );
  assert.deepEqual(sessions, original);
});

test("Calendar mode uses Monday boundaries and stable partial-month week numbers regardless of A/B tags", () => {
  const sessions = [
    session("sept", "2026-09-30", "A", "one"),
    session("sun", "2026-10-04", "A", "one"),
    session("mon", "2026-10-05", "A", "one"),
    session("tue", "2026-10-06", "B", "two"),
    session("nov", "2026-11-01", "B", "two"),
  ];
  const weeks = librarySessionWeeks(sessions, sessions, "2026-10", false);
  assert.deepEqual(
    weeks.map((w) => w.label),
    ["Week 2", "Week 1"],
  );
  assert.deepEqual(
    weeks[0].sessions.map((s) => s.id),
    ["tue", "mon"],
  );
  assert.equal(weeks[1].from, "2026-10-01");
  assert.equal(weeks[1].to, "2026-10-04");
  assert.ok(weeks.every((w) => !w.week));
  assert.equal(
    librarySessionWeeks(sessions, [sessions[2]], "2026-10", false)[0].label,
    "Week 2",
  );
});

test("Current, past and all-history month sections keep crossing weeks consistent and show each session once", () => {
  const sessions = [
    session("sep", "2026-09-29", "A", "cross", "done"),
    session("oct1", "2026-10-01", "A", "cross", "done"),
    session("oct4", "2026-10-04", "A", "cross"),
    session("future", "2026-11-02", "B", "future"),
  ];
  for (const split of [true, false]) {
    for (const scope of ["current", "past", "all"] as const) {
      const months = trainingGroups(
        sessions,
        scope,
        "all",
        "all",
        "",
        "2026-10-05",
      );
      for (const month of months) {
        const weeks = librarySessionWeeks(
          sessions,
          month.sessions,
          month.month,
          split,
        );
        const ids = weeks.flatMap((w) => w.sessions.map((s) => s.id)).sort();
        assert.deepEqual(ids, month.sessions.map((s) => s.id).sort());
        assert.equal(new Set(ids).size, ids.length);
      }
    }
  }
  const september = librarySessionWeeks(sessions, sessions, "2026-09", true)[0];
  const october = librarySessionWeeks(sessions, sessions, "2026-10", true)[0];
  assert.equal(september.label, october.label);
  assert.equal(october.from, "2026-09-29");
  assert.equal(october.to, "2026-10-04");
  assert.equal(librarySessionWeeks(sessions, [], "2026-10", true).length, 0);
});

test("Legacy suggestions use full history before filtering and both week labels support Russian", () => {
  const sessions = [1, 2, 3, 4].map((n) =>
    session(String(n), `2026-10-0${n}`, "A", ""),
  );
  const last = librarySessionWeeks(sessions, [sessions[3]], "2026-10", true)[0];
  assert.equal(last.label, "Week A · 2");
  try {
    setAppLanguage("ru");
    assert.equal(t(last.label), "Неделя A · 2");
    assert.equal(t("Week 2"), "Неделя 2");
  } finally {
    setAppLanguage("en");
  }
});
