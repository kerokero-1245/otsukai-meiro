// 題字・見出しを1行に収める文字の大きさの見積もり（純粋関数・react-native 非依存）。
// タイトル画面（TitleScreen）とレベルえらび（LevelSelectScreen）が使う。

import { frameWidth } from "../layout";
import { font, space } from "../theme";

// ── タイトルの題字 ───────────────────────────────────────────────

// 題字を1行に収める文字の大きさ。題字は枠の左右の余白（space.md）まで使い、画面の端から TITLE_EDGE だけ離す。
// 1字 = 1em（7字）＋字間 1×7 で見積もる（保守的。ぴよぴよさんすう・ことばと同じ式。字間はこのアプリの題字の 1）。
// Mac のヒラギノの UI 用書体はかなが約 0.92em と狭いが、かなが全角（1em）の書体（Android の Noto Sans CJK JP など）
// でも2行に折り返さないよう、狭い方には寄せない。390 幅・360 幅で 44（従来どおり）、320 幅で 42
// （従来は 44 のまま「ろ」だけ2行目に折り返していた）。
const TITLE_CHARS = 7; // 「おつかいめいろ」
export const TITLE_LETTER_SPACING = 1;
const TITLE_EDGE = 8;

export function titleFontSize(windowW: number): number {
  const avail = frameWidth(windowW) - TITLE_EDGE * 2;
  return Math.min(
    font.huge,
    Math.floor((avail - TITLE_LETTER_SPACING * TITLE_CHARS) / TITLE_CHARS),
  );
}

// ── レベルえらびの見出し ─────────────────────────────────────────

// 見出し「どれで あそぶ?」（👑つき）を見出し行の1行に収める文字の大きさ。
// 見出し行 = ◀（52）＋ 見出し ＋ 右の空き（52。見出しを中央に置くための重し）。見出しに使える幅は
// 画面幅 − 左右の余白 − 52×2。以前は文字の大きさが固定 34 で、👑が付くと 360 幅で見出し行が
// 画面の右へ約 10px はみ出していた（320 幅では👑なしでもはみ出す）。
// 実測（Chrome / ヒラギノ）で 34px のとき幅 214.4px ≒ 6.31×大きさ。👑は 26＋すき間 6。
// 右の空きは見えない重しなので、少しだけ（RIGHT_GIVE）縮んでよいことにする。こうすると
// 390 幅の👑つき（見出しに使える幅 246・必要 246.4）は従来どおり 34 のまま収まり、
// 文字の幅が端末で少し違っても、右の空きが縮んで受け止める（はみ出す前に中央が少しずれるだけ）。
export const BACK_W = 52;
export const CROWN_W = 26 + space.xs;
const PROMPT_PER_PX = 6.31;
const RIGHT_GIVE = 4;

export function promptFontSize(winW: number, crowned: boolean): number {
  const room =
    winW - space.md * 2 - BACK_W * 2 + RIGHT_GIVE - (crowned ? CROWN_W : 0);
  return Math.max(18, Math.min(font.title, Math.floor(room / PROMPT_PER_PX)));
}
