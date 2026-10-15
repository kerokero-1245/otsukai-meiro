// Node では読めない react-native の差し替え（tests/register.mjs が "react-native" をここへ向ける）。
// 共通の名前（Platform・StyleSheet・View・Text・Pressable・Image・Animated・Easing）は piyo-assets の
// testing/stubs/react-native のものをそのまま使う（同じ実体なので、テストが Platform.OS を書き換えると src にも効く）。
// ここに足すのは、このアプリの画面の部品（.tsx）が import するのに要る残りの名前だけ。描画はしないので、
// 部品は何も描かない関数・AccessibilityInfo は空の入れ物。使われ方が増えたら、読む側のテストと一緒にここへ足す。
export * from "@kerokero-1245/piyo-assets/testing/stubs/react-native";

export const ScrollView = () => null;
export const AccessibilityInfo = {};

export function useWindowDimensions() {
  return { width: 390, height: 844, scale: 1, fontScale: 1 };
}
