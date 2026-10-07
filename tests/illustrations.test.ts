import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  DEFAULT_ILLUSTRATIONS,
  validateIllustrations,
  illustrationVariables,
  ILLUSTRATION_SLOTS,
  ILLUSTRATION_PRESET_IDS,
} from "../src/illustrations.ts";
test("illustration settings keep phone and desktop independent and reject unsafe or oversized images", () => {
  const value = structuredClone(DEFAULT_ILLUSTRATIONS);
  value.dashboard.phone = { scale: 80, x: 12, y: -25 };
  value.dashboard.image = "data:image/webp;base64,AAAA";
  const saved = validateIllustrations(value);
  assert.deepEqual(
    saved.dashboard.desktop,
    DEFAULT_ILLUSTRATIONS.dashboard.desktop,
  );
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
test("rotation preserves legacy positions and stays independent for desktop and phone", () => {
  const value = structuredClone(DEFAULT_ILLUSTRATIONS);
  assert.equal(
    illustrationVariables(value.todayEmpty)["--art-rotation"],
    "0deg",
  );
  value.todayEmpty.desktop.rotation = 45;
  value.todayEmpty.desktop.x = 100;
  value.todayEmpty.phone.rotation = -90;
  value.todayEmpty.phone.x = -100;
  const saved = validateIllustrations(value);
  assert.equal(saved.todayEmpty.desktop.rotation, 45);
  assert.equal(saved.todayEmpty.phone.rotation, -90);
  const variables = illustrationVariables(saved.todayEmpty);
  assert.equal(variables["--art-rotation"], "45deg");
  assert.equal(variables["--art-phone-rotation"], "-90deg");
  assert.equal(variables["--art-position-x"], "100%");
  assert.equal(variables["--art-phone-position-x"], "0%");
  for (const rotation of [NaN, Infinity, -181, 181, null, "45"])
    assert.throws(() =>
      validateIllustrations({
        ...value,
        todayEmpty: {
          ...value.todayEmpty,
          phone: { ...value.todayEmpty.phone, rotation },
        },
      }),
    );
});
test("legacy profiles gain new placements without changing original art, and every slot is validated", () => {
  const legacy = {
    dashboard: structuredClone(DEFAULT_ILLUSTRATIONS.dashboard),
    menu: structuredClone(DEFAULT_ILLUSTRATIONS.menu),
  };
  legacy.dashboard.phone.y = -17;
  const upgraded = validateIllustrations(legacy);
  assert.deepEqual(upgraded.dashboard, legacy.dashboard);
  assert.deepEqual(upgraded.planner, DEFAULT_ILLUSTRATIONS.planner);
  upgraded.planner.phone.x = 99;
  assert.equal(DEFAULT_ILLUSTRATIONS.planner.phone.x, 0);
  for (const slot of ILLUSTRATION_SLOTS) {
    assert.throws(() =>
      validateIllustrations({
        ...upgraded,
        [slot]: { ...upgraded[slot], enabled: "yes" },
      }),
    );
    assert.throws(() =>
      validateIllustrations({
        ...upgraded,
        [slot]: { ...upgraded[slot], image: "https://example.test/image" },
      }),
    );
    assert.throws(() =>
      validateIllustrations({
        ...upgraded,
        [slot]: { ...upgraded[slot], phone: { scale: 100, x: 0, y: -101 } },
      }),
    );
  }
  assert.equal(
    validateIllustrations({
      ...upgraded,
      todayEmpty: { ...upgraded.todayEmpty, enabled: false },
    }).todayEmpty.enabled,
    false,
  );
});
test("all bundled image choices are valid WebP assets and roundtrip without embedding image bytes", async () => {
  for (const preset of ILLUSTRATION_PRESET_IDS) {
    const asset = await readFile(
      new URL(`../src/assets/${preset}.webp`, import.meta.url),
    );
    assert.equal(asset.toString("ascii", 0, 4), "RIFF");
    assert.equal(asset.toString("ascii", 8, 12), "WEBP");
    const value = structuredClone(DEFAULT_ILLUSTRATIONS);
    value.dashboard.preset = preset;
    assert.equal(validateIllustrations(value).dashboard.preset, preset);
  }
  assert.equal(ILLUSTRATION_PRESET_IDS.length, 21);
  assert.throws(() =>
    validateIllustrations({
      ...DEFAULT_ILLUSTRATIONS,
      menu: { ...DEFAULT_ILLUSTRATIONS.menu, preset: "unknown" },
    }),
  );
  assert.throws(() =>
    validateIllustrations({
      ...DEFAULT_ILLUSTRATIONS,
      menu: {
        ...DEFAULT_ILLUSTRATIONS.menu,
        image: "data:image/webp;base64,AAAA",
        preset: "cat-face",
      },
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
    // A real pre-update row must survive migration, not just a normalized fixture.
    const legacy = {
      dashboard: structuredClone(DEFAULT_ILLUSTRATIONS.dashboard),
      menu: structuredClone(DEFAULT_ILLUSTRATIONS.menu),
    };
    legacy.dashboard.phone.y = -31;
    await db.query(
      "insert into public.profile_illustrations values($1,$2::jsonb)",
      [athlete, JSON.stringify(legacy)],
    );
    const sectionsMigration = await readFile(
      new URL(
        "../supabase/migrations/012_illustration_sections.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(sectionsMigration);
    await db.exec(sectionsMigration);
    await login(coach);
    const load = (id: string) =>
      db.query<{
        load_profile_illustrations: {
          sectionsReady: boolean;
          illustrations: unknown;
        };
      }>("select public.load_profile_illustrations($1)", [id]);
    assert.deepEqual((await load(athlete)).rows[0].load_profile_illustrations, {
      sectionsReady: true,
      illustrations: legacy,
    });
    const settings = structuredClone(DEFAULT_ILLUSTRATIONS);
    for (const slot of ILLUSTRATION_SLOTS) {
      settings[slot].image = "data:image/webp;base64," + "A".repeat(240000);
      delete settings[slot].preset;
    }
    settings.planner.phone = { scale: 85, x: 20, y: -12 };
    settings.inboxEmpty.enabled = false;
    settings.dashboard.phone.y = -20;
    await login(coach);
    await save(athlete, settings);
    await save(coach, DEFAULT_ILLUSTRATIONS);
    settings.todayEmpty.image = null;
    settings.todayEmpty.preset = "sticker21";
    // Rotation uses existing JSON settings; no database update is needed.
    settings.todayEmpty.desktop.rotation = 45;
    settings.todayEmpty.phone.rotation = -90;
    await save(athlete, settings);
    assert.deepEqual(
      (await load(athlete)).rows[0].load_profile_illustrations.illustrations,
      settings,
    );
    await assert.rejects(
      () =>
        save(athlete, {
          ...settings,
          todayEmpty: { ...settings.todayEmpty, preset: "unknown" },
        }),
      /Invalid illustration/,
    );
    await assert.rejects(
      () =>
        save(athlete, {
          ...settings,
          todayEmpty: {
            ...settings.todayEmpty,
            image: "data:image/webp;base64,AAAA",
          },
        }),
      /Invalid illustration/,
    );
    await save(athlete, { dashboard: settings.dashboard, menu: settings.menu });
    assert.deepEqual(
      (await load(athlete)).rows[0].load_profile_illustrations.illustrations,
      settings,
    );
    for (const slot of ILLUSTRATION_SLOTS) {
      await assert.rejects(
        () =>
          save(athlete, {
            ...settings,
            [slot]: {
              ...settings[slot],
              image: "data:image/svg+xml;base64,AAAA",
            },
          }),
        /Invalid illustration/,
      );
      await assert.rejects(
        () =>
          save(athlete, {
            ...settings,
            [slot]: { ...settings[slot], enabled: 1 },
          }),
        /Invalid illustration/,
      );
    }
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
    await assert.rejects(() => load(athlete), /Access denied/);
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
