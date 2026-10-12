// 方向パッド。◀ ▲ ▼ ▶ の巨大ボタンを十字に並べる。
// 「誤操作に寛容」= どのボタンも常に押せる。動けない向きでも無効化せず、
// 押した結果は PlayScreen 側で「首をかしげる」に変える（§4）。

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Direction } from "../types";
import { colors, radius, shadowRaised } from "../theme";
import { DIRPAD_COL_GAP, dirPadRowGap } from "../game/dirPad";
import { DIR_GLYPH, DIR_LABEL } from "../game/directions";

interface Props {
  onDir: (d: Direction) => void;
  size: number; // ボタン1つの一辺
  // 十字のまんなかに置くもの（②ならべてゴー の「ゴー!」ボタン）。
  // 省略時（＝①タップモード）は従来どおり空きスペースのまま。
  center?: React.ReactNode;
  // ②の実行中だけ true。押しても何も起きない（押下色も出さない）。
  // 省略時は undefined のまま Pressable に渡すので、①の描画は従来と完全に同じ。
  disabled?: boolean;
}

function DirButton({
  dir,
  size,
  onDir,
  disabled,
}: {
  dir: Direction;
  size: number;
  onDir: (d: Direction) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onDir(dir)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={DIR_LABEL[dir]}
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        {
          width: size,
          height: size,
          backgroundColor: pressed ? colors.buttonPressed : colors.button,
        },
      ]}
    >
      <Text style={[styles.glyph, { fontSize: size * 0.46 }]}>
        {DIR_GLYPH[dir]}
      </Text>
    </Pressable>
  );
}

export default function DirPad({ onDir, size, center, disabled }: Props) {
  const gap = dirPadRowGap(size);
  const Spacer = () => <View style={{ width: size, height: size }} />;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={[styles.row, { marginBottom: gap }]}>
        {/* eslint-disable-next-line react-hooks/static-components -- Spacer は描画のたびに作り直される関数（そのたびに空の View が作り直される）。外へ出すと部品の構造が変わるので、このままにしている */}
        <Spacer />
        <DirButton dir="up" size={size} onDir={onDir} disabled={disabled} />
        {/* eslint-disable-next-line react-hooks/static-components -- Spacer は描画のたびに作り直される関数（そのたびに空の View が作り直される）。外へ出すと部品の構造が変わるので、このままにしている */}
        <Spacer />
      </View>
      <View style={[styles.row, { marginBottom: gap }]}>
        <DirButton dir="left" size={size} onDir={onDir} disabled={disabled} />
        <View style={{ width: size, height: size }}>{center}</View>
        <DirButton dir="right" size={size} onDir={onDir} disabled={disabled} />
      </View>
      <View style={styles.row}>
        {/* eslint-disable-next-line react-hooks/static-components -- Spacer は描画のたびに作り直される関数（そのたびに空の View が作り直される）。外へ出すと部品の構造が変わるので、このままにしている */}
        <Spacer />
        <DirButton dir="down" size={size} onDir={onDir} disabled={disabled} />
        {/* eslint-disable-next-line react-hooks/static-components -- Spacer は描画のたびに作り直される関数（そのたびに空の View が作り直される）。外へ出すと部品の構造が変わるので、このままにしている */}
        <Spacer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    // ボタン間の左右の間隔（押し間違い防止に少しあける）。
    columnGap: DIRPAD_COL_GAP,
  },
  btn: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    ...shadowRaised,
  },
  glyph: {
    color: colors.buttonGlyph,
    fontWeight: "900",
  },
});
