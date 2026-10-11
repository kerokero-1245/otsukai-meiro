/**
 * ②ならべてゴー の「命令の列」の帯の寸法（src/game/queueStrip.ts の measureQueueStrip）。
 *
 * DESIGN §16.2: 帯の高さは上限本数によらず 64px 固定（＝⌫ の一辺）。矢印のマスは表示だけなので、
 * その一定の高さと横幅の両方に収まる中でいちばん大きくなる並べ方を選ぶ（1 行に入るなら 1 行、入らなければ折り返す）。
 * 以前は「1 行 7 個まで・1 マス最大 44px」だったため、いちばんよく出る上限 9〜10 本が帯 96px になり、
 * 上限 14 本（帯 66px）より厚い、という逆転が起きていた。値は手計算で出し、式を写さない。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BAND_H,
  CHIP_GAP,
  UNDO_SIZE,
  measureQueueStrip,
} from "../src/game/queueStrip";

test("定数: ⌫ は 64pt の巨大タップ領域（§4）、帯の高さはその一辺、マスのすきまは 8", () => {
  assert.equal(UNDO_SIZE, 64);
  assert.equal(BAND_H, 64);
  assert.equal(CHIP_GAP, 8);
});

test("390×844 の ②（帯に使える幅 350）: 上限 9 本は 5 個ずつ 2 行・マス 28、上限 14 本は 7 個ずつ 2 行・マス 28、上限 6 本は 1 行・マス 39", () => {
  // 並べられる幅 = 350 − ⌫ 64 − すきま 8 = 278。
  // 9 本: 1 行 = floor((278 − 8×8) / 9) = 23 / 2 行（5+4）= min(floor((278 − 32) / 5) = 49, floor((64 − 8) / 2) = 28) = 28 / 3 行 = 16 → 2 行・28
  assert.deepEqual(measureQueueStrip(350, 9), {
    chip: 28,
    perRow: 5,
    rows: 2,
    height: 64,
  });
  // 14 本: 1 行 = floor((278 − 8×13) / 14) = 12 / 2 行 = min(floor((278 − 48) / 7) = 32, 28) = 28 / 3 行 = 16
  assert.deepEqual(measureQueueStrip(350, 14), {
    chip: 28,
    perRow: 7,
    rows: 2,
    height: 64,
  });
  // 6 本: 1 行 = floor((278 − 40) / 6) = 39（上限 44 以下・高さ 64 以下）/ 2 行 = 28 → 1 行・39
  assert.deepEqual(measureQueueStrip(350, 6), {
    chip: 39,
    perRow: 6,
    rows: 1,
    height: 64,
  });
});

test("515×684 の ②（帯に使える幅 440）: 上限 9 本は 1 行に入る（マス 33）。同点でなく大きいほうを選ぶ", () => {
  // 並べられる幅 = 440 − 72 = 368。1 行 = floor((368 − 64) / 9) = 33 / 2 行 = min(67, 28) = 28 → 1 行が勝つ
  assert.deepEqual(measureQueueStrip(440, 9), {
    chip: 33,
    perRow: 9,
    rows: 1,
    height: 64,
  });
});

test("マスの上限 44: 広い画面で上限が少ないときも 44 より大きくしない", () => {
  // 並べられる幅 = 900 − 72 = 828。6 本 1 行 = floor((828 − 40) / 6) = 131 → 上限 44
  const r = measureQueueStrip(900, 6);
  assert.equal(r.chip, 44);
  assert.equal(r.rows, 1);
});

test("極端に細い画面: 並べられる幅は最低 60、マスは最低 6 までで、つぶれても帯の高さは変わらない", () => {
  // 幅 100 → 並べられる幅 = max(60, 28) = 60。6 本: 1 行 3 / 2 行 = 14 / 3 行（2+2+2）= min(26, 16) = 16 → 3 行・16
  assert.deepEqual(measureQueueStrip(100, 6), {
    chip: 16,
    perRow: 2,
    rows: 3,
    height: 64,
  });
  // 14 本: 3 行（5+5+4）= min(floor((60 − 32) / 5) = 5, 16) = 5 → 下限 6 に持ち上げる
  assert.deepEqual(measureQueueStrip(100, 14), {
    chip: 6,
    perRow: 5,
    rows: 3,
    height: 64,
  });
});

test("上限本数は 1 以上の整数に丸める（0・小数・負でも壊れない）", () => {
  assert.deepEqual(measureQueueStrip(350, 0), measureQueueStrip(350, 1));
  assert.deepEqual(measureQueueStrip(350, -3), measureQueueStrip(350, 1));
  assert.deepEqual(measureQueueStrip(350, 9.9), measureQueueStrip(350, 9));
});

test("性質: どの幅・上限でも 帯の高さは 64・行は最大 3・空の行を作らない・収まる中で最大のマスを選ぶ", () => {
  const MAX_ROWS = 3;
  let checked = 0;
  for (let width = 60; width <= 700; width += 10) {
    for (let capacity = 1; capacity <= 14; capacity++) {
      const r = measureQueueStrip(width, capacity);
      const where = `幅${width} 上限${capacity}本`;
      assert.equal(r.height, BAND_H, where);
      assert.ok(r.rows >= 1 && r.rows <= MAX_ROWS, `${where}: 行数 ${r.rows}`);
      assert.ok(r.perRow * r.rows >= capacity, `${where}: 全部並ぶ`);
      assert.ok((r.rows - 1) * r.perRow < capacity, `${where}: 空の行がある`);
      assert.ok(r.chip >= 6 && r.chip <= 44, `${where}: マス ${r.chip}`);

      // 答え合わせ: 1 行あたりの個数をすべて試し（行数 3 まで）、収まる中で最大のマス（下限 6）になっているか
      const usable = Math.max(60, width - UNDO_SIZE - CHIP_GAP);
      let best = 0;
      for (let perRow = 1; perRow <= capacity; perRow++) {
        const rows = Math.ceil(capacity / perRow);
        if (rows > MAX_ROWS) continue;
        const byWidth = Math.floor((usable - CHIP_GAP * (perRow - 1)) / perRow);
        const byHeight = Math.floor((BAND_H - CHIP_GAP * (rows - 1)) / rows);
        best = Math.max(best, Math.min(byWidth, byHeight, 44));
      }
      assert.equal(r.chip, Math.max(6, best), `${where}: マスの大きさ`);

      // つぶれていない（下限 6 に持ち上げていない）なら、実際に幅と高さに収まる
      if (r.chip > 6) {
        assert.ok(
          r.perRow * r.chip + CHIP_GAP * (r.perRow - 1) <= usable,
          `${where}: 幅に収まる`,
        );
        assert.ok(
          r.rows * r.chip + CHIP_GAP * (r.rows - 1) <= BAND_H,
          `${where}: 高さに収まる`,
        );
      }
      checked++;
    }
  }
  assert.ok(checked > 800, `確かめた組み合わせが少ない: ${checked}`);
});

test("非単調の逆転が無い: 360×640 の ②（帯に使える幅 320）で、上限 9 本の帯が 14 本の帯より厚くならない", () => {
  // 帯の高さが上限本数によらず一定なので、いちばんよく出る 9〜10 本が 14 本より盤を損することは無い（DESIGN §16.2）
  const heights = [6, 7, 8, 9, 10, 11, 12, 13, 14].map(
    (c) => measureQueueStrip(320, c).height,
  );
  assert.deepEqual(new Set(heights), new Set([64]));
});
