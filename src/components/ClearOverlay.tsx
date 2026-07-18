// ゴール到達の祝福オーバーレイ。写真ズーム風の拡大＋紙吹雪＋「ついたね!」＋次の行動ボタン。
// ここに「⭐ゲット!」の瞬間を統合（ぽんっ＋効果音）。クリア=⭐なので、何手で着いたかは問わない。
// 罰やスコアは出さない（§4）。ボタンは大きく、絵文字＋ひらがなで示す。
//
// 全レベルに⭐が揃った瞬間（justCompletedAll）だけは、ボタンを出さずに ⭐ゲットの余韻のあと
// 自動で「ぜんぶ できたね! がんばりカード」へ進む（onCelebrateAll）。4歳が確実に大祝福に辿り着けるように。

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, font, space } from '../theme';
import { playSound } from '../audio/sounds';
import { sayPhrase, cancelVoice } from '../audio/voice';
import BigButton from './BigButton';
import Confetti from './Confetti';
import PiyoArt from './PiyoArt';

interface Props {
  goalEmoji: string;
  onReplay: () => void;
  onNext?: () => void; // 次のレベルが無ければ undefined（ボタンを出さない）
  onHome: () => void;
  justCompletedAll?: boolean; // このクリアで全5レベルの⭐が初めて揃った
  onCelebrateAll?: () => void; // ↑のとき「がんばりカード」へ進む
}

export default function ClearOverlay({
  goalEmoji,
  onReplay,
  onNext,
  onHome,
  justCompletedAll = false,
  onCelebrateAll,
}: Props) {
  // ゴールをぽんっと大きく見せる（写真ズームの代わり）。
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  // ⭐ゲットのスタンプ（ゴールに少し遅れてぽんっと付く）。
  const starScale = useRef(new Animated.Value(0)).current;
  const advancedRef = useRef(false);

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

    // ⭐ゲットの瞬間: ゴールが出たあとに星がぽんっと弾む＋「きらっ」。
    const starDelay = setTimeout(() => {
      playSound('star');
      Animated.spring(starScale, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: false,
      }).start();
    }, 360);

    // ずんだもんの声「ついたね」。既存の clear 効果音（PlayScreen が到達時に鳴らす・約0.65秒）と
    // 星の「きらっ」のあとに遅らせて鳴らし、効果音と喧嘩させない。
    // クリップ未同梱の現状は speechSynthesis で読み上げ、非対応環境では無音（文字だけで成立）。
    const voiceDelay = setTimeout(() => {
      sayPhrase('tsuita');
    }, 750);

    return () => {
      clearTimeout(starDelay);
      clearTimeout(voiceDelay);
      // 全制覇でがんばりカードへ自動遷移する時など、離脱時に声を止めて次の声と重ならないように。
      cancelVoice();
    };
  }, [scale, opacity, starScale]);

  // 全部そろった瞬間だけ、⭐ゲットの余韻ののち自動で大祝福（がんばりカード）へ。
  useEffect(() => {
    if (!justCompletedAll || !onCelebrateAll) return;
    const t = setTimeout(() => {
      if (advancedRef.current) return;
      advancedRef.current = true;
      onCelebrateAll();
    }, 1900);
    return () => clearTimeout(t);
  }, [justCompletedAll, onCelebrateAll]);

  const starRotate = starScale.interpolate({
    inputRange: [0, 1],
    outputRange: ['-40deg', '0deg'],
  });

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.backdrop} pointerEvents="none" />
      <Confetti />

      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <View style={styles.zoomCircle}>
          <PiyoArt glyph={goalEmoji} size={128} emojiSize={104} />

          {/* ⭐ゲットのスタンプ（右上にぽんっ） */}
          <Animated.View
            style={[
              styles.starStamp,
              { transform: [{ scale: starScale }, { rotate: starRotate }] },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.starGlyph}>⭐</Text>
          </Animated.View>
        </View>
        <Text style={styles.headline}>ついたね!</Text>
        <Animated.Text style={[styles.starGot, { opacity: starScale }]}>
          ⭐ゲット!
        </Animated.Text>
      </Animated.View>

      {/* 全部そろった瞬間はボタンを出さず自動で大祝福へ。それ以外は次の行動ボタン。 */}
      {justCompletedAll ? null : (
        <View style={styles.buttons}>
          <BigButton emoji="🔁" label="もういちど" onPress={onReplay} color={colors.button} />
          {onNext ? (
            <BigButton emoji="👉" label="つぎへ" onPress={onNext} color={colors.play} pressedColor={colors.playPressed} />
          ) : null}
          <BigButton emoji="🏠" label="おうちへ" onPress={onHome} />
        </View>
      )}
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
  starStamp: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starGlyph: {
    fontSize: 64,
    textShadowColor: '#00000055',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
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
  starGot: {
    marginTop: space.xs,
    fontSize: font.big,
    fontWeight: '900',
    color: '#FFE270',
    textShadowColor: '#00000088',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  buttons: {
    width: '100%',
    maxWidth: 360,
    rowGap: space.sm,
  },
});