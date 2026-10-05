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
import { generateLevel, QUEUE_MIN_CAPACITY } from '../game/generate';
import { Coord, Direction, Level, LevelMode } from '../types';
import { canMove, isGoal, move } from '../game/maze';
import { playSound } from '../audio/sounds';
import { allCleared, bumpTotalStars, hasCelebratedAll, markCleared } from '../progress';
import { getPlayMode } from '../settings';
import { useReducedMotion } from '../a11y';
import MazeGrid, { BOARD_BORDER } from '../components/MazeGrid';
import DirPad from '../components/DirPad';
import ClearOverlay from '../components/ClearOverlay';
import BigButton from '../components/BigButton';
import GoalArt from '../components/GoalArt';
import GoButton from '../components/GoButton';
import CommandQueue, { measureQueueStrip } from '../components/CommandQueue';
import { pickGoalPhotoUrl } from '../personal/store';

interface Props {
  templateId: string;
  onHome: () => void;
  onNext: (nextTemplateId: string) => void;
  onCelebrateAll: () => void; // 全5レベルの⭐が初めて揃った → がんばりカードへ
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

export default function PlayScreen({ templateId, onHome, onNext, onCelebrateAll }: Props) {
  const template = getTemplate(templateId);
  const { width, height } = useWindowDimensions();

  // あそびかたは画面に入った時点の設定で固定する（遊んでいる最中に切り替わらない）。
  // おとなモードで変えたあとは タイトル→レベルえらび→プレイ と入り直すので必ず反映される。
  const [playMode] = useState<LevelMode>(() => getPlayMode());
  const isQueue = playMode === 'queue';
  const reduceMotion = useReducedMotion();

  // このテンプレートから生成した「いまの迷路」。カードを開くたび／「もういちど」のたびに
  // 新しい迷路を作る（さんすうドリルのように何回も遊べる）。テンプレートが無い保険では null。
  // key={templateId}（App.tsx）で画面はテンプレートごとに作り直されるので、初期生成は1回。
  const [level, setLevel] = useState<Level | null>(() =>
    template ? decorate(generateLevel(template)) : null
  );

  // --- ②ならべてゴー の状態（①では触らない）---
  const [queue, setQueue] = useState<Direction[]>([]);
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1); // いま実行している命令の位置
  // 並べられる矢印の上限。迷路の実際の最短手数＋よゆう（generate.ts の queueCapacity）。
  const capacity = level?.maxSteps ?? QUEUE_MIN_CAPACITY;

  // --- 盤面・ボタンの寸法 ---
  // 縦を「上段ヘッダー（＋②の命令の列）＋めいろ＋方向パッド」で必ず収める。
  // 以前は maxBoardH = height*0.46 と最小64pxの固定寸法だったため、背の低い（横長でない）
  // ウィンドウでは盤がはみ出し、RN Web の View 既定 overflow:visible により上のヘッダーへ
  // 覆いかぶさって文言が隠れていた。ここでヘッダー/パッドのぶんを差し引いた高さに収める。
  const cols = level?.cols ?? 1;
  const rows = level?.rows ?? 1;

  const contentW = Math.min(width, 480) - space.md * 2; // 横に使える幅（frame の左右パディングぶん）
  const availH = Math.max(height - (space.lg + space.md), 320); // 縦に使える高さ（frame の上下パディングぶん）
  const HEADER_H = 64; // 上段（おうち＋ゴール案内）にみておく高さ
  const GAP = space.md; // 盤と方向パッドのあいだの最小余白
  const CELL_MIN = 44; // めいろのマスの下限
  const DIR_MIN = 52; // 方向ボタンの下限（ここまで来たらもう譲らない）

  // ②だけ増える「命令の列」の帯。高さは上限本数によらず一定（CommandQueue の BAND_H）。
  const strip = isQueue ? measureQueueStrip(contentW, capacity) : null;
  const stripH = strip ? strip.height + space.sm : 0; // 帯の高さ＋上マージン

  // 縦の配りかた。②で帯が1段増えても、**タップ標的（方向ボタン・ゴー!）は①と同じ大きさ**を保つ
  // （§4 の巨大タップ領域は遊びかたで変わってはいけない）。帯が食う縦は、優先度の低いほうから
  // 　タップ標的 ＞ 盤面のマス ＞ 帯のマスの見た目
  // の順で返す。＝ 帯の高さは方向パッドの取り分から引かない（引くのは盤面から）。
  const bodyH = Math.max(availH - HEADER_H, 200);
  let padBudget = Math.min(bodyH * 0.42, 340); // 方向パッド帯に割り当てる高さの上限
  if (stripH > 0) {
    // 例外: 盤面が下限のマスすら置けないほど縦が足りない画面では、足りないぶんだけ方向パッドが譲る
    //（重なりを出さないことが最優先。DIR_MIN より小さくはしない）。
    const padRoom = bodyH - stripH - GAP - rows * CELL_MIN;
    padBudget = Math.min(padBudget, Math.max(padRoom, DIR_MIN * 3.3 + space.md));
  }
  const dirByH = Math.floor((padBudget - space.md) / 3.3); // 3行＋行間＋下パディングぶん
  const dirByW = Math.floor(contentW / 3.4);
  const dirSize = Math.max(DIR_MIN, Math.min(dirByH, dirByW, 100));
  const padAreaH = Math.ceil(dirSize * 3.3) + space.md; // 実際に方向パッド帯が占める高さの見積り

  // めいろのマス: 残り高さと幅の小さいほうに収める。下限も小さめにして絶対にあふれさせない。
  // 盤の外寸はマス目全体＋枠線（MazeGrid の BOARD_BORDER）なので、枠線のぶんを引いてから割る。
  const boardBudgetH = Math.max(bodyH - stripH - padAreaH - GAP, rows * CELL_MIN);
  const frameLine = BOARD_BORDER * 2;
  const cell = Math.max(
    CELL_MIN,
    Math.floor(Math.min((contentW - frameLine) / cols, (boardBudgetH - frameLine) / rows, 116))
  );

  // --- アバターの状態（論理位置は ref、見た目は Animated 値で駆動）---
  const start = level?.start ?? { x: 0, y: 0 };
  const posRef = useRef<Coord>(start);
  const avatarPos = useRef(new Animated.ValueXY({ x: start.x * cell, y: start.y * cell })).current;
  const avatarTilt = useRef(new Animated.Value(0)).current;
  const animatingRef = useRef(false);
  const [arrived, setArrived] = useState(false);
  // このクリアで全5レベルの⭐が初めて揃ったか（＝がんばりカードへ自動で進む）。
  const [completedAll, setCompletedAll] = useState(false);

  // 実行中にリサイズされてもマス寸法を追えるよう、いつも最新の cell を持っておく。
  const cellRef = useRef(cell);
  cellRef.current = cell;

  // ②の実行を打ち切るための世代番号。もういちど／画面を離れる で増やすと、走っている
  // 実行ループは次のステップの手前で静かに抜ける（後片付けは打ち切った側が行う）。
  const runTokenRef = useRef(0);
  useEffect(() => () => {
    runTokenRef.current++;
  }, []);

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
    runTokenRef.current++; // 走っている実行があれば打ち切る（②）
    const nextLevel = decorate(generateLevel(template));
    setLevel(nextLevel);
    animatingRef.current = false;
    posRef.current = nextLevel.start;
    avatarPos.setValue({ x: nextLevel.start.x * cell, y: nextLevel.start.y * cell });
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
          Animated.timing(avatarTilt, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(avatarTilt, { toValue: -1, duration: 150, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.timing(avatarTilt, { toValue: 0, duration: 90, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        ]).start(() => {
          animatingRef.current = false;
          resolve();
        });
      });
    },
    [avatarTilt]
  );

  // ①タップモードの首かしげ（従来と同じ挙動。結果は待たない）。
  const wiggle = useCallback(() => {
    void tiltAsync();
  }, [tiltAsync]);

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
          // 街（ランチャー）の燃料。クリアのたび +1（再クリアも +1。バッジとは独立）。
          // 先に積む: markCleared が今回の⭐を足す前に読むことで、初回マイグレーション
          // （totalStars 未存在時に meiro.stars 件数を初期値化）が今回の1クリアを二重計上しない。
          bumpTotalStars();
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

  // ── ②ならべてゴー ───────────────────────────────────────────────
  // ゴールに着いたときの共通処理（①と同じ順序で⭐を積む）。
  const celebrate = useCallback((lv: Level) => {
    bumpTotalStars();
    markCleared(lv.id);
    setCompletedAll(allCleared() && !hasCelebratedAll());
    playSound('clear');
    setArrived(true);
  }, []);

  // 矢印を1つ積む。上限に達していたら **静かに** 受け付けない（エラー表現なし / §4）。
  const onArrow = useCallback(
    (dir: Direction) => {
      if (!level || arrived || running) return;
      if (queue.length >= capacity) return;
      playSound('tap');
      setQueue((q) => (q.length >= capacity ? q : [...q, dir]));
    },
    [level, arrived, running, queue.length, capacity]
  );

  // 取り消しは「さいごの1つを消す」だけ（単発タップ・ドラッグや長押しは使わない / §4）。
  const onUndo = useCallback(() => {
    if (arrived || running || queue.length === 0) return;
    playSound('tap');
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
    [avatarPos]
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
    [avatarPos]
  );

  // 「ゴー!」= 先頭から1マスずつ実行する。
  //  ・動けない歩（壁・障害物）は首をかしげ＋やさしい「?」音。**実行は止めず**次の命令へ進む
  //    （「言われたとおりに動く」を観察させる。ルビィ / Cubetto の流儀）。
  //  ・途中でゴールに着いたら残りの命令は捨てて即クリア（余分に並べたことを罰しない）。
  //  ・全部実行しても届かなければ、首をかしげ → スタートへ ぴょん → 列を空にして組み直し。
  //    タイマー・ライフ・減点は無い（§4）。
  const onGo = useCallback(async () => {
    if (!level || arrived || running || queue.length === 0) return;
    playSound('tap'); // 「ゴー!」は効果音だけ（新しい声は増やさない）
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
        playSound('move');
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
        playSound('blocked');
        await tiltAsync(reduceMotion);
        if (!alive()) return;
      }
      await sleep(STEP_GAP_MS);
      if (!alive()) return;
    }

    setStepIndex(-1);
    animatingRef.current = false;

    if (reached) {
      setQueue([]); // 残りの命令は捨てる
      setRunning(false);
      celebrate(level);
      return;
    }

    // 届かなかった: 失敗にしない。首をかしげて、スタートへ ぴょんと戻って、また組み直す。
    await sleep(MISS_PAUSE_MS);
    if (!alive()) return;
    playSound('blocked');
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
  ]);

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
          <GoalArt
            glyph={level.goalEmoji}
            photoUri={level.goalImage}
            size={34}
            emojiSize={32}
          />

        </View>
        <View style={styles.homeBtn} />
      </View>

      {/* ②だけ: 命令の列（積んだ矢印と ⌫） */}
      {isQueue && strip ? (
        <View style={styles.queueArea}>
          <CommandQueue
            queue={queue}
            capacity={capacity}
            activeIndex={stepIndex}
            metrics={strip}
            onUndo={onUndo}
            disabled={running || arrived}
          />
        </View>
      ) : null}

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

      {/* 下段: 方向パッド（②は十字のまんなかが「ゴー!」） */}
      <View style={[styles.padArea, isQueue && running ? styles.padRunning : null]}>
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
      </View>

      {arrived ? (
        <ClearOverlay
          goalEmoji={level.goalEmoji}
          goalPhoto={level.goalImage}
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

// 実行ループの「間」。打ち切りは runToken で判定するので、片付けは要らない。
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
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
  // ②の「命令の列」の帯。高さは measureQueueStrip が決めた値（+ この上マージン）で
  // 高さバジェットに算入済みなので、盤面・方向パッドと重ならない。
  queueArea: {
    marginTop: space.sm,
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
  // 実行中は方向パッドをうすくして「いまは見るじかん」を伝える（②のみ）。
  padRunning: {
    opacity: 0.55,
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
