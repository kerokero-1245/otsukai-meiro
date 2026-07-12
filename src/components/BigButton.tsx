// 4歳児でも押しやすい大きなボタン。絵文字＋ひらがな（装飾程度）を大きく取る。
// タイトル・クリア・おとなモードで共通して使う。

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../theme';

interface Props {
  onPress: () => void;
  emoji?: string;
  label?: string;
  color?: string; // 背景色（省略時は白カード）
  pressedColor?: string; // 押下時の色
  textColor?: string;
  size?: 'big' | 'huge';
}

export default function BigButton({
  onPress,
  emoji,
  label,
  color,
  pressedColor,
  textColor,
  size = 'big',
}: Props) {
  const bg = color ?? colors.surface;
  const pressedBg = pressedColor ?? (color ? colors.buttonPressed : '#F0EADD');
  const fg = textColor ?? (color ? colors.white : colors.text);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? emoji}
      style={({ pressed }) => [
        styles.base,
        size === 'huge' && styles.huge,
        { backgroundColor: pressed ? pressedBg : bg },
      ]}
    >
      <View style={styles.row}>
        {emoji ? (
          <Text style={[styles.emoji, size === 'huge' && styles.emojiHuge]}>{emoji}</Text>
        ) : null}
        {label ? (
          <Text style={[styles.label, size === 'huge' && styles.labelHuge, { color: fg }]}>
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
    justifyContent: 'center',
    alignItems: 'center',
    // やわらかい影で押せそうな見た目に。
    shadowColor: '#00000040',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  huge: {
    minHeight: 104,
    borderRadius: radius.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: font.title,
    marginRight: space.sm,
  },
  emojiHuge: {
    fontSize: font.huge,
  },
  label: {
    fontSize: font.big,
    fontWeight: '800',
  },
  labelHuge: {
    fontSize: font.huge,
  },
});