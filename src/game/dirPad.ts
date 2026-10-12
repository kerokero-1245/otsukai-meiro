// 方向パッド（components/DirPad.tsx）の外寸の決まり（純粋・react-native 非依存）。
// DirPad の描画と、プレイ画面の配分計算（game/playLayout.ts）が同じ値を使う。以前は DirPad の中の数（行間 0.14・列間 10）を、
// 配分の側が近似した係数（3.3・3.4・10×2）で別々に持っていて、DirPad を変えると配分だけが古い前提のまま
// （盤・枠への重なり・はみ出し。DESIGN §8・§16 に直した履歴がある）になった。
// 見積もりの係数（3.3・3.4）は実際の外寸（3 + 2×0.14 = 3.28 など）より少し大きい値のまま（寸法を変えない）。
// tests/dirPad.test.ts が「見積もりが実際の外寸以上」であることを、使われる一辺の範囲で確かめる。

export const DIRPAD_ROW_GAP_RATIO = 0.14; // 行間 = ボタンの一辺 × この割合（四捨五入）
export const DIRPAD_COL_GAP = 10; // 列間（px）。押し間違い防止に少しあける
export const DIRPAD_H_PER_SIZE = 3.3; // パッド全体の高さ ≒ 一辺 × この値（3 行 + 行間 2 つ。実際は 3.28 ほど）
export const DIRPAD_W_PER_SIZE = 3.4; // パッド全体の幅 ≒ 一辺 × この値（3 列 + 列間 2 つ。一辺 50 以上で足りる）

// 行間（px）。DirPad が使う。
export function dirPadRowGap(size: number): number {
  return Math.round(size * DIRPAD_ROW_GAP_RATIO);
}
