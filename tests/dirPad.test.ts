/**
 * 方向パッドの外寸の決まり（src/game/dirPad.ts）。
 *
 * DirPad の描画（行間 = 一辺 × 0.14・列間 10）と、プレイ画面の配分計算（game/playLayout.ts）が使う見積もりの係数
 * （高さ 3.3 × 一辺・幅 3.4 × 一辺）は、以前は別々の数だった。DirPad を変えても配分が追いつかないと、
 * パッドが盤に重なる・枠からはみ出す（DESIGN §8・§16 に直した履歴がある）。係数の値は変えない（見た目を変えない）ので、
 * 値そのものを固定し、「見積もりが実際の外寸以上」であることを、使われる一辺の範囲で確かめる。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIRPAD_COL_GAP,
  DIRPAD_H_PER_SIZE,
  DIRPAD_ROW_GAP_RATIO,
  DIRPAD_W_PER_SIZE,
  dirPadRowGap,
} from "../src/game/dirPad";
import { DIR_MAX, DIR_MIN, computePlayLayout } from "../src/game/playLayout";

test("定数の値: 行間の割合 0.14・列間 10・高さの係数 3.3・幅の係数 3.4", () => {
  assert.equal(DIRPAD_ROW_GAP_RATIO, 0.14);
  assert.equal(DIRPAD_COL_GAP, 10);
  assert.equal(DIRPAD_H_PER_SIZE, 3.3);
  assert.equal(DIRPAD_W_PER_SIZE, 3.4);
});

test("dirPadRowGap: 一辺 × 0.14 の四捨五入（DirPad の行間）", () => {
  const pins: [size: number, gap: number][] = [
    [52, 7], // 7.28
    [61, 9], // 8.54 → 切り上がる
    [66, 9], // 9.24
    [87, 12], // 12.18
    [97, 14], // 13.58 → 切り上がる
    [100, 14],
  ];
  for (const [size, gap] of pins) {
    assert.equal(dirPadRowGap(size), gap, `一辺 ${size}`);
  }
  assert.equal(dirPadRowGap(0), 0);
});

test("高さの見積もり（切り上げた 一辺 × 3.3）は、実際のパッドの高さ（ボタン 3 つ + 行間 2 つ）以上", () => {
  for (let size = 40; size <= 120; size++) {
    const actual = 3 * size + 2 * dirPadRowGap(size);
    assert.ok(
      actual <= Math.ceil(size * DIRPAD_H_PER_SIZE),
      `一辺 ${size}: 実際 ${actual} が見積もり ${Math.ceil(size * DIRPAD_H_PER_SIZE)} を超える`,
    );
  }
});

test("幅の見積もり（一辺 × 3.4）は、実際のパッドの幅（ボタン 3 つ + 列間 2 つ）以上（一辺 50 以上）", () => {
  for (let size = 50; size <= 120; size++) {
    const actual = 3 * size + 2 * DIRPAD_COL_GAP;
    assert.ok(
      actual <= size * DIRPAD_W_PER_SIZE,
      `一辺 ${size}: 実際 ${actual} が見積もり ${size * DIRPAD_W_PER_SIZE} を超える`,
    );
  }
  // 方向ボタンの下限（DIR_MIN）はこの前提（一辺 50 以上）を満たす
  assert.ok(DIR_MIN >= 50);
});

test("配分計算: 縦持ちのパッド帯の高さ（padAreaH）は、実際のパッド（3 辺 + 行間 2 つ）と下の余白 20 を含み、方向ボタンが下限・上限のどこでも足りる", () => {
  let checked = 0;
  for (let w = 320; w <= 1000; w += 20) {
    for (let h = 600; h <= 1100; h += 20) {
      for (const isQueue of [false, true]) {
        const r = computePlayLayout({
          width: w,
          height: h,
          cols: 4,
          rows: 4,
          isQueue,
          capacity: 9,
        });
        if (r.side) continue;
        const actual = 3 * r.dirSize + 2 * dirPadRowGap(r.dirSize) + 20;
        assert.ok(
          actual <= r.padAreaH,
          `${w}×${h} ${isQueue ? "②" : "①"}: 実際 ${actual} が見積もり ${r.padAreaH} を超える`,
        );
        assert.ok(r.dirSize >= DIR_MIN && r.dirSize <= DIR_MAX);
        checked++;
      }
    }
  }
  assert.ok(checked > 500, `確かめた組み合わせが少ない: ${checked}`);
});
