import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { emptyData, newSession, newExercise } from "../src/model.ts";

test("training-week migration saves atomically, preserves old-client assignments and respects isolation", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    for (const file of [
      "001_liftlog",
      "002_program_preferences",
      "004_personal_app_name",
      "005_technique_videos",
      "006_shared_exercise_library",
      "007_training_weeks",
      "007_training_weeks",
    ]) {
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}.sql`, import.meta.url),
          "utf8",
        ),
      );
    }
    const owner = "00000000-0000-4000-8000-000000000001";
    const stranger = "00000000-0000-4000-8000-000000000002";
    await db.query(
      "insert into auth.users values($1,'owner@example.test','{}'),($2,'stranger@example.test','{}')",
      [owner, stranger],
    );
    const login = async (id: string) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    };
    await login(owner);
    const data = emptyData();
    const session = newSession(data, "2026-10-04");
    session.exercises = [newExercise("default-0", "Bench Press")];
    session.exercises[0].notes = "Keep knees steady";
    session.trainingWeek = "A:first-group";
    data.sessions = [session];
    const save = async (rev: number) =>
      (
        await db.query<{ revision: number }>(
          "select public.save_training_data($1,$2::jsonb,$3) as revision",
          [owner, JSON.stringify(data), rev],
        )
      ).rows[0].revision;
    const load = async () =>
      (
        await db.query<{
          result: {
            trainingWeeksReady: boolean;
            revision: number;
            data: typeof data;
          };
        }>("select public.load_training_data($1) as result", [owner])
      ).rows[0].result;
    assert.equal(await save(0), 1);
    assert.equal((await load()).trainingWeeksReady, true);
    assert.equal((await load()).data.sessions[0].trainingWeek, "A:first-group");
    session.date = "2026-11-03";
    data.settings.useABSplit = false;
    delete session.trainingWeek; // Old client does not know the new field.
    assert.equal(await save(1), 2);
    assert.equal((await load()).data.sessions[0].trainingWeek, "A:first-group");
    assert.equal((await load()).data.sessions[0].date, "2026-11-03");
    assert.equal(
      (await load()).data.sessions[0].exercises[0].notes,
      "Keep knees steady",
    );
    await assert.rejects(() => save(1), /Training changed/);
    session.trainingWeek = "";
    await assert.rejects(() => save(2), /Invalid training week/);
    assert.equal((await load()).revision, 2);
    assert.equal((await load()).data.sessions[0].trainingWeek, "A:first-group");
    session.trainingWeek = "B:next";
    session.week = "B";
    assert.equal(await save(2), 3);
    assert.equal((await load()).data.sessions[0].trainingWeek, "B:next");
    await login(stranger);
    await assert.rejects(() => load(), /Access denied/);
    await assert.rejects(() => save(3), /Access denied/);
    await db.exec("reset role; set role anon");
    await assert.rejects(() => load(), /permission denied/);
  } finally {
    await db.close();
  }
});
