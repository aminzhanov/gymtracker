import type {
  AppData,
  Session,
  Template,
  WorkoutExercise,
  Week,
  Bodyweight,
} from "./types.ts";
import { suggestedProgramWeek, suggestTrainingWeek } from "./trainingWeeks.ts";
export const id = () => crypto.randomUUID();
export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDate = (s: string) => new Date(`${s}T12:00:00`);
export const fullDate = (s: string) => {
  const date = parseDate(s);
  return `${date.toLocaleDateString("en-GB", { weekday: "long" })} ${date.getDate()}, ${date.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;
};
export function exerciseComplete(exercise: WorkoutExercise) {
  return exercise.kind === "strength"
    ? exercise.sets.length > 0 && exercise.sets.every((set) => set.done)
    : exercise.done;
}
export function setExerciseCompletion(
  exercise: WorkoutExercise,
  done: boolean,
): WorkoutExercise {
  return {
    ...exercise,
    done,
    sets: exercise.sets.map((set) => ({ ...set, done })),
  };
}
export function updateSessionExercise(
  session: Session,
  exercise: WorkoutExercise,
): Session {
  return {
    ...session,
    status:
      session.status === "done" &&
      exercise.kind === "strength" &&
      !exerciseComplete(exercise)
        ? "planned"
        : session.status,
    exercises: session.exercises.map((old) =>
      old.id === exercise.id ? exercise : old,
    ),
  };
}
/** Move one exercise without changing its identity, sets, notes or completion. */
export function reorderExercises(
  exercises: WorkoutExercise[],
  fromId: string,
  toId: string,
): WorkoutExercise[] {
  const from = exercises.findIndex((e) => e.id === fromId);
  const to = exercises.findIndex((e) => e.id === toId);
  if (from < 0 || to < 0 || from === to) return exercises;
  const next = [...exercises];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
export type RecoveryStatus =
  "done" | "partial" | "skipped" | "pending" | "unplanned";
export function recoveryHistory(sessions: Session[], today = dateKey()) {
  return sessions
    .filter(
      (session) =>
        session.status === "done" ||
        session.exercises.some((exercise) =>
          exercise.kind === "strength"
            ? exercise.sets.some((set) => set.done)
            : exercise.done,
        ),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .map((session) => {
      const check = (kind: "warmup" | "cooldown") => {
        const activities = session.exercises.filter(
          (exercise) => exercise.kind === kind,
        );
        const completed = activities.filter((exercise) => exercise.done).length;
        const total = activities.length;
        const status: RecoveryStatus = !total
          ? "unplanned"
          : completed === total
            ? "done"
            : completed
              ? "partial"
              : session.status === "done" || session.date < today
                ? "skipped"
                : "pending";
        return { status, completed, total };
      };
      return {
        id: session.id,
        date: session.date,
        name: session.name,
        warmup: check("warmup"),
        cooldown: check("cooldown"),
      };
    });
}
export const addDays = (s: string, n: number) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};
export const monday = (s: string) => {
  const d = parseDate(s);
  return addDays(s, -((d.getDay() + 6) % 7));
};
export const shortDate = (s: string) =>
  parseDate(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
export const number = (n: number, digits = 0) =>
  n.toLocaleString(undefined, { maximumFractionDigits: digits });
export const defaults = [
  "Bench Press",
  "Incline Dumbbell Press",
  "Overhead Press",
  "Barbell Row",
  "Pull-Up",
  "Lat Pulldown",
  "Seated Cable Row",
  "Deadlift",
  "Romanian Deadlift",
  "Barbell Back Squat",
  "Leg Press",
  "Leg Curl",
  "Calf Raise",
  "Biceps Curl",
  "Triceps Pushdown",
  "Lateral Raise",
];
export function emptyData(name = "Aleksei"): AppData {
  return {
    version: 1,
    sessions: [],
    templates: [],
    exercises: defaults.map((name, i) => ({
      id: `default-${i}`,
      name,
      custom: false,
    })),
    bodyweight: [],
    settings: {
      useABSplit: true,
      spikeThreshold: 30,
      anchorDate: monday(dateKey()),
      anchorWeek: "A",
      name,
    },
  };
}
export function currentWeek(data: AppData, date = dateKey()): Week {
  if (!data.settings.useABSplit) return "A";
  const delta = Math.round(
    (parseDate(monday(date)).getTime() -
      parseDate(monday(data.settings.anchorDate)).getTime()) /
      604800000,
  );
  return ((delta % 2) + 2) % 2 === 0
    ? data.settings.anchorWeek
    : data.settings.anchorWeek === "A"
      ? "B"
      : "A";
}
export function newSession(
  data: AppData,
  date = dateKey(),
  template?: Template,
): Session {
  const week = data.settings.useABSplit
    ? template?.week ||
      suggestedProgramWeek(data.sessions, date, currentWeek(data, date))
    : "A";
  return {
    id: id(),
    date,
    name: template?.name || "New workout",
    icon: template?.icon || "🏋️",
    week,
    ...(data.settings.useABSplit
      ? {
          trainingWeek:
            suggestTrainingWeek(data.sessions, date, week)?.key || id(),
        }
      : {}),
    status: "planned",
    difficulty: "",
    notes: template?.notes || "",
    exercises: template ? cloneExercises(template.exercises) : [],
  };
}
export function cloneExercises(
  exercises: WorkoutExercise[],
): WorkoutExercise[] {
  return exercises.map((e) => ({
    ...e,
    id: id(),
    done: false,
    sets: e.sets.map((s) => ({ ...s, id: id(), done: false })),
  }));
}
export function newExercise(
  exerciseId: string,
  name: string,
  kind: WorkoutExercise["kind"] = "strength",
): WorkoutExercise {
  return {
    id: id(),
    exerciseId,
    name,
    kind,
    duration: 5,
    notes: "",
    done: false,
    sets:
      kind === "strength"
        ? [{ id: id(), weight: 20, reps: 8, done: false }]
        : [],
  };
}
export const doneSets = (s: Session) =>
  s.exercises
    .filter((e) => e.kind === "strength")
    .flatMap((e) =>
      e.sets
        .filter((set) => set.done)
        .map((set) => ({ ...set, exerciseId: e.exerciseId, name: e.name })),
    );
export const volume = (s: Session) =>
  doneSets(s).reduce((a, set) => a + set.weight * set.reps, 0);
// The requested Epley formula is applied consistently, including singles.
export const estimatedMax = (weight: number, reps: number) =>
  weight * (1 + reps / 30);
export const bestMax = (s: Session) =>
  Math.max(
    0,
    ...doneSets(s)
      .filter((set) => set.weight > 0 && set.reps > 0)
      .map((set) => estimatedMax(set.weight, set.reps)),
  );
export function completeSession(s: Session): Session {
  return {
    ...s,
    status: "done",
    exercises: s.exercises.map((e) =>
      e.kind === "strength" ? setExerciseCompletion(e, true) : e,
    ),
  };
}
export const changePercent = (now: number, before: number): number | null =>
  before > 0 ? ((now - before) / before) * 100 : null;
export function filterSessions(data: AppData, week: "All" | Week) {
  return data.sessions.filter(
    (s) => !data.settings.useABSplit || week === "All" || s.week === week,
  );
}
export function exerciseSummary(exercise: WorkoutExercise) {
  if (exercise.kind !== "strength")
    return `${number(exercise.duration)} min · ${exercise.kind === "warmup" ? "Warm-up" : "Cool-down"}`;
  if (!exercise.sets.length) return "No sets planned";
  const groups: { count: number; weight: number; reps: number }[] = [];
  for (const set of exercise.sets) {
    const last = groups.at(-1);
    if (last && last.weight === set.weight && last.reps === set.reps)
      last.count++;
    else groups.push({ count: 1, weight: set.weight, reps: set.reps });
  }
  return groups
    .map(
      (g) =>
        `${g.count} ${g.count === 1 ? "set" : "sets"} × ${g.reps} reps · ${number(g.weight, 2)} kg`,
    )
    .join(" / ");
}
export function lastPerformance(
  sessions: Session[],
  exerciseId: string,
  before: Session,
) {
  return sessions
    .filter(
      (s) =>
        s.id !== before.id &&
        s.date <= before.date &&
        doneSets(s).some((set) => set.exerciseId === exerciseId),
    )
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
    )[0];
}
export function records(sessions: Session[]) {
  const map = new Map<
    string,
    {
      exerciseId: string;
      name: string;
      best: number;
      heaviest: number;
      weight: number;
      reps: number;
      date: string;
      count: number;
    }
  >();
  const events: {
    exerciseId: string;
    date: string;
    value: number;
    sessionId: string;
  }[] = [];
  const sorted = [...sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  for (const s of sorted) {
    const sessionBest = new Map<string, number>();
    for (const set of doneSets(s)) {
      const max = estimatedMax(set.weight, set.reps);
      const prev = map.get(set.exerciseId);
      if (set.weight <= 0 || set.reps <= 0) continue;
      sessionBest.set(
        set.exerciseId,
        Math.max(max, sessionBest.get(set.exerciseId) || 0),
      );
      map.set(set.exerciseId, {
        exerciseId: set.exerciseId,
        name: set.name,
        best: Math.max(prev?.best || 0, max),
        heaviest: Math.max(prev?.heaviest || 0, set.weight),
        weight: max > (prev?.best || 0) ? set.weight : prev!.weight,
        reps: max > (prev?.best || 0) ? set.reps : prev!.reps,
        date: max > (prev?.best || 0) ? s.date : prev!.date,
        count: (prev?.count || 0) + 1,
      });
    }
    for (const [eid, max] of sessionBest) {
      const earlier = events.filter((e) => e.exerciseId === eid);
      if (max > Math.max(0, ...earlier.map((e) => e.value)))
        events.push({
          exerciseId: eid,
          date: s.date,
          value: max,
          sessionId: s.id,
        });
    }
  }
  return { rows: [...map.values()].sort((a, b) => b.count - a.count), events };
}
export type PeriodRow = {
  key: string;
  label: string;
  value: number;
  change: number | null;
  a: number;
  b: number;
};
export function volumeHistory(
  sessions: Session[],
  period: "session" | "week" | "month",
): PeriodRow[] {
  if (period === "session") {
    const rows = [...sessions]
      .filter((s) => doneSets(s).length)
      .sort((a, b) => a.date.localeCompare(b.date));
    return rows.map((s, i) => ({
      key: s.id,
      label: `${shortDate(s.date)} · ${s.name}`,
      value: volume(s),
      change: i ? changePercent(volume(s), volume(rows[i - 1])) : null,
      a: s.week === "A" ? volume(s) : 0,
      b: s.week === "B" ? volume(s) : 0,
    }));
  }
  const groups = new Map<string, { value: number; a: number; b: number }>();
  for (const s of sessions) {
    if (!doneSets(s).length) continue;
    const key = period === "week" ? monday(s.date) : s.date.slice(0, 7);
    const row = groups.get(key) || { value: 0, a: 0, b: 0 };
    row.value += volume(s);
    if (s.week === "A") row.a += volume(s);
    else row.b += volume(s);
    groups.set(key, row);
  }
  if (!groups.size) return [];
  const keys = [...groups.keys()].sort();
  let cursor = keys[0];
  const end = keys[keys.length - 1];
  const rows: PeriodRow[] = [];
  while (cursor <= end) {
    const row = groups.get(cursor) || { value: 0, a: 0, b: 0 };
    rows.push({
      key: cursor,
      label:
        period === "week"
          ? shortDate(cursor)
          : parseDate(`${cursor}-01`).toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            }),
      ...row,
      change: rows.length
        ? changePercent(row.value, rows[rows.length - 1].value)
        : null,
    });
    if (period === "week") cursor = addDays(cursor, 7);
    else {
      const d = parseDate(`${cursor}-01`);
      d.setMonth(d.getMonth() + 1);
      cursor = dateKey(d).slice(0, 7);
    }
  }
  return rows;
}
export function weekComparison(sessions: Session[]) {
  const history = volumeHistory(sessions, "week");
  const a = history.filter((x) => x.a > 0);
  const b = history.filter((x) => x.b > 0);
  const av = a.length ? a.reduce((n, x) => n + x.a, 0) / a.length : null;
  const bv = b.length ? b.reduce((n, x) => n + x.b, 0) / b.length : null;
  return {
    a: av,
    b: bv,
    difference: av !== null && bv !== null ? changePercent(av, bv) : null,
  };
}
export function exerciseHistory(
  sessions: Session[],
  eid: string,
  metric: "e1rm" | "weight",
) {
  const daily = new Map<string, number>();
  for (const s of sessions) {
    const sets = doneSets(s).filter(
      (x) => x.exerciseId === eid && x.weight > 0 && x.reps > 0,
    );
    if (!sets.length) continue;
    const value = Math.max(
      ...sets.map((x) =>
        metric === "e1rm" ? estimatedMax(x.weight, x.reps) : x.weight,
      ),
    );
    daily.set(s.date, Math.max(daily.get(s.date) ?? 0, value));
  }
  return [...daily]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ label: shortDate(date), date, value }));
}
export function exerciseProgress(
  sessions: Session[],
  eid: string,
  metric: "e1rm" | "weight",
  scale: "kg" | "percent",
  month: string,
) {
  const history = exerciseHistory(sessions, eid, metric).filter(
    (row) => !month || row.date.startsWith(month),
  );
  const baseline = history[0];
  return {
    baseline,
    rows: history.map((row) => ({
      ...row,
      value:
        scale === "percent"
          ? changePercent(row.value, baseline.value)!
          : row.value,
    })),
  };
}
export function chartLinePath(
  values: (number | null)[],
  x: (index: number) => number,
  y: (value: number) => number,
) {
  return values
    .flatMap((value, index) => (value === null ? [] : [{ value, index }]))
    .map(
      ({ value, index }, point) =>
        `${point === 0 ? "M" : "L"}${x(index)},${y(value)}`,
    )
    .join(" ");
}
export function bodyweightHistory(entries: Bodyweight[]) {
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const window = entries.filter(
        (x) => x.date >= addDays(e.date, -6) && x.date <= e.date,
      );
      return {
        ...e,
        average: window.reduce((s, x) => s + x.weight, 0) / window.length,
      };
    });
}
export const recoveryMinutes = (s: Session) =>
  s.exercises
    .filter((e) => e.kind !== "strength" && e.done)
    .reduce((a, e) => a + e.duration, 0);
export function demoData(name = "Aleksei"): AppData {
  const data = emptyData(name);
  const start = addDays(monday(dateKey()), -42);
  const programs = [
    {
      name: "Push day",
      icon: "💪",
      names: [
        "Bench Press",
        "Incline Dumbbell Press",
        "Overhead Press",
        "Triceps Pushdown",
      ],
      weights: [60, 22, 35, 30],
    },
    {
      name: "Pull day",
      icon: "🦍",
      names: ["Barbell Row", "Lat Pulldown", "Biceps Curl"],
      weights: [50, 55, 12],
    },
    {
      name: "Leg day",
      icon: "🦵",
      names: [
        "Barbell Back Squat",
        "Romanian Deadlift",
        "Leg Curl",
        "Calf Raise",
      ],
      weights: [80, 65, 35, 50],
    },
  ];
  for (let w = 0; w < 8; w++) {
    const week: Week = w % 2 ? "B" : "A";
    for (let p = 0; p < 3; p++) {
      const date = addDays(start, w * 7 + [0, 2, 4][p]);
      const program = programs[p];
      const s = newSession(data, date);
      s.week = week;
      s.name = program.name;
      s.icon = program.icon;
      s.exercises = [
        newExercise("warmup", "Light cardio & mobility", "warmup"),
        ...program.names.map((name, i) => {
          const e = newExercise(
            data.exercises.find((x) => x.name === name)!.id,
            name,
          );
          e.sets = Array.from({ length: week === "A" ? 4 : 3 }, () => ({
            id: id(),
            weight: program.weights[i] + Math.floor(w / 2) * 2.5,
            reps: week === "A" ? 8 : 6,
            done: false,
          }));
          return e;
        }),
        newExercise("cooldown", "Stretch & breathe", "cooldown"),
      ];
      if (date < dateKey()) {
        Object.assign(s, completeSession(s));
        s.difficulty = w % 3 ? "solid" : "hard";
        s.notes = "Good form. Keep showing up!";
      }
      data.sessions.push(s);
    }
  }
  for (let i = 0; i < 45; i += 2)
    data.bodyweight.push({
      date: addDays(start, i),
      weight: Math.round((76.5 - i * 0.027 + Math.sin(i) * 0.2) * 10) / 10,
    });
  data.templates = programs.map((p, i) => {
    const s = data.sessions[i];
    return {
      id: id(),
      name: p.name,
      icon: p.icon,
      week: s.week,
      notes: "Focus on controlled reps.",
      exercises: cloneExercises(s.exercises),
    };
  });
  return data;
}
export function validateBackup(value: unknown): AppData {
  const fail = () => {
    throw new Error("Invalid backup. Your existing data has not been changed.");
  };
  if (!value || typeof value !== "object") return fail();
  const d = value as AppData;
  const text = (v: unknown) => typeof v === "string";
  const num = (v: unknown, max = 100000) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
  const validDate = (v: unknown) =>
    text(v) &&
    /^\d{4}-\d{2}-\d{2}$/.test(v as string) &&
    dateKey(parseDate(v as string)) === v;
  const unique = (a: { id: string }[]) =>
    new Set(a.map((x) => x.id)).size === a.length;
  const exercise = (e: WorkoutExercise) =>
    e &&
    text(e.id) &&
    text(e.exerciseId) &&
    text(e.name) &&
    ["strength", "warmup", "cooldown"].includes(e.kind) &&
    num(e.duration, 1440) &&
    text(e.notes) &&
    typeof e.done === "boolean" &&
    Array.isArray(e.sets) &&
    unique(e.sets) &&
    e.sets.every(
      (s) =>
        s &&
        text(s.id) &&
        num(s.weight, 2000) &&
        num(s.reps, 1000) &&
        Number.isInteger(s.reps) &&
        typeof s.done === "boolean",
    );
  const base = (s: Template | Session) =>
    s &&
    text(s.id) &&
    s.id.length > 0 &&
    text(s.name) &&
    s.name.trim().length > 0 &&
    s.name.length <= 100 &&
    text(s.icon) &&
    ["A", "B"].includes(s.week) &&
    text(s.notes) &&
    Array.isArray(s.exercises) &&
    unique(s.exercises) &&
    s.exercises.every(exercise);
  if (
    d.version !== 1 ||
    !Array.isArray(d.sessions) ||
    !Array.isArray(d.templates) ||
    !Array.isArray(d.exercises) ||
    !Array.isArray(d.bodyweight) ||
    !d.settings
  )
    return fail();
  if (
    !unique(d.sessions) ||
    !unique(d.templates) ||
    !unique(d.exercises) ||
    !unique(
      d.sessions.flatMap((s) =>
        Array.isArray(s.exercises) ? s.exercises : [],
      ),
    ) ||
    !unique(
      d.sessions.flatMap((s) =>
        (Array.isArray(s.exercises) ? s.exercises : []).flatMap((e) =>
          Array.isArray(e?.sets) ? e.sets : [],
        ),
      ),
    ) ||
    !unique(
      d.templates.flatMap((t) =>
        Array.isArray(t.exercises) ? t.exercises : [],
      ),
    ) ||
    !unique(
      d.templates.flatMap((t) =>
        (Array.isArray(t.exercises) ? t.exercises : []).flatMap((e) =>
          Array.isArray(e?.sets) ? e.sets : [],
        ),
      ),
    ) ||
    !d.sessions.every(
      (s) =>
        base(s) &&
        validDate(s.date) &&
        (s.trainingWeek == null ||
          (text(s.trainingWeek) &&
            s.trainingWeek.trim().length > 0 &&
            s.trainingWeek.length <= 600)) &&
        ["planned", "done"].includes(s.status) &&
        ["", "easy", "solid", "hard", "brutal"].includes(s.difficulty),
    ) ||
    !d.templates.every(base) ||
    !d.exercises.every(
      (e) => e && text(e.id) && text(e.name) && typeof e.custom === "boolean",
    ) ||
    !d.bodyweight.every(
      (e) => e && validDate(e.date) && num(e.weight, 600) && e.weight > 0,
    ) ||
    new Set(d.bodyweight.map((e) => e.date)).size !== d.bodyweight.length ||
    !num(d.settings.spikeThreshold, 1000) ||
    !validDate(d.settings.anchorDate) ||
    !["A", "B"].includes(d.settings.anchorWeek) ||
    (d.settings.useABSplit !== undefined &&
      typeof d.settings.useABSplit !== "boolean") ||
    !text(d.settings.name)
  )
    return fail();
  const normalized = structuredClone(d);
  normalized.settings.useABSplit ??= true;
  return normalized;
}
