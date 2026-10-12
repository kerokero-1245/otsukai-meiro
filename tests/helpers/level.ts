// テスト用の Level。必要な欄だけ上書きして使う（既定は 3x3 の盤・障害物なし・左上から右下）。
import type { Level } from "../../src/types";

export function makeLevel(overrides: Partial<Level> = {}): Level {
  return {
    id: "level-test",
    cols: 3,
    rows: 3,
    start: { x: 0, y: 0 },
    goal: { x: 2, y: 2 },
    obstacles: [],
    maxSteps: 8,
    goalImage: null,
    goalEmoji: "🍎",
    avatarEmoji: "🐥",
    ...overrides,
  };
}
