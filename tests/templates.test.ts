/**
 * むずかしさテンプレート（src/data/templates.json）と、その読み込み口（src/data/templates.ts）の現状を固定する。
 *
 *  - id は進捗⭐の保存キー（localStorage の meiro.stars に入る）。変えると、いままでの⭐が別物になる（DESIGN §7）。
 *  - minSteps ≤ (cols-1)+(rows-1) は、生成の最終保証（対角コーナー・障害物ゼロ）が必ず成り立つ条件（DESIGN §7）。
 *    これを破るカードを足すと、どんな乱数でも遊べる、という保証が崩れる。
 *  - JSON は読み込み時に parseTemplates で検査する（壊れた欄は、何件目の何かを書いて例外）。検査そのものと、
 *    同梱の JSON の形をここで確かめる。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import rawTemplates from "../src/data/templates.json";
import {
  TEMPLATES,
  getNextTemplateId,
  getTemplate,
  parseTemplates,
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

// ── parseTemplates（読み込み時の検査）──────────────────────────────────────────

/** 正しい 1 件。ここから 1 つの欄だけ壊して、例外になることを確かめる。 */
const GOOD = {
  id: "level-x",
  label: "ためし",
  cols: 3,
  rows: 3,
  obstacleMin: 0,
  obstacleMax: 1,
  minSteps: 2,
};

test("parseTemplates: 同梱の templates.json をそのまま通し、TEMPLATES と同じ中身（欄の取りこぼし・並び替えが無い）", () => {
  assert.deepEqual(parseTemplates(rawTemplates), TEMPLATES);
  assert.deepEqual(parseTemplates(rawTemplates), rawTemplates);
  assert.equal(
    TEMPLATES.length,
    5,
    "カードは 5 枚（がんばりカードの⭐の数もここから決まる）",
  );
});

test("parseTemplates: 正しい 1 件はそのまま通る。知らない欄は落とす。境界の値（cols 1・障害物 0 個・対角ちょうど）も通る", () => {
  assert.deepEqual(parseTemplates([GOOD]), [GOOD]);
  assert.deepEqual(parseTemplates([{ ...GOOD, extra: "余計" }]), [GOOD]);
  assert.deepEqual(parseTemplates([]), []);
  const edge = { ...GOOD, cols: 1, rows: 2, obstacleMax: 0, minSteps: 1 };
  assert.deepEqual(
    parseTemplates([edge]),
    [edge],
    "1×2: 対角の手数 1 に minSteps 1",
  );
  const diagonal = { ...GOOD, cols: 4, rows: 4, obstacleMax: 14, minSteps: 6 };
  assert.deepEqual(
    parseTemplates([diagonal]),
    [diagonal],
    "対角ちょうど・障害物は 2 マスを空けた残りまで",
  );
});

test("parseTemplates: 配列でないもの・要素がオブジェクトでないものは例外", () => {
  for (const bad of [undefined, null, "x", 1, {}, { 0: GOOD }]) {
    assert.throws(
      () => parseTemplates(bad),
      /配列/,
      JSON.stringify(bad) ?? "undefined",
    );
  }
  for (const item of [null, 1, "a", [], [GOOD], undefined]) {
    assert.throws(
      () => parseTemplates([item]),
      /1 件目: オブジェクトではありません/,
      JSON.stringify(item) ?? "undefined",
    );
  }
});

test("parseTemplates: 欄が壊れていたら、何件目のどの欄かを書いて例外（欄ごとに 1 つずつ壊して確かめる）", () => {
  const cases: [field: string, bad: unknown[]][] = [
    ["id", [undefined, "", 5, null]],
    ["label", [undefined, "", 5, null]],
    ["cols", [undefined, 0, -1, 1.5, "3", null]],
    ["rows", [undefined, 0, -1, 1.5, "3", null]],
    ["obstacleMin", [undefined, -1, 0.5, "0", null]],
    ["obstacleMax", [undefined, -1, 0.5, "1", null]],
    ["minSteps", [undefined, 0, -1, 1.5, "2", null]],
  ];
  const first = { ...GOOD, id: "level-a" };
  for (const [field, values] of cases) {
    for (const value of values) {
      const item: Record<string, unknown> = { ...GOOD, id: "level-b" };
      if (value === undefined) delete item[field];
      else item[field] = value;
      assert.throws(
        () => parseTemplates([first, item]),
        new RegExp(`2 件目: ${field} が`),
        `${field} = ${JSON.stringify(value) ?? "なし"}`,
      );
    }
  }
});

test("parseTemplates: id の重なり・障害物の最小が最大より大きい・障害物が置き場所を食う・minSteps が対角を超える、は例外", () => {
  assert.throws(
    () => parseTemplates([GOOD, { ...GOOD, label: "別" }]),
    /2 件目: id「level-x」が重なっています/,
  );
  assert.throws(
    () => parseTemplates([{ ...GOOD, obstacleMin: 2, obstacleMax: 1 }]),
    /1 件目: obstacleMin が obstacleMax より大きい/,
  );
  // 3×3 は 9 マス。スタートとゴールを除いた 7 個まで置ける
  assert.doesNotThrow(() => parseTemplates([{ ...GOOD, obstacleMax: 7 }]));
  assert.throws(
    () => parseTemplates([{ ...GOOD, obstacleMax: 8 }]),
    /1 件目: obstacleMax が、スタートとゴールの 2 マスを空けた残りのマス数を超えています/,
  );
  // 3×3 の対角の手数は 4
  assert.doesNotThrow(() => parseTemplates([{ ...GOOD, minSteps: 4 }]));
  assert.throws(
    () => parseTemplates([{ ...GOOD, minSteps: 5 }]),
    /1 件目: minSteps が対角コーナーの最短手数/,
  );
  // 1×1 には、別々のスタートとゴールを置けない
  assert.throws(
    () =>
      parseTemplates([
        { ...GOOD, cols: 1, rows: 1, obstacleMax: 0, minSteps: 1 },
      ]),
    /1 件目: /,
  );
});
