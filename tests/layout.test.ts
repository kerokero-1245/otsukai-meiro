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
  FRAME_MAX_W,
  FRAME_MAX_W_WIDE,
  FRAME_PAD_BOTTOM,
  FRAME_PAD_H,
  FRAME_PAD_TOP,
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
