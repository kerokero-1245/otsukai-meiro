/**
 * 「1 回だけ呼ぶ」包み（src/once.ts）。
 *
 * 終了通知（音・声が ended / error / 停止のどれで終わっても BGM のダッキング解除は 1 回）や、約束の解決（IndexedDB の
 * open・読み書きが onsuccess / onerror / タイムアウトのどれが先でも 1 回）を、旗（fired / settled / done）で 1 回に絞る。
 * 2 回呼ぶと、ダッキングの数え間違い（沈みっぱなし・戻しすぎ）や、解決済みの約束への再解決が起きる。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "../src/once";

test("1 回目だけ fn を呼び、2 回目以降は何もしない", () => {
  let count = 0;
  const f = once(() => {
    count++;
  });
  assert.equal(count, 0, "包んだだけでは呼ばない");
  f();
  assert.equal(count, 1);
  f();
  f();
  assert.equal(count, 1);
});

test("1 回目の引数を fn に渡す。2 回目の引数は無視する", () => {
  const seen: unknown[][] = [];
  const f = once((a: number, b: string) => {
    seen.push([a, b]);
  });
  f(1, "いち");
  f(2, "に");
  assert.deepEqual(seen, [[1, "いち"]]);
});

test("fn の中から同じ関数を呼んでも、2 回目は動かない（旗は fn を呼ぶ前に立てる）", () => {
  let count = 0;
  const f: () => void = once(() => {
    count++;
    f();
    f();
  });
  f();
  assert.equal(count, 1);
});

test("fn が例外を投げても、旗は立ったまま（次の呼び出しは何もしない）", () => {
  let count = 0;
  const f = once(() => {
    count++;
    throw new Error("失敗");
  });
  assert.throws(() => f(), /失敗/);
  assert.doesNotThrow(() => f());
  assert.equal(count, 1);
});

test("包むたびに別々の旗（1 つ呼んでも、別の once には効かない）", () => {
  let a = 0;
  let b = 0;
  const fa = once(() => {
    a++;
  });
  const fb = once(() => {
    b++;
  });
  fa();
  fa();
  fb();
  assert.deepEqual([a, b], [1, 1]);
});

test("約束の解決に使う形: 最初の値だけが解決に使われる（onsuccess のあとのタイムアウトは無視）", async () => {
  const promise = new Promise<string | null>((resolve) => {
    const done = once((v: string | null) => resolve(v));
    done("onsuccess の値");
    done(null);
  });
  assert.equal(await promise, "onsuccess の値");
});
