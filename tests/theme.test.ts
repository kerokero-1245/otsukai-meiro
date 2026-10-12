/**
 * 見た目の基準値（src/theme.ts）のうち、トークンにした値の現状を固定する。
 *
 * 影の色 #00000055 は 9 か所に直書きされていたので colors.shadow にし、方向ボタンと「ゴー!」の同じ 5 値の影を
 * shadowRaised にした。トークンにしても見た目は変えない（撮影で差分 0 を測る）ので、値そのものをここで固定する。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { colors, shadowRaised } from "../src/theme";

test("影の色のトークン: colors.shadow は #00000055（9 か所の直書きと同じ値）", () => {
  assert.equal(colors.shadow, "#00000055");
});

test("押せるボタンの影（方向ボタンと「ゴー!」）: 色・ずれ・濃さ・ぼかし・高さが従来の 5 値のまま", () => {
  assert.deepEqual(shadowRaised, {
    shadowColor: "#00000055",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  });
});
