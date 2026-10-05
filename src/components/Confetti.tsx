// 祝福の紙吹雪。外部素材を使わず、色つきの小片を Animated で上から降らせるだけ。
// pointerEvents="none" で下のボタン操作は妨げない。
// 横位置は画面幅ではなく、紙吹雪を置いた枠（親）の実測幅で決める。画面幅で決めると、
// 最大幅 480 の枠を中央に置く広い画面で、紙吹雪が枠の外（右側）に散らばっていた。

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet } from 'react-native';
import { colors } from '../theme';

interface PieceSpec {
  x: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
}

function Piece({ spec, fallH }: { spec: PieceSpec; fallH: number }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(p, {
        toValue: 1,
        duration: spec.duration,
        delay: spec.delay,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
      { iterations: 2 }
    );
    anim.start();
    return () => anim.stop();
  }, [p, spec.duration, spec.delay]);

  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [-40, fallH] });
  const translateX = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, spec.drift, 0] });
  const rotate = p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spec.spin}deg`] });
  const opacity = p.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: spec.x,
        top: 0,
        width: spec.size,
        height: spec.size,
        borderRadius: 3,
        backgroundColor: spec.color,
        transform: [{ translateX }, { translateY }, { rotate }],
        opacity,
      }}
    />
  );
}

export default function Confetti({ count = 18 }: { count?: number }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b.w === width && b.h === height ? b : { w: width, h: height }));
  };
  const width = box.w;
  const specs = useMemo<PieceSpec[]>(() => {
    if (width <= 0) return [];
    const palette = colors.confetti;
    return Array.from({ length: count }, (_, i) => {
      const size = 10 + Math.random() * 10;
      // 小片の左端は 0..(枠の幅−大きさ)。左右の揺れ（drift）も枠の内側に収める。
      const x = Math.random() * Math.max(0, width - size);
      const drift = Math.min(Math.max((Math.random() - 0.5) * 90, -x), width - size - x);
      return {
        x,
        size,
        color: palette[i % palette.length],
        delay: Math.random() * 500,
        duration: 1500 + Math.random() * 1200,
        drift,
        spin: 360 + Math.random() * 360,
      };
    });
  }, [count, width]);

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {specs.map((spec, i) => (
        <Piece key={i} spec={spec} fallH={box.h + 40} />
      ))}
    </Animated.View>
  );
}
