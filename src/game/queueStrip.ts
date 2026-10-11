// ②ならべてゴー の「命令の列」の帯の寸法（純粋関数・react-native 非依存）。
// 画面（PlayScreen の高さバジェット）と部品（CommandQueue の描画）の両方が同じ値を使う。
// 帯の見た目と仕様は components/CommandQueue.tsx の冒頭と DESIGN §16.2 を参照。

export const CHIP_GAP = 8; // マスとマスのすきま
// ⌫ の一辺。§4 の巨大タップ領域（64pt以上）をボタンの実寸で満たす。
// react-native-web は hitSlop を **無視する**（実測）ので、当たり判定は箱の大きさで確保する。
export const UNDO_SIZE = 64;
// 帯の高さ。ここを一定にすることで、上限本数が増えても帯が厚くならない（＝盤面が痩せない）。
export const BAND_H = UNDO_SIZE;
const MAX_ROWS = 3; // 折り返しの上限（上限本数は最大14本なので実際は1〜2行）
const CHIP_MIN = 6; // 極端に細い画面での保険（表示だけなので、つぶれても操作は壊れない）
const CHIP_MAX = 44;

export interface QueueStripMetrics {
  chip: number; // 1マスの一辺
  perRow: number; // 1行あたりのマス数
  rows: number; // 行数
  height: number; // 帯全体の高さ
}

// 帯の寸法を決める（PlayScreen の高さバジェット用の純粋関数）。
// 高さは常に BAND_H。上限本数（capacity）は迷路ごとに変わる（generate.ts の queueCapacity）ので、
// **その一定の高さと横幅の両方に収まる中でいちばん大きくなる並べ方** を選ぶ。
// 1行に収まるなら1行（並べた順が左から右に素直に読める）、幅が足りなければ折り返す。
export function measureQueueStrip(
  width: number,
  capacity: number,
): QueueStripMetrics {
  const cap = Math.max(1, Math.floor(capacity));
  const usable = Math.max(60, width - UNDO_SIZE - CHIP_GAP);

  let best = { chip: 0, perRow: cap, rows: 1 };
  for (let r = 1; r <= MAX_ROWS; r++) {
    const perRow = Math.ceil(cap / r);
    const rows = Math.ceil(cap / perRow); // 実際に使う行数（空の行を作らない）
    const byW = Math.floor((usable - CHIP_GAP * (perRow - 1)) / perRow);
    const byH = Math.floor((BAND_H - CHIP_GAP * (rows - 1)) / rows);
    const chip = Math.min(byW, byH, CHIP_MAX);
    // 同点なら行数の少ないほう（先に見たほう）を残す。
    if (chip > best.chip) best = { chip, perRow, rows };
  }

  return {
    chip: Math.max(CHIP_MIN, best.chip),
    perRow: best.perRow,
    rows: best.rows,
    height: BAND_H,
  };
}
