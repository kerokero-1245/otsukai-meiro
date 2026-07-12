// プレイ画面（①タップで即1マス動くモード）。
// 上段: ゴールの案内 / 中段: めいろ盤面＋アバター / 下段: 方向パッド。
// 方向ボタン → 動ける向きなら1マス移動、壁/障害物なら首をかしげる（罰なし）。
// ゴール到達 → 祝福オーバーレイ（もういちど / つぎへ / おうちへ）。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors, font, radius, space } from '../theme';
import { getLevel, getNextLevelId } from '../data/levels';
import { Coord, Direction } from '../types';
import { canMove, isGoal, move } from '../game/maze';
import { playSound } from '../audio/sounds';
import MazeGrid from '../components/MazeGrid';
import DirPad from '../components/DirPad';
import ClearOverlay from '../components/ClearOverlay';
import BigButton from '../components/BigButton';

interface Props {
  levelId: string;
  onHome: () => void;
  onNext: (nextLevelId: string) => void;
}

export default function PlayScreen({ levelId, onHome, onNext }: Props) {
  const level = getLevel(levelId);
  const { width, height } = useWindowDimensions();

  // --- 盤面・ボタンの寸法（画面サイズに合わせる。縦持ち前提で中央寄せ）---
  const cols = level?.cols ?? 1;
  const rows = level?.rows ?? 1;
  const maxBoardW = Math.min(width, 460) - space.md * 2;
  const maxBoardH = height * 0.46;
  const cell = Math.max(64, Math.floor(Math.min(maxBoardW / cols, maxBoardH / rows, 120)));
  const dirSize = Math.max(64, Math.min(Math.floor((Math.min(width, 460) - space.md * 2) / 3.4), 100));

  // --- アバターの状態（論理位置は ref、見た目は Animated 値で駆動）---
  const start = level?.start ?? { x: 0, y: 0 };
  const posRef = useRef<Coord>(start);
  const avatarPos = useRef(new Animated.ValueXY({ x: start.x * cell, y: start.y * cell })).current;
  const avatarTilt = useRef(new Animated.Value(0)).current;
  const animatingRef = useRef(false);
  const [arrived, setArrived] = useState(false);

  // 画面リサイズ時、アニメ中でなければアバターを論理位置に合わせ直す。
  useEffect(() => {
    if (!animatingRef.current) {
      avatarPos.setValue({ x: posRef.current.x * cell, y: posRef.current.y * cell });
    }
  }, [cell, avatarPos]);

  const reset = useCallback(() => {
    animatingRef.current = false;
    posRef.current = start;
    avatarPos.setValue({ x: start.x * cell, y: start.y * cell });
    avatarTilt.setValue(0);
    setArrived(false);
  }, [start, cell, avatarPos, avatarTilt]);

  // 動けないときの「首をかしげる」演出。
  const wiggle = useCallback(() => {
    animatingRef.current = true;
    avatarTilt.setValue(0);
    Animated.sequence([
      Animated.timing(avatarTilt, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(avatarTilt, { toValue: -1, duration: 150, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(avatarTilt, { toValue: 0, duration: 90, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]).start(() => {
      animatingRef.current = false;
    });
  }, [avatarTilt]);

  const onDir = useCallback(
    (dir: Direction) => {
      if (!level || arrived || animatingRef.current) return;
      const cur = posRef.current;
      if (!canMove(level, cur, dir)) {
        // 壁・障害物・盤外 → 失敗ではなく首をかしげるだけ。
        playSound('blocked');
        wiggle();
        return;
      }
      const next = move(cur, dir);
      animatingRef.current = true;
      playSound('move');
      Animated.timing(avatarPos, {
        toValue: { x: next.x * cell, y: next.y * cell },
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start(() => {
        animatingRef.current = false;
        posRef.current = next;
        if (isGoal(level, next)) {
          playSound('clear');
          setArrived(true);
        }
      });
    },
    [level, arrived, cell, avatarPos, wiggle]
  );

  // データ不整合の保険（通常は到達しない）。
  if (!level) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>レベルが みつかりません</Text>
        <BigButton emoji="🏠" label="おうちへ" onPress={onHome} color={colors.button} />
      </View>
    );
  }

  const nextId = getNextLevelId(levelId);

  return (
    <View style={styles.root}>
      {/* 上段: おうちボタン＋ゴール案内 */}
      <View style={styles.top}>
        <Pressable onPress={onHome} hitSlop={10} style={styles.homeBtn} accessibilityLabel="おうちへ">
          <Text style={styles.homeGlyph}>🏠</Text>
        </Pressable>
        <View style={styles.banner}>
          <Text style={styles.bannerLabel}>ここまで いこう</Text>
          <Text style={styles.bannerGoal}>{level.goalEmoji}</Text>
        </View>
        <View style={styles.homeBtn} />
      </View>

      {/* 中段: めいろ盤面 */}
      <View style={styles.boardArea}>
        <MazeGrid
          level={level}
          cell={cell}
          avatarPos={avatarPos}
          avatarTilt={avatarTilt}
          goalEmoji={level.goalEmoji}
        />
      </View>

      {/* 下段: 方向パッド */}
      <View style={styles.padArea}>
        <DirPad onDir={onDir} size={dirSize} />
      </View>

      {arrived ? (
        <ClearOverlay
          goalEmoji={level.goalEmoji}
          onReplay={() => {
            playSound('tap');
            reset();
          }}
          onNext={nextId ? () => onNext(nextId) : undefined}
          onHome={onHome}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeGlyph: {
    fontSize: 30,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderWidth: 2,
    borderColor: colors.tileBorder,
  },
  bannerLabel: {
    fontSize: font.body,
    fontWeight: '800',
    color: colors.text,
    marginRight: space.sm,
  },
  bannerGoal: {
    fontSize: 32,
  },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: space.md,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: space.lg,
  },
  fallbackText: {
    fontSize: font.big,
    color: colors.text,
  },
});