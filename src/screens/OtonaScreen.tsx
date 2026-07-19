// おとなモード（親ゲートの奥）。MVP（フェーズ1）は入口だけ用意した準備中スタブ。
// フェーズ2でゴール写真の差し替え（image-picker）・おじの声の差し替えをここに実装する。
// ごほうび（スタンプ式）の「⭐をリセット」だけは先に配置（DESIGN §14）。破壊的操作なので確認を1枚はさむ。

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../theme';
import BigButton from '../components/BigButton';
import { clearedCount, resetProgress } from '../progress';
import { isBgmOn, setBgmOn } from '../audio/bgm';

interface Props {
  onBack: () => void;
}

export default function OtonaScreen({ onBack }: Props) {
  const [count, setCount] = useState(() => clearedCount());
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [bgmOn, setBgmOnState] = useState(() => isBgmOn());

  // BGM の ON/OFF トグル（既定 ON・保存キー meiro.bgm）。この押下はユーザー操作なので、
  // ON にした瞬間その場で（ジェスチャ文脈で）鳴らし直せる。OFF なら即フェード停止。
  const toggleBgm = () => {
    const next = !bgmOn;
    setBgmOn(next);
    setBgmOnState(next);
  };

  const doReset = () => {
    resetProgress();
    setCount(0);
    setConfirming(false);
    setDone(true);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>おとなモード</Text>

      <View style={styles.card}>
        <Text style={styles.body}>
          ここでゴールの写真や、おじの声を差し替えられるようにする予定です。
        </Text>
        <Text style={styles.note}>いまは準備中です（フェーズ2）。</Text>
      </View>

      {/* ごほうび（⭐）のリセット。子どもの誤操作で消えないよう確認を1枚はさむ。 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>ごほうびの ⭐</Text>
        <Text style={styles.note}>
          {done ? 'リセットしました。' : `いま ⭐は ${count} こ ついています。`}
        </Text>

        {confirming ? (
          <View style={styles.confirmRow}>
            <Text style={styles.confirmText}>ぜんぶ けしても いい?</Text>
            <View style={styles.confirmButtons}>
              <BigButton emoji="🗑️" label="けす" onPress={doReset} color={colors.button} />
              <BigButton emoji="↩️" label="やめる" onPress={() => setConfirming(false)} />
            </View>
          </View>
        ) : (
          <View style={styles.resetWrap}>
            <BigButton
              emoji="⭐"
              label="⭐をリセット"
              onPress={() => {
                setDone(false);
                setConfirming(true);
              }}
            />
          </View>
        )}
      </View>

      {/* BGM（オルゴール）の ON/OFF。既定 ON。子は触らない前提（親ゲートの奥）だが、うるさければ切れる。 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>おんがく（BGM）</Text>
        <Text style={styles.note}>
          {bgmOn ? 'いま BGM は ながれます ♪' : 'いま BGM は ながれません。'}
        </Text>
        <View style={styles.resetWrap}>
          <BigButton
            emoji={bgmOn ? '🎵' : '🔇'}
            label={bgmOn ? 'BGM: ながす' : 'BGM: ながさない'}
            onPress={toggleBgm}
            color={bgmOn ? colors.play : colors.button}
            pressedColor={bgmOn ? colors.playPressed : colors.buttonPressed}
          />
        </View>
        <Text style={styles.note}>タップで きりかえ</Text>
      </View>

      <View style={styles.spacer} />

      {/* こえ（よみあげ）の出どころ。同梱クリップは VOICEVOX（ずんだもん）で生成。
          対応環境が無い場合のみ端末の音声合成へフォールバックする（README の音声メモ参照）。 */}
      <Text style={styles.credit}>VOICEVOX:ずんだもん</Text>

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
    marginBottom: space.md,
  },
  body: {
    fontSize: font.body,
    color: colors.text,
    lineHeight: 30,
  },
  sectionTitle: {
    fontSize: font.big,
    fontWeight: '800',
    color: colors.text,
    marginBottom: space.xs,
  },
  note: {
    fontSize: font.small,
    color: colors.subtext,
    marginTop: space.xs,
  },
  resetWrap: {
    marginTop: space.md,
  },
  confirmRow: {
    marginTop: space.md,
  },
  confirmText: {
    fontSize: font.body,
    fontWeight: '800',
    color: colors.text,
    marginBottom: space.sm,
  },
  confirmButtons: {
    rowGap: space.sm,
  },
  spacer: {
    flex: 1,
  },
  credit: {
    fontSize: font.small,
    color: colors.subtext,
    textAlign: 'center',
    marginBottom: space.md,
  },
});