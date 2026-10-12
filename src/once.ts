// 「1 回だけ呼ぶ」ための包み。終了通知（ended / error / 停止のうち最初の 1 回）や、約束（Promise）の解決を 1 回に絞る旗
// （fired / settled / done / finished）を、音・声・保存の 6 か所が別々に書いていた。
// 旗は fn を呼ぶ前に立てる（fn の中から同じ関数が呼ばれても 2 回目は動かない）。fn が例外を投げても旗は立ったまま。
// 1 回目の引数がそのまま fn に渡る。2 回目以降の呼び出しは何もしない。
// （audio の録音 personal/recorder.ts の settle は、旗の値を stop() でも読むので、これでは書き換えない。）

export function once<A extends unknown[]>(
  fn: (...args: A) => void,
): (...args: A) => void {
  let called = false;
  return (...args: A) => {
    if (called) return;
    called = true;
    fn(...args);
  };
}
