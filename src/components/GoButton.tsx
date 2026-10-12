// ②ならべてゴー の「ゴー!」ボタン。方向パッドの十字の **まんなか** に置く。
//
// なぜ十字の中央か:
//  - Bee-Bot / Cubetto など、この年齢向けのプログラミング玩具は「矢印のまんなかに GO」が定番で、
//    指が自然に届く。方向ボタンと同じ大きさなので巨大タップ領域（§4）も満たす。
//  - 画面の縦を1段も使わないので、盤面のマスを大きいまま保てる（背の低い 515×684 でも被りゼロ）。
//
// 見た目は方向ボタン（オレンジの角丸）と はっきり変える: **緑のまる**。
// 矢印が1本も無いあいだは うすく（押せない）。まず矢印を並べる → それから ゴー!、の順番が
// 文字を読まなくても伝わるようにするため。

import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, shadowRaised } from "../theme";

interface Props {
  size: number; // 一辺（＝方向ボタンと同じ）
  onPress: () => void;
  ready: boolean; // 矢印が1本以上ある
  running: boolean; // 実行中
}

export default function GoButton({ size, onPress, ready, running }: Props) {
  const off = !ready || running;
  return (
    <Pressable
      onPress={onPress}
      disabled={off || undefined}
      accessibilityRole="button"
      accessibilityLabel="ゴー"
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: off ? 0.4 : 1,
          backgroundColor: pressed ? colors.playPressed : colors.play,
        },
      ]}
    >
      <Text
        style={[styles.label, { fontSize: Math.round(size * 0.3) }]}
        numberOfLines={1}
      >
        ゴー!
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: "center",
    justifyContent: "center",
    ...shadowRaised,
  },
  label: {
    color: colors.white,
    fontWeight: "900",
  },
});
