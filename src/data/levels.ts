// 同梱レベルデータの読み込み口。docs/DESIGN.md §7 のとおり、レベル定義は
// アプリ同梱の静的JSON（levels.json）で持ち、コード側からは Level[] として扱う。

import rawLevels from './levels.json';
import { Level } from '../types';

// JSON の推論型は緩い（mode が string 等）ので Level[] として扱う。
export const LEVELS: Level[] = rawLevels as unknown as Level[];

export function getLevel(id: string): Level | undefined {
  return LEVELS.find((lv) => lv.id === id);
}

// 次のレベルのid（並び順）。最後のレベルなら undefined。
export function getNextLevelId(id: string): string | undefined {
  const i = LEVELS.findIndex((lv) => lv.id === id);
  if (i < 0 || i >= LEVELS.length - 1) return undefined;
  return LEVELS[i + 1].id;
}