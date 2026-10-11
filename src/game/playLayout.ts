// プレイ画面の縦横の配分（純粋関数・react-native 非依存）。PlayScreen から切り出した。
// 入力（窓の幅・高さ・盤の cols/rows・あそびかた・上限本数）→ 出力（マス・方向ボタン・命令の列の帯）。
// DESIGN §16.2 の実測表と、§8・§14・§16 の「盤が上段に重なっていた」などの修正履歴は、この計算の結果。
// 係数・下限・上限は画面にあったときの値のまま（見た目を変えない）。tests/playLayout.test.ts が表の値を固定する。
//
// 縦を「上段ヘッダー（＋②の命令の列）＋めいろ＋方向パッド」で必ず収める。
// 以前は maxBoardH = height*0.46 と最小64pxの固定寸法だったため、背の低い（横長でない）
// ウィンドウでは盤がはみ出し、RN Web の View 既定 overflow:visible により上のヘッダーへ
// 覆いかぶさって文言が隠れていた。ここでヘッダー/パッドのぶんを差し引いた高さに収める。

import {
  BOARD_BORDER,
  FRAME_MAX_W,
  FRAME_MAX_W_WIDE,
  FRAME_PAD_BOTTOM,
  FRAME_PAD_H,
  FRAME_PAD_TOP,
  isCompactLandscape,
} from "../layout";
import { space } from "../theme";
import { BAND_H, QueueStripMetrics, measureQueueStrip } from "./queueStrip";

export const HEADER_H = 64; // 上段（おうち＋ゴール案内）にみておく高さ
export const GAP = space.md; // 盤と方向パッドのあいだの最小余白
export const CELL_MIN = 44; // めいろのマスの下限
export const CELL_MAX = 116; // めいろのマスの上限
export const DIR_MIN = 52; // 方向ボタンの下限（ここまで来たらもう譲らない）
export const DIR_MAX = 100; // 方向ボタンの上限
const PAD_BUDGET_RATIO = 0.42; // 方向パッド帯に割り当てる高さ ＝ 盤の下の本体の高さ × この割合（上限 PAD_BUDGET_MAX）
const PAD_BUDGET_MAX = 340;
// 背の低い横向き: 左の列に上段（🏠＋ゴール案内。実測 320）が収まる幅。
const MAIN_MIN_W = 320;
const DIR_GAP_W = 10 * 2; // DirPad の列間（columnGap 10）×2

export interface PlayLayoutInput {
  width: number; // 窓の幅
  height: number; // 窓の高さ
  cols: number; // 盤の列数
  rows: number; // 盤の行数
  isQueue: boolean; // ②ならべてゴー か
  capacity: number; // ②で並べられる矢印の上限（Level.maxSteps）
}

export interface PlayLayout {
  side: boolean; // 背の低い横向き＝盤と方向パッドを左右に並べる
  cell: number; // めいろの1マスの一辺
  dirSize: number; // 方向ボタン（と ゴー!）の一辺
  sidePadW: number; // 横向きのとき、右の列（方向パッド＋②の命令の列）の幅（縦持ちは 0）
  strip: QueueStripMetrics | null; // ②の命令の列の寸法（①は null）
  // 以下は計算の途中の値（テストで重なりを確かめるために返す）。
  frameW: number; // 枠の内側の幅
  availH: number; // 縦に使える高さ（枠の上下パディングを除く）
  contentW: number; // 盤・命令の列に使える幅
  stripH: number; // 縦持ちで帯が食う高さ（帯＋上マージン）。横向き・①は 0
  padAreaH: number; // 縦持ちで方向パッド帯が占める高さの見積り。横向きは 0
  boardBudgetH: number; // 盤の外寸に使える高さ
}

export function computePlayLayout({
  width,
  height,
  cols,
  rows,
  isQueue,
  capacity,
}: PlayLayoutInput): PlayLayout {
  const side = isCompactLandscape(width, height); // 背の低い横向き＝盤と方向パッドを左右に並べる
  const frameW =
    Math.min(width, side ? FRAME_MAX_W_WIDE : FRAME_MAX_W) - FRAME_PAD_H * 2; // 枠の内側の幅
  // 縦に使える高さ（frame の上下パディングぶん）。縦持ちは従来どおり下限 320（横向きは実寸で組む）。
  const availH = side
    ? height - (FRAME_PAD_TOP + FRAME_PAD_BOTTOM)
    : Math.max(height - (FRAME_PAD_TOP + FRAME_PAD_BOTTOM), 320);
  // 盤の外寸はマス目全体＋枠線（BOARD_BORDER×2）。下限のマスで組むときも枠線のぶんを数える。
  const frameLine = BOARD_BORDER * 2;

  // 背の低い横向き: 右の列の方向パッドは列の高さ（②は命令の列のぶんを引いた残り）から、左の列には
  // 上段（🏠＋ゴール案内）が収まる幅（MAIN_MIN_W）を残した幅から大きさを決める。
  // 下限 DIR_MIN・上限 DIR_MAX は縦持ちと同じ。②の命令の列は右の列（方向パッドの上）に置く。
  // 左の列に置くと、568x320 で level-05 の盤が下限のマスでも帯に重なるため。
  const sideStripH = side && isQueue ? BAND_H + space.sm : 0; // 右の列の命令の列（帯＋下マージン）
  const sideDir = side
    ? Math.max(
        DIR_MIN,
        Math.min(
          Math.floor((availH - sideStripH - space.md) / 3.3),
          Math.floor((frameW - GAP - MAIN_MIN_W - DIR_GAP_W) / 3),
          DIR_MAX,
        ),
      )
    : 0;
  const sidePadW = side ? sideDir * 3 + DIR_GAP_W : 0;
  // 盤・命令の列に使える幅。縦持ちは枠の内側いっぱい、横向きは方向パッドの列とすき間を引いた残り。
  const contentW = side ? frameW - sidePadW - GAP : frameW;

  // ②だけ増える「命令の列」の帯。高さは上限本数によらず一定（BAND_H）。
  // 横向きでは右の列（方向パッドと同じ幅）に置くので、盤の高さからは引かない。
  const strip = isQueue
    ? measureQueueStrip(side ? sidePadW : contentW, capacity)
    : null;
  const stripH = strip && !side ? strip.height + space.sm : 0; // 帯の高さ＋上マージン

  // 縦の配りかた。②で帯が1段増えても、**タップ標的（方向ボタン・ゴー!）は①と同じ大きさ**を保つ
  // （§4 の巨大タップ領域は遊びかたで変わってはいけない）。帯が食う縦は、優先度の低いほうから
  // 　タップ標的 ＞ 盤面のマス ＞ 帯のマスの見た目
  // の順で返す。＝ 帯の高さは方向パッドの取り分から引かない（引くのは盤面から）。
  const bodyH = side ? availH - HEADER_H : Math.max(availH - HEADER_H, 200);
  let padBudget = Math.min(bodyH * PAD_BUDGET_RATIO, PAD_BUDGET_MAX); // 方向パッド帯に割り当てる高さの上限
  if (stripH > 0) {
    // 例外: 盤面が下限のマスすら置けないほど縦が足りない画面では、足りないぶんだけ方向パッドが譲る
    //（重なりを出さないことが最優先。DIR_MIN より小さくはしない）。
    const padRoom = bodyH - stripH - GAP - (rows * CELL_MIN + frameLine);
    padBudget = Math.min(
      padBudget,
      Math.max(padRoom, DIR_MIN * 3.3 + space.md),
    );
  }
  const dirByH = Math.floor((padBudget - space.md) / 3.3); // 3行＋行間＋下パディングぶん
  const dirByW = Math.floor(contentW / 3.4);
  const dirSize = side
    ? sideDir
    : Math.max(DIR_MIN, Math.min(dirByH, dirByW, DIR_MAX));
  // 実際に方向パッド帯が占める高さの見積り（横向きは右の列なので盤の高さからは引かない）。
  const padAreaH = side ? 0 : Math.ceil(dirSize * 3.3) + space.md;

  // めいろのマス: 残り高さと幅の小さいほうに収める。下限も小さめにして絶対にあふれさせない。
  // 盤の外寸はマス目全体＋枠線（BOARD_BORDER）なので、枠線のぶんを引いてから割る。
  // 下限も「下限のマス×行数＋枠線」にする（以前は枠線を入れておらず、マスが下限に張り付く画面で
  // 盤が予算より 6px 大きくなっていた）。
  const boardBudgetH = Math.max(
    bodyH - stripH - (side ? 0 : padAreaH + GAP),
    rows * CELL_MIN + frameLine,
  );
  const cell = Math.max(
    CELL_MIN,
    Math.floor(
      Math.min(
        (contentW - frameLine) / cols,
        (boardBudgetH - frameLine) / rows,
        CELL_MAX,
      ),
    ),
  );

  return {
    side,
    cell,
    dirSize,
    sidePadW,
    strip,
    frameW,
    availH,
    contentW,
    stripH,
    padAreaH,
    boardBudgetH,
  };
}
