// 絵文字グリフ → シールポップSVG素材（このリポジトリ内 assets/piyo/）の対応表。
//
// 方針（ぴよぴよランド 共通ルール）:
//  - 素材はクロスオリジン参照せず、必要ファイルだけをリポジトリ内へコピーして使う。
//  - ゲームロジック・レイアウト・タップ領域は不変。**見た目の差し替えのみ**。
//    盤面やカードは今まで通り「絵文字文字列」を識別子として持ち回り、描画のときだけ
//    この表で同じ意味のSVGへ差し替える（generate.ts の GOAL_EMOJIS など既存コードは無改造）。
//  - Metro の既定 assetExts は 'svg' を含むため、require('./x.svg') は <Image> 用の
//    ソース（web では <img src> に解決）を返す。react-native-svg などの追加依存は不要（web優先）。
//  - 対応が無いグリフは undefined を返し、呼び出し側（PiyoArt）は絵文字のまま表示する。

import { ImageSourcePropType } from "react-native";

const GLYPH_ART: Record<string, ImageSourcePropType> = {
  // ゴール絵文字プール（src/game/generate.ts の GOAL_EMOJIS 12種と1対1）
  "🍎": require("../assets/piyo/ringo.svg"),
  "🏠": require("../assets/piyo/ie.svg"),
  "🍰": require("../assets/piyo/cake.svg"),
  "🍓": require("../assets/piyo/ichigo.svg"),
  "🎈": require("../assets/piyo/fuusen.svg"),
  "🍦": require("../assets/piyo/aisu.svg"),
  "🎁": require("../assets/piyo/purezento.svg"),
  "🌷": require("../assets/piyo/chuurippu.svg"),
  "🍭": require("../assets/piyo/ame.svg"),
  "🐰": require("../assets/piyo/usagi.svg"),
  "🚗": require("../assets/piyo/kuruma.svg"),
  "🍩": require("../assets/piyo/doonatsu.svg"),

  // アバター（言われた順にしか歩けないおともだち）＝相棒ぴよ
  "🐥": require("../assets/piyo/piyo.svg"),

  // 障害物（通れないマス）＝き
  "🌳": require("../assets/piyo/ki.svg"),
};

// グリフに対応するSVG素材を返す。無ければ undefined（呼び出し側で絵文字フォールバック）。
export function artForGlyph(glyph: string): ImageSourcePropType | undefined {
  return GLYPH_ART[glyph];
}
