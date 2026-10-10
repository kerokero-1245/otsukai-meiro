/**
 * 迷路生成まわりの小さな関数（src/game/generate.ts）の現状を固定する。多数回の生成の性質は
 * generateProperties.test.ts。
 *
 *  - queueCapacity … ②で並べられる矢印の上限。「最短手数 + よゆう 4 本、最低 6 本」（DESIGN §16.4）。
 *    ここが小さいと「一本道の完璧な手順」しか許されず、まわり道もやり直しの余白も無くなる。
 *  - bfsShortest … 生成の安全保証の要（届かない迷路を不採用にする・最短手数を測る）。幅優先探索を
 *    別の方法（helpers/oracle.ts）と突き合わせる。M-07 で move() を使う形へ書き直す予定なので、
 *    書き直しても同じ答えを返すことをこのテストで守る。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GOAL_EMOJIS,
  QUEUE_MIN_CAPACITY,
  QUEUE_SLACK,
  bfsShortest,
  generateLevel,
  generateLevelDebug,
  queueCapacity,
} from "../src/game/generate";
import { TEMPLATES } from "../src/data/templates";
import type { Coord, Level } from "../src/types";
import { makeLevel } from "./helpers/level";
import { shortestBySettling } from "./helpers/oracle";
import { replaceRandom, seededRandom } from "./helpers/random";

test("queueCapacity: 最短手数 + 4 本、ただし最低 6 本（DESIGN §16.4）", () => {
  assert.equal(QUEUE_SLACK, 4);
  assert.equal(QUEUE_MIN_CAPACITY, 6);
  const table: [shortest: number, capacity: number][] = [
    [0, 6],
    [1, 6],
    [2, 6], // 2 + 4 = 6 ちょうど
    [3, 7], // ここから「最短 + 4」が最低 6 を超える
    [4, 8],
    [5, 9],
    [6, 10],
    [10, 14], // ⑤ 4x4 で起こりうる最長（DESIGN §16.4）
  ];
  for (const [shortest, capacity] of table) {
    assert.equal(queueCapacity(shortest), capacity, `最短 ${shortest} 手`);
  }
});

test("queueCapacity: 最短手数が増えても減らず、いつも最短手数より 4 本以上多く置ける", () => {
  let before = queueCapacity(0);
  for (let shortest = 1; shortest <= 30; shortest++) {
    const capacity = queueCapacity(shortest);
    assert.ok(capacity >= before, `最短 ${shortest} 手で上限が減った`);
    assert.ok(capacity >= shortest + 4, `最短 ${shortest} 手に余裕が足りない`);
    assert.ok(capacity >= 6);
    before = capacity;
  }
});

// 手で数えた答えのある盤。start / goal / obstacles 以外は 既定（makeLevel）のまま。
const bfsCases: {
  name: string;
  level: Level;
  expected: number | null;
}[] = [
  {
    name: "障害物なしの 3x3 を左上から右下へ = 4 手（縦横の合計）",
    level: makeLevel(),
    expected: 4,
  },
  {
    name: "となりのマス = 1 手",
    level: makeLevel({ goal: { x: 1, y: 0 } }),
    expected: 1,
  },
  {
    name: "スタートとゴールが同じマス = 0 手",
    level: makeLevel({ goal: { x: 0, y: 0 } }),
    expected: 0,
  },
  {
    name: "真ん中が木でも、周りを通って 4 手",
    level: makeLevel({ obstacles: [{ x: 1, y: 1 }] }),
    expected: 4,
  },
  {
    name: "壁をよけて回り道 = 6 手（(1,0)(1,1) が木で、下をぐるっと回る）",
    level: makeLevel({
      goal: { x: 2, y: 0 },
      obstacles: [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    }),
    expected: 6,
  },
  {
    name: "縦に 1 列ぜんぶ木なら、届かない",
    level: makeLevel({
      obstacles: [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
      ],
    }),
    expected: null,
  },
  {
    name: "ゴールが木のマスなら、届かない",
    level: makeLevel({ obstacles: [{ x: 2, y: 2 }] }),
    expected: null,
  },
  {
    name: "スタートが木のマスなら、届かない",
    level: makeLevel({ obstacles: [{ x: 0, y: 0 }] }),
    expected: null,
  },
  {
    name: "長方形 4x2 を左上から右下へ = 4 手（列と行を取り違えない）",
    level: makeLevel({ cols: 4, rows: 2, goal: { x: 3, y: 1 } }),
    expected: 4,
  },
  {
    name: "長方形 2x4 を左上から右下へ = 4 手",
    level: makeLevel({ cols: 2, rows: 4, goal: { x: 1, y: 3 } }),
    expected: 4,
  },
  {
    // DESIGN §16.4: ⑤（4x4・障害物 3）で起こりうる最長の最短手数 = 10。
    //   #S..      S=スタート (1,0)  G=ゴール (0,1)  #=木 (0,0)(1,1)(2,2)
    //   G#..      ななめどなりなのに、木にはさまれて右下の角をぐるっと回る。
    //   ..#.      (1,0)→(2,0)→(2,1)→(3,1)→(3,2)→(3,3)→(2,3)→(1,3)→(1,2)→(0,2)→(0,1)
    //   ....
    name: "4x4 で、ななめどなりなのに木にはさまれて 10 手（⑤で起こりうる最長）",
    level: makeLevel({
      cols: 4,
      rows: 4,
      start: { x: 1, y: 0 },
      goal: { x: 0, y: 1 },
      obstacles: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
    }),
    expected: 10,
  },
];

for (const { name, level, expected } of bfsCases) {
  test(`bfsShortest: ${name}`, () => {
    assert.equal(bfsShortest(level), expected);
    // 答え合わせ役（別の方法）も同じ答えを返す＝この表が正しい
    assert.equal(shortestBySettling(level), expected);
  });
}

test("bfsShortest: 渡した迷路を書き換えない", () => {
  const level = makeLevel({
    obstacles: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
    goal: { x: 2, y: 0 },
  });
  const before = JSON.parse(JSON.stringify(level)) as Level;
  bfsShortest(level);
  assert.deepEqual(level, before);
});

test("bfsShortest: 小さな盤をランダムに 3000 個作り、別の方法の答えと一致する（届かない・同じマスも含む）", (t) => {
  replaceRandom(t, seededRandom(20261011));
  const rand = (n: number) => Math.floor(Math.random() * n);
  let reachable = 0;
  let unreachable = 0;
  for (let i = 0; i < 3000; i++) {
    const cols = 1 + rand(5);
    const rows = 1 + rand(5);
    const cell = (): Coord => ({ x: rand(cols), y: rand(rows) });
    const obstacles: Coord[] = [];
    const density = Math.random() * 0.6;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (Math.random() < density) obstacles.push({ x, y });
      }
    }
    const level = makeLevel({
      cols,
      rows,
      start: cell(),
      goal: cell(),
      obstacles,
    });
    const expected = shortestBySettling(level);
    assert.equal(bfsShortest(level), expected, JSON.stringify(level));
    if (expected === null) unreachable++;
    else reachable++;
  }
  // 両方の場合をちゃんと含んでいる（片方しか出ない作りだと、突き合わせの意味がない）
  assert.ok(reachable > 300, `届く盤が少ない: ${reachable}`);
  assert.ok(unreachable > 300, `届かない盤が少ない: ${unreachable}`);
});

test("GOAL_EMOJIS: ゴールの絵は 12 種で重複なし（DESIGN §7。素材との対応は loader.test.ts）", () => {
  assert.deepEqual(
    [...GOAL_EMOJIS],
    ["🍎", "🏠", "🍰", "🍓", "🎈", "🍦", "🎁", "🌷", "🍭", "🐰", "🚗", "🍩"],
  );
  assert.equal(new Set(GOAL_EMOJIS).size, GOAL_EMOJIS.length);
});

test("generateLevel: 同じ乱数なら generateLevelDebug の level と同じ迷路（公開 API はその level だけを返す）", (t) => {
  assert.ok(TEMPLATES.length > 0, "テンプレートが 0 件");
  replaceRandom(t, seededRandom(0));
  for (const template of TEMPLATES) {
    Math.random = seededRandom(11);
    const viaDebug = generateLevelDebug(template).level;
    Math.random = seededRandom(11);
    const direct = generateLevel(template);
    assert.deepEqual(direct, viaDebug, template.id);
  }
});
