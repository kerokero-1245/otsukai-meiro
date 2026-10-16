// node --test の読み込み（`--import ./tests/register.mjs`）。中身は piyo-assets のひな形
// （.ts・.tsx の変換・拡張子なしの import の補完・JSON・素材の require・react-native と expo の差し替え）で、
// ここにはこのアプリの差分だけを書く。
//  - react-native と expo-* は tests/stubs/<名前>.ts の差し替え。無ければ足す場所の分かるエラーで止める
//  - 画像・音声の require は「/ から始まるアプリの中のパス」の文字列（Metro が web で返すのと同じ形）。
//    実在しない素材は MODULE_NOT_FOUND で止める（綴り違いの素材を npm test で見つけるため）
// 検査するのは react-native に依存しない純粋なロジックと保存の規則。画面（描画）は import できることだけを
// tests/loader.test.ts で確かめ、見た目は検査しない。
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "@kerokero-1245/piyo-assets/testing/register";

function stub(name) {
  const file = new URL(`./stubs/${name}.ts`, import.meta.url);
  if (!existsSync(fileURLToPath(file))) {
    throw new Error(
      `tests/stubs/${name}.ts がありません。Node では ${name} を読めないので、` +
        "読む側のテストと一緒に、使う分だけの差し替えを足してください。",
    );
  }
  return file;
}

register({
  root: new URL("../", import.meta.url),
  stubs: { "react-native": stub("react-native"), "expo-*": stub, expo: stub },
  asset: ({ specifier, file, root }) => {
    if (!existsSync(file)) {
      const error = new Error(
        `素材 "${specifier}" が見つかりません（${file}）`,
      );
      error.code = "MODULE_NOT_FOUND";
      throw error;
    }
    return "/" + path.relative(root, file).split(path.sep).join("/");
  },
});
