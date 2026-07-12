// レベルえらび。ゴール絵文字つきの大きなカードを横スクロールで並べる（DESIGN §6）。
// 文字は最小限。タップでプレイへ。前をクリアしなくても全レベル自由に選べる（進捗ロック無し）。

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../theme';
import { LEVELS } from '../data/levels';
import { Level } from '../types';
import { playSound } from '../audio/sounds';

interface Props {
  onPick: (levelId: string) => void;
  onBack: () => void;
}

function LevelCard({ level, index, onPick }: { level: Level; index: number; onPick: (id: string) => void }) {
  return (
    <Pressable
      onPress={() => {
        playSound('tap');
        onPick(level.id);
      }}
      accessibilityRole="button"
      accessibilityLabel={level.title}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{index + 1}</Text>
      </View>

      <View style={styles.goalCircle}>
        <Text style={styles.goalEmoji}>{level.goalEmoji}</Text>
      </View>

      <View style={styles.conceptRow}>
        <Text style={styles.conceptEmoji}>{level.avatarEmoji}</Text>
        <Text style={styles.conceptArrow}>→</Text>
        <Text style={styles.conceptEmoji}>{level.goalEmoji}</Text>
      </View>

      <Text style={styles.cardTitle} numberOfLines={1}>
        {level.title}
      </Text>
    </Pressable>
  );
}

export default function LevelSelectScreen({ onPick, onBack }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn} accessibilityLabel="もどる">
          <Text style={styles.backGlyph}>◀️</Text>
        </Pressable>
        <Text style={styles.prompt}>どれで あそぶ?</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {LEVELS.map((level, i) => (
          <LevelCard key={level.id} level={level} index={i} onPick={onPick} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  backBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontSize: 26,
  },
  prompt: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
  },
  scroll: {
    paddingHorizontal: space.xs,
    paddingVertical: space.md,
    alignItems: 'center',
    columnGap: space.md,
  },
  card: {
    width: 200,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.tileBorder,
    shadowColor: '#00000055',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  numberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  numberText: {
    fontSize: font.big,
    fontWeight: '900',
    color: colors.white,
  },
  goalCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.goalHalo,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.white,
  },
  goalEmoji: {
    fontSize: 72,
  },
  conceptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
  },
  conceptEmoji: {
    fontSize: 30,
  },
  conceptArrow: {
    fontSize: 24,
    marginHorizontal: space.xs,
    color: colors.subtext,
  },
  cardTitle: {
    marginTop: space.sm,
    fontSize: font.body,
    fontWeight: '700',
    color: colors.text,
    maxWidth: 176,
  },
});