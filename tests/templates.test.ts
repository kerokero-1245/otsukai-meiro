/**
 * むずかしさテンプレート（src/data/templates.json）と、その読み込み口（src/data/templates.ts）の現状を固定する。
 *
 *  - id は進捗⭐の保存キー（localStorage の meiro.stars に入る）。変えると、いままでの⭐が別物になる（DESIGN §7）。
 *  - minSteps ≤ (cols-1)+(rows-1) は、生成の最終保証（対角コーナー・障害物ゼロ）が必ず成り立つ条件（DESIGN §7）。
 *    これを破るカードを足すと、どんな乱数でも遊べる、という保証が崩れる。
 *  - JSON は `as unknown as Template[]` で型を付けているだけ（読み込み時の検査が無い）なので、形をここで確かめる。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TEMPLATES,
  getNextTemplateId,
  getTemplate,
} from "../src/data/templates";

test("TEMPLATES: DESIGN §7 の表どおりの 5 枚（id・見出し・盤の大きさ・障害物の数・minSteps）", () => {
  assert.deepEqual(TEMPLATES, [
    {
      id: "level-01",
      label: "ちいさな めいろ",
      cols: 2,
      rows: 2,
      obstacleMin: 0,
      obstacleMax: 0,
      minSteps: 2,
    },
    {
      id: "level-02",
      label: "ちょっと おおきい",
      cols: 3,
      rows: 2,
      obstacleMin: 0,
      obstacleMax: 1,
      minSteps: 3,
    },
    {
      id: "level-03",
      label: "きの ある めいろ",
      cols: 3,
      rows: 3,
      obstacleMin: 1,
      obstacleMax: 1,
      minSteps: 4,
    },
    {
      id: "level-04",
      label: "きが おおい めいろ",
      cols: 3,
      rows: 3,
      obstacleMin: 2,
      obstacleMax: 2,
      minSteps: 4,
    },
    {
      id: "level-05",
      label: "おおきな めいろ",
      cols: 4,
      rows: 4,
      obstacleMin: 2,
      obstacleMax: 3,
      minSteps: 5,
    },
  ]);
});

test("TEMPLATES: id の並びは保存データ（meiro.stars）のキー。level-01〜level-05 のまま", () => {
  assert.deepEqual(
    TEMPLATES.map((t) => t.id),
    ["level-01", "level-02", "level-03", "level-04", "level-05"],
  );
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
});

test("TEMPLATES: どのカードも Template の形（欄は過不足なし・盤と手数は整数で正）", () => {
  assert.ok(TEMPLATES.length > 0, "TEMPLATES が 0 件");
  const fields = [
    "cols",
    "id",
    "label",
    "minSteps",
    "obstacleMax",
    "obstacleMin",
    "rows",
  ];
  for (const t of TEMPLATES) {
    assert.deepEqual(Object.keys(t).sort(), fields, t.id);
    assert.ok(typeof t.id === "string" && t.id !== "", t.id);
    assert.ok(typeof t.label === "string" && t.label !== "", t.id);
    for (const key of ["cols", "rows", "minSteps"] as const) {
      assert.ok(Number.isInteger(t[key]) && t[key] >= 1, `${t.id}.${key}`);
    }
    for (const key of ["obstacleMin", "obstacleMax"] as const) {
      assert.ok(Number.isInteger(t[key]) && t[key] >= 0, `${t.id}.${key}`);
    }
  }
});

test("TEMPLATES: 生成が必ず成り立つ条件（minSteps ≤ 対角の手数、障害物はスタートとゴールの 2 マスを空けて置ける）", () => {
  assert.ok(TEMPLATES.length > 0, "TEMPLATES が 0 件");
  for (const t of TEMPLATES) {
    assert.ok(
      t.obstacleMin <= t.obstacleMax,
      `${t.id}: obstacleMin > obstacleMax`,
    );
    assert.ok(
      t.obstacleMax <= t.cols * t.rows - 2,
      `${t.id}: 障害物がスタートとゴールの場所まで食う`,
    );
    assert.ok(
      t.minSteps <= t.cols - 1 + (t.rows - 1),
      `${t.id}: minSteps が対角コーナーの手数を超える`,
    );
  }
});

test("getTemplate: id でカードを引ける。無い id は undefined", () => {
  for (const t of TEMPLATES) assert.equal(getTemplate(t.id), t);
  assert.equal(getTemplate("level-99"), undefined);
  assert.equal(getTemplate(""), undefined);
  assert.equal(getTemplate("LEVEL-01"), undefined);
});

test("getNextTemplateId: 並び順の次のカードの id。最後のカードと無い id は undefined", () => {
  assert.ok(TEMPLATES.length > 0, "TEMPLATES が 0 件");
  TEMPLATES.forEach((t, i) => {
    assert.equal(getNextTemplateId(t.id), TEMPLATES[i + 1]?.id, t.id);
  });
  assert.equal(getNextTemplateId("level-01"), "level-02");
  assert.equal(getNextTemplateId("level-04"), "level-05");
  assert.equal(getNextTemplateId("level-05"), undefined);
  assert.equal(getNextTemplateId("level-99"), undefined);
  assert.equal(getNextTemplateId(""), undefined);
});
