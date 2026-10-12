/**
 * 迷路の生成（src/game/generate.ts の generateLevelDebug）の安全保証を、多数回の生成で確かめる。
 *
 * 4 歳向けなので「詰み」・無限ループ・クラッシュは絶対に出せない（DESIGN §7）。DESIGN は
 * 「各テンプレートで 1,000 個（合計 50,000 個）生成し、(a) BFS 到達可能 (b) 最短手数 ≥ minSteps
 * (c) スタート≠ゴール・障害物と非重複 をスクリプトで確認」と書くが、そのスクリプトは repo に無かった。
 * ここがその代わり。件数は各テンプレート 2,000 個に縮め、乱数は種つき（同じ結果で再現できる）。
 *
 * 答え合わせに本体の bfsShortest は使わない（helpers/oracle.ts は別の方法）。「届くか」を本体の関数で
 * 確かめると、その関数が壊れたとき一緒に見逃してしまう。
 *
 * 検査するテンプレートは TEMPLATES から動的に列挙する（足したカードも自動で対象になる）。0 件なら失敗にする。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GOAL_EMOJIS,
  bfsShortest,
  generateLevelDebug,
} from "../src/game/generate";
import type { GenResult, GenStage } from "../src/game/generate";
import { TEMPLATES } from "../src/data/templates";
import type { Coord, Template } from "../src/types";
import { exactModel } from "./helpers/exactModel";
import { shortestBySettling } from "./helpers/oracle";
import { cyclingRandom, replaceRandom, seededRandom } from "./helpers/random";

const SAMPLES = 2000; // 1 テンプレートあたりの生成数（DESIGN は 1,000〜10,000）
const MAX_ATTEMPTS = 50; // DESIGN §7: 作り直しは 1 段あたり最大 50 回

const same = (a: Coord, b: Coord) => a.x === b.x && a.y === b.y;

/** どの段で採用された迷路でも守るべきこと。破れていたらその場で例外を投げる。 */
function assertPlayable(
  template: Template,
  result: GenResult,
  label: string,
): void {
  const { level, stage, shortest } = result;
  const where = `${label} [${stage}] ${JSON.stringify(level)}`;
  const { cols, rows } = template;
  const inside = (c: Coord) => c.x >= 0 && c.x < cols && c.y >= 0 && c.y < rows;

  // 生成元をそのまま引き継ぐ（⭐のキーは id。変わると進捗が別物になる）
  assert.equal(level.id, template.id, where);
  assert.equal(level.cols, cols, where);
  assert.equal(level.rows, rows, where);

  // (c) スタート≠ゴール・障害物と非重複
  assert.ok(inside(level.start) && inside(level.goal), `盤の外: ${where}`);
  assert.ok(!same(level.start, level.goal), `スタートとゴールが同じ: ${where}`);
  level.obstacles.forEach((o, i) => {
    assert.ok(inside(o), `障害物が盤の外: ${where}`);
    assert.ok(
      !same(o, level.start) && !same(o, level.goal),
      `障害物がスタート/ゴールと重なる: ${where}`,
    );
    assert.equal(
      level.obstacles.findIndex((p) => same(p, o)),
      i,
      `障害物が重複: ${where}`,
    );
  });

  // (a) 届く。報告された最短手数が、別の方法で求めた本当の最短手数と同じ
  const truth = shortestBySettling(level);
  assert.ok(truth !== null, `届かない: ${where}`);
  assert.equal(shortest, truth, `報告された最短手数が違う: ${where}`);
  assert.equal(bfsShortest(level), truth, `bfsShortest が違う: ${where}`);
  // (b) 最短手数 ≥ minSteps
  assert.ok(truth >= template.minSteps, `近すぎる: ${where}`);
  // ②で並べられる矢印の上限 = max(6, 最短 + 4)（DESIGN §16.4）
  assert.equal(level.maxSteps, Math.max(6, truth + 4), `上限本数: ${where}`);

  // 段ごとの約束
  const count = level.obstacles.length;
  if (stage === "natural") {
    assert.ok(
      count >= template.obstacleMin && count <= template.obstacleMax,
      `障害物の数がレンジの外: ${where}`,
    );
  } else if (stage === "reduced") {
    assert.ok(count <= template.obstacleMin, `減らしたはずが増えた: ${where}`);
  } else {
    // 最終保証: 対角コーナー・障害物ゼロ
    assert.equal(count, 0, where);
    assert.deepEqual(level.start, { x: 0, y: 0 }, where);
    assert.deepEqual(level.goal, { x: cols - 1, y: rows - 1 }, where);
    assert.equal(shortest, cols - 1 + (rows - 1), where);
  }

  // 生成のたびに決まる見た目まわり（写真はおとなモードで後から入れるので、生成直後は null。声は personal/store の録音が正本）
  assert.ok(GOAL_EMOJIS.includes(level.goalEmoji), `ゴール絵が不明: ${where}`);
  assert.equal(level.avatarEmoji, "🐥", where);
  assert.equal(level.goalImage, null, where);
}

test("テンプレートが 1 件以上読めている（0 件だと下の検査が空回りする）", () => {
  assert.ok(TEMPLATES.length > 0, "TEMPLATES が 0 件");
});

TEMPLATES.forEach((template, index) => {
  test(`generateLevelDebug: ${template.id} を ${SAMPLES} 個生成 → すべて (a)届く (b)最短≥minSteps (c)スタート≠ゴール・障害物と非重複`, (t) => {
    replaceRandom(t, seededRandom(1000 + index));
    const stages: Record<GenStage, number> = {
      natural: 0,
      reduced: 0,
      corner: 0,
    };
    const naturalCapacity = new Map<number, number>();
    const naturalObstacleCounts = new Set<number>();
    const emojis = new Set<string>();

    for (let i = 0; i < SAMPLES; i++) {
      const result = generateLevelDebug(template);
      assertPlayable(template, result, `${template.id} #${i}`);
      stages[result.stage]++;
      emojis.add(result.level.goalEmoji);
      if (result.stage === "natural") {
        naturalObstacleCounts.add(result.level.obstacles.length);
        const c = result.level.maxSteps;
        naturalCapacity.set(c, (naturalCapacity.get(c) ?? 0) + 1);
      }
    }

    // ほぼ全数が自然生成（DESIGN §7）。理論値: 1 回の試行の採用確率 p から 1-(1-p)^50。
    const model = exactModel(template);
    assert.ok(model.acceptRate > 0, "条件を満たす迷路が 1 つも無い");
    const expectedNatural = 1 - (1 - model.acceptRate) ** MAX_ATTEMPTS;
    const natural = stages.natural / SAMPLES;
    assert.ok(
      Math.abs(natural - expectedNatural) <= 0.02,
      `本命の段の成功率 ${natural}（理論値 ${expectedNatural}）`,
    );
    // 最終保証（対角コーナー）は、めったに使われない
    assert.ok(
      stages.corner / SAMPLES <= 0.01,
      `corner が多い: ${stages.corner}`,
    );

    // 乱数が実際に使われている: 障害物の数はレンジを使い切り、ゴールの絵は 12 種そろう
    const wanted: number[] = [];
    for (let k = template.obstacleMin; k <= template.obstacleMax; k++)
      wanted.push(k);
    assert.deepEqual(
      [...naturalObstacleCounts].sort((a, b) => a - b),
      wanted,
    );
    assert.equal(emojis.size, GOAL_EMOJIS.length);

    // 上限本数の出方は理論値（全数探索）に近い。出ないはずの本数は出ず、出た割合は理論値から 5σ（二項分布）以内。
    // DESIGN §16.4 の表の確かめにもなる。
    const naturalTotal = stages.natural;
    for (const capacity of naturalCapacity.keys()) {
      assert.ok(
        model.capacityShare.has(capacity),
        `出るはずのない上限 ${capacity} 本`,
      );
    }
    for (const [capacity, share] of model.capacityShare) {
      const seen = (naturalCapacity.get(capacity) ?? 0) / naturalTotal;
      const tolerance =
        5 * Math.sqrt((share * (1 - share)) / naturalTotal) + 0.005;
      assert.ok(
        Math.abs(seen - share) <= tolerance,
        `上限 ${capacity} 本の割合 ${seen}（理論値 ${share} ± ${tolerance}）`,
      );
    }
  });
});

// DESIGN §16.4 の 2 つの表（全数探索と 200,000 回生成の実測）。モデルは乱数を使わず数え上げるので、
// 文書の数字がいまの templates.json・生成の手順と合っているかをここで確かめられる。
const DESIGN_MAX_SHORTEST: Record<string, number> = {
  "level-01": 2,
  "level-02": 4,
  "level-03": 4,
  "level-04": 6,
  "level-05": 10,
};
const DESIGN_CAPACITY_PERCENT: Record<string, Record<number, number>> = {
  "level-01": { 6: 100 },
  "level-02": { 7: 89.0, 8: 11.0 },
  "level-03": { 8: 100 },
  "level-04": { 8: 72.0, 9: 18.8, 10: 9.3 },
  "level-05": { 9: 68.5, 10: 23.2, 11: 5.1, 12: 2.1, 13: 0.7, 14: 0.3 },
};

for (const template of TEMPLATES) {
  test(`全数探索: ${template.id} の最短手数の最大と上限本数の分布が DESIGN §16.4 の表どおり`, () => {
    const designMax = DESIGN_MAX_SHORTEST[template.id];
    const designShare = DESIGN_CAPACITY_PERCENT[template.id];
    assert.ok(
      designMax !== undefined && designShare !== undefined,
      `${template.id} が DESIGN §16.4 の表にありません。カードを足したときは、表（とこのテスト）を更新してください`,
    );
    const model = exactModel(template);
    assert.equal(model.maxShortest, designMax, "最短手数の最大");
    assert.deepEqual(
      [...model.capacityShare.keys()].sort((a, b) => a - b),
      Object.keys(designShare)
        .map(Number)
        .sort((a, b) => a - b),
      "出る上限本数の種類",
    );
    for (const [capacity, percent] of Object.entries(designShare)) {
      const actual = (model.capacityShare.get(Number(capacity)) ?? 0) * 100;
      // 表は 200,000 回生成の実測（誤差 ±0.1）なので、小数 1 桁の表と 0.3 ポイント以内で合えばよい
      assert.ok(
        Math.abs(actual - percent) <= 0.3,
        `${capacity} 本: 全数探索 ${actual.toFixed(2)}% / 表 ${percent}%`,
      );
    }
  });
}

// ── 段階的なフォールバック（DESIGN §7 安全保証 3）──────────────────────────
// 本命の段が必ず失敗するようなテンプレートを作り、障害物を減らす段・最終保証の段が働くことを確かめる。

test("フォールバック: 障害物を置く余地が無いなら、障害物 0 まで減らして迷路を返す（2x1・障害物 1）", (t) => {
  // 2 マスしか無く、スタートとゴールで埋まるので障害物は 1 つも置けない → 本命は必ず不採用。
  const template: Template = {
    id: "t-reduced-0",
    label: "ふたつだけ",
    cols: 2,
    rows: 1,
    obstacleMin: 1,
    obstacleMax: 1,
    minSteps: 1,
  };
  replaceRandom(t, seededRandom(1));
  for (let i = 0; i < 100; i++) {
    const result = generateLevelDebug(template);
    assertPlayable(template, result, `#${i}`);
    assert.equal(result.stage, "reduced", `#${i}`);
    assert.equal(result.level.obstacles.length, 0, `#${i}`);
    assert.equal(result.shortest, 1, `#${i}`);
  }
});

test("フォールバック: 指定の数では届かないなら、障害物を 1 つずつ減らす（2x2・障害物 2 → 1）", (t) => {
  // 障害物 2 だと、となりどうしは近すぎ（1 手 < 2）、ななめどうしは両方ふさがって届かない → 本命は必ず不採用。
  // 1 つに減らすと、ななめどうしが 2 手で届く。0 まで一気に落とさず、ちょうど 1 つで止まる。
  const template: Template = {
    id: "t-reduced-1",
    label: "かこまれた",
    cols: 2,
    rows: 2,
    obstacleMin: 2,
    obstacleMax: 2,
    minSteps: 2,
  };
  replaceRandom(t, seededRandom(2));
  for (let i = 0; i < 100; i++) {
    const result = generateLevelDebug(template);
    assertPlayable(template, result, `#${i}`);
    assert.equal(result.stage, "reduced", `#${i}`);
    assert.equal(result.level.obstacles.length, 1, `#${i}`);
    assert.equal(result.shortest, 2, `#${i}`);
  }
});

const LAST = 1 - Number.EPSILON / 2; // 1 未満でいちばん大きい数

test("最終保証: 乱数がどんなに偏っても、全テンプレートで必ず遊べる迷路を返す（対角コーナー）", (t) => {
  assert.ok(TEMPLATES.length > 0, "TEMPLATES が 0 件");
  replaceRandom(t, seededRandom(0));
  // 定数の乱数は、スタートとゴールがいつも同じマスになり、本命も減らす段もすべて不採用になる。
  const constants: [name: string, random: () => number, emoji: string][] = [
    ["0 だけ", () => 0, GOAL_EMOJIS[0]],
    ["0.5 だけ", () => 0.5, GOAL_EMOJIS[Math.floor(GOAL_EMOJIS.length / 2)]],
    ["1 未満の最大だけ", () => LAST, GOAL_EMOJIS[GOAL_EMOJIS.length - 1]],
  ];
  for (const template of TEMPLATES) {
    for (const [name, random, emoji] of constants) {
      Math.random = random;
      const result = generateLevelDebug(template);
      const label = `${template.id} / ${name}`;
      assertPlayable(template, result, label);
      assert.equal(result.stage, "corner", label);
      assert.equal(result.level.goalEmoji, emoji, label);
    }
    // 偏った周期の乱数でも、段は問わず、どれも遊べる迷路になる
    for (const values of [
      [0, LAST],
      [LAST, 0],
      [0, 0, LAST],
      [0.25, 0.75],
    ]) {
      Math.random = cyclingRandom(values);
      assertPlayable(
        template,
        generateLevelDebug(template),
        `${template.id} / 周期 ${values.join(",")}`,
      );
    }
  }
});
