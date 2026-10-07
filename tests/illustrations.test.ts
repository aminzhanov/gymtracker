import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  DEFAULT_ILLUSTRATIONS,
  validateIllustrations,
  illustrationVariables,
} from "../src/illustrations.ts";
test("illustration settings keep phone and desktop independent and reject unsafe or oversized images", () => {
  const value = structuredClone(DEFAULT_ILLUSTRATIONS);
  value.dashboard.phone = { scale: 80, x: 12, y: -25 };
  value.dashboard.image = "data:image/webp;base64,AAAA";
  const saved = validateIllustrations(value);
  assert.deepEqual(saved.dashboard.desktop, { scale: 100, x: 0, y: 0 });
  assert.equal(
    illustrationVariables(saved.dashboard)["--art-phone-scale"],
    0.8,
  );
  assert.equal(
    illustrationVariables(saved.dashboard)["--art-phone-y"],
    "-25px",
  );
  for (const image of [
    "https://example.test/tracker.svg",
    "data:image/webp;base64," + "A".repeat(250000),
  ])
    assert.throws(() =>
      validateIllustrations({
        ...value,
        dashboard: { ...value.dashboard, image },
      }),
    );
  for (const phone of [
    { scale: 200, x: 0, y: 0 },
    { scale: 100, x: NaN, y: 0 },
  ])
    assert.throws(() =>
      validateIllustrations({
        ...value,
        dashboard: { ...value.dashboard, phone },
      }),
    );
});
test("illustration migration is rerunnable, coach scoped, and separate from training", async () => {
  const db = new PGlite();
  const coach = "00000000-0000-4000-8000-000000000001",
    athlete = "00000000-0000-4000-8000-000000000002",
    stranger = "00000000-0000-4000-8000-000000000003";
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/001_liftlog.sql", import.meta.url),
        "utf8",
      ),
    );
    const migration = await readFile(
      new URL(
        "../supabase/migrations/010_profile_illustrations.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    await db.query(
      "insert into auth.users values($1,'coach@example.test','{}'),($2,'athlete@example.test','{}'),($3,'stranger@example.test','{}')",
      [coach, athlete, stranger],
    );
    await db.query(
      "update public.profiles set role='coach' where id in ($1,$2)",
      [coach, stranger],
    );
    await db.query("insert into public.coach_athletes values($1,$2)", [
      athlete,
      coach,
    ]);
    const login = async (id: string) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    };
    const save = (owner: string, value: unknown) =>
      db.query("select public.save_profile_illustrations($1,$2::jsonb)", [
        owner,
        JSON.stringify(value),
      ]);
    const settings = structuredClone(DEFAULT_ILLUSTRATIONS);
    settings.dashboard.image = "data:image/webp;base64,AAAA";
    settings.dashboard.phone.y = -20;
    await login(coach);
    await save(athlete, settings);
    await save(coach, DEFAULT_ILLUSTRATIONS);
    assert.equal(
      (await db.query("select * from public.profile_illustrations")).rows
        .length,
      2,
    );
    assert.equal(
      (
        await db.query<{ revision: number }>(
          "select revision from public.user_settings where owner_user_id=$1",
          [athlete],
        )
      ).rows[0].revision,
      0,
    );
    await assert.rejects(
      () =>
        save(athlete, {
          ...settings,
          menu: { ...settings.menu, image: "data:image/svg+xml;base64,AAAA" },
        }),
      /Invalid illustration/,
    );
    await assert.rejects(
      () =>
        save(athlete, {
          ...settings,
          menu: { ...settings.menu, desktop: { scale: 100, x: 101, y: 0 } },
        }),
      /Invalid illustration/,
    );
    await login(athlete);
    const rows = (
      await db.query<{ illustrations: typeof settings }>(
        "select illustrations from public.profile_illustrations",
      )
    ).rows;
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].illustrations, settings);
    await assert.rejects(
      () => save(athlete, DEFAULT_ILLUSTRATIONS),
      /Coach access required/,
    );
    await assert.rejects(
      () =>
        db.query("update public.profile_illustrations set illustrations=$1", [
          JSON.stringify(DEFAULT_ILLUSTRATIONS),
        ]),
      /permission denied/,
    );
    await login(stranger);
    assert.equal(
      (await db.query("select * from public.profile_illustrations")).rows
        .length,
      0,
    );
    await assert.rejects(
      () => save(athlete, settings),
      /Coach access required/,
    );
    await db.exec("reset role");
    await db.query("update public.profiles set active=false where id=$1", [
      coach,
    ]);
    await login(coach);
    await assert.rejects(() => save(coach, settings), /Coach access required/);
  } finally {
    await db.close();
  }
});
