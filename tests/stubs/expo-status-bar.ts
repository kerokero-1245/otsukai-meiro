// Node では読めない expo-status-bar の差し替え（tests/register.mjs が expo-* をここへ向ける）。
// App.tsx が import できることだけを確かめる（tests/loader.test.ts）。中身は piyo-assets の
// testing/stubs/expo の StatusBar（何も描かない）。
export * from "@kerokero-1245/piyo-assets/testing/stubs/expo";
