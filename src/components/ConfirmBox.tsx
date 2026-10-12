// おとなモードの確認ボックス（問い ＋ 🗑️けす ＋ ↩️やめる）。破壊的な操作（写真・録音・⭐の削除）に、確認を 1 枚はさむ（§6）。
// 写真 1 枚・写真ぜんぶ・録音・⭐リセットの 4 か所が同じ作りのコピーだったのを部品にした。
// 大きさは呼び出し側が決める（⭐リセットだけ既定の big、ほかは small。以前の見た目のまま）。

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, font, space } from "../theme";
import BigButton from "./BigButton";

interface Props {
  question: string; // 「この しゃしんを けしますか?」など
  confirmLabel: string; // 🗑️ のボタンの文言（「けす」「ぜんぶ けす」）
  onConfirm: () => void;
  onCancel: () => void;
  size?: "small" | "big" | "huge"; // BigButton の大きさ。省くと BigButton の既定（big）
}

export default function ConfirmBox({
  question,
  confirmLabel,
  onConfirm,
  onCancel,
  size,
}: Props) {
  return (
    <View style={styles.confirmRow}>
      <Text style={styles.confirmText}>{question}</Text>
      <View style={styles.confirmButtons}>
        <BigButton
          size={size}
          emoji="🗑️"
          label={confirmLabel}
          onPress={onConfirm}
          color={colors.button}
        />
        <BigButton size={size} emoji="↩️" label="やめる" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  confirmRow: {
    marginTop: space.md,
  },
  confirmText: {
    fontSize: font.body,
    fontWeight: "800",
    color: colors.text,
    marginBottom: space.sm,
  },
  confirmButtons: {
    rowGap: space.sm,
  },
});
