// アバター（言われた順にしか歩けないおともだち）の見た目。
// 白い丸いバッジに、シールポップ画風のぴよ（PiyoArt。🐥 → assets/piyo/piyo.svg）を載せる。
// 対応する素材が無いグリフのときだけ、PiyoArt が絵文字の文字で描く。

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import PiyoArt from './PiyoArt';

interface Props {
  emoji: string;
  size: number;
}

export default function Avatar({ emoji, size }: Props) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <PiyoArt glyph={emoji} size={size * 0.82} emojiSize={size * 0.58} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFE0B2',
    shadowColor: '#00000055',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
});