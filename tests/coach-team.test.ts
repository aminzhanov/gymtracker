import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { emptyData, newSession, newExercise } from "../src/model.ts";
import type { Profile } from "../src/types.ts";
import type { ReviewItem } from "../src/reviews.ts";

test("coach invitation descendants are visible without crossing groups or changing direct assignments", async () => {
  const db = new PGlite();
  const id = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const [root, kate, one, two, direct, outsider, foreign] = [
    1, 2, 3, 4, 5, 6, 7,
  ].map(id);
  const apply = async (file: string) =>
    db.exec(
      await readFile(
        new URL(`../supabase/migrations/${file}.sql`, import.meta.url),
        "utf8",
      ),
    );
  const login = async (user: string) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user,
    ]);
    await db.exec("set role authenticated");
  };
  const people = async () =>
    (
      await db.query<{ result: Profile[] }>(
        "select public.load_people() as result",
      )
    ).rows[0].result;
  const inbox = async () =>
    (
      await db.query<{ result: { items: ReviewItem[] } }>(
        "select public.load_review_inbox() as result",
      )
    ).rows[0].result.items;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    for (const file of [
      "001_liftlog",
      "002_program_preferences",
      "004_personal_app_name",
      "005_technique_videos",
      "006_shared_exercise_library",
      "007_training_weeks",
      "009_coach_review_inbox",
      "010_profile_illustrations",
    ])
      await apply(file);
    for (const [user, name] of [
      [root, "Root"],
      [kate, "Kate"],
      [one, "One"],
      [two, "Two"],
      [direct, "Direct"],
      [outsider, "Other coach"],
      [foreign, "Foreign"],
    ]) {
      await db.query("insert into auth.users values($1,$2,$3::jsonb)", [
        user,
        `${user}@test`,
        JSON.stringify({ name }),
      ]);
    }
    await db.query(
      "update public.profiles set role='coach' where id in ($1,$2,$3)",
      [root, kate, outsider],
    );
    await db.query(
      "insert into public.coach_athletes values($1,$2),($3,$1),($4,$1),($5,$2),($6,$7)",
      [kate, root, one, two, direct, foreign, outsider],
    );
    await login(root);
    assert.deepEqual(
      (
        await db.query<{ id: string }>(
          "select id from public.profiles order by id",
        )
      ).rows.map((x) => x.id),
      [root, kate, direct],
    );
    await db.exec("reset role");
    await apply("011_coach_team_visibility");
    await apply("011_coach_team_visibility");
    await login(root);
    let roster = await people();
    assert.deepEqual(
      roster.map((x) => x.id).sort(),
      [root, kate, one, two, direct].sort(),
    );
    assert.equal(roster.find((x) => x.id === one)?.coachId, kate);
    assert.equal(roster.find((x) => x.id === one)?.coachName, "Kate");
    assert.equal(
      (await db.query("select * from public.profiles")).rows.length,
      5,
    );
    await db.query("select public.load_training_data($1)", [one]);
    await db.query("select public.load_exercise_library($1)", [one]);
    await assert.rejects(
      () => db.query("select public.load_training_data($1)", [foreign]),
      /Access denied/,
    );
    // Account access stays with the direct coach, even when training is shared.
    await assert.rejects(
      () => db.query("select public.set_athlete_active($1,false)", [one]),
      /Access denied/,
    );
    await assert.rejects(
      () =>
        db.query("insert into public.coach_athletes values($1,$2)", [
          outsider,
          root,
        ]),
      /permission denied/,
    );

    await login(kate);
    assert.deepEqual(
      (await people()).map((x) => x.id).sort(),
      [kate, one, two].sort(),
    );
    await assert.rejects(
      () => db.query("select public.load_training_data($1)", [root]),
      /Access denied/,
    );
    const training = emptyData("One");
    const session = newSession(training, "2026-10-07");
    session.exercises = [newExercise("default-0", "Bench Press")];
    session.exercises[0].sets[0].weight = 40;
    session.exercises[0].sets[0].reps = 8;
    session.exercises[0].notes = "Kate's coaching note";
    session.status = "done";
    training.sessions = [session];
    await db.query("select public.save_training_data($1,$2::jsonb,0)", [
      one,
      JSON.stringify(training),
    ]);
    assert.equal(
      (await inbox())[0].session.exercises[0].notes,
      "Kate's coaching note",
    );
    await login(root);
    let item = (await inbox())[0];
    assert.equal(item.ownerId, one);
    await db.query("select public.set_workout_review($1,$2,$3,true)", [
      one,
      session.id,
      item.version,
    ]);
    assert.equal((await inbox())[0].reviewed, true);
    await login(kate);
    assert.equal((await inbox())[0].reviewed, false);
    await login(root);
    training.sessions[0].notes = "Root can plan and review this workout";
    await db.query("select public.save_training_data($1,$2::jsonb,1)", [
      one,
      JSON.stringify(training),
    ]);
    item = (await inbox())[0];
    assert.equal(item.session.notes, training.sessions[0].notes);
    assert.equal(item.reviewed, false);
    await db.query("select public.set_workout_review($1,$2,$3,true)", [
      one,
      session.id,
      item.version,
    ]);
    await db.exec("reset role");
    await apply("011_coach_team_visibility");
    assert.equal(
      (
        await db.query<{ revision: number }>(
          "select revision from public.user_settings where owner_user_id=$1",
          [one],
        )
      ).rows[0].revision,
      2,
    );
    assert.equal(
      (
        await db.query<{ coach_id: string }>(
          "select coach_id from public.coach_athletes where athlete_id=$1",
          [one],
        )
      ).rows[0].coach_id,
      kate,
    );
    await login(root);
    assert.equal((await inbox())[0].reviewed, true);

    await login(one);
    roster = await people();
    assert.equal(roster.length, 1);
    assert.equal(roster[0].id, one);
    assert.equal(roster[0].coachId, null);
    await assert.rejects(
      () => db.query("select public.load_training_data($1)", [two]),
      /Access denied/,
    );
    await assert.rejects(
      () => db.query("select public.load_review_inbox()"),
      /Coach access required/,
    );
    await login(outsider);
    assert.deepEqual(
      (await people()).map((x) => x.id).sort(),
      [outsider, foreign].sort(),
    );
    assert.equal((await inbox()).length, 0);
    await assert.rejects(
      () =>
        db.query("select public.set_workout_review($1,$2,$3,true)", [
          one,
          session.id,
          item.version,
        ]),
      /Coach access required/,
    );

    // Real invitation reservations/trigger work after the upgrade, at any depth.
    await db.exec("reset role");
    await db.query("update public.profiles set role='coach' where id=$1", [
      two,
    ]);
    const nonce = id(80),
      newcomer = id(8);
    await db.query("select public.reserve_athlete_invite('new@test',$1,$2)", [
      two,
      nonce,
    ]);
    await db.query("insert into auth.users values($1,'new@test',$2::jsonb)", [
      newcomer,
      JSON.stringify({ name: "New", invite_nonce: nonce }),
    ]);
    await login(root);
    assert.ok(
      (await people()).some((x) => x.id === newcomer && x.coachId === two),
    );
    await login(kate);
    assert.ok((await people()).some((x) => x.id === newcomer));
    // Disabling a child coach's login does not strand their existing athletes.
    await db.exec("reset role");
    await db.query("update public.profiles set active=false where id=$1", [
      kate,
    ]);
    await login(kate);
    assert.equal((await people()).length, 0);
    await login(root);
    assert.ok((await people()).some((x) => x.id === newcomer));
    // Demotion removes delegated coaching authority and the inherited branch.
    await db.exec("reset role");
    await db.query("update public.profiles set role='athlete' where id=$1", [
      kate,
    ]);
    await login(root);
    assert.deepEqual(
      (await people()).map((x) => x.id).sort(),
      [root, kate, direct].sort(),
    );
    await assert.rejects(
      () => db.query("select public.load_training_data($1)", [one]),
      /Access denied/,
    );
    await db.exec("reset role");
    await db.query(
      "update public.profiles set role='coach',active=true where id=$1",
      [kate],
    );
    // UNION terminates even if an administrator has created a legacy cycle.
    await db.exec("reset role");
    await db.query("insert into public.coach_athletes values($1,$2)", [
      root,
      two,
    ]);
    await login(root);
    assert.equal((await people()).length, 6);
    await db.exec("reset role");
    await db.query(
      "delete from public.coach_athletes where athlete_id in ($1,$2)",
      [root, kate],
    );
    await login(root);
    assert.deepEqual(
      (await people()).map((x) => x.id).sort(),
      [root, direct].sort(),
    );
    assert.equal((await inbox()).length, 0);
    await assert.rejects(
      () => db.query("select public.load_training_data($1)", [one]),
      /Access denied/,
    );
    await db.exec("reset role");
    await db.query("update public.profiles set active=false where id=$1", [
      root,
    ]);
    await login(root);
    assert.equal((await people()).length, 0);
    await assert.rejects(
      () => db.query("select public.load_training_data($1)", [root]),
      /Access denied/,
    );
    await db.exec("reset role; set role anon");
    await assert.rejects(
      () => db.query("select public.load_people()"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
