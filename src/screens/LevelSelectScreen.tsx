// レベルえらび。ゴール絵文字つきの大きなカードを横スクロールで並べる（DESIGN §6）。
// 文字は最小限。タップでプレイへ。前をクリアしなくても全レベル自由に選べる（進捗ロック無し）。
//
// 視認性の工夫（4歳児は「見えないもの＝存在しない」と認識するため）:
//  1) ピーク保証: どの画面幅でも「次のカードが必ず見切れて」見えるよう、カード幅を
//     画面幅から動的に算出（floor(画面幅 / 1.6) を上限つきで）。
//  2) 端の誘導サイン: まだ右（左）にカードがあるときだけ、端に柔らかい▶（◀）を
//     ゆっくり明滅＋小さく揺らして出す。端まで来たら消す（onScrollで判定）。
//  3) 初回ナッジ: 表示の約1秒後、スクロール可能なときだけ軽く右へ動いて戻る（1回だけ）。
//  4) 画面が広く全カードが収まる場合（PC等）は、誘導サイン・ナッジとも出さない。

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, font, radius, space } from '../theme';
import { LEVELS } from '../data/levels';
import { Level } from '../types';
import { playSound } from '../audio/sounds';
import { allCleared, isCleared } from '../progress';

interface Props {
  onPick: (levelId: string) => void;
  onBack: () => void;
}

// レイアウト定数（ピーク計算とスタイルで共有する）。
const H_PAD = space.md; // カルーセル左右の内側パディング（片側）
const GAP = space.md; // カード間の間隔
const CARD_MAX = 240; // カードの最大幅（大きすぎ防止）
const CARD_MIN = 188; // ゴールの円(128)＋左右余白が収まる最小幅

function LevelCard({
  level,
  index,
  cleared,
  width,
  onPick,
}: {
  level: Level;
  index: number;
  cleared: boolean;
  width: number;
  onPick: (id: string) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        playSound('tap');
        onPick(level.id);
      }}
      accessibilityRole="button"
      accessibilityLabel={cleared ? `${level.title}（クリアずみ）` : level.title}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.cardPressed]}
    >
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{index + 1}</Text>
      </View>

      {/* クリア済みのごほうび⭐（未クリアは何も出さない ＝「まだ無い」を意識させない）。 */}
      {cleared ? (
        <View style={styles.starBadge} pointerEvents="none">
          <Text style={styles.starBadgeGlyph}>⭐</Text>
        </View>
      ) : null}

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

// 端の誘導サイン。柔らかい三角を、ゆっくり明滅＋小さく左右に揺らす（4歳向けに派手すぎない）。
// 装飾なので pointerEvents="none"（タップは下のスクロールへ通す）。
function HintArrow({ side }: { side: 'left' | 'right' }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(a, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [a]);

  const opacity = a.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const sway = a.interpolate({
    inputRange: [0, 1],
    outputRange: side === 'right' ? [-3, 4] : [3, -4],
  });

  return (
    <View
      style={[styles.hintWrap, side === 'right' ? styles.hintRight : styles.hintLeft]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.hintBubble, { opacity, transform: [{ translateX: sway }] }]}>
        <Text style={styles.hintGlyph}>{side === 'right' ? '▶︎' : '◀︎'}</Text>
      </Animated.View>
    </View>
  );
}

export default function LevelSelectScreen({ onPick, onBack }: Props) {
  // 全部⭐が揃っていれば、控えめな王冠をそっと添える（減点・失敗表示は無し）。
  const crowned = allCleared();
  const { width: winW } = useWindowDimensions();

  const scrollRef = useRef<ScrollView>(null);
  const nudgedRef = useRef(false);
  const [measuredW, setMeasuredW] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // 実測できたらそれを使い、初回描画のちらつきは画面幅で代用する（フルブリードなので≒画面幅）。
  const viewportW = measuredW || winW;
  const n = LEVELS.length;

  // 全カードを程よい大きさで収められる幅か（PC等の広い画面か）を判定。
  const cardIfAllFit = Math.floor((viewportW - 2 * H_PAD - (n - 1) * GAP) / n);
  const allFit = cardIfAllFit >= CARD_MIN;

  // カード幅: 収まるなら詰めて中央寄せ、収まらないなら floor(画面幅 / 1.6) を上限つきで
  // （＝次のカードが必ず見切れて見える）。
  const cardW = allFit
    ? Math.min(cardIfAllFit, CARD_MAX)
    : Math.min(Math.floor(viewportW / 1.6), CARD_MAX);

  // 誘導サイン: スクロールできる（＝広い画面ではない）ときだけ、端でない側に出す。
  const showRight = !allFit && !atEnd;
  const showLeft = !allFit && !atStart;

  // 初回ナッジ: 約1秒後、スクロール可能なときだけ「ちょんっ」と右へ動いて戻る（1回だけ）。
  useEffect(() => {
    if (allFit || nudgedRef.current || !measuredW) return;
    nudgedRef.current = true;
    let t2: ReturnType<typeof setTimeout> | null = null;
    const t1 = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: 32, animated: true });
      t2 = setTimeout(() => {
        scrollRef.current?.scrollTo({ x: 0, animated: true });
      }, 420);
    }, 1000);
    return () => {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [allFit, measuredW]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const x = contentOffset.x;
    const maxX = contentSize.width - layoutMeasurement.width;
    setAtStart(x <= 2);
    setAtEnd(x >= maxX - 2);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn} accessibilityLabel="もどる">
          <Text style={styles.backGlyph}>◀️</Text>
        </Pressable>
        <View style={styles.promptRow}>
          {crowned ? <Text style={styles.crown}>👑</Text> : null}
          <Text style={styles.prompt}>どれで あそぶ?</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <View
        style={styles.carousel}
        onLayout={(e) => setMeasuredW(e.nativeEvent.layout.width)}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, allFit && styles.scrollCentered]}
        >
          {LEVELS.map((level, i) => (
            <LevelCard
              key={level.id}
              level={level}
              index={i}
              cleared={isCleared(level.id)}
              width={cardW}
              onPick={onPick}
            />
          ))}
        </ScrollView>

        {showLeft ? <HintArrow side="left" /> : null}
        {showRight ? <HintArrow side="right" /> : null}
      </View>
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
    paddingHorizontal: space.md, // フルブリードなので横の余白は画面側で持つ
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
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.xs,
  },
  crown: {
    fontSize: 26,
  },
  prompt: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
  },
  // カルーセル領域（縦方向中央にカードを置き、端に誘導サインを重ねる）。
  carousel: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollView: {
    flexGrow: 0,
    width: '100%',
  },
  scroll: {
    paddingHorizontal: H_PAD,
    paddingVertical: space.md,
    alignItems: 'center',
    columnGap: GAP,
  },
  // 全カードが収まる広い画面: 横方向に中央寄せ（誘導サインは出さない）。
  scrollCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  // 誘導サイン（端に重ねる、縦中央）。
  hintWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRight: {
    right: 2,
  },
  hintLeft: {
    left: 2,
  },
  hintBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.tileBorder,
    shadowColor: '#00000055',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  hintGlyph: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.button,
  },
  card: {
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
  starBadge: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.goalHalo,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#00000055',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  starBadgeGlyph: {
    fontSize: 26,
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