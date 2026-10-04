import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  emptyData,
  newSession,
  newExercise,
  validateBackup,
} from "../src/model.ts";
import { mergeLocalLibraries, exerciseNameKey } from "../src/library.ts";

const coach = "00000000-0000-4000-8000-000000000001";
const athlete = "00000000-0000-4000-8000-000000000002";
const peer = "00000000-0000-4000-8000-000000000003";
const otherCoach = "00000000-0000-4000-8000-000000000004";
const otherAthlete = "00000000-0000-4000-8000-000000000005";
const newcomer = "00000000-0000-4000-8000-000000000006";
const migration = (name: string) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

test("shared library upgrades, coach-group boundaries, stable identities and bidirectional additions", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
  );
  for (const name of [
    "001_liftlog.sql",
    "002_program_preferences.sql",
    "005_technique_videos.sql",
  ])
    await db.exec(await migration(name));
  for (const [id, name] of [
    [coach, "Coach"],
    [athlete, "Athlete"],
    [peer, "Peer"],
    [otherCoach, "Other Coach"],
    [otherAthlete, "Other Athlete"],
  ])
    await db.query(`insert into auth.users values($1,$2,$3::jsonb)`, [
      id,
      `${name.replaceAll(" ", "")}@example.test`,
      JSON.stringify({ name }),
    ]);
  await db.query("update profiles set role='coach' where id in ($1,$2)", [
    coach,
    otherCoach,
  ]);
  await db.query("insert into coach_athletes values($1,$2),($3,$2),($4,$5)", [
    athlete,
    coach,
    peer,
    otherAthlete,
    otherCoach,
  ]);
  await db.query(
    "insert into exercises values($1,'coach-row','Cable Row',true),($2,'athlete-row','  cable   row ',true)",
    [coach, athlete],
  );
  await db.query(
    "insert into exercise_technique_videos(owner_user_id,exercise_id,drive_file_id) values($1,'coach-row','CoachVideo_123456'),($2,'athlete-row','OlderVideo_123456')",
    [coach, athlete],
  );
  const login = async (id: string) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  };
  const load = async (id: string) =>
    (
      await db.query<{
        load_training_data: { data: unknown; revision: number };
      }>("select load_training_data($1)", [id])
    ).rows[0].load_training_data;
  const library = async (id: string) =>
    (
      await db.query<{
        load_exercise_library: {
          exercises: { id: string; name: string; custom: boolean }[];
          videos: { exercise_id: string; drive_file_id: string }[];
        };
      }>("select load_exercise_library($1)", [id])
    ).rows[0].load_exercise_library;
  const add = async (id: string, name: string, clientId: string) =>
    (
      await db.query<{ add_shared_exercise: string }>(
        "select add_shared_exercise($1,$2,$3)",
        [id, name, clientId],
      )
    ).rows[0].add_shared_exercise;
  const video = (id: string, exercise: string, file: string | null) =>
    db.query("select save_technique_video($1,$2,$3,null)", [
      id,
      exercise,
      file,
    ]);
  const save = (id: string, data: unknown, revision: number) =>
    db.query("select save_training_data($1,$2::jsonb,$3)", [
      id,
      JSON.stringify(data),
      revision,
    ]);
  await login(athlete);
  const before = await load(athlete);
  const data = validateBackup(before.data);
  const workout = newSession(data, "2026-10-04");
  workout.exercises = [newExercise("athlete-row", "Cable Row")];
  workout.exercises[0].notes = "Private workout note";
  workout.exercises[0].sets[0].weight = 42;
  data.sessions = [workout];
  await save(athlete, data, before.revision);
  const preserved = await load(athlete);
  await db.exec("reset role");
  const upgrade = await migration("006_shared_exercise_library.sql");
  await db.exec(upgrade);

  await t.test(
    "migration merges names and coach videos while keeping owner IDs, workouts and revisions",
    async () => {
      await login(athlete);
      assert.deepEqual(await load(athlete), preserved);
      const result = await library(athlete);
      assert.equal(
        result.exercises.filter((e) => exerciseNameKey(e.name) === "cable row")
          .length,
        1,
      );
      assert.equal(
        result.exercises.find((e) => e.name === "Cable Row")?.id,
        "athlete-row",
      );
      assert.equal(
        result.videos.find((v) => v.exercise_id === "athlete-row")
          ?.drive_file_id,
        "CoachVideo_123456",
      );
      await login(coach);
      assert.equal(
        (await library(coach)).exercises.find((e) => e.name === "Cable Row")
          ?.id,
        "coach-row",
      );
    },
  );
  await t.test(
    "athlete additions appear for coach and peers without granting access to their workouts",
    async () => {
      await login(athlete);
      assert.equal(
        await add(athlete, "Reverse Lunge", "athlete-lunge"),
        "athlete-lunge",
      );
      const current = await load(athlete);
      const payload = validateBackup(current.data);
      payload.exercises.push({
        id: "editor-curl",
        name: "Hammer Curl",
        custom: true,
      });
      await save(athlete, payload, current.revision); // Existing session-editor/older-client path.
      await assert.rejects(() => load(peer), /Access denied/);
      await assert.rejects(() => library(coach), /Access denied/);
      await login(coach);
      const result = await library(coach);
      assert.ok(result.exercises.some((e) => e.name === "Reverse Lunge"));
      assert.ok(result.exercises.some((e) => e.name === "Hammer Curl"));
      const source = await load(coach);
      await login(peer);
      assert.ok(
        (await library(peer)).exercises.some((e) => e.name === "Reverse Lunge"),
      );
      await assert.rejects(() => load(coach), /Access denied/);
      await assert.rejects(
        () => save(coach, source.data, source.revision),
        /Access denied/,
      );
    },
  );
  await t.test(
    "coach additions and video changes reach every athlete, including historical aliases",
    async () => {
      await login(coach);
      await add(coach, "Farmer Carry", "coach-carry");
      await video(coach, "coach-carry", "SharedVideo_123456");
      await video(athlete, "athlete-row", "NewRowVideo_123456");
      await login(athlete);
      const result = await library(athlete);
      const carry = result.exercises.find((e) => e.name === "Farmer Carry")!;
      assert.equal(
        result.videos.find((v) => v.exercise_id === carry.id)?.drive_file_id,
        "SharedVideo_123456",
      );
      assert.equal(
        result.videos.find((v) => v.exercise_id === "athlete-row")
          ?.drive_file_id,
        "NewRowVideo_123456",
      );
      await assert.rejects(
        () => video(athlete, "athlete-row", "ForgedVideo_123456"),
        /Coach access required/,
      );
      await assert.rejects(
        () =>
          db.query(
            "update shared_exercises set drive_file_id='ForgedVideo_123456'",
          ),
        /permission denied/,
      );
      await assert.rejects(
        () =>
          db.query("select register_shared_exercise($1,'x','Forged',true)", [
            athlete,
          ]),
        /permission denied/,
      );
      await login(otherCoach);
      assert.ok(
        !(await library(otherCoach)).exercises.some(
          (e) => e.name === "Farmer Carry",
        ),
      );
      await assert.rejects(() => library(athlete), /Access denied/);
      await assert.rejects(
        () => video(athlete, "athlete-row", "ForgedVideo_123456"),
        /Coach access required/,
      );
      assert.equal(
        (
          await db.query(
            "select * from shared_exercises where library_owner_id=$1",
            [coach],
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "case and whitespace duplicates keep IDs stable; forged alias IDs roll back atomically",
    async () => {
      await login(athlete);
      assert.equal(
        await add(athlete, " cable  ROW ", "duplicate-row"),
        "athlete-row",
      );
      const result = await library(athlete);
      const carry = result.exercises.find((e) => e.name === "Farmer Carry")!;
      await assert.rejects(
        () => add(athlete, "Spoof Carry", carry.id),
        /Exercise ID already/,
      );
      assert.ok(
        !(await library(athlete)).exercises.some(
          (e) => e.name === "Spoof Carry",
        ),
      );
      await assert.rejects(
        () => add(athlete, "New Name", "athlete-row"),
        /Exercise ID already/,
      );
      assert.ok(
        !(await library(athlete)).exercises.some((e) => e.name === "New Name"),
      );
    },
  );
  await t.test(
    "failed and stale training saves cannot publish partial shared additions",
    async () => {
      await login(athlete);
      const current = await load(athlete);
      const malformed = validateBackup(current.data);
      malformed.exercises.push({
        id: "should-rollback",
        name: "Rollback Exercise",
        custom: true,
      });
      malformed.sessions[0].exercises[0].sets[0].weight = -1;
      await assert.rejects(() => save(athlete, malformed, current.revision));
      assert.ok(
        !(await library(athlete)).exercises.some(
          (e) => e.name === "Rollback Exercise",
        ),
      );
      const stale = validateBackup(current.data);
      stale.exercises.push({
        id: "should-stay-stale",
        name: "Stale Exercise",
        custom: true,
      });
      await assert.rejects(
        () => save(athlete, stale, current.revision - 1),
        /Training changed/,
      );
      assert.ok(
        !(await library(athlete)).exercises.some(
          (e) => e.name === "Stale Exercise",
        ),
      );
      assert.deepEqual(await load(athlete), current);
    },
  );
  await t.test(
    "non-library recovery videos retain their private owner scope",
    async () => {
      await login(coach);
      await video(athlete, "recovery-private", "RecoveryVideo_123456");
      await login(athlete);
      assert.ok(
        (await library(athlete)).videos.some(
          (v) => v.exercise_id === "recovery-private",
        ),
      );
      await login(peer);
      assert.ok(
        !(await library(peer)).videos.some(
          (v) => v.exercise_id === "recovery-private",
        ),
      );
      assert.equal(
        (
          await db.query("select * from sessions where owner_user_id=$1", [
            athlete,
          ])
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select * from shared_exercise_aliases where owner_user_id=$1",
            [athlete],
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "archive and video removal survive stale backups and repeated upgrades; history stays intact",
    async () => {
      await login(athlete);
      const snapshot = await load(athlete);
      await assert.rejects(
        () =>
          db.query("select archive_shared_exercise($1,'athlete-row',true)", [
            athlete,
          ]),
        /Coach access required/,
      );
      await login(coach);
      await db.query("select archive_shared_exercise($1,'coach-row',true)", [
        coach,
      ]);
      await video(coach, "coach-row", null);
      await login(athlete);
      await save(athlete, snapshot.data, snapshot.revision);
      assert.ok(
        !(await library(athlete)).exercises.some((e) => e.name === "Cable Row"),
      );
      assert.ok(
        !(await library(athlete)).videos.some(
          (v) => v.exercise_id === "athlete-row",
        ),
      );
      await assert.rejects(
        () => add(athlete, "Cable Row", "restore-by-athlete"),
        /Ask your coach/,
      );
      const saved = await load(athlete);
      assert.equal(
        validateBackup(saved.data).sessions[0].exercises[0].notes,
        "Private workout note",
      );
      await db.exec("reset role");
      await db.exec(upgrade);
      await login(athlete);
      assert.deepEqual(await load(athlete), saved);
      assert.ok(
        !(await library(athlete)).videos.some(
          (v) => v.exercise_id === "athlete-row",
        ),
      );
      assert.ok(
        !(await library(athlete)).exercises.some((e) => e.name === "Cable Row"),
      );
      await login(coach);
      await add(coach, "Cable Row", "restore-by-coach");
      await login(athlete);
      assert.equal(
        (await library(athlete)).exercises.find((e) => e.name === "Cable Row")
          ?.id,
        "athlete-row",
      );
    },
  );
  await t.test(
    "new invitations inherit their coach library; foreign groups and inactive users remain blocked",
    async () => {
      await db.exec("reset role");
      await db.query(
        "insert into auth.users values($1,'new@example.test','{}')",
        [newcomer],
      );
      await db.query("insert into coach_athletes values($1,$2)", [
        newcomer,
        coach,
      ]);
      await login(newcomer);
      assert.ok(
        (await library(newcomer)).exercises.some(
          (e) => e.name === "Farmer Carry",
        ),
      );
      await assert.rejects(
        () => add(otherAthlete, "Wrong group", "wrong-group"),
        /Access denied/,
      );
      await db.exec("reset role");
      await db.query("update profiles set active=false where id=$1", [
        newcomer,
      ]);
      await assert.rejects(async () => {
        await login(newcomer);
        await library(newcomer);
      }, /Access denied/);
      await db.exec("reset role");
      await db.query("update profiles set active=false where id=$1", [coach]);
      await login(coach);
      await assert.rejects(
        () => video(athlete, "athlete-row", "DisabledVideo_123456"),
        /Coach access required/,
      );
      await db.exec("reset role; set role anon");
      await assert.rejects(() => library(athlete), /permission denied/);
    },
  );
  await db.close();
});

test("demo sharing merges exercise names, keeps historical IDs, syncs videos and handles removal", () => {
  const a = emptyData(),
    b = emptyData();
  a.exercises.push({ id: "coach-row", name: "Cable Row", custom: true });
  b.exercises.push(
    { id: "athlete-row", name: " cable   ROW ", custom: true },
    { id: "athlete-curl", name: "Hammer Curl", custom: true },
  );
  const s = newSession(b, "2026-10-04");
  s.exercises = [newExercise("athlete-row", "Cable Row")];
  b.sessions = [s];
  const members = [
    { owner: "coach", data: a, videos: { "coach-row": "coach-video" } },
    { owner: "athlete", data: b, videos: { "athlete-row": "athlete-video" } },
  ];
  const original = structuredClone(members);
  const result = mergeLocalLibraries(members, "athlete", {}, []);
  assert.equal(
    result.exercises.filter((e) => exerciseNameKey(e.name) === "cable row")
      .length,
    1,
  );
  assert.equal(
    result.exercises.find((e) => exerciseNameKey(e.name) === "cable row")?.id,
    "athlete-row",
  );
  assert.equal(result.techniqueVideos["athlete-row"], "coach-video");
  assert.ok(
    mergeLocalLibraries(members, "coach", {}, []).exercises.some(
      (e) => e.name === "Hammer Curl",
    ),
  );
  assert.equal(
    mergeLocalLibraries(members, "athlete", { "cable row": "updated" }, [])
      .techniqueVideos["athlete-row"],
    "updated",
  );
  const archived = mergeLocalLibraries(
    members,
    "athlete",
    { "cable row": "" },
    ["cable row"],
  );
  assert.ok(
    !archived.exercises.some((e) => exerciseNameKey(e.name) === "cable row"),
  );
  assert.equal(archived.techniqueVideos["athlete-row"], undefined);
  assert.deepEqual(members, original);
});
