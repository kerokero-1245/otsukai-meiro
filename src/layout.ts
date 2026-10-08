// 画面の枠（App.tsx の frame）の寸法。App.tsx・ClearOverlay で共有する（ぴよぴよさんすうの src/layout.ts と同じ作り）。
// ClearOverlay のスクロールの入れ物は枠の上下の余白まで広げて画面の上端〜下端を使うので、
// 余白の値をここ1か所に置き、枠と入れ物が食い違わないようにする。

import { space } from './theme';

// 縦持ち前提の枠の最大幅。
export const FRAME_MAX_W = 480;
// 枠の上下・左右の余白。
export const FRAME_PAD_TOP = space.lg;
export const FRAME_PAD_BOTTOM = space.md;
export const FRAME_PAD_H = space.md;
