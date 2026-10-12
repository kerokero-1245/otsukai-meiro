// localStorage の入口（web でだけ）。progress.ts・settings.ts・audio/bgm.ts が、同じ作りの小さな型の宣言と ls() を
// 3 つ別々に持っていた（コメントで互いに「同じ流儀」と参照し合っていた）ので 1 か所にした。
// キー名と値の形式は各モジュールが持つ（ここは入れ物と、例外を投げない読み書きだけ）。
// 保存できなくても・読めなくても遊びは壊さない: どの関数も例外を投げず、読めなければ null を返す。

import { webGlobal } from "./web";

// 最小限だけ宣言（DOM lib の型には直接依存しない）。
export interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// localStorage そのもの（web 以外・無い・取り出せない環境は null）。読み書きの失敗の扱いを自分で決めたい呼び出し側用。
export function webStorage(): WebStorage | null {
  return webGlobal<WebStorage>("localStorage");
}

// 値を読む。web 以外・localStorage が無い・読めない（例外）・キーが無い、はすべて null。
export function readKey(key: string): string | null {
  const store = webStorage();
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

// 値を書く。保存できなくても例外にしない。
export function writeKey(key: string, value: string): void {
  const store = webStorage();
  if (!store) return;
  try {
    store.setItem(key, value);
  } catch {
    // 保存できなくても遊びは壊さない
  }
}

// 値を消す。消せなくても例外にしない。
export function removeKey(key: string): void {
  const store = webStorage();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // 消せなくても遊びは壊さない
  }
}
