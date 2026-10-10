// ②ならべてゴー の「命令の列」（DESIGN §6 のスケッチ / §16）。
// 画面上部の帯に、下段の ◀▲▼▶ で積んだ矢印が左から並ぶ。空きマスも見せることで
// 「あと何本 置けるか」「いっぱいになった」を **文字を使わずに** 伝える（§4）。
//
// - 表示だけのマス（タップ領域ではない）。こどもが触るのは右端の ⌫（さいごを1つ けす）だけ。
//   取り消しは単発タップで成立する手段を **1つだけ** に絞る（ドラッグ・長押しは使わない / §4）。
// - 実行中は、いま動いている命令が緑に光り、済んだ命令は薄くなる。
//   「言われたとおりに、順に動いている」を目で追えるようにする（＝観察）。
// - 帯の高さは **上限本数によらず一定**（＝⌫ の巨大タップ領域ぶんだけ）。
//   矢印のマスは表示だけなので、その一定の高さに収まるよう大きさのほうを合わせる。
//   こうしないと「上限9本＝2行×大きいマス」が「上限14本＝2行×小さいマス」より帯が厚くなり、
//   いちばんよく出る迷路がいちばん盤面を損する（非単調）という逆転が起きる。

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Direction } from "../types";
import { colors, radius } from "../theme";

export const CHIP_GAP = 8; // マスとマスのすきま
// ⌫ の一辺。§4 の巨大タップ領域（64pt以上）をボタンの実寸で満たす。
// react-native-web は hitSlop を **無視する**（実測）ので、当たり判定は箱の大きさで確保する。
export const UNDO_SIZE = 64;
// 帯の高さ。ここを一定にすることで、上限本数が増えても帯が厚くならない（＝盤面が痩せない）。
export const BAND_H = UNDO_SIZE;
const MAX_ROWS = 3; // 折り返しの上限（上限本数は最大14本なので実際は1〜2行）
const CHIP_MIN = 6; // 極端に細い画面での保険（表示だけなので、つぶれても操作は壊れない）
const CHIP_MAX = 44;

const GLYPH: Record<Direction, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
};

const LABEL: Record<Direction, string> = {
  up: "うえ",
  down: "した",
  left: "ひだり",
  right: "みぎ",
};

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

interface Props {
  queue: Direction[]; // 積まれた命令
  capacity: number; // 置けるマスの数（＝ Level.maxSteps）
  activeIndex: number; // いま実行している命令の位置（-1 = 実行していない）
  metrics: QueueStripMetrics;
  onUndo: () => void; // さいごの1つを消す
  disabled?: boolean; // 実行中は触れない
}

export default function CommandQueue({
  queue,
  capacity,
  activeIndex,
  metrics,
  onUndo,
  disabled,
}: Props) {
  const { chip, perRow, rows, height } = metrics;
  const glyphSize = Math.round(chip * 0.5);
  const chipRadius = Math.max(6, Math.round(chip * 0.28));

  const rowNodes: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cells: React.ReactNode[] = [];
    const end = Math.min((r + 1) * perRow, capacity);
    for (let i = r * perRow; i < end; i++) {
      const dir: Direction | undefined = queue[i];
      const active = dir != null && i === activeIndex;
      const done = dir != null && activeIndex >= 0 && i < activeIndex;
      cells.push(
        <View
          key={i}
          style={[
            styles.slot,
            { width: chip, height: chip, borderRadius: chipRadius },
            dir ? styles.slotFilled : null,
            done ? styles.slotDone : null,
            active ? styles.slotActive : null,
          ]}
        >
          {dir ? (
            <Text style={[styles.glyph, { fontSize: glyphSize }]}>
              {GLYPH[dir]}
            </Text>
          ) : null}
        </View>,
      );
    }
    rowNodes.push(
      <View key={`row-${r}`} style={styles.row}>
        {cells}
      </View>,
    );
  }

  // 読み上げ用（画面には出さない）。文字に頼らない原則は保ちつつ、支援技術には中身を伝える。
  const readOut =
    queue.length === 0
      ? "めいれいの れつ: まだ ありません"
      : `めいれいの れつ: ${queue.map((d) => LABEL[d]).join("、")}`;

  const undoOff = disabled || queue.length === 0;

  return (
    <View style={[styles.band, { height }]}>
      <View style={styles.slots} accessible accessibilityLabel={readOut}>
        {rowNodes}
      </View>
      {/* 帯のなかで唯一のボタン。一辺 64px の実寸で巨大タップ領域を満たす（hitSlop に頼らない）。*/}
      <Pressable
        onPress={onUndo}
        disabled={undoOff || undefined}
        accessibilityRole="button"
        accessibilityLabel="さいごの やじるしを けす"
        style={({ pressed }) => [
          styles.undo,
          {
            width: UNDO_SIZE,
            height: UNDO_SIZE,
            opacity: undoOff ? 0.3 : 1,
            backgroundColor: pressed ? "#F0EADD" : colors.surface,
          },
        ]}
      >
        <Text style={styles.undoGlyph}>⌫</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // 帯の中身（マスの列と ⌫）はひとかたまりで中央寄せにする。
  // 両端に離して置くと、⌫ が「列のさいごを消すもの」に見えなくなるため。
  band: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  slots: {
    rowGap: CHIP_GAP,
  },
  row: {
    flexDirection: "row",
    columnGap: CHIP_GAP,
  },
  // 空きマス: そこに置けることだけを示すうすい下地（未達成マークにはしない / §14 の流儀）。
  slot: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tileDark,
    borderWidth: 1,
    borderColor: colors.tileBorder,
  },
  // 置いた矢印: 方向ボタンと同じオレンジ（押したボタンがここに積まれた、と分かるように）。
  slotFilled: {
    backgroundColor: colors.button,
    borderColor: colors.button,
  },
  // 実行し終えた命令はうすく（どこまで進んだかが分かる）。
  slotDone: {
    opacity: 0.4,
  },
  // いま動いている命令（緑＝ゴー! と同じ色）。
  slotActive: {
    backgroundColor: colors.play,
    borderColor: colors.white,
    borderWidth: 3,
  },
  glyph: {
    color: colors.buttonGlyph,
    fontWeight: "900",
  },
  undo: {
    marginLeft: CHIP_GAP,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.tileBorder,
  },
  undoGlyph: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.text,
  },
});
