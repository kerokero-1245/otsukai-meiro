// 方向パッド。◀ ▲ ▼ ▶ の巨大ボタンを十字に並べる。
// 「誤操作に寛容」= どのボタンも常に押せる。動けない向きでも無効化せず、
// 押した結果は PlayScreen 側で「首をかしげる」に変える（§4）。

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Direction } from '../types';
import { colors, radius } from '../theme';

interface Props {
  onDir: (d: Direction) => void;
  size: number; // ボタン1つの一辺
}

const GLYPH: Record<Direction, string> = {
  up: '▲',
  down: '▼',
  left: '◀',
  right: '▶',
};

const LABEL: Record<Direction, string> = {
  up: 'うえ',
  down: 'した',
  left: 'ひだり',
  right: 'みぎ',
};

function DirButton({ dir, size, onDir }: { dir: Direction; size: number; onDir: (d: Direction) => void }) {
  return (
    <Pressable
      onPress={() => onDir(dir)}
      accessibilityRole="button"
      accessibilityLabel={LABEL[dir]}
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, backgroundColor: pressed ? colors.buttonPressed : colors.button },
      ]}
    >
      <Text style={[styles.glyph, { fontSize: size * 0.46 }]}>{GLYPH[dir]}</Text>
    </Pressable>
  );
}

export default function DirPad({ onDir, size }: Props) {
  const gap = Math.round(size * 0.14);
  const Spacer = () => <View style={{ width: size, height: size }} />;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[styles.row, { marginBottom: gap }]}>
        <Spacer />
        <DirButton dir="up" size={size} onDir={onDir} />
        <Spacer />
      </View>
      <View style={[styles.row, { marginBottom: gap }]}>
        <DirButton dir="left" size={size} onDir={onDir} />
        <View style={[styles.centerGap, { width: size, height: size }]} />
        <DirButton dir="right" size={size} onDir={onDir} />
      </View>
      <View style={styles.row}>
        <Spacer />
        <DirButton dir="down" size={size} onDir={onDir} />
        <Spacer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // ボタン間の左右の間隔（押し間違い防止に少しあける）。
    columnGap: 10,
  },
  centerGap: {},
  btn: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00000055',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  glyph: {
    color: colors.buttonGlyph,
    fontWeight: '900',
  },
});