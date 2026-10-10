// 写真を選ぶ入口（web のみ / DESIGN §8「写真・録音の取得」）。
//
// ネイティブの expo-image-picker は使わず、ブラウザ標準の <input type="file" accept="image/*"> を使う
// （新規 npm 依存ゼロの方針）。React Native Web では任意の DOM を JSX で書けないので、
// **document.body に隠し input を1つだけ置き**、おとなモードのボタンから click() する。
//
// - input は「1つだけ」使い回す（id: meiro-photo-input）。React の再描画とは無関係な場所に置くので、
//   画面を出入りしても壊れない。
// - accept="image/*" / multiple。iOS Safari では「写真を撮る／ライブラリから選ぶ」のシートが出る。
// - 選び直しを確実にするため、click 前に value を空にする（同じファイルを続けて選んでも change が鳴る）。
// - web 以外／DOM が無い環境では false を返すだけ（呼び出し側が機能を隠す）。
//
// 外部送信ゼロ: 選ばれた File はメモリ上で縮小して IndexedDB に入るだけ。どこにも送らない。

import { Platform } from "react-native";

export const PHOTO_INPUT_ID = "meiro-photo-input";

interface FileListLike {
  length: number;
  item(i: number): unknown;
}
interface InputEl {
  id: string;
  type: string;
  accept: string;
  multiple: boolean;
  value: string;
  files: FileListLike | null;
  onchange: (() => void) | null;
  click(): void;
  setAttribute(name: string, value: string): void;
}
interface DocLike {
  getElementById(id: string): InputEl | null;
  createElement(tag: string): unknown;
  body: { appendChild(el: unknown): void } | null;
}

function doc(): DocLike | null {
  if (Platform.OS !== "web") return null;
  try {
    const g = globalThis as unknown as { document?: DocLike };
    const d = g.document;
    if (!d || typeof d.createElement !== "function" || !d.body) return null;
    return d;
  } catch {
    return null;
  }
}

// 写真を選べる環境か。
export function canPickPhotos(): boolean {
  return doc() != null;
}

function ensureInput(): InputEl | null {
  const d = doc();
  if (!d) return null;
  try {
    const existing = d.getElementById(PHOTO_INPUT_ID);
    if (existing) return existing;
    const el = d.createElement("input") as InputEl;
    el.id = PHOTO_INPUT_ID;
    el.type = "file";
    el.accept = "image/*";
    el.multiple = true;
    // 画面には出さないが、要素としては存在させる（自動テストからも触れるように）。
    el.setAttribute(
      "style",
      "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;",
    );
    d.body?.appendChild(el);
    return el;
  } catch {
    return null;
  }
}

// おとなモードの「しゃしんを ふやす」から呼ぶ。選ばれたら onFiles(File[]) を1回だけ呼ぶ。
// 開けたら true（＝ダイアログを出した）、無理なら false。
export function pickPhotoFiles(onFiles: (files: unknown[]) => void): boolean {
  const el = ensureInput();
  if (!el) return false;
  try {
    el.onchange = () => {
      const list = el.files;
      const out: unknown[] = [];
      if (list) {
        for (let i = 0; i < list.length; i++) {
          const f = list.item(i);
          if (f) out.push(f);
        }
      }
      // 同じファイルを続けて選んでも change が鳴るように空にしておく。
      try {
        el.value = "";
      } catch {
        // 無視
      }
      if (out.length > 0) onFiles(out);
    };
    try {
      el.value = "";
    } catch {
      // 無視
    }
    el.click();
    return true;
  } catch {
    return false;
  }
}
