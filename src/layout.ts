// 画面の枠（App.tsx の frame）の寸法と、画面の向きに応じたレイアウトの判定（DESIGN §8）。
// App.tsx・ClearOverlay と、プレイ画面の配分計算（game/playLayout.ts）で共有する（ぴよぴよさんすうの src/layout.ts と同じ作り）。
// ClearOverlay のスクロールの入れ物は枠の上下の余白まで広げて画面の上端〜下端を使うので、
// 余白の値をここ1か所に置き、枠と入れ物が食い違わないようにする。

import { space } from "./theme";

// 縦持ち前提の枠の最大幅。
export const FRAME_MAX_W = 480;
// 枠の上下・左右の余白。
export const FRAME_PAD_TOP = space.lg;
export const FRAME_PAD_BOTTOM = space.md;
export const FRAME_PAD_H = space.md;
// 背の低い横向きで、めいろ画面だけに使う広い枠の最大幅（盤と方向パッドを左右に並べるため）。
export const FRAME_MAX_W_WIDE = 960;

// 盤の枠線の太さ。枠の大きさは「マス目全体＋左右（上下）の枠線」にする。
// 以前はマス目全体の大きさ（cell×列数）を枠の外寸にしていたため、枠線のぶん内側が狭くなり、
// マス目が右と下で枠線に 6px かぶっていた（左上は枠線の内側から始まるので、右下だけずれる）。
// MazeGrid の描画と、PlayScreen のマスの大きさの計算（game/playLayout.ts）が同じ値を使う。
export const BOARD_BORDER = 3;

// 「背の低い横向き」（スマホの横持ち。例: 844x390・932x430・640x360・568x320）。
// 縦持ち前提の1列の並び（上段＋盤＋方向パッド）では盤の置き場所が足りず、level-05（4x4）の盤が
// 上段に重なっていたので、めいろ画面は盤と方向パッドを左右に分ける。
// 1280x800 のように横長でも高さが足りる画面は対象外（従来どおり1列）。境界は ぴよぴよさんすうと同じ。
const COMPACT_LANDSCAPE_MAX_H = 600;

export function isCompactLandscape(windowW: number, windowH: number): boolean {
  return windowW > windowH && windowH < COMPACT_LANDSCAPE_MAX_H;
}
