/**
 * 盤のマスの下地の色（src/game/tileColor.ts の tileColor）。
 * 本番の盤（MazeGrid）とカードのミニめいろ（MazePreview）が同じ規則で塗る。優先は ゴール ＞ 障害物 ＞ 市松。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tileColor } from "../src/game/tileColor";
import { colors } from "../src/theme";

test("市松: (x + y) が偶数なら明るい色、奇数なら暗い色", () => {
  assert.equal(tileColor(0, 0, false, false), colors.tileLight);
  assert.equal(tileColor(1, 0, false, false), colors.tileDark);
  assert.equal(tileColor(0, 1, false, false), colors.tileDark);
  assert.equal(tileColor(1, 1, false, false), colors.tileLight);
  assert.equal(tileColor(3, 2, false, false), colors.tileDark);
  assert.equal(tileColor(3, 3, false, false), colors.tileLight);
});

test("ゴールのマスはゴールの色（市松より優先）", () => {
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [3, 3],
    [2, 1],
  ]) {
    assert.equal(tileColor(x, y, true, false), colors.goalTile, `${x},${y}`);
  }
});

test("障害物のマスは障害物の色（市松より優先）", () => {
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [3, 3],
    [2, 1],
  ]) {
    assert.equal(
      tileColor(x, y, false, true),
      colors.obstacleTile,
      `${x},${y}`,
    );
  }
});

test("ゴールと障害物が重なったら ゴールの色（ゴール ＞ 障害物）", () => {
  assert.equal(tileColor(1, 1, true, true), colors.goalTile);
});

test("色は theme の値そのもの（#FFFFFF / #FBE7C4 / #FFF3B0 / #DDEFD0）", () => {
  assert.equal(tileColor(0, 0, false, false), "#FFFFFF");
  assert.equal(tileColor(1, 0, false, false), "#FBE7C4");
  assert.equal(tileColor(0, 0, true, false), "#FFF3B0");
  assert.equal(tileColor(0, 0, false, true), "#DDEFD0");
});
