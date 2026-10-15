// 乱数の差し替え用。generate.ts は Math.random を直接使うので、テストでは replaceRandom で置き換える。
// replaceRandom（テストの終わりに戻す。t.mock.method は呼び出しのたびに記録を取るので、乱数を何十万回も
// 引くテストには遅すぎる）と seededRandom（種つきの mulberry32）は piyo-assets の testing/random のもの。
export {
  replaceRandom,
  seededRandom,
} from "@kerokero-1245/piyo-assets/testing/random";

/** 決めた値を順に繰り返す乱数。「どんな乱数でも」の確認に、わざと偏った列を作るために使う。 */
export function cyclingRandom(values: readonly number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}
