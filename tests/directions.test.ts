/**
 * 方向の記号と読みの表（src/game/directions.ts）。
 *
 * 方向パッド（ボタンの記号と accessibilityLabel）と命令の列（マスの記号と読み上げ）が同じ表を使う。
 * 4 つの向きがそろっていて、記号・読みが取り違えなく、重複しないことを固定する（取り違えは、押したボタンと
 * 命令の列の記号が食い違う・支援技術が違う向きを読む、という形で出る）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DIR_GLYPH, DIR_LABEL } from "../src/game/directions";
import type { Direction } from "../src/types";

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

test("記号の表: ▲ 上・▼ 下・◀ 左・▶ 右（現状の値）", () => {
  assert.deepEqual(DIR_GLYPH, { up: "▲", down: "▼", left: "◀", right: "▶" });
});

test("読みの表: うえ・した・ひだり・みぎ（現状の値）", () => {
  assert.deepEqual(DIR_LABEL, {
    up: "うえ",
    down: "した",
    left: "ひだり",
    right: "みぎ",
  });
});

test("どちらの表も 4 つの向きがそろい、それ以外の向きは無い。値は空でなく、4 つとも違う", () => {
  for (const table of [DIR_GLYPH, DIR_LABEL]) {
    assert.deepEqual(Object.keys(table).sort(), [...DIRECTIONS].sort());
    const values = DIRECTIONS.map((d) => table[d]);
    assert.ok(values.every((v) => v.length > 0));
    assert.equal(new Set(values).size, 4, "値の重複");
  }
});
