// めいろの移動ロジック（純粋関数）。画面から切り離してテスト・再利用しやすくする。
// フェーズ4の②キュー方式でも、この move/canMove をそのまま使い回す設計。

import { Coord, Direction, Level } from '../types';

// 1マス動いた先の座標を返す（盤内かどうかは判定しない）。
export function move(pos: Coord, dir: Direction): Coord {
  switch (dir) {
    case 'up':
      return { x: pos.x, y: pos.y - 1 };
    case 'down':
      return { x: pos.x, y: pos.y + 1 };
    case 'left':
      return { x: pos.x - 1, y: pos.y };
    case 'right':
      return { x: pos.x + 1, y: pos.y };
  }
}

// 盤面の中に収まっているか。
export function inBounds(level: Level, c: Coord): boolean {
  return c.x >= 0 && c.x < level.cols && c.y >= 0 && c.y < level.rows;
}

// そのマスが障害物（通れないマス）か。
export function isObstacle(level: Level, c: Coord): boolean {
  return level.obstacles.some((o) => o.x === c.x && o.y === c.y);
}

// その向きに1マス進めるか。盤外・障害物なら false（＝首をかしげる）。
export function canMove(level: Level, pos: Coord, dir: Direction): boolean {
  const next = move(pos, dir);
  return inBounds(level, next) && !isObstacle(level, next);
}

// そのマスがゴールか。
export function isGoal(level: Level, c: Coord): boolean {
  return c.x === level.goal.x && c.y === level.goal.y;
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}