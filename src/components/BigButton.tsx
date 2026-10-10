// 4歳児でも押しやすい大きなボタン。絵文字＋ひらがな（装飾程度）を大きく取る。
// タイトル・クリア・おとなモードで共通して使う。

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, space } from "../theme";

interface Props {
  onPress: () => void;
  emoji?: string;
  label?: string;
  color?: string; // 背景色（省略時は白カード）
  pressedColor?: string; // 押下時の色
  textColor?: string;
  // big=既定（こども側の巨大ボタン） / huge=タイトルの「あそぶ」
  // small=おとなモード用。親ゲートの奥は普通のアプリUIでよいので、
  //       長いラベル（「しゃしんを ふやす」など）が折り返さない大きさにする。
  size?: "small" | "big" | "huge";
}

export default function BigButton({
  onPress,
  emoji,
  label,
  color,
  pressedColor,
  textColor,
  size = "big",
}: Props) {
  const bg = color ?? colors.surface;
  const pressedBg = pressedColor ?? (color ? colors.buttonPressed : "#F0EADD");
  const fg = textColor ?? (color ? colors.white : colors.text);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? emoji}
      style={({ pressed }) => [
        styles.base,
        size === "huge" && styles.huge,
        size === "small" && styles.small,
        { backgroundColor: pressed ? pressedBg : bg },
      ]}
    >
      <View style={styles.row}>
        {emoji ? (
          <Text
            style={[
              styles.emoji,
              size === "huge" && styles.emojiHuge,
              size === "small" && styles.emojiSmall,
            ]}
          >
            {emoji}
          </Text>
        ) : null}
        {label ? (
          <Text
            style={[
              styles.label,
              size === "huge" && styles.labelHuge,
              size === "small" && styles.labelSmall,
              { color: fg },
            ]}
            numberOfLines={size === "small" ? 1 : undefined}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 76,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    justifyContent: "center",
    alignItems: "center",
    // やわらかい影で押せそうな見た目に。
    shadowColor: "#00000040",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  huge: {
    minHeight: 104,
    borderRadius: radius.lg,
  },
  // おとなモード用の一回り小さいボタン（それでも 64pt 以上を確保）。
  small: {
    minHeight: 64,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: font.title,
    marginRight: space.sm,
  },
  emojiHuge: {
    fontSize: font.huge,
  },
  emojiSmall: {
    fontSize: font.big,
    marginRight: space.xs,
  },
  label: {
    fontSize: font.big,
    fontWeight: "800",
  },
  labelHuge: {
    fontSize: font.huge,
  },
  labelSmall: {
    fontSize: font.body,
  },
});
