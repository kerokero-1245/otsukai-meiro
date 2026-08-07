// ゴールの見た目（写真 or シールポップSVG or 絵文字）を1か所にまとめた表示コンポーネント。
// DESIGN §1「ゴールを実在の写真に」/ フェーズ2。
//
// - photoUri（おとなモードで入れた写真の blob: URL）があれば **写真**を描く。
//   マス目のシールポップ画風に合わせ、白フチ・角丸・やわらかい影の「シール」に見せる。
// - photoUri が無い／読み込みに失敗した場合は、従来どおり PiyoArt（SVG or 絵文字）へ静かに戻る。
//   写真が壊れていても、こどもの画面は絶対に空にしない。
// - レイアウト不変: 呼び出し側は絵文字のときと同じスロット（size）に置くだけ。盤面の高さバジェット
//   （PlayScreen）には影響しない。
//
// fit: 'cover'  … マスの上・バナーなど小さい枠（正方形にきれいに収める。端は少し切れる）
//      'contain' … クリア演出のズーム（写真の全体を見せる。周りは白い台紙）

import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import PiyoArt from './PiyoArt';

interface Props {
  glyph: string; // 写真が無いときのグリフ（＝従来の goalEmoji）
  photoUri?: string | null; // おとなモードの写真（blob: URL）。null なら glyph を描く
  size: number; // 一辺(px)
  emojiSize?: number; // フォールバック絵文字の fontSize
  fit?: 'cover' | 'contain';
}

export default function GoalArt({ glyph, photoUri, size, emojiSize, fit = 'cover' }: Props) {
  // 写真が読めなかったら（消えた blob URL など）絵に戻す。
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [photoUri]);

  if (!photoUri || failed) {
    return <PiyoArt glyph={glyph} size={size} emojiSize={emojiSize} />;
  }

  const border = Math.max(2, Math.round(size * 0.05));
  const radius = Math.max(6, Math.round(size * 0.2));
  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: border,
        },
      ]}
    >
      <Image
        source={{ uri: photoUri }}
        style={styles.photo}
        resizeMode={fit}
        onError={() => setFailed(true)}
        accessible={false}
        fadeDuration={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderColor: colors.white,
    backgroundColor: colors.white,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // シールらしいやわらかい影（PiyoArt の素材と同じ空気に）。
    shadowColor: '#00000055',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
});
