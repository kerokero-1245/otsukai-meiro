// 絵文字スロットに「シールポップ」SVGを同サイズで載せる差し替え用コンポーネント。
//
// これまで各画面は <Text style={{fontSize}}>{絵文字}</Text> で役者（ぴよ／ゴール／障害物）を
// 描いていた。その見た目だけを素材へ置き換えるため、同じ「グリフ（絵文字文字列）」を受け取り、
// 対応するSVGがあれば <Image> で、無ければ従来どおり絵文字の <Text> で描く（安全な後方互換）。
//
// レイアウト不変の原則: 呼び出し側は絵文字のときと同じスロットに置く。
//  - size     : 画像の一辺(px)。<Image> の box。
//  - emojiSize : 素材が無いときのフォールバック絵文字の fontSize（既定は size）。
//               従来コードの fontSize をそのまま渡せば見た目・行の高さが変わらない。

import React from 'react';
import { Image, ImageStyle, StyleProp, Text, TextStyle } from 'react-native';
import { artForGlyph } from '../art';

interface Props {
  glyph: string; // 表示する絵文字（＝素材の識別子）
  size: number; // 画像の一辺(px)
  emojiSize?: number; // フォールバック絵文字の fontSize（既定 size）
  imageStyle?: StyleProp<ImageStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function PiyoArt({ glyph, size, emojiSize, imageStyle, textStyle }: Props) {
  const source = artForGlyph(glyph);
  if (source) {
    return (
      <Image
        source={source}
        style={[{ width: size, height: size }, imageStyle]}
        resizeMode="contain"
        accessible={false}
        fadeDuration={0}
      />
    );
  }
  return <Text style={[{ fontSize: emojiSize ?? size }, textStyle]}>{glyph}</Text>;
}
