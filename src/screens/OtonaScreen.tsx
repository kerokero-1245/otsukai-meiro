// おとなモード（親ゲートの奥）。MVP（フェーズ1）は入口だけ用意した準備中スタブ。
// フェーズ2でゴール写真の差し替え（image-picker）・おじの声の差し替えをここに実装する。

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../theme';
import BigButton from '../components/BigButton';

interface Props {
  onBack: () => void;
}

export default function OtonaScreen({ onBack }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>おとなモード</Text>

      <View style={styles.card}>
        <Text style={styles.body}>
          ここでゴールの写真や、おじの声を差し替えられるようにする予定です。
        </Text>
        <Text style={styles.note}>いまは準備中です（フェーズ2）。</Text>
      </View>

      <View style={styles.spacer} />

      <BigButton emoji="◀️" label="もどる" onPress={onBack} color={colors.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: space.lg,
  },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
    marginBottom: space.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.tileBorder,
  },
  body: {
    fontSize: font.body,
    color: colors.text,
    lineHeight: 30,
  },
  note: {
    fontSize: font.small,
    color: colors.subtext,
    marginTop: space.md,
  },
  spacer: {
    flex: 1,
  },
});