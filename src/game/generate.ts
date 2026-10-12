// 迷路のランダム生成（純粋ロジック・react-native 非依存）。
// レベルえらびのカード（＝むずかしさテンプレート Template）を選ぶたびに、この generateLevel で
// スタート・ゴール・障害物・ゴール絵文字をその場でランダムに決める（DESIGN §7）。
//
// 生成の安全保証（4歳向けなので「詰み」や無限ループ・クラッシュは絶対に出さない）:
//  1) 生成した迷路は必ず BFS で到達可能性を検証する（bfsShortest が null なら不採用）。
//  2) 最短手数がテンプレートの minSteps 以上になるまで作り直す（近すぎるゴールを防ぐ）。
//  3) 作り直しは上限つき（MAX_ATTEMPTS）。溢れたら障害物を段階的に減らして再挑戦し、
//     それでも駄目なら「対角コーナー・障害物ゼロ」の決定的フォールバックを返す。
//     不変条件 minSteps <= (cols-1)+(rows-1) を全テンプレートで満たすので、この最終手段は必ず有効。
//
// 乱数は Math.random でよい（アプリ実行時コード）。

import { AVATAR_GLYPH } from "../art";
import { Coord, Direction, Level, Template } from "../types";
import { canMove, isGoal, isObstacle, move, sameCoord } from "./maze";

// ゴールの既定イラスト（絵文字）プール。生成のたびここから1つランダムに選ぶ。
// 差し替え写真（goalImage）が入るまでのプレースホルダ（外部素材ゼロ）。
export const GOAL_EMOJIS = [
  "🍎",
  "🏠",
  "🍰",
  "🍓",
  "🎈",
  "🍦",
  "🎁",
  "🌷",
  "🍭",
  "🐰",
  "🚗",
  "🍩",
];

// 1テンプレートあたりの作り直し上限。これを超えたらフォールバックへ。
const MAX_ATTEMPTS = 50;

// ②ならべてゴー（フェーズ4）で並べられる矢印の上限 = Level.maxSteps。
// 「その迷路の実際の最短手数 ＋ よゆう4本」。短い迷路でも最低6本は置ける。
//
// なぜ固定値（例: 10本）にしないか: テンプレート⑤（4×4・障害物2〜3）は **最短10手** の迷路が
// 起こりうる（全配置の全数探索で確認。採用されうる最短手数の最大は ①2 ②4 ③4 ④6 ⑤10）。
// 固定10本だと、その迷路では「一本道の完璧な10手」しか許されず、まわり道もやり直しの余白も
// 無くなってしまう。上限は「盤面の最短手数に対して十分な数」でなければならない（DESIGN §16）ので、
// 生成時に判明した実際の最短手数から1迷路ごとに決める。
export const QUEUE_SLACK = 4;
export const QUEUE_MIN_CAPACITY = 6;
export function queueCapacity(shortest: number): number {
  return Math.max(QUEUE_MIN_CAPACITY, shortest + QUEUE_SLACK);
}

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(arr.length)];
}

// Fisher-Yates（元配列は壊さない）。
function shuffled<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 幅優先探索で隣のマスを見る向きの順（最短手数は見る順によらない）。
const NEIGHBOR_DIRS: readonly Direction[] = ["right", "left", "down", "up"];

// スタート → ゴールの最短手数（マス移動数）を返す。到達不能なら null。
// 幅優先探索。障害物・盤外は通れない（maze.ts の判定を再利用）。
export function bfsShortest(level: Level): number | null {
  const { start, goal } = level;
  if (isObstacle(level, start) || isObstacle(level, goal)) return null;

  const key = (c: Coord) => `${c.x},${c.y}`;
  const seen = new Set<string>([key(start)]);
  let frontier: Coord[] = [start];
  let dist = 0;

  while (frontier.length > 0) {
    const next: Coord[] = [];
    for (const c of frontier) {
      if (isGoal(level, c)) return dist;
      for (const dir of NEIGHBOR_DIRS) {
        if (!canMove(level, c, dir)) continue;
        const nb = move(c, dir);
        const k = key(nb);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push(nb);
      }
    }
    frontier = next;
    dist++;
  }
  return null;
}

// どのフォールバック段まで使ったか（プロパティ検証・デバッグ用）。
export type GenStage = "natural" | "reduced" | "corner";

export interface GenResult {
  level: Level;
  stage: GenStage; // natural=テンプレ通り / reduced=障害物を減らした / corner=決定的フォールバック
  shortest: number; // 採用した迷路の最短手数
}

// テンプレートから迷路を1つ生成し、内部の判定つきで返す（プロパティ検証で使う）。
export function generateLevelDebug(template: Template): GenResult {
  const { cols, rows, obstacleMin, obstacleMax, minSteps } = template;

  // 全マスの座標。
  const cells: Coord[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) cells.push({ x, y });
  }

  // ゴール絵文字は毎回ランダム（採用/フォールバックいずれでも1つに固定）。
  const goalEmoji = pick(GOAL_EMOJIS);

  const build = (start: Coord, goal: Coord, obstacles: Coord[]): Level => ({
    id: template.id, // 進捗⭐はテンプレート単位。生成迷路が変わっても⭐のキーは同じ。
    cols,
    rows,
    start,
    goal,
    obstacles,
    // 生成ロジックは あそびかた（①/②）を知らない＝①でも②でも完全に同じ迷路が出る。
    // 暫定値。実際の最短手数が分かった時点で finish() が queueCapacity() で入れ直す。
    maxSteps: queueCapacity(minSteps),
    goalImage: null,
    goalEmoji,
    avatarEmoji: AVATAR_GLYPH,
  });

  // 障害物 obstacleCount 個で1回だけ試す。条件を満たせば Level、駄目なら null。
  const attempt = (
    obstacleCount: number,
  ): { level: Level; shortest: number } | null => {
    const start = pick(cells);
    const goal = pick(cells);
    if (sameCoord(start, goal)) return null;

    const pool = cells.filter(
      (c) => !sameCoord(c, start) && !sameCoord(c, goal),
    );
    if (pool.length < obstacleCount) return null;
    const obstacles = shuffled(pool).slice(0, obstacleCount);

    const level = build(start, goal, obstacles);
    const shortest = bfsShortest(level);
    if (shortest !== null && shortest >= minSteps) return { level, shortest };
    return null;
  };

  // 採用が決まってから maxSteps（②で並べられる矢印の上限）を実際の最短手数で入れ直す。
  const finish = (
    level: Level,
    stage: GenStage,
    shortest: number,
  ): GenResult => ({
    level: { ...level, maxSteps: queueCapacity(shortest) },
    stage,
    shortest,
  });

  // 本命: テンプレート通り。障害物数はレンジ [min,max] から毎回ランダムに選び直す。
  for (let a = 0; a < MAX_ATTEMPTS; a++) {
    const obstacleCount = obstacleMin + randInt(obstacleMax - obstacleMin + 1);
    const r = attempt(obstacleCount);
    if (r) return finish(r.level, "natural", r.shortest);
  }

  // フォールバック1: 障害物を段階的に減らして通す（それでも遊べる迷路にする）。
  for (let oc = obstacleMin; oc >= 0; oc--) {
    for (let a = 0; a < MAX_ATTEMPTS; a++) {
      const r = attempt(oc);
      if (r) return finish(r.level, "reduced", r.shortest);
    }
  }

  // フォールバック2（最終保証・決定的）: 対角コーナー・障害物ゼロ。
  // minSteps <= (cols-1)+(rows-1) の不変条件により最短手数は必ず minSteps 以上。
  const start: Coord = { x: 0, y: 0 };
  const goal: Coord = { x: cols - 1, y: rows - 1 };
  const level = build(start, goal, []);
  const shortest = bfsShortest(level) ?? cols - 1 + (rows - 1);
  return finish(level, "corner", shortest);
}

// テンプレートから迷路を1つ生成する（アプリ本体が使う公開API）。
export function generateLevel(template: Template): Level {
  return generateLevelDebug(template).level;
}
