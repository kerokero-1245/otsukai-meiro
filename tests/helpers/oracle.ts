// 最短手数の答え合わせ用。本体の bfsShortest（幅優先探索）とは別の方法で求める。
//
// 「ある地点からの距離」を、全マス ∞・地点 0 から始め、隣のマスの距離 + 1 のほうが小さければ縮める、
// という操作を、変わらなくなるまで繰り返して求める（ベルマン・フォード型）。本体の検査と同じ間違い方を
// しないよう、maze.ts の move / inBounds / isObstacle は使わず、盤面の判定もここで独立に書く。
import type { Coord, Level } from "../../src/types";

const AROUND = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** from から各マスへの手数。dist[y][x]。障害物のマス・たどり着けないマスは Infinity。 */
export function distanceField(
  cols: number,
  rows: number,
  obstacles: readonly Coord[],
  from: Coord,
): number[][] {
  const blocked = Array.from({ length: rows }, () =>
    Array<boolean>(cols).fill(false),
  );
  for (const o of obstacles) blocked[o.y][o.x] = true;

  const dist = Array.from({ length: rows }, () =>
    Array<number>(cols).fill(Infinity),
  );
  if (blocked[from.y][from.x]) return dist;
  dist[from.y][from.x] = 0;

  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (blocked[y][x]) continue;
        for (const [dx, dy] of AROUND) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
          if (dist[ny][nx] + 1 < dist[y][x]) {
            dist[y][x] = dist[ny][nx] + 1;
            changed = true;
          }
        }
      }
    }
  }
  return dist;
}

/** スタートからゴールまでの最短手数。たどり着けない（スタートかゴールが障害物のときも）なら null。 */
export function shortestBySettling(level: Level): number | null {
  const { cols, rows, start, goal, obstacles } = level;
  const d = distanceField(cols, rows, obstacles, goal)[start.y][start.x];
  return Number.isFinite(d) ? d : null;
}
