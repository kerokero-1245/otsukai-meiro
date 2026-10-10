// Node では読めない react-native の差し替え（tests/register.mjs が "react-native" をここへ向ける）。
// 役目は 2 つだけ。
//  1) progress.ts・settings.ts などが見る Platform.OS。テストは web を既定にし、native のふるまいは
//     OS を書き換えて確かめる。
//  2) 画面の部品（.tsx）が import できること（tests/loader.test.ts）。描画はしないので、部品は何も描かない
//     関数、Animated などは空の入れ物にしてある。使われ方が増えたら、読む側のテストと一緒にここへ足す。

export const Platform = { OS: "web" as string };

export const StyleSheet = {
  create: <T extends object>(styles: T): T => styles,
};

const renderNothing = () => null;
export const View = renderNothing;
export const Text = renderNothing;
export const Pressable = renderNothing;
export const Image = renderNothing;
export const ScrollView = renderNothing;

export const Animated = {};
export const Easing = {};
export const AccessibilityInfo = {};

export function useWindowDimensions() {
  return { width: 390, height: 844, scale: 1, fontScale: 1 };
}
