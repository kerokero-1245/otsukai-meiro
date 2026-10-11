/**
 * 題字・見出しを 1 行に収める文字の大きさ（src/game/textFit.ts の titleFontSize・promptFontSize）。
 *
 * どちらも「入力（窓の幅）→ 出力（文字の大きさ）」だけの見積もりで、DESIGN §8 と各関数のコメントに具体値がある。
 * 値の根拠: タイトルは 1 字 = 1em ＋ 字間 1px × 7 字を、枠の幅（最大 480）から左右 8px ずつ離した幅に収める。
 * 見出しは 6.31 × 大きさ（実測）の幅を、◀（52）と右の空き（52）・左右の余白（20）を引いた幅に収める。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BACK_W,
  CROWN_W,
  TITLE_LETTER_SPACING,
  promptFontSize,
  titleFontSize,
} from "../src/game/textFit";

test("titleFontSize: 390・360 幅は 44（従来どおり）、320 幅は 42（DESIGN §8）、広い画面は 44 のまま", () => {
  assert.equal(titleFontSize(390), 44);
  assert.equal(titleFontSize(360), 44);
  assert.equal(titleFontSize(320), 42);
  assert.equal(titleFontSize(1280), 44);
  assert.equal(titleFontSize(480), 44);
});

test("titleFontSize: 44 を割り始めるのは 330 幅から（手計算: (幅 − 16 − 7) ÷ 7 の切り捨て）", () => {
  // 330 幅 = 枠の幅 330 − 左右 8×2 = 314 → floor((314 − 7) / 7) = 43。331 幅 = 315 → 44
  assert.equal(titleFontSize(330), 43);
  assert.equal(titleFontSize(331), 44);
  // 320 幅 = 304 → floor((304 − 7) / 7) = 42。300 幅 = 284 → floor(277 / 7) = 39
  assert.equal(titleFontSize(300), 39);
});

test("titleFontSize: 枠の最大幅 480 を超える窓でも 480 で見積もる（枠より広くならない）", () => {
  // 331 幅から 44（font.huge の上限）に当たるので、480 での頭打ちは数値としては現れない（枠の最大幅が小さくなったときの保険）
  assert.equal(titleFontSize(481), titleFontSize(480));
  assert.equal(titleFontSize(5000), titleFontSize(480));
  assert.equal(titleFontSize(5000), 44);
});

test("titleFontSize: 7 字 + 字間が 1 行（枠の幅 − 左右 8px）に収まる。字間は 1", () => {
  assert.equal(TITLE_LETTER_SPACING, 1);
  for (let w = 280; w <= 1400; w += 5) {
    const size = titleFontSize(w);
    const line = size * 7 + TITLE_LETTER_SPACING * 7; // 1 字 = 1em（全角かなの書体でも折り返さない）
    assert.ok(
      line <= Math.min(w, 480) - 16,
      `${w} 幅: 題字 ${line}px が収まらない`,
    );
    assert.ok(size <= 44, `${w} 幅: ${size}`);
  }
});

test("promptFontSize: 👑なしは 390 幅で 34（上限）、360 幅で 34、320 幅で 28", () => {
  // 見出しに使える幅 = 窓 − 左右の余白 20×2 − ◀ 52×2 + 縮んでよい 4（👑の幅 32 を引くのは👑つきのとき）
  assert.equal(promptFontSize(390, false), 34); // room 250 ÷ 6.31 = 39.6 → 上限 34
  assert.equal(promptFontSize(360, false), 34); // room 220 ÷ 6.31 = 34.9 → 34
  assert.equal(promptFontSize(320, false), 28); // room 180 ÷ 6.31 = 28.5 → 28
});

test("promptFontSize: 👑つきは 390 幅で従来どおり 34、360 幅で 29、320 幅で 23（以前は 360 幅でも 34 で約 10px はみ出していた）", () => {
  assert.equal(CROWN_W, 32); // 👑 26 + すき間 6
  assert.equal(promptFontSize(390, true), 34); // room 218 ÷ 6.31 = 34.5 → 34
  assert.equal(promptFontSize(360, true), 29); // room 188 ÷ 6.31 = 29.8 → 29
  assert.equal(promptFontSize(320, true), 23); // room 148 ÷ 6.31 = 23.5 → 23
});

test("promptFontSize: 下限 18（極端に細い窓でも読める大きさを保つ）、上限は font.title の 34", () => {
  assert.equal(promptFontSize(200, true), 18);
  assert.equal(promptFontSize(100, false), 18);
  assert.equal(promptFontSize(5000, false), 34);
  assert.equal(promptFontSize(5000, true), 34);
});

test("promptFontSize: 見出しの幅（6.31 × 大きさ）が、使える幅（右の空きが縮んでよい 4 を足す）に収まる。👑があるほうが小さいか同じ", () => {
  assert.equal(BACK_W, 52);
  for (let w = 320; w <= 600; w += 4) {
    for (const crowned of [false, true]) {
      const size = promptFontSize(w, crowned);
      const room = w - 20 * 2 - BACK_W * 2 + 4 - (crowned ? CROWN_W : 0);
      if (size > 18) {
        assert.ok(
          size * 6.31 <= room,
          `${w} 幅 ${crowned ? "👑つき" : "👑なし"}: ${size}px が ${room}px に収まらない`,
        );
      }
    }
    assert.ok(
      promptFontSize(w, true) <= promptFontSize(w, false),
      `${w} 幅: 👑つきが大きい`,
    );
  }
});

test("promptFontSize: 幅が広くなっても小さくならない（単調）", () => {
  for (const crowned of [false, true]) {
    let prev = 0;
    for (let w = 200; w <= 800; w += 2) {
      const size = promptFontSize(w, crowned);
      assert.ok(
        size >= prev,
        `${w} 幅 ${crowned ? "👑つき" : "👑なし"}: ${prev} → ${size}`,
      );
      prev = size;
    }
  }
});
