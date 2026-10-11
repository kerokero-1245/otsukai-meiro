// 盤のマスの下地の色（純粋関数・react-native 非依存）。
// 本番の盤（MazeGrid）とレベルえらびのミニめいろ（LevelSelectScreen の MazePreview）が同じ規則で塗る。
// 優先は ゴール ＞ 障害物 ＞ 市松（(x + y) が偶数なら明、奇数なら暗）。

import { colors } from "../theme";

export function tileColor(
  x: number,
  y: number,
  isGoalTile: boolean,
  isObstacleTile: boolean,
): string {
  if (isGoalTile) return colors.goalTile;
  if (isObstacleTile) return colors.obstacleTile;
  return (x + y) % 2 === 0 ? colors.tileLight : colors.tileDark;
}
