// めいろ盤面の描画。市松のタイル・障害物・ゴール・アバターを1つの盤に重ねる。
// アバターの位置(avatarPos)と首かしげ(avatarTilt)は親(PlayScreen)が Animated 値で駆動する
// 制御コンポーネント。ここでは描画とゴールのゆるやかな“きらきら”だけを持つ。

import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Level } from "../types";
import { colors, radius } from "../theme";
import { BOARD_BORDER } from "../layout";
import { isGoal, isObstacle } from "../game/maze";
import { tileColor } from "../game/tileColor";
import Avatar from "./Avatar";
import PiyoArt from "./PiyoArt";
import GoalArt from "./GoalArt";

const OBSTACLE_EMOJI = "🌳";

interface Props {
  level: Level;
  cell: number; // 1マスのピクセルサイズ
  avatarPos: Animated.ValueXY; // アバターの左上ピクセル位置
  avatarTilt: Animated.Value; // -1..1（首かしげ）
  goalEmoji: string;
}

export default function MazeGrid({
  level,
  cell,
  avatarPos,
  avatarTilt,
  goalEmoji,
}: Props) {
  // 外寸（枠線こみ）。枠線の内側がちょうどマス目全体になる。
  const boardW = cell * level.cols + BOARD_BORDER * 2;
  const boardH = cell * level.rows + BOARD_BORDER * 2;

  // ゴールをそっと目立たせるゆるやかな拍動（§4 強い点滅は避ける）。
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // 市松タイル。
  const tiles: React.ReactNode[] = [];
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      const tile = { x, y };
      const bg = tileColor(x, y, isGoal(level, tile), isObstacle(level, tile));
      tiles.push(
        <View
          key={`t-${x}-${y}`}
          style={[
            styles.tile,
            {
              left: x * cell,
              top: y * cell,
              width: cell,
              height: cell,
              backgroundColor: bg,
            },
          ]}
        />,
      );
    }
  }

  const rotate = avatarTilt.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-14deg", "0deg", "14deg"],
  });

  return (
    <View style={[styles.board, { width: boardW, height: boardH }]}>
      {/* 市松のマスは角丸の枠線の内側で切る（四隅の四角いマスが角丸の外へ出ないように）。
          切るのはマスの層だけ。盤そのものは切らないので、枠線・影と、②で盤の上へ ぴょんと跳ねる
          アバター（PlayScreen の hopHome）は欠けない。 */}
      <View style={styles.tileLayer} pointerEvents="none">
        {tiles}
      </View>

      {/* 障害物（通れないマス） */}
      {level.obstacles.map((o, i) => (
        <View
          key={`o-${i}`}
          style={[
            styles.cellOverlay,
            { left: o.x * cell, top: o.y * cell, width: cell, height: cell },
          ]}
          pointerEvents="none"
        >
          <PiyoArt
            glyph={OBSTACLE_EMOJI}
            size={cell * 0.78}
            emojiSize={cell * 0.58}
          />
        </View>
      ))}

      {/* ゴール（おとなモードの写真があれば写真、無ければシールポップSVG/絵文字） */}
      <Animated.View
        style={[
          styles.cellOverlay,
          {
            left: level.goal.x * cell,
            top: level.goal.y * cell,
            width: cell,
            height: cell,
            transform: [{ scale: pulse }],
          },
        ]}
        pointerEvents="none"
      >
        <View
          style={[
            styles.goalHalo,
            {
              width: cell * 0.82,
              height: cell * 0.82,
              borderRadius: cell * 0.41,
            },
          ]}
        >
          <GoalArt
            glyph={goalEmoji}
            photoUri={level.goalImage}
            size={cell * 0.66}
            emojiSize={cell * 0.54}
          />
        </View>
      </Animated.View>

      {/* アバター */}
      <Animated.View
        style={[
          styles.avatarWrap,
          {
            width: cell,
            height: cell,
            transform: [
              { translateX: avatarPos.x },
              { translateY: avatarPos.y },
              { rotate },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <Avatar emoji={level.avatarEmoji} size={cell * 0.76} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.boardBg,
    borderRadius: radius.md,
    borderWidth: BOARD_BORDER,
    borderColor: colors.tileBorder,
    position: "relative",
    shadowColor: "#00000055",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  // 枠線の内側いっぱい。角丸は枠の角丸から枠線の太さを引いた内側の丸み。
  tileLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.md - BOARD_BORDER,
    overflow: "hidden",
  },
  tile: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.tileBorder,
  },
  cellOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  goalHalo: {
    backgroundColor: colors.goalHalo,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
