// 迷路生成の「正しい分布」を、乱数を使わず全数探索で求める。
//
// 生成（generate.ts の本命の段）は「障害物の数 k をレンジから一様に選ぶ → スタート・ゴールを全マスから一様に
// 選ぶ → 障害物をそれ以外のマスから一様に k 個選ぶ → 条件（届く・最短手数 ≥ minSteps）を満たすまで繰り返す」
// という棄却サンプリング。なので、採用される迷路の分布は「条件を満たす全配置」を、1 回の試行で選ばれる確率で
// 重みづけたものに一致する。ここではその全配置を数え上げ、次を返す。
//  - 採用される迷路の最短手数の最小・最大（DESIGN §16.4「最短手数の最大」の表）
//  - 1 回の試行で採用される確率（作り直し 50 回で本命の段が成功する割合の計算に使う）
//  - 上限本数（queueCapacity）ごとの割合（DESIGN §16.4「実際に出る上限本数の分布」の表）
// 距離は helpers/oracle.ts（本体の BFS とは別の方法）で求める。
import type { Coord, Template } from "../../src/types";
import { distanceField } from "./oracle";

export interface ExactModel {
  minShortest: number;
  maxShortest: number;
  /** 1 回の試行で採用される確率（0〜1） */
  acceptRate: number;
  /** 採用された迷路に占める、上限本数ごとの割合（合計 1） */
  capacityShare: Map<number, number>;
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  const pick: T[] = [];
  const walk = (from: number) => {
    if (pick.length === size) {
      out.push(pick.slice());
      return;
    }
    for (let i = from; i < items.length; i++) {
      pick.push(items[i]);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return out;
}

function binomial(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

// DESIGN §16.4: 並べられる矢印の上限は「最短手数 + よゆう 4 本、最低 6 本」。本体の queueCapacity は使わず、
// 文書どおりの式で独立に書く（本体が壊れたとき、答えも一緒に動いて見逃すことのないように）。
const capacityOf = (shortest: number) => Math.max(6, shortest + 4);

const cache = new Map<string, ExactModel>();

export function exactModel(template: Template): ExactModel {
  const cached = cache.get(template.id);
  if (cached) return cached;

  const { cols, rows, obstacleMin, obstacleMax, minSteps } = template;
  const cells: Coord[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) cells.push({ x, y });
  }
  const n = cells.length;
  const counts: number[] = [];
  for (let k = obstacleMin; k <= obstacleMax; k++) counts.push(k);

  let minShortest = Infinity;
  let maxShortest = 0;
  let acceptRate = 0;
  const weight = new Map<number, number>();

  for (const k of counts) {
    if (n - 2 < k) continue; // 障害物を置く余地が無い（生成側でも不採用）
    // 1 つの配置（スタート・ゴール・障害物の集合）が 1 回の試行で選ばれる確率。
    const each = 1 / counts.length / (n * n) / binomial(n - 2, k);
    // 障害物の集合を先に決めて、空いているマスどうしのスタート・ゴールを調べる。
    for (const obstacles of combinations(cells, k)) {
      const blocked = new Set(obstacles.map((o) => `${o.x},${o.y}`));
      const free = cells.filter((c) => !blocked.has(`${c.x},${c.y}`));
      for (const start of free) {
        const field = distanceField(cols, rows, obstacles, start);
        for (const goal of free) {
          if (goal === start) continue;
          const d = field[goal.y][goal.x];
          if (!Number.isFinite(d) || d < minSteps) continue;
          minShortest = Math.min(minShortest, d);
          maxShortest = Math.max(maxShortest, d);
          acceptRate += each;
          const capacity = capacityOf(d);
          weight.set(capacity, (weight.get(capacity) ?? 0) + each);
        }
      }
    }
  }

  const capacityShare = new Map<number, number>();
  for (const [capacity, w] of weight)
    capacityShare.set(capacity, w / acceptRate);
  const model = { minShortest, maxShortest, acceptRate, capacityShare };
  cache.set(template.id, model);
  return model;
}
