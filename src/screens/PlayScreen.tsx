// プレイ画面（①タップで即1マス動くモード）。
// 上段: ゴールの案内 / 中段: めいろ盤面＋アバター / 下段: 方向パッド。
// 方向ボタン → 動ける向きなら1マス移動、壁/障害物なら首をかしげる（罰なし）。
// ゴール到達 → 祝福オーバーレイ（もういちど / つぎへ / おうちへ）。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors, font, radius, space } from '../theme';
import { getTemplate, getNextTemplateId } from '../data/templates';
import { generateLevel } from '../game/generate';
import { Coord, Direction, Level } from '../types';
import { canMove, isGoal, move } from '../game/maze';
import { playSound } from '../audio/sounds';
import { allCleared, hasCelebratedAll, markCleared } from '../progress';
import MazeGrid from '../components/MazeGrid';
import DirPad from '../components/DirPad';
import ClearOverlay from '../components/ClearOverlay';
import BigButton from '../components/BigButton';

interface Props {
  templateId: string;
  onHome: () => void;
  onNext: (nextTemplateId: string) => void;
  onCelebrateAll: () => void; // 全5レベルの⭐が初めて揃った → がんばりカードへ
}

export default function PlayScreen({ templateId, onHome, onNext, onCelebrateAll }: Props) {
  const template = getTemplate(templateId);
  const { width, height } = useWindowDimensions();

  // このテンプレートから生成した「いまの迷路」。カードを開くたび／「もういちど」のたびに
  // 新しい迷路を作る（さんすうドリルのように何回も遊べる）。テンプレートが無い保険では null。
  // key={templateId}（App.tsx）で画面はテンプレートごとに作り直されるので、初期生成は1回。
  const [level, setLevel] = useState<Level | null>(() =>
    template ? generateLevel(template) : null
  );

  // --- 盤面・ボタンの寸法 ---
  // 縦を「上段ヘッダー＋めいろ＋方向パッド」で必ず収める。
  // 以前は maxBoardH = height*0.46 と最小64pxの固定寸法だったため、背の低い（横長でない）
  // ウィンドウでは盤がはみ出し、RN Web の View 既定 overflow:visible により上のヘッダーへ
  // 覆いかぶさって文言が隠れていた。ここでヘッダー/パッドのぶんを差し引いた高さに収める。
  const cols = level?.cols ?? 1;
  const rows = level?.rows ?? 1;

  const contentW = Math.min(width, 480) - space.md * 2; // 横に使える幅（frame の左右パディングぶん）
  const availH = Math.max(height - (space.lg + space.md), 320); // 縦に使える高さ（frame の上下パディングぶん）
  const HEADER_H = 64; // 上段（おうち＋ゴール案内）にみておく高さ
  const GAP = space.md; // 盤と方向パッドのあいだの最小余白

  // 方向パッド: 幅と「高さの持ちぶん」の両方から1辺を決める（背の低い画面では小さくする）。
  const bodyH = Math.max(availH - HEADER_H, 200);
  const padBudget = Math.min(bodyH * 0.42, 340); // 方向パッド帯に割り当てる高さの上限
  const dirByH = Math.floor((padBudget - space.md) / 3.3); // 3行＋行間＋下パディングぶん
  const dirByW = Math.floor(contentW / 3.4);
  const dirSize = Math.max(52, Math.min(dirByH, dirByW, 100));
  const padAreaH = Math.ceil(dirSize * 3.3) + space.md; // 実際に方向パッド帯が占める高さの見積り

  // めいろのマス: 残り高さと幅の小さいほうに収める。下限も小さめにして絶対にあふれさせない。
  const boardBudgetH = Math.max(bodyH - padAreaH - GAP, rows * 44);
  const cell = Math.max(44, Math.floor(Math.min(contentW / cols, boardBudgetH / rows, 116)));

  // --- アバターの状態（論理位置は ref、見た目は Animated 値で駆動）---
  const start = level?.start ?? { x: 0, y: 0 };
  const posRef = useRef<Coord>(start);
  const avatarPos = useRef(new Animated.ValueXY({ x: start.x * cell, y: start.y * cell })).current;
  const avatarTilt = useRef(new Animated.Value(0)).current;
  const animatingRef = useRef(false);
  const [arrived, setArrived] = useState(false);
  // このクリアで全5レベルの⭐が初めて揃ったか（＝がんばりカードへ自動で進む）。
  const [completedAll, setCompletedAll] = useState(false);

  // 画面リサイズ時、アニメ中でなければアバターを論理位置に合わせ直す。
  useEffect(() => {
    if (!animatingRef.current) {
      avatarPos.setValue({ x: posRef.current.x * cell, y: posRef.current.y * cell });
    }
  }, [cell, avatarPos]);

  // 「もういちど」= 同じむずかしさで新しい迷路を作り直す（さんすうドリルのように毎回ちがう）。
  // マス数はテンプレート内で不変なので cell は変わらず、アバターは新しいスタートへ置き直す。
  const reset = useCallback(() => {
    if (!template) return;
    const nextLevel = generateLevel(template);
    setLevel(nextLevel);
    animatingRef.current = false;
    posRef.current = nextLevel.start;
    avatarPos.setValue({ x: nextLevel.start.x * cell, y: nextLevel.start.y * cell });
    avatarTilt.setValue(0);
    setArrived(false);
    setCompletedAll(false);
  }, [template, cell, avatarPos, avatarTilt]);

  // 動けないときの「首をかしげる」演出。
  const wiggle = useCallback(() => {
    animatingRef.current = true;
    avatarTilt.setValue(0);
    Animated.sequence([
      Animated.timing(avatarTilt, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(avatarTilt, { toValue: -1, duration: 150, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(avatarTilt, { toValue: 0, duration: 90, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]).start(() => {
      animatingRef.current = false;
    });
  }, [avatarTilt]);

  const onDir = useCallback(
    (dir: Direction) => {
      if (!level || arrived || animatingRef.current) return;
      const cur = posRef.current;
      if (!canMove(level, cur, dir)) {
        // 壁・障害物・盤外 → 失敗ではなく首をかしげるだけ。
        playSound('blocked');
        wiggle();
        return;
      }
      const next = move(cur, dir);
      animatingRef.current = true;
      playSound('move');
      Animated.timing(avatarPos, {
        toValue: { x: next.x * cell, y: next.y * cell },
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start(() => {
        animatingRef.current = false;
        posRef.current = next;
        if (isGoal(level, next)) {
          // クリア=⭐（何手で着いたかは問わない）。既にクリア済みなら剥奪・変化なし。
          markCleared(level.id);
          // このクリアで全部そろい、まだ大祝福を見せていなければ「がんばりカード」へ。
          setCompletedAll(allCleared() && !hasCelebratedAll());
          playSound('clear');
          setArrived(true);
        }
      });
    },
    [level, arrived, cell, avatarPos, wiggle]
  );

  // データ不整合の保険（通常は到達しない）。
  if (!level) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>レベルが みつかりません</Text>
        <BigButton emoji="🏠" label="おうちへ" onPress={onHome} color={colors.button} />
      </View>
    );
  }

  const nextId = getNextTemplateId(templateId);

  return (
    <View style={styles.root}>
      {/* 上段: おうちボタン＋ゴール案内 */}
      <View style={styles.top}>
        <Pressable onPress={onHome} hitSlop={10} style={styles.homeBtn} accessibilityLabel="おうちへ">
          <Text style={styles.homeGlyph}>🏠</Text>
        </Pressable>
        <View style={styles.banner}>
          <Text style={styles.bannerLabel} numberOfLines={1}>
            ここまで いこう
          </Text>
          <Text style={styles.bannerGoal}>{level.goalEmoji}</Text>
        </View>
        <View style={styles.homeBtn} />
      </View>

      {/* 中段: めいろ盤面 */}
      <View style={styles.boardArea}>
        <MazeGrid
          level={level}
          cell={cell}
          avatarPos={avatarPos}
          avatarTilt={avatarTilt}
          goalEmoji={level.goalEmoji}
        />
      </View>

      {/* 下段: 方向パッド */}
      <View style={styles.padArea}>
        <DirPad onDir={onDir} size={dirSize} />
      </View>

      {arrived ? (
        <ClearOverlay
          goalEmoji={level.goalEmoji}
          onReplay={() => {
            playSound('tap');
            reset();
          }}
          onNext={nextId ? () => onNext(nextId) : undefined}
          onHome={onHome}
          justCompletedAll={completedAll}
          onCelebrateAll={onCelebrateAll}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeGlyph: {
    fontSize: 30,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderWidth: 2,
    borderColor: colors.tileBorder,
  },
  bannerLabel: {
    fontSize: font.body,
    fontWeight: '800',
    color: colors.text,
    marginRight: space.sm,
  },
  bannerGoal: {
    fontSize: 32,
  },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: space.md,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: space.lg,
  },
  fallbackText: {
    fontSize: font.big,
    color: colors.text,
  },
});