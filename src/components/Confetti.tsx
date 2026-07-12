// 祝福の紙吹雪。外部素材を使わず、色つきの小片を Animated で上から降らせるだけ。
// pointerEvents="none" で下のボタン操作は妨げない。

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
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
  const { width, height } = useWindowDimensions();
  const specs = useMemo<PieceSpec[]>(() => {
    const palette = colors.confetti;
    return Array.from({ length: count }, (_, i) => ({
      x: Math.random() * width,
      size: 10 + Math.random() * 10,
      color: palette[i % palette.length],
      delay: Math.random() * 500,
      duration: 1500 + Math.random() * 1200,
      drift: (Math.random() - 0.5) * 90,
      spin: 360 + Math.random() * 360,
    }));
  }, [count, width]);

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      {specs.map((spec, i) => (
        <Piece key={i} spec={spec} fallH={height + 40} />
      ))}
    </Animated.View>
  );
}