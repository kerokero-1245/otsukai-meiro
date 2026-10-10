// Node では読めない expo-status-bar の差し替え（tests/register.mjs が expo-* をここへ向ける）。
// App.tsx が import できることだけを確かめる（tests/loader.test.ts）。何も描かない。

export const StatusBar = () => null;
