// めいろの移動ロジック（純粋関数）。画面から切り離してテスト・再利用しやすくする。
// フェーズ4の②キュー方式でも、この move/canMove をそのまま使い回す設計。

import { Coord, Direction, Level } from "../types";

// 1マス動いた先の座標を返す（盤内かどうかは判定しない）。
export function move(pos: Coord, dir: Direction): Coord {
  switch (dir) {
    case "up":
      return { x: pos.x, y: pos.y - 1 };
    case "down":
      return { x: pos.x, y: pos.y + 1 };
    case "left":
      return { x: pos.x - 1, y: pos.y };
    case "right":
      return { x: pos.x + 1, y: pos.y };
  }
}

// 盤面の中に収まっているか。
export function inBounds(level: Level, c: Coord): boolean {
  return c.x >= 0 && c.x < level.cols && c.y >= 0 && c.y < level.rows;
}

// 座標のリストに、その座標が含まれるか（障害物の判定・ミニめいろの木の判定が使う）。
export function includesCoord(list: readonly Coord[], c: Coord): boolean {
  return list.some((o) => sameCoord(o, c));
}

// そのマスが障害物（通れないマス）か。
export function isObstacle(level: Level, c: Coord): boolean {
  return includesCoord(level.obstacles, c);
}

// その向きに1マス進めるか。盤外・障害物なら false（＝首をかしげる）。
export function canMove(level: Level, pos: Coord, dir: Direction): boolean {
  const next = move(pos, dir);
  return inBounds(level, next) && !isObstacle(level, next);
}

// そのマスがゴールか。
export function isGoal(level: Level, c: Coord): boolean {
  return sameCoord(c, level.goal);
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}
