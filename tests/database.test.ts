import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  emptyData,
  newSession,
  newExercise,
  validateBackup,
  completeSession,
} from "../src/model.ts";
const coach = "00000000-0000-4000-8000-000000000001";
const athlete = "00000000-0000-4000-8000-000000000002";
const stranger = "00000000-0000-4000-8000-000000000003";
test("database isolation, atomic backups, completion and concurrency", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/001_liftlog.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.query(
    `insert into auth.users values($1,'coach@example.test','{"name":"Coach","role":"coach"}'),($2,'athlete@example.test','{"name":"Athlete"}'),($3,'other@example.test','{}')`,
    [coach, athlete, stranger],
  );
  await t.test("signup metadata cannot assign coach role", async () => {
    const p = await db.query<{ role: string }>(
      "select role from public.profiles where id=$1",
      [coach],
    );
    assert.equal(p.rows[0].role, "athlete");
  });
  await db.query("update public.profiles set role='coach' where id=$1", [
    coach,
  ]);
  await db.query("insert into public.coach_athletes values($1,$2)", [
    athlete,
    coach,
  ]);
  const login = async (uid: string) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      uid,
    ]);
    await db.exec("set role authenticated");
  };
  const load = async (uid: string) =>
    (
      await db.query<{
        load_training_data: { data: unknown; revision: number };
      }>("select public.load_training_data($1)", [uid])
    ).rows[0].load_training_data;
  const save = async (uid: string, d: unknown, rev: number | null) =>
    (
      await db.query<{ save_training_data: number }>(
        "select public.save_training_data($1,$2::jsonb,$3)",
        [uid, JSON.stringify(d), rev],
      )
    ).rows[0].save_training_data;
  await login(athlete);
  const initial = await load(athlete);
  const data = validateBackup(initial.data);
  assert.equal(data.exercises.length, 16);
  const s = newSession(data, "2026-10-04");
  s.exercises = [newExercise("default-0", "Bench Press")];
  s.exercises[0].sets[0].weight = 80;
  s.exercises[0].sets[0].done = true;
  data.sessions = [s];
  data.bodyweight = [{ date: "2026-10-04", weight: 75 }];
  await t.test(
    "athlete can atomically save and reload own normalized rows",
    async () => {
      assert.equal(await save(athlete, data, 0), 1);
      const result = await load(athlete);
      assert.deepEqual(
        validateBackup(result.data).sessions[0].exercises[0].sets,
        data.sessions[0].exercises[0].sets,
      );
      assert.equal(
        (await db.query("select * from public.session_sets")).rows.length,
        1,
      );
    },
  );
  await t.test(
    "athlete cannot read or modify another athlete even by forged owner",
    async () => {
      await assert.rejects(() => load(stranger), /Access denied/);
      await assert.rejects(() => save(stranger, data, 0), /Access denied/);
      assert.equal(
        (
          await db.query(
            "select * from public.user_settings where owner_user_id=$1",
            [stranger],
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "athlete cannot change role, create coach link or bypass revision RPC",
    async () => {
      await assert.rejects(
        () =>
          db.query("update public.profiles set role='coach' where id=$1", [
            athlete,
          ]),
        /permission denied/,
      );
      await assert.rejects(
        () => db.query("delete from public.sessions"),
        /permission denied/,
      );
      await assert.rejects(
        () =>
          db.query("insert into public.coach_athletes values($1,$2)", [
            stranger,
            athlete,
          ]),
        /permission denied/,
      );
    },
  );
  await t.test(
    "stale and null revisions cannot overwrite newer data",
    async () => {
      await assert.rejects(() => save(athlete, data, 0), /another device/);
      await assert.rejects(() => save(athlete, data, null), /another device/);
      assert.equal((await load(athlete)).revision, 1);
    },
  );
  await t.test(
    "malformed nested data rolls back deletions and revision increment",
    async () => {
      const corrupt = structuredClone(data);
      corrupt.sessions[0].exercises[0].sets[0].weight = -1;
      await assert.rejects(() => save(athlete, corrupt, 1));
      const missing = structuredClone(data) as any;
      delete missing.bodyweight;
      await assert.rejects(() => save(athlete, missing, 1), /Invalid backup/);
      assert.equal((await load(athlete)).revision, 1);
      assert.equal(
        validateBackup((await load(athlete)).data).sessions.length,
        1,
      );
    },
  );
  await login(coach);
  await t.test(
    "coach can edit assigned athlete, cannot access unassigned athlete",
    async () => {
      const next = validateBackup((await load(athlete)).data);
      next.sessions[0].notes = "Coach cue";
      assert.equal(await save(athlete, next, 1), 2);
      await assert.rejects(() => load(stranger), /Access denied/);
    },
  );
  await t.test("session completion is enforced by database", async () => {
    const next = validateBackup((await load(athlete)).data);
    next.sessions[0].status = "done";
    next.sessions[0].exercises[0].sets[0].done = false;
    await save(athlete, next, 2);
    assert.equal(
      validateBackup((await load(athlete)).data).sessions[0].exercises[0]
        .sets[0].done,
      true,
    );
  });
  await t.test(
    "deactivation blocks athlete access but preserves coach access and history",
    async () => {
      await db.query("select public.set_athlete_active($1,false)", [athlete]);
      assert.equal(
        validateBackup((await load(athlete)).data).sessions.length,
        1,
      );
      await login(athlete);
      await assert.rejects(() => load(athlete), /Access denied/);
      await login(coach);
      await db.query("select public.set_athlete_active($1,true)", [athlete]);
    },
  );
  await t.test(
    "invite reservations are service-only and bind new accounts to their coach",
    async () => {
      await login(athlete);
      const invited = "00000000-0000-4000-8000-000000000004";
      const nonce = "10000000-0000-4000-8000-000000000001";
      await assert.rejects(
        () =>
          db.query("select public.reserve_athlete_invite($1,$2,$3)", [
            "invited@example.test",
            coach,
            nonce,
          ]),
        /permission denied/,
      );
      await assert.rejects(
        () => db.query("select * from public.athlete_invitations"),
        /permission denied/,
      );
      await db.exec("reset role");
      await db.exec("set role service_role");
      await db.query("select public.reserve_athlete_invite($1,$2,$3)", [
        "invited@example.test",
        coach,
        nonce,
      ]);
      await assert.rejects(
        () =>
          db.query("select public.reserve_athlete_invite($1,$2,$3)", [
            "athlete@example.test",
            coach,
            nonce,
          ]),
        /already has an account/,
      );
      await db.exec("reset role");
      await db.query(
        `insert into auth.users values($1,'invited@example.test',$2::jsonb)`,
        [
          invited,
          JSON.stringify({
            name: "Invited",
            invite_nonce: nonce,
            role: "coach",
          }),
        ],
      );
      const rel = await db.query<{ coach_id: string }>(
        "select coach_id from public.coach_athletes where athlete_id=$1",
        [invited],
      );
      assert.equal(rel.rows[0].coach_id, coach);
      const pr = await db.query<{ role: string }>(
        "select role from public.profiles where id=$1",
        [invited],
      );
      assert.equal(pr.rows[0].role, "athlete");
      assert.equal(
        (await db.query("select * from public.athlete_invitations")).rows
          .length,
        0,
      );
    },
  );
  await t.test(
    "template and bodyweight backup roundtrip uses separate normalized tables",
    async () => {
      await login(coach);
      const next = validateBackup((await load(athlete)).data);
      next.templates = [
        {
          id: "template",
          name: "Week B template",
          icon: "💪",
          week: "B",
          notes: "Cue",
          exercises: next.sessions[0].exercises.map((e) => ({
            ...e,
            id: "template-exercise",
            done: false,
            sets: e.sets.map((z) => ({
              ...z,
              id: "template-set",
              done: false,
            })),
          })),
        },
      ];
      const revision = (await load(athlete)).revision;
      await save(athlete, next, revision);
      const reloaded = validateBackup((await load(athlete)).data);
      assert.deepEqual(reloaded.templates, next.templates);
      assert.deepEqual(reloaded.bodyweight, next.bodyweight);
    },
  );
  await db.close();
});
