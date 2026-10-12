// プレイ画面。二段階の遊びモード（DESIGN §3）を1画面で持つ。
//
//   ① タップで即動く（'tap' / 既定・フェーズ1）
//       上段: ゴールの案内 / 中段: めいろ盤面＋アバター / 下段: 方向パッド。
//       方向ボタン → 動ける向きなら1マス移動、壁/障害物なら首をかしげる（罰なし）。
//
//   ② ならべてゴー（'queue' / フェーズ4・やじるしモード）
//       上段に「命令の列」の帯が増える。方向ボタンは **その場では動かず** 列に矢印を積む。
//       十字のまんなかの「ゴー!」で先頭から1マスずつ実行し、けいかく→じっこう→かんさつ→しゅうせい
//       のループを回す（DESIGN §6 / §16）。
//
// どちらで遊ぶかは おとなモードの設定（settings.ts / localStorage `meiro.mode`）。既定は①なので、
// 親が有効化するまで こども側の見た目・挙動はフェーズ1と完全に同一。
// めいろ生成・移動判定（maze.ts）・⭐（progress.ts）・クリア演出は **両モード共通**。②が足すのは UI だけ。
//
// 背の低い横向き（src/layout.ts の isCompactLandscape。例: 844x390・568x320）では、1列に積むと盤の置き場所が
// 足りず level-05 の盤が上段に重なっていたので、左に「上段＋盤」、右に「（②の命令の列）＋方向パッド」を並べる。
// どちらの並びでも盤まわりの要素の木（mainCol / boardArea）は同じにして、回転しても盤やアバターを作り直さない
// （置き場所が変わるのは②の命令の列だけ。列の中身は PlayScreen の状態なので消えない）。

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { colors, font, radius, space } from "../theme";
import { getTemplate, getNextTemplateId } from "../data/templates";
import { generateLevel, QUEUE_MIN_CAPACITY } from "../game/generate";
import { Coord, Direction, Level, PlayMode } from "../types";
import { canMove, isGoal, move } from "../game/maze";
import { playSound } from "../audio/sounds";
import {
  allCleared,
  bumpTotalStars,
  hasCelebratedAll,
  markCleared,
} from "../progress";
import { getPlayMode } from "../settings";
import { useReducedMotion } from "../a11y";
import MazeGrid from "../components/MazeGrid";
import { computePlayLayout } from "../game/playLayout";
import DirPad from "../components/DirPad";
import ClearOverlay from "../components/ClearOverlay";
import BigButton from "../components/BigButton";
import GoalArt from "../components/GoalArt";
import GoButton from "../components/GoButton";
import CommandQueue from "../components/CommandQueue";
import { pickGoalPhotoUrl } from "../personal/store";

interface Props {
  templateId: string;
  onHome: () => void;
  onNext: (nextTemplateId: string) => void;
  onCelebrateAll: () => void; // 全レベルの⭐が初めて揃った → がんばりカードへ
}

// ②の1歩の見え方。1つずつ実行しているのが目で追えるよう、①（240ms・押した直後）より
// ほんの少しゆっくりにし、歩と歩のあいだにも短い間を置く。
const STEP_MS = 260;
const STEP_GAP_MS = 110;
// 列を全部実行してもゴールに届かなかったとき、首をかしげ始めるまでの間。
const MISS_PAUSE_MS = 320;

// 生成した迷路に「このプレイのゴールの見た目」を載せる。
// おとなモードで写真が入っていれば一定の割合で写真をゴールにする（personal/store.ts）。
// 写真が無い／保存が使えない環境では null のまま＝従来どおり絵文字プールのゴール。
// あそびかた（①/②）は迷路には載せない。画面が settings の値で描き分けるだけなので、
// 生成される迷路は①でも②でも同一（DESIGN §16.3）。
function decorate(level: Level): Level {
  const photo = pickGoalPhotoUrl();
  return photo ? { ...level, goalImage: photo } : level;
}

export default function PlayScreen({
  templateId,
  onHome,
  onNext,
  onCelebrateAll,
}: Props) {
  const template = getTemplate(templateId);
  const { width, height } = useWindowDimensions();

  // あそびかたは画面に入った時点の設定で固定する（遊んでいる最中に切り替わらない）。
  // おとなモードで変えたあとは タイトル→レベルえらび→プレイ と入り直すので必ず反映される。
  const [playMode] = useState<PlayMode>(() => getPlayMode());
  const isQueue = playMode === "queue";
  const reduceMotion = useReducedMotion();

  // このテンプレートから生成した「いまの迷路」。カードを開くたび／「もういちど」のたびに
  // 新しい迷路を作る（さんすうドリルのように何回も遊べる）。テンプレートが無い保険では null。
  // key={templateId}（App.tsx）で画面はテンプレートごとに作り直されるので、初期生成は1回。
  const [level, setLevel] = useState<Level | null>(() =>
    template ? decorate(generateLevel(template)) : null,
  );

  // --- ②ならべてゴー の状態（①では触らない）---
  const [queue, setQueue] = useState<Direction[]>([]);
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1); // いま実行している命令の位置
  // 並べられる矢印の上限。迷路の実際の最短手数＋よゆう（generate.ts の queueCapacity）。
  const capacity = level?.maxSteps ?? QUEUE_MIN_CAPACITY;

  // --- 盤面・ボタンの寸法 ---
  // 縦を「上段ヘッダー（＋②の命令の列）＋めいろ＋方向パッド」で必ず収める配分は、純粋関数
  // computePlayLayout（src/game/playLayout.ts。DESIGN §16.2 の実測表をテストで固定）が決める。
  const cols = level?.cols ?? 1;
  const rows = level?.rows ?? 1;
  const { side, strip, dirSize, sidePadW, cell } = computePlayLayout({
    width,
    height,
    cols,
    rows,
    isQueue,
    capacity,
  });

  // --- アバターの状態（論理位置は ref、見た目は Animated 値で駆動）---
  const start = level?.start ?? { x: 0, y: 0 };
  const posRef = useRef<Coord>(start);
  const avatarPos = useRef(
    new Animated.ValueXY({ x: start.x * cell, y: start.y * cell }),
  ).current;
  const avatarTilt = useRef(new Animated.Value(0)).current;
  const animatingRef = useRef(false);
  const [arrived, setArrived] = useState(false);
  // このクリアで全レベルの⭐が初めて揃ったか（＝がんばりカードへ自動で進む）。
  const [completedAll, setCompletedAll] = useState(false);

  // 実行中にリサイズされてもマス寸法を追えるよう、いつも最新の cell を持っておく。
  const cellRef = useRef(cell);
  cellRef.current = cell;

  // ②の実行を打ち切るための世代番号。もういちど／画面を離れる で増やすと、走っている
  // 実行ループは次のステップの手前で静かに抜ける（後片付けは打ち切った側が行う）。
  const runTokenRef = useRef(0);
  useEffect(
    () => () => {
      runTokenRef.current++;
    },
    [],
  );

  // 画面リサイズ時、アニメ中でなければアバターを論理位置に合わせ直す。
  useEffect(() => {
    if (!animatingRef.current) {
      avatarPos.setValue({
        x: posRef.current.x * cell,
        y: posRef.current.y * cell,
      });
    }
  }, [cell, avatarPos]);

  // 「もういちど」= 同じむずかしさで新しい迷路を作り直す（さんすうドリルのように毎回ちがう）。
  // マス数はテンプレート内で不変なので cell は変わらず、アバターは新しいスタートへ置き直す。
  const reset = useCallback(() => {
    if (!template) return;
    runTokenRef.current++; // 走っている実行があれば打ち切る（②）
    const nextLevel = decorate(generateLevel(template));
    setLevel(nextLevel);
    animatingRef.current = false;
    posRef.current = nextLevel.start;
    avatarPos.setValue({
      x: nextLevel.start.x * cell,
      y: nextLevel.start.y * cell,
    });
    avatarTilt.setValue(0);
    setArrived(false);
    setCompletedAll(false);
    setQueue([]);
    setRunning(false);
    setStepIndex(-1);
  }, [template, cell, avatarPos, avatarTilt]);

  // 動けないときの「首をかしげる」演出。②では1歩ぶんの待ちとしても使うので Promise を返す。
  // subdued（prefers-reduced-motion）のときは回転させず、同じ長さだけ間を置く。
  const tiltAsync = useCallback(
    (subdued = false): Promise<void> => {
      animatingRef.current = true;
      avatarTilt.setValue(0);
      if (subdued) {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            animatingRef.current = false;
            resolve();
          }, 330);
        });
      }
      return new Promise<void>((resolve) => {
        Animated.sequence([
          Animated.timing(avatarTilt, {
            toValue: 1,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(avatarTilt, {
            toValue: -1,
            duration: 150,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(avatarTilt, {
            toValue: 0,
            duration: 90,
            easing: Easing.in(Easing.quad),
            useNativeDriver: false,
          }),
        ]).start(() => {
          animatingRef.current = false;
          resolve();
        });
      });
    },
    [avatarTilt],
  );

  // ①タップモードの首かしげ（従来と同じ挙動。結果は待たない）。
  const wiggle = useCallback(() => {
    void tiltAsync();
  }, [tiltAsync]);

  // ゴールに着いたときの共通処理（①・②のどちらも通る）。順序は変えない:
  //  1) 街（ランチャー）の燃料。クリアのたび +1（再クリアも +1。バッジとは独立）。
  //     先に積む: markCleared が今回の⭐を足す前に読むことで、初回マイグレーション
  //     （totalStars 未存在時に meiro.stars 件数を初期値化）が今回の1クリアを二重計上しない。
  //  2) クリア=⭐（何手で着いたかは問わない）。既にクリア済みなら剥奪・変化なし。
  //  3) このクリアで全部そろい、まだ大祝福を見せていなければ「がんばりカード」へ。
  //  4) clear の効果音 → 5) 到着の表示（ClearOverlay）。
  const celebrate = useCallback((lv: Level) => {
    bumpTotalStars();
    markCleared(lv.id);
    setCompletedAll(allCleared() && !hasCelebratedAll());
    playSound("clear");
    setArrived(true);
  }, []);

  const onDir = useCallback(
    (dir: Direction) => {
      if (!level || arrived || animatingRef.current) return;
      const cur = posRef.current;
      if (!canMove(level, cur, dir)) {
        // 壁・障害物・盤外 → 失敗ではなく首をかしげるだけ。
        playSound("blocked");
        wiggle();
        return;
      }
      const next = move(cur, dir);
      animatingRef.current = true;
      playSound("move");
      Animated.timing(avatarPos, {
        toValue: { x: next.x * cell, y: next.y * cell },
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start(() => {
        animatingRef.current = false;
        posRef.current = next;
        if (isGoal(level, next)) celebrate(level);
      });
    },
    [level, arrived, cell, avatarPos, wiggle, celebrate],
  );

  // ── ②ならべてゴー ───────────────────────────────────────────────
  // 矢印を1つ積む。上限に達していたら **静かに** 受け付けない（エラー表現なし / §4）。
  const onArrow = useCallback(
    (dir: Direction) => {
      if (!level || arrived || running) return;
      if (queue.length >= capacity) return;
      playSound("tap");
      setQueue((q) => (q.length >= capacity ? q : [...q, dir]));
    },
    [level, arrived, running, queue.length, capacity],
  );

  // 取り消しは「さいごの1つを消す」だけ（単発タップ・ドラッグや長押しは使わない / §4）。
  const onUndo = useCallback(() => {
    if (arrived || running || queue.length === 0) return;
    playSound("tap");
    setQueue((q) => q.slice(0, -1));
  }, [arrived, running, queue.length]);

  // 1マスぶんの移動アニメ（実行中のリサイズにも追従できるよう cellRef を見る）。
  const stepTo = useCallback(
    (next: Coord): Promise<void> => {
      const c = cellRef.current;
      return new Promise<void>((resolve) => {
        Animated.timing(avatarPos, {
          toValue: { x: next.x * c, y: next.y * c },
          duration: STEP_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start(() => resolve());
      });
    },
    [avatarPos],
  );

  // ゴールに届かなかったとき、スタートへ ぴょんと戻る（失敗ではないので罰の表現はしない）。
  // prefers-reduced-motion のときは弧を描かず、まっすぐ静かに戻す。
  const hopHome = useCallback(
    (from: Coord, to: Coord, subdued: boolean): Promise<void> => {
      const c = cellRef.current;
      const target = { x: to.x * c, y: to.y * c };
      animatingRef.current = true;
      const done = (resolve: () => void) => () => {
        animatingRef.current = false;
        resolve();
      };
      if (subdued) {
        return new Promise<void>((resolve) => {
          Animated.timing(avatarPos, {
            toValue: target,
            duration: 300,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }).start(done(resolve));
        });
      }
      const peak = Math.min(from.y * c, target.y) - c * 0.35;
      return new Promise<void>((resolve) => {
        Animated.parallel([
          Animated.timing(avatarPos.x, {
            toValue: target.x,
            duration: 460,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.sequence([
            Animated.timing(avatarPos.y, {
              toValue: peak,
              duration: 190,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
            Animated.timing(avatarPos.y, {
              toValue: target.y,
              duration: 270,
              easing: Easing.in(Easing.quad),
              useNativeDriver: false,
            }),
          ]),
        ]).start(done(resolve));
      });
    },
    [avatarPos],
  );

  // 「ゴー!」= 先頭から1マスずつ実行する。
  //  ・動けない歩（壁・障害物）は首をかしげ＋やさしい「?」音。**実行は止めず**次の命令へ進む
  //    （「言われたとおりに動く」を観察させる。ルビィ / Cubetto の流儀）。
  //  ・途中でゴールに着いたら残りの命令は捨てて即クリア（余分に並べたことを罰しない）。
  //  ・全部実行しても届かなければ、首をかしげ → スタートへ ぴょん → 列を空にして組み直し。
  //    タイマー・ライフ・減点は無い（§4）。
  const onGo = useCallback(async () => {
    if (!level || arrived || running || queue.length === 0) return;
    playSound("tap"); // 「ゴー!」は効果音だけ（新しい声は増やさない）
    const token = ++runTokenRef.current;
    const alive = () => runTokenRef.current === token;
    const steps = queue;

    setRunning(true);
    animatingRef.current = true;
    let pos = posRef.current;
    let reached = false;

    for (let i = 0; i < steps.length; i++) {
      if (!alive()) return;
      setStepIndex(i);
      const dir = steps[i];
      if (canMove(level, pos, dir)) {
        const next = move(pos, dir);
        playSound("move");
        await stepTo(next);
        if (!alive()) return;
        pos = next;
        posRef.current = next;
        if (isGoal(level, next)) {
          reached = true;
          break;
        }
      } else {
        // 動けない歩。止めずに次へ進む（＝ロボットの正直な実行を見せる）。
        playSound("blocked");
        await tiltAsync(reduceMotion);
        if (!alive()) return;
        // 首かしげの終わりは「動いていない」に戻すが、実行はまだ続く。実行中のままにしておかないと、
        // 次の 1 歩の最中のリサイズで、アバターが 1 マス前の位置へ合わせ直されて跳ぶ（走っている移動も止まる）。
        animatingRef.current = true;
      }
      await sleep(STEP_GAP_MS);
      if (!alive()) return;
    }

    setStepIndex(-1);
    animatingRef.current = false;
    // 実行中は、リサイズでのアバターの合わせ直しを止めている（上の animatingRef）。最後のマスの寸法で位置を取り直す。
    avatarPos.setValue({
      x: pos.x * cellRef.current,
      y: pos.y * cellRef.current,
    });

    if (reached) {
      setQueue([]); // 残りの命令は捨てる
      setRunning(false);
      celebrate(level);
      return;
    }

    // 届かなかった: 失敗にしない。首をかしげて、スタートへ ぴょんと戻って、また組み直す。
    await sleep(MISS_PAUSE_MS);
    if (!alive()) return;
    playSound("blocked");
    await tiltAsync(reduceMotion);
    if (!alive()) return;
    await hopHome(pos, level.start, reduceMotion);
    if (!alive()) return;
    posRef.current = level.start;
    avatarTilt.setValue(0);
    setQueue([]);
    setRunning(false);
  }, [
    level,
    arrived,
    running,
    queue,
    stepTo,
    tiltAsync,
    hopHome,
    celebrate,
    reduceMotion,
    avatarTilt,
    avatarPos,
  ]);

  // データ不整合の保険（通常は到達しない）。
  if (!level) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>レベルが みつかりません</Text>
        <BigButton
          emoji="🏠"
          label="おうちへ"
          onPress={onHome}
          color={colors.button}
        />
      </View>
    );
  }

  const nextId = getNextTemplateId(templateId);

  const queueStrip =
    isQueue && strip ? (
      <View style={side ? styles.queueAreaSide : styles.queueArea}>
        <CommandQueue
          queue={queue}
          capacity={capacity}
          activeIndex={stepIndex}
          metrics={strip}
          onUndo={onUndo}
          disabled={running || arrived}
        />
      </View>
    ) : null;

  // 方向パッド（②は十字のまんなかが「ゴー!」）。実行中は うすくする（②のみ）。横向きでは命令の列が
  // 同じ右の列に入るので、うすくするのは方向パッドだけにする（実行中に光る命令の列は うすくしない）。
  const padDim = isQueue && running ? styles.padRunning : null;
  const dirPad = (
    <DirPad
      onDir={isQueue ? onArrow : onDir}
      size={dirSize}
      disabled={isQueue && (running || arrived) ? true : undefined}
      center={
        isQueue ? (
          <GoButton
            size={dirSize}
            onPress={() => void onGo()}
            ready={queue.length > 0 && !arrived}
            running={running}
          />
        ) : undefined
      }
    />
  );

  return (
    <View style={[styles.root, side && styles.rootSide]}>
      {/* 左（縦持ちでは上〜中段）: 上段・命令の列・めいろ盤面 */}
      <View style={styles.mainCol}>
        {/* 上段: おうちボタン＋ゴール案内 */}
        <View style={styles.top}>
          <Pressable
            onPress={onHome}
            hitSlop={10}
            style={styles.homeBtn}
            accessibilityLabel="おうちへ"
          >
            <Text style={styles.homeGlyph}>🏠</Text>
          </Pressable>
          <View style={styles.banner}>
            <Text style={styles.bannerLabel} numberOfLines={1}>
              ここまで いこう
            </Text>
            <GoalArt
              glyph={level.goalEmoji}
              photoUri={level.goalImage}
              size={34}
              emojiSize={32}
            />
          </View>
          <View style={styles.homeBtn} />
        </View>

        {/* ②だけ: 命令の列（積んだ矢印と ⌫）。横向きでは右の列に置く */}
        {!side ? queueStrip : null}

        {/* 中段: めいろ盤面 */}
        <View style={styles.boardArea}>
          <MazeGrid
            level={level}
            cell={cell}
            avatarPos={avatarPos}
            avatarTilt={avatarTilt}
          />
        </View>
      </View>

      {/* 右（縦持ちでは下段）: 方向パッド（②は十字のまんなかが「ゴー!」） */}
      <View
        style={[styles.padArea, side && { width: sidePadW }, !side && padDim]}
      >
        {side ? (
          <>
            {queueStrip}
            <View style={padDim}>{dirPad}</View>
          </>
        ) : (
          dirPad
        )}
      </View>

      {arrived ? (
        <ClearOverlay
          goalEmoji={level.goalEmoji}
          goalPhoto={level.goalImage}
          onReplay={() => {
            playSound("tap");
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

// 実行ループの「間」。打ち切りは runToken で判定するので、片付けは要らない。
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // 背の低い横向き: 左に mainCol、右に方向パッドを並べる（すき間は盤と方向パッドの最小余白 space.md）。
  rootSide: {
    flexDirection: "row",
    columnGap: space.md,
  },
  // 上段＋命令の列＋盤。縦持ちでは従来の root の中身と同じ縦の並び（boardArea が残りを取る）。
  mainCol: {
    flex: 1,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  homeBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  homeGlyph: {
    fontSize: 30,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderWidth: 2,
    borderColor: colors.tileBorder,
  },
  bannerLabel: {
    fontSize: font.body,
    fontWeight: "800",
    color: colors.text,
    marginRight: space.sm,
  },
  // ②の「命令の列」の帯。高さは measureQueueStrip（game/queueStrip.ts）が決めた値（+ この上マージン）で
  // 高さバジェット（game/playLayout.ts）に算入済みなので、盤面・方向パッドと重ならない。
  queueArea: {
    marginTop: space.sm,
  },
  // 横向き: 右の列の方向パッドの上（すき間は下に取る）。
  queueAreaSide: {
    marginBottom: space.sm,
  },
  boardArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  padArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: space.md,
  },
  // 実行中は方向パッドをうすくして「いまは見るじかん」を伝える（②のみ）。
  padRunning: {
    opacity: 0.55,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    rowGap: space.lg,
  },
  fallbackText: {
    fontSize: font.big,
    color: colors.text,
  },
});
