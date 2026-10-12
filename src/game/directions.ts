// 方向の記号と読み（純粋・react-native 非依存）。方向パッド（components/DirPad.tsx）と
// 命令の列（components/CommandQueue.tsx）が同じ表を使う（以前は同じ表が 2 か所にあった）。

import { Direction } from "../types";

// ボタン・命令のマスに描く記号。
export const DIR_GLYPH: Record<Direction, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
};

// 読み上げ・支援技術向けの名前（ボタンの accessibilityLabel・命令の列の読み上げ）。
export const DIR_LABEL: Record<Direction, string> = {
  up: "うえ",
  down: "した",
  left: "ひだり",
  right: "みぎ",
};
