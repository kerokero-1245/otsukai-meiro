// ゴール到達の祝福オーバーレイ。写真ズーム風の拡大＋紙吹雪＋「ついたね!」＋次の行動ボタン。
// ここに「⭐ゲット!」の瞬間を統合（ぽんっ＋効果音）。クリア=⭐なので、何手で着いたかは問わない。
// 罰やスコアは出さない（§4）。ボタンは大きく、絵文字＋ひらがなで示す。
//
// 全レベルに⭐が揃った瞬間（justCompletedAll）だけは、ボタンを出さずに ⭐ゲットの余韻のあと
// 自動で「ぜんぶ できたね! がんばりカード」へ進む（onCelebrateAll）。4歳が確実に大祝福に辿り着けるように。
//
// 中身（ゴールの絵・「ついたね!」・ボタン）はスクロールできる入れ物に入れる。背の低い画面（320x568・
// 横向きの 844x390・568x320 など）では縦に積むと下のボタンが画面の外に出ていたので、スクロールで必ず届くようにする。
// 縦持ちで高さが足りる画面では中身を中央に置くので、見た目は従来と同じ。ぴよぴよさんすうと同じ作り
// （さんすうは横向きでカードとボタンを左右に並べるが、めいろはスクロールだけ。背の低い横向きではめいろ画面の枠が
// 最大 960 に広がるが（src/layout.ts）、中身は中央の1列のまま）。

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, font, space } from '../theme';
import { FRAME_PAD_BOTTOM, FRAME_PAD_TOP } from '../layout';
import { playSound } from '../audio/sounds';
import { sayPhrase, cancelVoice } from '../audio/voice';
import BigButton from './BigButton';
import Confetti from './Confetti';
import PiyoArt from './PiyoArt';
import GoalArt from './GoalArt';

// 暗幕は画面全体に敷く。このオーバーレイは最大幅 480 の枠（App.tsx の frame）の内側に置かれるので、
// absolute のままだと広い画面では枠の中だけが暗くなる。web では position: fixed でビューポート全体を覆う
// （react-native-web は fixed をそのまま CSS に渡す。RN の型には無いので型だけ合わせる）。
const BACKDROP_FULL: ViewStyle | null =
  Platform.OS === 'web' ? ({ position: 'fixed' } as unknown as ViewStyle) : null;

// スクロールの入れ物は、枠（App.tsx の frame）の上下の余白（上 FRAME_PAD_TOP・下 FRAME_PAD_BOTTOM。src/layout.ts）まで広げて画面の上端〜下端を使う。
// 従来は中身を枠の中央に置き、背が足りない画面（360x640 など）では中身が枠の余白にはみ出したまま画面内に
// 収まっていた。入れ物を画面の高さまで広げ、中央の位置（枠の中央＝画面の中央より (FRAME_PAD_TOP − FRAME_PAD_BOTTOM)/2 下）を
// 上下の余白の差（FRAME_PAD_TOP − FRAME_PAD_BOTTOM）で保つので、中身が画面に収まる限り見た目は従来と同じ。収まらないときだけスクロールになる。
const SCROLL_EDGE = 4; // スクロールになったときの上下の最小のすき間

interface Props {
  goalEmoji: string;
  goalPhoto?: string | null; // おとなモードの写真（blob: URL）。あれば丸ではなく写真の台紙でズーム
  onReplay: () => void;
  onNext?: () => void; // 次のレベルが無ければ undefined（ボタンを出さない）
  onHome: () => void;
  justCompletedAll?: boolean; // このクリアで全5レベルの⭐が初めて揃った
  onCelebrateAll?: () => void; // ↑のとき「がんばりカード」へ進む
}

export default function ClearOverlay({
  goalEmoji,
  goalPhoto,
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
    // 鳴る声は おじの録音 → 同梱クリップ（p_tsuita）→ speechSynthesis → 無音 の順（voice.ts）。
    // どれも鳴らせない環境でも文字だけで成立する。
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
      <View style={[styles.backdrop, BACKDROP_FULL]} pointerEvents="none" />
      <Confetti />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          {/* 写真があるときは丸い台紙をやめ、白い台紙の「写真ズーム」にする（DESIGN §1）。
              fit='contain' なので、おばあちゃんの家の写真が端まで欠けずに大きく出る。 */}
          <View style={[styles.zoomCircle, goalPhoto ? styles.zoomPhoto : null]}>
            {goalPhoto ? (
              <GoalArt glyph={goalEmoji} photoUri={goalPhoto} size={168} fit="contain" />
            ) : (
              <PiyoArt glyph={goalEmoji} size={128} emojiSize={104} />
            )}

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
      </ScrollView>
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
  },
  scroll: {
    position: 'absolute',
    top: -FRAME_PAD_TOP,
    bottom: -FRAME_PAD_BOTTOM,
    left: 0,
    right: 0,
  },
  // 縦持ちでは従来の root と同じ中央寄せ（横の余白 space.lg）。高さが足りないときはスクロールで届く。
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingTop: FRAME_PAD_TOP - FRAME_PAD_BOTTOM + SCROLL_EDGE,
    paddingBottom: SCROLL_EDGE,
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
  // 写真のときだけ角丸の四角い台紙に（丸く切ると人や家が欠けるため）。寸法は同じ180。
  zoomPhoto: {
    borderRadius: 28,
    backgroundColor: colors.white,
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