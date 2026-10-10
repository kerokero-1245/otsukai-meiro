// おつかいめいろ 全体の見た目の基準値。
// 4歳児が使う画面なので「大きく・やさしい色・少ない要素・高いコントラスト」を原則にする。
// 参考: kore-daijobu/src/theme.ts（colors / font / space / radius の同じ構成）。

export const colors = {
  // 地の色
  bg: "#FFF6E5", // やわらかいクリーム（背景）
  surface: "#FFFFFF", // カード
  surfacePressed: "#F3ECDD", // カード色のボタンを押したとき（さんすうの choicePressed と同じ）

  // めいろ盤面
  boardBg: "#FCEFD0", // 盤の外枠
  tileLight: "#FFFFFF", // 市松タイル（明）
  tileDark: "#FBE7C4", // 市松タイル（暗）
  tileBorder: "#F0D9A8",
  goalTile: "#FFF3B0", // ゴールのマスをほんのり強調

  // 役者
  obstacleTile: "#DDEFD0", // 通れないマスの下地（うすい緑）
  goalHalo: "#FFE270", // ゴールのきらきら

  // 方向ボタン（大タップ領域）
  button: "#FF9F45", // オレンジ
  buttonPressed: "#F08A2E",
  buttonGlyph: "#FFFFFF",

  // アクセント
  play: "#5FBF7A", // 「あそぶ」など前向きなボタン
  playPressed: "#4EA867",

  // 文字（読める子むけの装飾程度）
  text: "#5B3A1E", // こげ茶
  subtext: "#9B7B57",
  white: "#FFFFFF",

  // 祝福の紙吹雪
  confetti: ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF9F45", "#C77DFF"],

  primary: "#FF9F45",
  overlay: "rgba(43, 26, 12, 0.45)", // 祝福オーバーレイの背後を少し暗く
};

// 大きめのフォント。ひらがなは「読める子には嬉しい」装飾程度に留める。
export const font = {
  jumbo: 72, // ゴール絵文字などの主役
  huge: 44,
  title: 34,
  big: 26,
  body: 20,
  small: 16,
};

export const space = { xs: 6, sm: 12, md: 20, lg: 28, xl: 40 };

export const radius = { sm: 12, md: 20, lg: 28, pill: 999 };
