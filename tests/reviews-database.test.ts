import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { emptyData, newSession, newExercise } from "../src/model.ts";
import type { ReviewItem } from "../src/reviews.ts";
test("Inbox migration baselines history, tracks atomic completions and edits, caps reviewed history and enforces assigned-coach access", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    const apply = async (file: string) =>
      db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}.sql`, import.meta.url),
          "utf8",
        ),
      );
    for (const file of [
      "001_liftlog",
      "002_program_preferences",
      "004_personal_app_name",
      "005_technique_videos",
      "006_shared_exercise_library",
      "007_training_weeks",
    ])
      await apply(file);
    const owner = "00000000-0000-4000-8000-000000000001",
      coach = "00000000-0000-4000-8000-000000000002",
      other = "00000000-0000-4000-8000-000000000003",
      owner2 = "00000000-0000-4000-8000-000000000004";
    await db.query(
      `insert into auth.users values($1,'athlete@test','{}'),($2,'coach@test','{}'),($3,'other@test','{}'),($4,'athlete2@test','{}')`,
      [owner, coach, other, owner2],
    );
    await db.query(
      "update public.profiles set role='coach' where id in ($1,$2)",
      [coach, other],
    );
    await db.query(
      "insert into public.coach_athletes(coach_id,athlete_id) values($1,$2),($1,$3)",
      [coach, owner, owner2],
    );
    const login = async (id: string) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    };
    const data = emptyData(),
      old = newSession(data, "2026-09-01");
    old.status = "done";
    old.exercises = [newExercise("default-0", "Bench Press")];
    data.sessions = [old];
    let rev = 0;
    const save = async () => {
      const result = await db.query<{ rev: number }>(
        "select public.save_training_data($1,$2::jsonb,$3) as rev",
        [owner, JSON.stringify(data), rev],
      );
      rev = result.rows[0].rev;
    };
    const inbox = async () =>
      (
        await db.query<{ result: { items: ReviewItem[] } }>(
          "select public.load_review_inbox() as result",
        )
      ).rows[0].result.items;
    const review = async (item: ReviewItem, flag = true) =>
      db.query("select public.set_workout_review($1,$2,$3,$4)", [
        item.ownerId,
        item.session.id,
        item.version,
        flag,
      ]);
    await login(owner);
    await save();
    await db.exec("reset role");
    await apply("009_coach_review_inbox");
    await apply("009_coach_review_inbox");
    await login(coach);
    assert.equal((await inbox()).length, 0);
    await login(owner);
    old.notes = "Old history note";
    await save();
    const next = newSession(data, "2026-10-05");
    next.exercises = [newExercise("default-0", "Bench Press")];
    next.exercises[0].sets[0].weight = 20;
    next.exercises[0].sets[0].reps = 5;
    next.notes = "Felt good";
    data.sessions.push(next);
    await save();
    await login(coach);
    assert.equal((await inbox()).length, 0);
    await login(owner);
    next.status = "done";
    await save();
    await login(coach);
    let item = (await inbox())[0];
    assert.equal(item.version, 1);
    assert.equal(item.session.notes, "Felt good");
    assert.ok(item.session.exercises[0].sets.every((x) => x.done));
    await review(item);
    assert.equal((await inbox())[0].reviewed, true);
    await login(owner);
    data.settings.spikeThreshold = 30;
    data.bodyweight = [{ date: "2026-10-05", weight: 70 }];
    await save();
    await login(coach);
    assert.equal((await inbox())[0].version, 1);
    assert.equal((await inbox())[0].reviewed, true);
    await login(owner);
    next.exercises[0].notes = "Check technique";
    await save();
    await login(coach);
    assert.equal((await inbox())[0].version, 2);
    assert.equal((await inbox())[0].reviewed, false);
    await assert.rejects(() => review(item), /Workout changed/);
    item = (await inbox())[0];
    await review(item);
    await review(item, false);
    assert.equal((await inbox())[0].reviewed, false);
    await review(item);
    // The actual migration is safe to rerun without erasing pending/reviewed events.
    await db.exec("reset role");
    await apply("009_coach_review_inbox");
    await login(coach);
    assert.equal((await inbox())[0].reviewed, true);
    assert.equal((await inbox())[0].version, 2);
    await login(other);
    assert.equal((await inbox()).length, 0);
    await assert.rejects(() => review(item), /Coach access required/);
    await login(owner);
    await assert.rejects(inbox, /Coach access required/);
    await assert.rejects(() => review(item), /Coach access required/);
    await assert.rejects(
      () => db.query("select * from public.workout_review_events"),
      /permission denied/,
    );
    await assert.rejects(
      () => db.query("select public._sync_workout_reviews($1,false)", [owner]),
      /permission denied/,
    );
    await db.exec("set role anon");
    await assert.rejects(inbox, /permission denied/);
    await assert.rejects(() => review(item), /permission denied/);
    // Reviewed cap never discards receipts: five reviews -> three visible, all five stored.
    await login(owner);
    for (let i = 0; i < 4; i++) {
      const s = newSession(data, `2026-10-0${i + 1}`);
      s.status = "done";
      data.sessions.push(s);
    }
    await save();
    await login(coach);
    for (const pending of (await inbox()).filter((x) => !x.reviewed))
      await review(pending);
    assert.equal((await inbox()).length, 3);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from public.workout_review_receipts",
        )
      ).rows[0].count,
      5,
    );
    // Cap is per athlete, not global.
    await login(owner2);
    const second = emptyData(),
      secondSession = newSession(second, "2026-10-05");
    secondSession.status = "done";
    second.sessions = [secondSession];
    await db.query("select public.save_training_data($1,$2::jsonb,0)", [
      owner2,
      JSON.stringify(second),
    ]);
    await login(coach);
    assert.equal((await inbox()).length, 4);
    await review((await inbox()).find((x) => x.ownerId === owner2)!);
    assert.equal((await inbox()).length, 4);
    // An old hidden reviewed workout reappears only when its content changes.
    await login(owner);
    next.notes = "New note";
    await save();
    await login(coach);
    item = (await inbox()).find((x) => x.session.id === next.id)!;
    assert.equal(item.reviewed, false);
    assert.equal(item.version, 3);
    assert.equal(
      (await inbox()).filter((x) => x.ownerId === owner && x.reviewed).length,
      3,
    );
    // Invalid backup rolls back training, version, receipts and revision together.
    await login(owner);
    next.exercises[0].sets[0].reps = -1;
    await assert.rejects(save);
    next.exercises[0].sets[0].reps = 5;
    await login(coach);
    assert.equal(
      (await inbox()).find((x) => x.session.id === next.id)!.version,
      3,
    );
    await login(owner);
    next.status = "planned";
    await save();
    await login(coach);
    assert.ok(!(await inbox()).some((x) => x.session.id === next.id));
    await login(owner);
    next.status = "done";
    await save();
    await login(coach);
    item = (await inbox()).find((x) => x.session.id === next.id)!;
    assert.equal(item.version, 4);
    await review(item);
    await login(owner);
    data.sessions = data.sessions.filter((x) => x.id !== next.id);
    await save();
    await login(coach);
    assert.ok(!(await inbox()).some((x) => x.session.id === next.id));
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from public.workout_review_receipts where session_id=$1",
          [next.id],
        )
      ).rows[0].count,
      0,
    );
    await db.query("update public.profiles set active=false where id=$1", [
      coach,
    ]);
    await login(coach);
    await assert.rejects(inbox, /Coach access required/);
  } finally {
    await db.close();
  }
});
