/**
 * プレイ画面の縦横の配分（src/game/playLayout.ts の computePlayLayout）。
 *
 * DESIGN §16.2 は実測表（390×844 で ①②の方向ボタン 87・マス 86/80・帯 64 など）を仕様として持ち、
 * §8・§14・§16 には「盤が上段に 40px 重なっていた」「非単調の逆転」「枠線ぶん 6px かぶっていた」など、
 * この計算の不具合の修正履歴が並ぶ。計算は画面コンポーネントの中にあって確かめる手段が無かったので、
 * 純関数にして、表の値を正解として固定する。係数（3.3・3.4・0.42・340・116・320 など）の値は変えない。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CELL_MAX,
  CELL_MIN,
  DIR_MAX,
  DIR_MIN,
  GAP,
  HEADER_H,
  computePlayLayout,
} from "../src/game/playLayout";
import { BAND_H, measureQueueStrip } from "../src/game/queueStrip";
import { QUEUE_MIN_CAPACITY } from "../src/game/generate";
import { BOARD_BORDER, isCompactLandscape } from "../src/layout";

/** 4×4（level-05）の配分。上限本数は盤の寸法に関わらないので、既定は最頻の 9 本。 */
function layout(
  width: number,
  height: number,
  isQueue: boolean,
  opts: { cols?: number; rows?: number; capacity?: number } = {},
) {
  return computePlayLayout({
    width,
    height,
    cols: opts.cols ?? 4,
    rows: opts.rows ?? 4,
    isQueue,
    capacity: opts.capacity ?? 9,
  });
}

// DESIGN §16.2 の実測表（4×4・①=タップ / ②=ならべてゴー・単位 px）。
const DESIGN_TABLE = [
  { w: 390, h: 844, tapDir: 87, queueDir: 87, tapCell: 86, queueCell: 80 },
  { w: 515, h: 684, tapDir: 66, queueDir: 66, tapCell: 77, queueCell: 58 },
  { w: 1280, h: 800, tapDir: 81, queueDir: 81, tapCell: 93, queueCell: 74 },
  { w: 360, h: 640, tapDir: 61, queueDir: 61, tapCell: 70, queueCell: 51 },
];

test("DESIGN §16.2 の表: 390×844・515×684・1280×800・360×640 の ①②の方向ボタン・マス・帯", () => {
  for (const row of DESIGN_TABLE) {
    for (const capacity of [6, 9, 14]) {
      const tap = layout(row.w, row.h, false, { capacity });
      const queue = layout(row.w, row.h, true, { capacity });
      const where = `${row.w}×${row.h} 上限${capacity}本`;
      assert.equal(tap.side, false, where);
      assert.equal(tap.dirSize, row.tapDir, `${where} ①方向ボタン`);
      assert.equal(tap.cell, row.tapCell, `${where} ①マス`);
      assert.equal(tap.strip, null, `${where} ①に帯は無い`);
      assert.equal(queue.dirSize, row.queueDir, `${where} ②方向ボタン`);
      assert.equal(queue.cell, row.queueCell, `${where} ②マス`);
      assert.equal(queue.strip?.height, 64, `${where} ②の帯`);
    }
  }
});

test("手計算で組み立て直した 390×844（①②）: 式の途中の値まで表と合う", () => {
  // 窓 390×844（縦持ち）。枠の内側の幅 = min(390, 480) − 20×2 = 350。縦に使える高さ = 844 − (28+20) = 796。
  // 本体の高さ bodyH = 796 − 上段 64 = 732。方向パッド帯の取り分 = min(732×0.42, 340) = 307.44。
  // 方向ボタン = floor((307.44 − 20) / 3.3) = 87（幅の側は floor(350 / 3.4) = 102・上限 100 より小さい 87 が勝つ）。
  // パッド帯の高さ = ceil(87×3.3) + 20 = 288 + 20 = 308。
  const tap = layout(390, 844, false);
  assert.equal(tap.frameW, 350);
  assert.equal(tap.availH, 796);
  assert.equal(tap.contentW, 350);
  assert.equal(tap.dirSize, 87);
  assert.equal(tap.padAreaH, 308);
  // ① 盤に使える高さ = 732 − (308 + 20) = 404。マス = floor(min((350−6)/4 = 86, (404−6)/4 = 99.5, 116)) = 86。
  assert.equal(tap.boardBudgetH, 404);
  assert.equal(tap.cell, 86);

  // ② 帯 = 64 + 上マージン 12 = 76 を、方向パッドからは引かず盤から引く。
  // 方向パッドの取り分は ① と同じ 307.44（余りの padRoom = 732 − 76 − 20 − (4×44+6) = 454 は取り分より大きいので効かない）→ 87。
  // 盤に使える高さ = 732 − 76 − 328 = 328。マス = floor(min(86, (328−6)/4 = 80.5, 116)) = 80。
  const queue = layout(390, 844, true);
  assert.equal(queue.stripH, 76);
  assert.equal(queue.dirSize, 87, "タップ標的は ① と同じ大きさ");
  assert.equal(queue.boardBudgetH, 328);
  assert.equal(queue.cell, 80);
});

test("②の命令の列は、上限本数によらず帯の高さが 64 で、マス・方向ボタンも変わらない（縦持ち・横向きとも）", () => {
  for (const [w, h] of [
    [390, 844],
    [360, 640],
    [844, 390],
    [568, 320],
  ]) {
    const base = layout(w, h, true, { capacity: 6 });
    for (let capacity = 6; capacity <= 14; capacity++) {
      const r = layout(w, h, true, { capacity });
      assert.equal(r.strip?.height, BAND_H, `${w}×${h} 上限${capacity}本`);
      assert.equal(r.cell, base.cell, `${w}×${h} 上限${capacity}本のマス`);
      assert.equal(
        r.dirSize,
        base.dirSize,
        `${w}×${h} 上限${capacity}本の方向ボタン`,
      );
    }
  }
});

test("②の帯の寸法は、縦持ちでは盤・命令の列に使える幅で、横向きでは右の列（方向パッドと同じ幅）で決める。①は帯なし", () => {
  for (const capacity of [6, 9, 14]) {
    const portrait = layout(390, 844, true, { capacity });
    assert.deepEqual(
      portrait.strip,
      measureQueueStrip(portrait.contentW, capacity),
    );
    assert.equal(portrait.contentW, 350);
    const landscape = layout(844, 390, true, { capacity });
    assert.deepEqual(
      landscape.strip,
      measureQueueStrip(landscape.sidePadW, capacity),
    );
    assert.equal(landscape.sidePadW, 242);
    assert.equal(layout(390, 844, false, { capacity }).strip, null);
    assert.equal(layout(844, 390, false, { capacity }).strip, null);
  }
});

test("縦持ち: 高さ 600 以上では、上段・帯・盤・方向パッドが重ならず、②の方向ボタンは ① と同じ大きさ（DESIGN §4・§16.6）", () => {
  const boards: [number, number][] = [
    [2, 2],
    [3, 2],
    [3, 3],
    [4, 4],
  ];
  let checked = 0;
  for (let w = 320; w <= 1400; w += 20) {
    for (let h = 600; h <= 1100; h += 20) {
      if (isCompactLandscape(w, h)) continue;
      for (const [cols, rows] of boards) {
        for (const capacity of [6, 9, 14]) {
          const tap = layout(w, h, false, { cols, rows, capacity });
          const queue = layout(w, h, true, { cols, rows, capacity });
          const where = `${w}×${h} ${cols}×${rows} 上限${capacity}本`;
          for (const [mode, r] of [
            ["①", tap],
            ["②", queue],
          ] as const) {
            // 上から: 上段 ＋ 帯 ＋ 盤（マス目全体＋枠線）＋ 余白 ＋ 方向パッド帯
            const used =
              HEADER_H +
              r.stripH +
              rows * r.cell +
              2 * BOARD_BORDER +
              GAP +
              r.padAreaH;
            assert.ok(
              used <= r.availH,
              `${where} ${mode}: 使う高さ ${used} が ${r.availH} を超える`,
            );
            assert.ok(
              r.dirSize >= DIR_MIN && r.dirSize <= DIR_MAX,
              `${where} ${mode} 方向ボタン ${r.dirSize}`,
            );
            assert.ok(
              r.cell >= CELL_MIN && r.cell <= CELL_MAX,
              `${where} ${mode} マス ${r.cell}`,
            );
          }
          assert.equal(
            queue.dirSize,
            tap.dirSize,
            `${where}: ②の方向ボタンは ① と同じ`,
          );
          assert.equal(queue.strip?.height, 64, where);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 5000, `確かめた組み合わせが少ない: ${checked}`);
});

test("縦持ち: 背が低すぎて収まらない画面では、重なりより下限（マス 44・方向ボタン 52）を優先する", () => {
  // 320×568 の ②（4×4）: 上段 64 + 帯 76 + 盤の下限 182 + 余白 20 + パッド帯 192 = 534 > 使える高さ 520。
  const r = layout(320, 568, true);
  assert.equal(r.availH, 520);
  assert.equal(r.cell, 44);
  assert.equal(r.dirSize, 52);
  assert.equal(r.strip?.height, 64);
  // 縦持ちの使える高さには下限 320 がある（極端に低い窓でも計算が破綻しない）。幅が高さより大きい窓は横向きの扱いになる
  const tiny = layout(300, 330, true);
  assert.equal(tiny.side, false);
  assert.equal(tiny.availH, 320);
  assert.ok(Number.isFinite(tiny.cell) && Number.isFinite(tiny.dirSize));
});

test("幅の狭い画面は方向ボタンの大きさが幅で決まる（枠の内側の幅 ÷ 3.4）", () => {
  // 320×900（縦持ち）: 枠の内側 280。高さからは floor((331.0 − 20) / 3.3) = 94 まで取れるが、幅は floor(280 / 3.4) = 82 まで。
  // パッド帯 = ceil(82×3.3) + 20 = 291、盤に使える高さ = 788 − (291 + 20) = 477。
  // マス = floor(min((280 − 6) / 4 = 68.5, (477 − 6) / 4 = 117.75, 116)) = 68（幅で決まる）。
  const r = layout(320, 900, false);
  assert.equal(r.dirSize, 82);
  assert.equal(r.padAreaH, 291);
  assert.equal(r.boardBudgetH, 477);
  assert.equal(r.cell, 68);
});

test("マスの上限 116 と、方向ボタンの上限 100（横向き）。定数の値そのもの（44・52・100・116）も固定する", () => {
  assert.deepEqual([CELL_MIN, CELL_MAX, DIR_MIN, DIR_MAX], [44, 116, 52, 100]);
  // 2×2 の盤が大画面でも 116 より大きくならない（1280×800: 枠の内側 440 ÷ 2 は 217、高さは 404 以上ある）
  assert.equal(layout(1280, 800, false, { cols: 2, rows: 2 }).cell, 116);
  // 縦持ちの方向ボタンは、パッド帯の取り分の上限 340 から floor((340−20)/3.3) = 96 までしか大きくならない
  assert.equal(layout(1280, 1100, false).dirSize, 96);
  // 横向き 932×430 は右の列の高さに余裕があり、上限 100 に当たる
  assert.equal(layout(932, 430, false).dirSize, 100);
});

test("背の低い横向き（スマホの横持ち）: 左に上段＋盤、右に方向パッド（②は帯もここ）。現状の値を固定する", () => {
  // 手計算（844×390 ①）: 枠の内側 = min(844, 960) − 40 = 804、使える高さ = 390 − 48 = 342（横向きは下限 320 を使わない）。
  // 方向ボタン = max(52, min(floor((342 − 0 − 20) / 3.3) = 97, floor((804 − 20 − 320 − 20) / 3) = 148, 100)) = 97。
  // 右の列の幅 = 97×3 + 20 = 311、盤・帯に使える幅 = 804 − 311 − 20 = 473。
  // 盤: 本体の高さ = 342 − 64 = 278（横向きは帯も方向パッドも引かない）。マス = floor(min((473−6)/4, (278−6)/4 = 68, 116)) = 68。
  const a = layout(844, 390, false);
  assert.equal(a.side, true);
  assert.equal(a.availH, 342);
  assert.equal(a.dirSize, 97);
  assert.equal(a.sidePadW, 311);
  assert.equal(a.contentW, 473);
  assert.equal(a.cell, 68);
  assert.equal(a.padAreaH, 0);
  assert.equal(
    a.stripH,
    0,
    "横向きの帯は右の列に置くので、盤の高さからは引かない",
  );

  // ② は右の列の高さから帯（64 + 12）を引いた残りで方向ボタンを決める: floor((342 − 76 − 20) / 3.3) = 74。
  // 帯は右の列（方向パッドと同じ幅）に収める。盤のマスは ① と同じ（帯は盤の高さを食わない）。
  const b = layout(844, 390, true);
  assert.equal(b.dirSize, 74);
  assert.equal(b.sidePadW, 74 * 3 + 20);
  assert.equal(b.cell, 68);
  assert.equal(b.strip?.height, 64);

  // ほかのスマホの横持ち（いまの値の固定）
  const pins: [number, number, boolean, number, number][] = [
    // [幅, 高さ, ②か, 方向ボタン, マス]
    [568, 320, false, 56, 50],
    [568, 320, true, 53, 50],
    [932, 430, false, 100, 78],
    [932, 430, true, 86, 78],
    [640, 360, false, 80, 60],
    [640, 360, true, 65, 60],
  ];
  for (const [w, h, isQueue, dir, cell] of pins) {
    const r = layout(w, h, isQueue);
    assert.equal(r.side, true, `${w}×${h}`);
    assert.equal(r.dirSize, dir, `${w}×${h} ${isQueue ? "②" : "①"} 方向ボタン`);
    assert.equal(r.cell, cell, `${w}×${h} ${isQueue ? "②" : "①"} マス`);
  }
});

test("背の低い横向き: 左の列の盤が上段に重ならない（以前は 844×390 で 40px・568×320 と 640×360 で 50px 重なっていた / DESIGN §8）", () => {
  for (const [w, h] of [
    [844, 390],
    [932, 430],
    [640, 360],
    [568, 320],
  ]) {
    for (const isQueue of [false, true]) {
      const r = layout(w, h, isQueue);
      const boardH = 4 * r.cell + 2 * BOARD_BORDER;
      assert.ok(
        HEADER_H + boardH <= r.availH,
        `${w}×${h} ${isQueue ? "②" : "①"}: 上段 ${HEADER_H} + 盤 ${boardH} が ${r.availH} を超える`,
      );
      // 右の列: 方向パッド（高さ ≒ 3.3 辺）が列の高さに収まる。②は帯のぶんも
      const column = (isQueue ? BAND_H + 12 : 0) + Math.ceil(r.dirSize * 3.3);
      assert.ok(
        column + 20 <= r.availH,
        `${w}×${h} ${isQueue ? "②" : "①"}: 右の列 ${column + 20} が ${r.availH} を超える`,
      );
      // 左の列には、上段（実測 320）が収まる幅が残る
      assert.ok(r.contentW >= 320, `${w}×${h}: 左の列の幅 ${r.contentW}`);
    }
  }
});

test("枠の外へ出る幅・横向きの判定は layout.ts に従う（横向きは枠の最大幅 960）", () => {
  // 1280×800 は横長でも高さが足りるので 1 列（枠の最大幅 480）
  assert.equal(layout(1280, 800, false).side, false);
  assert.equal(layout(1280, 800, false).frameW, 480 - 40);
  // 1280×390 のような広い横向きは 960 まで
  const wide = layout(1280, 390, false);
  assert.equal(wide.side, true);
  assert.equal(wide.frameW, 960 - 40);
});

test("盤が 1×1・上限が最小のとき（レベルが見つからない保険の既定）でも有限の値を返す", () => {
  for (const [w, h] of [
    [390, 844],
    [844, 390],
    [320, 200],
  ]) {
    for (const isQueue of [false, true]) {
      const r = layout(w, h, isQueue, {
        cols: 1,
        rows: 1,
        capacity: QUEUE_MIN_CAPACITY,
      });
      for (const v of [
        r.cell,
        r.dirSize,
        r.sidePadW,
        r.frameW,
        r.contentW,
        r.availH,
      ]) {
        assert.ok(Number.isFinite(v), `${w}×${h}`);
      }
    }
  }
});
