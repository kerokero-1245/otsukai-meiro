/**
 * 盤面の移動ロジック（src/game/maze.ts）の現状を固定する。
 *
 * ①タップも②ならべてゴーも、1 マスの移動と行き先の判定はすべてここを通る（DESIGN §7・§16.3）。
 * 座標と向きの約束（x=列 左→右、y=行 上→下、どちらも 0 起点。▲=y−1 ▼=y+1 ◀=x−1 ▶=x+1）が
 * ずれると、押した矢印と逆に動く・壁をすり抜ける・首をかしげるはずの所で進む、が起きる。
 * 盤は正方形だけでなく 3x2 のような長方形も使うので、列と行の取り違えを見つける形を混ぜてある。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canMove,
  inBounds,
  includesCoord,
  isGoal,
  isObstacle,
  move,
  sameCoord,
} from "../src/game/maze";
import type { Direction } from "../src/types";
import { makeLevel } from "./helpers/level";

test("move: 向きと座標の約束（▲=y−1 ▼=y+1 ◀=x−1 ▶=x+1）", () => {
  const from = { x: 1, y: 1 };
  assert.deepEqual(move(from, "up"), { x: 1, y: 0 });
  assert.deepEqual(move(from, "down"), { x: 1, y: 2 });
  assert.deepEqual(move(from, "left"), { x: 0, y: 1 });
  assert.deepEqual(move(from, "right"), { x: 2, y: 1 });
});

test("move: 盤の内か外かは見ず、元の座標も書き換えない", () => {
  const from = { x: 0, y: 0 };
  assert.deepEqual(move(from, "left"), { x: -1, y: 0 });
  assert.deepEqual(move(from, "up"), { x: 0, y: -1 });
  assert.deepEqual(from, { x: 0, y: 0 });
  assert.notEqual(move(from, "right"), from);
});

test("inBounds: 0 以上で cols / rows 未満のマスだけ true（3x2 の盤）", () => {
  const level = makeLevel({ cols: 3, rows: 2 });
  const inside = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 1 },
  ];
  const outside = [
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 3, y: 0 }, // 列は 0〜2
    { x: 1, y: 2 }, // 行は 0〜1
    { x: 3, y: 2 },
    { x: -1, y: -1 },
  ];
  for (const c of inside)
    assert.equal(inBounds(level, c), true, JSON.stringify(c));
  for (const c of outside)
    assert.equal(inBounds(level, c), false, JSON.stringify(c));
});

test("isObstacle: 障害物のマスだけ true（x と y を入れ替えたマスは別のマス）", () => {
  const level = makeLevel({
    obstacles: [
      { x: 1, y: 1 },
      { x: 2, y: 0 },
    ],
  });
  assert.equal(isObstacle(level, { x: 1, y: 1 }), true);
  assert.equal(isObstacle(level, { x: 2, y: 0 }), true);
  assert.equal(isObstacle(level, { x: 0, y: 2 }), false);
  assert.equal(isObstacle(level, { x: 0, y: 1 }), false);
  assert.equal(isObstacle(level, { x: 2, y: 2 }), false);
});

test("isObstacle: 障害物のない盤は、どのマスも false", () => {
  const level = makeLevel({ obstacles: [] });
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      assert.equal(isObstacle(level, { x, y }), false);
    }
  }
});

test("includesCoord: 座標のリストにその座標があるときだけ true（x と y を入れ替えたマスは別のマス・空のリストは常に false）", () => {
  const list = [
    { x: 1, y: 0 },
    { x: 2, y: 3 },
  ];
  assert.equal(includesCoord(list, { x: 1, y: 0 }), true);
  assert.equal(includesCoord(list, { x: 2, y: 3 }), true);
  assert.equal(includesCoord(list, { x: 0, y: 1 }), false); // (1,0) の x と y を入れ替え
  assert.equal(includesCoord(list, { x: 3, y: 2 }), false);
  assert.equal(includesCoord(list, { x: 1, y: 3 }), false); // x は片方・y はもう片方に一致
  assert.equal(includesCoord([], { x: 0, y: 0 }), false);
});

test("includesCoord と isObstacle: 障害物の判定は、障害物のリストの includesCoord と同じ", () => {
  const level = makeLevel({
    cols: 3,
    rows: 3,
    obstacles: [
      { x: 1, y: 1 },
      { x: 2, y: 0 },
    ],
  });
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      assert.equal(
        isObstacle(level, { x, y }),
        includesCoord(level.obstacles, { x, y }),
        `${x},${y}`,
      );
    }
  }
});

test("canMove: 盤の外へは進めない（四辺とも）", () => {
  const level = makeLevel(); // 3x3
  assert.equal(canMove(level, { x: 0, y: 1 }, "left"), false);
  assert.equal(canMove(level, { x: 2, y: 1 }, "right"), false);
  assert.equal(canMove(level, { x: 1, y: 0 }, "up"), false);
  assert.equal(canMove(level, { x: 1, y: 2 }, "down"), false);
});

test("canMove: 長方形の盤でも、列と行を取り違えずに外を判定する（4x2）", () => {
  const level = makeLevel({ cols: 4, rows: 2, goal: { x: 3, y: 1 } });
  assert.equal(canMove(level, { x: 2, y: 1 }, "right"), true); // x=3 はまだ盤の中
  assert.equal(canMove(level, { x: 3, y: 1 }, "right"), false); // x=4 は外
  assert.equal(canMove(level, { x: 3, y: 0 }, "down"), true); // y=1 はまだ盤の中
  assert.equal(canMove(level, { x: 3, y: 1 }, "down"), false); // y=2 は外
});

test("canMove: 障害物のマスへは進めない（四方向とも）", () => {
  const level = makeLevel({ obstacles: [{ x: 1, y: 1 }] });
  assert.equal(canMove(level, { x: 0, y: 1 }, "right"), false);
  assert.equal(canMove(level, { x: 2, y: 1 }, "left"), false);
  assert.equal(canMove(level, { x: 1, y: 0 }, "down"), false);
  assert.equal(canMove(level, { x: 1, y: 2 }, "up"), false);
});

test("canMove: 空いているマスへは進める（ゴールのマスにも入れる）", () => {
  const level = makeLevel({ obstacles: [{ x: 1, y: 1 }] });
  assert.equal(canMove(level, { x: 0, y: 0 }, "right"), true);
  assert.equal(canMove(level, { x: 0, y: 0 }, "down"), true);
  assert.equal(canMove(level, { x: 2, y: 1 }, "down"), true); // 次は (2,2) = ゴール
  assert.equal(canMove(level, { x: 1, y: 2 }, "right"), true);
});

test("isGoal: ゴールのマスだけ true", () => {
  const level = makeLevel({ goal: { x: 2, y: 0 } });
  assert.equal(isGoal(level, { x: 2, y: 0 }), true);
  assert.equal(isGoal(level, { x: 0, y: 2 }), false); // x と y を入れ替えたマス
  assert.equal(isGoal(level, { x: 2, y: 1 }), false);
  assert.equal(isGoal(level, level.start), false);
});

test("sameCoord: x も y も同じときだけ true", () => {
  assert.equal(sameCoord({ x: 1, y: 2 }, { x: 1, y: 2 }), true);
  assert.equal(sameCoord({ x: 1, y: 2 }, { x: 2, y: 1 }), false);
  assert.equal(sameCoord({ x: 1, y: 2 }, { x: 1, y: 3 }), false);
  assert.equal(sameCoord({ x: 1, y: 2 }, { x: 0, y: 2 }), false);
});

test("move と canMove: 障害物をよけて、スタートからゴールまで歩ける", () => {
  // 3x3 の真ん中が木。右右下下で、左上 → 右下の 4 手。
  const level = makeLevel({ obstacles: [{ x: 1, y: 1 }] });
  const route: Direction[] = ["right", "right", "down", "down"];
  let pos = level.start;
  for (const dir of route) {
    assert.equal(
      canMove(level, pos, dir),
      true,
      `${JSON.stringify(pos)} から ${dir}`,
    );
    pos = move(pos, dir);
  }
  assert.equal(isGoal(level, pos), true);
  // 真ん中を通る道は、木があるので途中で止まる。
  assert.equal(canMove(level, level.start, "down"), true);
  assert.equal(canMove(level, { x: 0, y: 1 }, "right"), false);
});
