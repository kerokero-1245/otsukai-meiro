// タイトル画面。文字ゼロでも進める大ボタン「あそぶ」＋概念の絵（🐥→🍎）。
// 隅の歯車を3秒長押しでおとなモードへ（4歳が偶発しにくい親ゲート／DESIGN §6）。

import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, space } from '../theme';
import BigButton from '../components/BigButton';
import PiyoArt from '../components/PiyoArt';
import { playSound } from '../audio/sounds';
import { sayPhrase, warmUpVoice } from '../audio/voice';

interface Props {
  onPlay: () => void;
  onOtona: () => void;
}

const HOLD_MS = 3000;

export default function TitleScreen({ onPlay, onOtona }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHold = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const startHold = () => {
    clearHold();
    timer.current = setTimeout(() => {
      timer.current = null;
      onOtona();
    }, HOLD_MS);
  };

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        {/* タイトル＋概念の絵をタップすると「おつかいめいろ」と声が出る（ジェスチャ起点）。
            同時に声エンジンをアンロックして、以降のゴール到達・がんばりカードの声も鳴るようにする。 */}
        <Pressable
          onPress={() => {
            warmUpVoice();
            sayPhrase('title');
          }}
          accessibilityRole="button"
          accessibilityLabel="おつかいめいろ（こえ）"
          style={styles.titleTap}
        >
          <Text style={styles.title}>おつかいめいろ</Text>

          <View style={styles.concept}>
            <PiyoArt glyph="🐥" size={82} emojiSize={64} />
            <Text style={styles.conceptArrow}>➡️</Text>
            <PiyoArt glyph="🍎" size={82} emojiSize={64} />
          </View>
        </Pressable>

        <View style={styles.playWrap}>
          <BigButton
            emoji="▶️"
            label="あそぶ"
            size="huge"
            color={colors.play}
            pressedColor={colors.playPressed}
            onPress={() => {
              // 声を出さずに次へ進むが、ここでも声エンジンをアンロックしておく
              // （タイトルをタップせず直接「あそぶ」を押した子でも、後の声が鳴るように）。
              warmUpVoice();
              playSound('tap');
              onPlay();
            }}
          />
        </View>
      </View>

      {/* 親ゲート: 3秒長押しでおとなモード */}
      <Pressable
        onPressIn={startHold}
        onPressOut={clearHold}
        accessibilityLabel="おとなモード（長押し）"
        hitSlop={12}
        style={styles.gear}
      >
        <Text style={styles.gearGlyph}>⚙️</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTap: {
    alignItems: 'center',
  },
  title: {
    fontSize: font.huge,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 1,
  },
  concept: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.lg,
    marginBottom: space.xl,
  },
  conceptArrow: {
    fontSize: 40,
    marginHorizontal: space.sm,
  },
  playWrap: {
    width: '100%',
    maxWidth: 320,
  },
  gear: {
    position: 'absolute',
    right: space.sm,
    bottom: space.sm,
    padding: space.sm,
    opacity: 0.35,
  },
  gearGlyph: {
    fontSize: 30,
  },
});