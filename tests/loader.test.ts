/**
 * テストの読み込みの仕組み（tests/register.mjs）と、tests/stubs/ の差し替えが働いていることを確かめる。
 *
 * 純粋な関数のテストが通っても、画面の部品（.tsx）・画像と音声の require・expo-* の差し替えは使われない。
 * あとの群が src/ から純粋な関数を切り出す・画面の一部を試すときに、読み込みの仕組みが黙って壊れていると
 * 原因が分かりにくい。ここで「src/ の全モジュールが Node で import できる」ことを見張る。
 * （描画はしない。見た目は検査しない。）
 */
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CLIP_URLS } from "../src/audio/voiceClips";
import { AVATAR_GLYPH, OBSTACLE_GLYPH, artForGlyph } from "../src/art";
import { GOAL_EMOJIS } from "../src/game/generate";
import { importFresh } from "./helpers/importFresh";
import { Platform } from "./stubs/react-native";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** import できるはずのモジュール = src/ の .ts / .tsx 全部と、アプリの入口 App.tsx。 */
function moduleFiles(): string[] {
  const inSrc = readdirSync(path.join(ROOT, "src"), {
    recursive: true,
    encoding: "utf8",
  })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => path.join(ROOT, "src", file));
  return [...inSrc, path.join(ROOT, "App.tsx")];
}

afterEach(() => {
  Platform.OS = "web";
});

test("src/ のすべてのモジュールと App.tsx が Node で import できる（.tsx・画像と音声の require・react-native・expo-status-bar を含む）", async () => {
  const files = moduleFiles();
  // 列挙が空回りしていない（対象の取りこぼしがない）ことを先に確かめる
  assert.ok(
    files.some((f) => f.endsWith(path.join("game", "maze.ts"))),
    "maze.ts が対象にない",
  );
  assert.ok(
    files.some((f) => f.endsWith(".tsx")),
    ".tsx が対象にない",
  );
  assert.ok(
    files.some((f) => f.endsWith("App.tsx")),
    "App.tsx が対象にない",
  );

  const failures: string[] = [];
  for (const file of files) {
    try {
      await import(pathToFileURL(file).href);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${path.relative(ROOT, file)}: ${reason.split("\n")[0]}`);
    }
  }
  assert.deepEqual(failures, [], `${files.length} 個のうち読めなかったもの`);
});

test("画像・音声の require は、ファイルの場所を示す文字列になる（Metro が web で返すのと同じ形）", () => {
  assert.equal(artForGlyph("🍎"), "/assets/piyo/ringo.svg");
  assert.equal(artForGlyph("🐥"), "/assets/piyo/piyo.svg");
  assert.equal(artForGlyph("?"), undefined, "素材の無いグリフは undefined");
  // アバター・障害物の識別子（盤・タイトル・レベルえらびの見本・生成が同じ定数を使う）の値
  assert.equal(AVATAR_GLYPH, "🐥");
  assert.equal(OBSTACLE_GLYPH, "🌳");
  // ゴールの絵 12 種・アバター・木のすべてに素材がある（art.ts の require が全部読めている）
  for (const glyph of [...GOAL_EMOJIS, AVATAR_GLYPH, OBSTACLE_GLYPH]) {
    assert.equal(typeof artForGlyph(glyph), "string", glyph);
  }
  assert.equal(CLIP_URLS.p_tsuita, "/assets/voice/p_tsuita.m4a");
  assert.equal(CLIP_URLS.p_zenbu, "/assets/voice/p_zenbu.m4a");
});

test("src が import する react-native は tests/stubs/react-native.ts（Platform.OS を書き換えると src にも効く）", async () => {
  const rn = await import("react-native");
  assert.equal(rn.Platform, Platform);
  assert.equal(Platform.OS, "web", "テストの既定は web");
});

test("expo-* は tests/stubs/ に差し替えが無いと、足す場所の分かるエラーになる", async () => {
  const name = "expo-not-a-real-package";
  await assert.rejects(
    import(name),
    /tests\/stubs\/expo-not-a-real-package\.ts がありません/,
  );
});

test("importFresh: 読み込み直すたびに別の実体になり、モジュール内のキャッシュが初期状態に戻る", async () => {
  Platform.OS = "ios"; // 保存先を使わない（キャッシュだけで覚える）状態にして、実体どうしの独立を見る
  type Settings = typeof import("../src/settings");
  const a = await importFresh<Settings>("settings.ts");
  const b = await importFresh<Settings>("settings.ts");
  assert.notEqual(a, b);
  a.setPlayMode("queue");
  assert.equal(a.getPlayMode(), "queue");
  assert.equal(b.getPlayMode(), "tap");
  assert.equal(
    (await importFresh<Settings>("settings.ts")).getPlayMode(),
    "tap",
  );
});
