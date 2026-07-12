// ゴール到達の祝福オーバーレイ。写真ズーム風の拡大＋紙吹雪＋「ついたね!」＋次の行動ボタン。
// 罰やスコアは出さない（§4）。ボタンは大きく、絵文字＋ひらがなで示す。

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, font, space } from '../theme';
import BigButton from './BigButton';
import Confetti from './Confetti';

interface Props {
  goalEmoji: string;
  onReplay: () => void;
  onNext?: () => void; // 次のレベルが無ければ undefined（ボタンを出さない）
  onHome: () => void;
}

export default function ClearOverlay({ goalEmoji, onReplay, onNext, onHome }: Props) {
  // ゴールをぽんっと大きく見せる（写真ズームの代わり）。
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  }, [scale, opacity]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.backdrop} pointerEvents="none" />
      <Confetti />

      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <View style={styles.zoomCircle}>
          <Text style={styles.goalEmoji}>{goalEmoji}</Text>
        </View>
        <Text style={styles.headline}>ついたね!</Text>
      </Animated.View>

      <View style={styles.buttons}>
        <BigButton emoji="🔁" label="もういちど" onPress={onReplay} color={colors.button} />
        {onNext ? (
          <BigButton emoji="👉" label="つぎへ" onPress={onNext} color={colors.play} pressedColor={colors.playPressed} />
        ) : null}
        <BigButton emoji="🏠" label="おうちへ" onPress={onHome} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  card: {
    alignItems: 'center',
    marginBottom: space.xl,
  },
  zoomCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.goalHalo,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: colors.white,
    shadowColor: '#00000066',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  goalEmoji: {
    fontSize: 104,
  },
  headline: {
    marginTop: space.md,
    fontSize: font.huge,
    fontWeight: '900',
    color: colors.white,
    textShadowColor: '#00000088',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  buttons: {
    width: '100%',
    maxWidth: 360,
    rowGap: space.sm,
  },
});