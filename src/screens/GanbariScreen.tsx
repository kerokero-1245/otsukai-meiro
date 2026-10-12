// 「ぜんぶ できたね! がんばりカード」。全5レベルの⭐が揃ったときに一度だけ見せる大祝福（DESIGN §14）。
// ⭐×5 が順にぽんっと並び → 王冠＋大きな「ぜんぶ できたね!」＋紙吹雪。減点・失敗表示は一切なし。
// 表示のたびに setCelebratedAll(true) 済みなので、以降はレベルえらびの控えめな王冠だけになる。

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { colors, font, space } from "../theme";
import { frameInnerWidth } from "../layout";
import { TEMPLATES } from "../data/templates";
import { playSound } from "../audio/sounds";
import { sayPhrase, cancelVoice } from "../audio/voice";
import BigButton from "../components/BigButton";
import Confetti from "../components/Confetti";

interface Props {
  onDone: () => void; // レベルえらびへ（王冠つきで戻る）
}

// ⭐の数 = 全レベル（むずかしさテンプレート）の数。templates.json にカードを足すと、がんばりカードの⭐も増える（DESIGN §11）。
const STAR_COUNT = TEMPLATES.length;

export default function GanbariScreen({ onDone }: Props) {
  const { width, height } = useWindowDimensions();

  // 背の低い画面でもはみ出さないよう、星と間隔を幅・高さから決める。
  const inner = frameInnerWidth(width);
  const starSize = Math.max(
    40,
    Math.min(
      72,
      Math.floor(inner / (STAR_COUNT + 1)),
      Math.floor(height * 0.11),
    ),
  );

  // ⭐×5 が順にぽんっと出るスプリング値。
  const stars = useRef(
    Array.from({ length: STAR_COUNT }, () => new Animated.Value(0)),
  ).current;
  // 最後に王冠＋見出しがふわっと出る。
  const crown = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    stars.forEach((v, i) => {
      timers.push(
        setTimeout(
          () => {
            playSound("star");
            Animated.spring(v, {
              toValue: 1,
              friction: 4,
              tension: 120,
              useNativeDriver: false,
            }).start();
          },
          300 + i * 340,
        ),
      );
    });
    // 全部そろったら大きな祝福（王冠＋ファンファーレ）。
    const fanfareAt = 300 + STAR_COUNT * 340 + 150;
    timers.push(
      setTimeout(() => {
        playSound("fanfare");
        Animated.spring(crown, {
          toValue: 1,
          friction: 5,
          tension: 90,
          useNativeDriver: false,
        }).start();
      }, fanfareAt),
    );
    // ずんだもんの声「ぜんぶ できたね」。fanfare 効果音（約1秒）のあとに鳴らして喧嘩させない。
    // 鳴る声は おじの録音 → 同梱クリップ（p_zenbu）→ speechSynthesis → 無音 の順（voice.ts）。
    // どれも鳴らせない環境でも文字だけで成立する。
    timers.push(
      setTimeout(() => {
        sayPhrase("zenbu");
      }, fanfareAt + 1050),
    );
    return () => {
      timers.forEach(clearTimeout);
      cancelVoice(); // 画面を離れるとき、鳴りかけの声を止める。
    };
  }, [stars, crown]);

  const crownTranslate = crown.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });

  return (
    <View style={styles.root}>
      <Confetti count={26} />

      <View style={styles.center}>
        <Animated.View
          style={[
            styles.crownWrap,
            { opacity: crown, transform: [{ translateY: crownTranslate }] },
          ]}
        >
          <Text style={styles.crown}>👑</Text>
        </Animated.View>

        <Animated.Text
          style={[
            styles.headline,
            { opacity: crown, transform: [{ scale: crown }] },
          ]}
        >
          ぜんぶ できたね!
        </Animated.Text>

        <View style={styles.starsRow}>
          {stars.map((v, i) => {
            const rotate = v.interpolate({
              inputRange: [0, 1],
              outputRange: ["-45deg", "0deg"],
            });
            return (
              <Animated.Text
                key={i}
                style={[
                  styles.star,
                  { fontSize: starSize, transform: [{ scale: v }, { rotate }] },
                ]}
              >
                ⭐
              </Animated.Text>
            );
          })}
        </View>

        <Animated.Text style={[styles.sub, { opacity: crown }]}>
          🐥 すごい! がんばったね
        </Animated.Text>
      </View>

      <Animated.View style={[styles.buttonWrap, { opacity: crown }]}>
        <BigButton
          emoji="🎉"
          label="やったー!"
          size="huge"
          color={colors.play}
          pressedColor={colors.playPressed}
          onPress={() => {
            playSound("tap");
            onDone();
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  crownWrap: {
    marginBottom: space.sm,
  },
  crown: {
    fontSize: 64,
  },
  headline: {
    fontSize: font.huge,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 1,
    marginBottom: space.lg,
    textAlign: "center",
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: space.xs,
    flexWrap: "nowrap",
  },
  star: {
    textShadowColor: "#00000033",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  sub: {
    marginTop: space.lg,
    fontSize: font.big,
    fontWeight: "800",
    color: colors.subtext,
    textAlign: "center",
  },
  buttonWrap: {
    width: "100%",
    maxWidth: 320,
    alignSelf: "center",
    paddingBottom: space.md,
  },
});
