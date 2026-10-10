// 乱数の差し替え用。generate.ts は Math.random を直接使うので、テストでは replaceRandom で置き換える。
import type { TestContext } from "node:test";

/**
 * Math.random をこのテストの間だけ差し替える（テストが終わると元に戻す）。
 * t.mock.method は呼び出しのたびに記録（スタック）を取るので、乱数を何十万回も引くテストには遅すぎて使えない
 * （実測: 20 万回で 11 秒。直接の差し替えなら 0.03 秒）。
 */
export function replaceRandom(t: TestContext, random: () => number): void {
  const original = Math.random;
  Math.random = random;
  t.after(() => {
    Math.random = original;
  });
}

/** 種つきの乱数（mulberry32）。同じ種なら同じ列（0 以上 1 未満）になるので、性質テストが毎回同じ結果で再現できる。 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 決めた値を順に繰り返す乱数。「どんな乱数でも」の確認に、わざと偏った列を作るために使う。 */
export function cyclingRandom(values: readonly number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}
