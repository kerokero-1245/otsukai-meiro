// レベルえらびのカードの「ミニめいろ」に置く障害物（純粋関数・react-native 非依存）。

import { Coord } from "../types";
import { sameCoord } from "./maze";

// カードのプレビュー用の障害物マスを決める（見た目のヒント。実際に遊ぶ迷路は毎回生成される）。
// スタート(0,0)とゴール(cols-1,rows-1)は避け、内側から count 個を等間隔にサンプルする。
export function previewObstacles(
  cols: number,
  rows: number,
  count: number,
): Coord[] {
  const start: Coord = { x: 0, y: 0 };
  const goal: Coord = { x: cols - 1, y: rows - 1 };
  const avail: Coord[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = { x, y };
      if (sameCoord(c, start) || sameCoord(c, goal)) continue;
      avail.push(c);
    }
  }
  const chosen: Coord[] = [];
  for (let i = 0; i < count && i < avail.length; i++) {
    chosen.push(avail[Math.floor(((i + 1) * avail.length) / (count + 1))]);
  }
  return chosen;
}
