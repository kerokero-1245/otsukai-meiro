/**
 * 画面に依らない純粋なロジックのモジュール（src/game/）は、react-native・expo・画面の部品を import しない。
 *
 * 配分計算（playLayout）・寸法の見積もり（queueStrip・textFit）・探索（generate・maze）・色決め（tileColor）を画面から
 * 切り出した目的は、Node のテストから、画面の部品や react-native の差し替えを介さずに読めること。1 つでも
 * react-native などを import すると、テストが stub に頼る（純関数ではなくなる）うえ、あとの変更で
 * 画面の都合が計算に入り込む。各ファイルの冒頭に書いた「react-native 非依存」を、ここで見張る。
 * 対象は src/game/ の全ファイルを実際に数え上げる（0 件なら失敗）。import は書いてある文面から集める。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GAME_DIR = path.join(
  fileURLToPath(new URL("..", import.meta.url)),
  "src",
  "game",
);

/** import の行き先（from "…" と import "…" と require("…"）。 */
function specifiers(source: string): string[] {
  const found: string[] = [];
  for (const re of [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    for (const m of source.matchAll(re)) found.push(m[1]);
  }
  return found;
}

/** 純粋なモジュールが import してはいけない行き先。 */
function forbidden(spec: string): boolean {
  return (
    spec === "react" ||
    spec === "react-native" ||
    spec === "react-dom" ||
    spec.startsWith("react-native/") ||
    spec === "expo" ||
    spec.startsWith("expo-") ||
    /(^|\/)(components|screens)\//.test(spec)
  );
}

test("src/game/ は 1 つ以上あり、.tsx（画面の部品）は置かない", () => {
  const files = readdirSync(GAME_DIR);
  assert.ok(files.length > 0, "src/game/ にファイルが 0 件");
  for (const name of [
    "maze.ts",
    "generate.ts",
    "playLayout.ts",
    "queueStrip.ts",
    "textFit.ts",
    "preview.ts",
    "tileColor.ts",
  ]) {
    assert.ok(files.includes(name), `${name} が src/game/ に無い`);
  }
  assert.deepEqual(
    files.filter((f) => f.endsWith(".tsx")),
    [],
    ".tsx は画面の部品",
  );
});

test("src/game/ のどのモジュールも、react-native・react・expo・画面の部品（components・screens）を import しない", () => {
  const violations: string[] = [];
  let checked = 0;
  for (const name of readdirSync(GAME_DIR)) {
    if (!name.endsWith(".ts")) continue;
    checked++;
    const source = readFileSync(path.join(GAME_DIR, name), "utf8");
    for (const spec of specifiers(source)) {
      if (forbidden(spec)) violations.push(`${name}: ${spec}`);
    }
  }
  assert.ok(checked >= 7, `数えたファイルが少ない: ${checked}`);
  assert.deepEqual(violations, []);
});

test("import の集め方の確認: from・import 単体・require を拾い、禁止の行き先を見分ける", () => {
  const sample = `
    import { a } from "../theme";
    import React from "react";
    import "expo-status-bar";
    const x = require("../components/Foo");
    export { y } from "react-native";
  `;
  assert.deepEqual(specifiers(sample), [
    "../theme",
    "react",
    "react-native",
    "expo-status-bar",
    "../components/Foo",
  ]);
  const verdicts = specifiers(sample).map(forbidden);
  assert.deepEqual(verdicts, [false, true, true, true, true]);
  assert.equal(forbidden("../layout"), false);
  assert.equal(forbidden("./maze"), false);
  assert.equal(
    forbidden("react-native-web"),
    false,
    "名前の頭だけが同じ別のもの",
  );
});
