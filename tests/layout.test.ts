/**
 * 画面の枠の寸法と、「背の低い横向き」の判定（src/layout.ts）の現状を固定する。
 *
 * 判定が変わると、スマホの横持ちで盤と方向パッドが左右に分かれなくなり、level-05（4x4）の盤が上段に
 * 重なる（DESIGN §8・§16 に直した履歴がある）。逆に 1280x800 のような高さの足りる横長を対象にすると、
 * 広いのに盤が小さいままになる。境界（高さ 600 未満・幅が高さより大きい）は ぴよぴよさんすう と同じ。
 *
 * 枠の寸法は App.tsx・PlayScreen・ClearOverlay が共有する正本。画面の撮影はここでは行わないので、
 * 値そのものを固定して、見た目が黙って変わるのを防ぐ。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_BORDER,
  FRAME_MAX_W,
  FRAME_MAX_W_WIDE,
  FRAME_PAD_BOTTOM,
  FRAME_PAD_H,
  FRAME_PAD_TOP,
  frameInnerWidth,
  frameWidth,
  isCompactLandscape,
} from "../src/layout";

test("isCompactLandscape: スマホの横持ち（幅が高さより大きく、高さが 600 未満）は true", () => {
  const phones: [w: number, h: number][] = [
    [844, 390],
    [932, 430],
    [640, 360],
    [568, 320],
  ];
  for (const [w, h] of phones) {
    assert.equal(isCompactLandscape(w, h), true, `${w}x${h}`);
  }
});

test("isCompactLandscape: 高さの足りる横長（タブレット・PC）は false（従来どおり 1 列）", () => {
  for (const [w, h] of [
    [1280, 800],
    [1024, 768],
    [800, 600], // 高さがちょうど 600 は対象外
    [960, 601],
  ]) {
    assert.equal(isCompactLandscape(w, h), false, `${w}x${h}`);
  }
});

test("isCompactLandscape: 縦持ち・正方形は、小さくても false", () => {
  for (const [w, h] of [
    [390, 844],
    [360, 640],
    [320, 568],
    [768, 1024],
    [500, 500],
    [320, 320],
  ]) {
    assert.equal(isCompactLandscape(w, h), false, `${w}x${h}`);
  }
});

test("isCompactLandscape: 境界（高さ 599 と 600、幅が高さより 1 だけ大きい）", () => {
  assert.equal(isCompactLandscape(800, 599), true);
  assert.equal(isCompactLandscape(800, 600), false);
  assert.equal(isCompactLandscape(391, 390), true);
  assert.equal(isCompactLandscape(390, 390), false);
  assert.equal(isCompactLandscape(389, 390), false);
});

test("枠の寸法: 最大幅 480・横向きの広い枠 960・余白は上 28 / 下 20 / 左右 20", () => {
  assert.equal(FRAME_MAX_W, 480);
  assert.equal(FRAME_MAX_W_WIDE, 960);
  assert.equal(FRAME_PAD_TOP, 28);
  assert.equal(FRAME_PAD_BOTTOM, 20);
  assert.equal(FRAME_PAD_H, 20);
});

test("盤の枠線の太さ 3（MazeGrid の描画と、PlayScreen のマスの計算が同じ値を使う）", () => {
  assert.equal(BOARD_BORDER, 3);
});

// 枠の外寸・内側の幅。以前は 480 と左右の余白を、がんばりカード（Math.min(幅, 480) − 余白×2）・タイトル（FRAME_MAX_W を再定義）・
// 配分計算が別々に書いていた。layout.ts の値を変えたとき、一部の画面だけ旧い値で計算される事故の元。
test("frameWidth: 窓の幅と枠の最大幅（480。背の低い横向きのめいろ画面は 960）の小さいほう", () => {
  assert.equal(frameWidth(320), 320);
  assert.equal(frameWidth(390), 390);
  assert.equal(frameWidth(480), 480);
  assert.equal(frameWidth(481), 480);
  assert.equal(frameWidth(1280), 480);
  assert.equal(frameWidth(1280, true), 960);
  assert.equal(frameWidth(844, true), 844);
  assert.equal(frameWidth(960, true), 960);
  assert.equal(frameWidth(961, true), 960);
  assert.equal(frameWidth(320, false), 320, "wide を省いたときと false は同じ");
  assert.equal(frameWidth(1280), frameWidth(1280, false));
});

test("frameInnerWidth: 外寸から左右の余白（20 × 2）を引く。がんばりカードが直書きしていた Math.min(幅, 480) − 40 と同じ値", () => {
  for (const w of [0, 100, 320, 360, 390, 480, 481, 800, 1280, 5000]) {
    assert.equal(frameInnerWidth(w), Math.min(w, 480) - 40, `窓 ${w}`);
    assert.equal(
      frameInnerWidth(w, true),
      Math.min(w, 960) - 40,
      `窓 ${w}（広い枠）`,
    );
  }
  assert.equal(frameInnerWidth(390), 350);
  assert.equal(frameInnerWidth(1280), 440);
  assert.equal(frameInnerWidth(1280, true), 920);
});
