// あそびかたの設定（端末内のみ）。DESIGN §3「二段階の遊びモード」/ §16。
//
// いまは1つだけ: **あそびかた（mode）**
//   'tap'   … ①タップで即1マス動く（既定。フェーズ1からの遊び）
//   'queue' … ②ならべてゴー（やじるしを並べて「ゴー!」で一気に実行。フェーズ4）
//
// - 切り替えは **おとなモード（親ゲートの奥）だけ**。親が有効化するまで、こども側の見た目・
//   挙動はフェーズ1と完全に同一（既定のリグレッションゼロ）。
// - 保存は web の localStorage（キー `meiro.mode`）。native はセッション内キャッシュのみ。
//   **外部送信ゼロ**（DESIGN §7 の表に追記）。
// - progress.ts / audio/bgm.ts と同じ流儀: どの API も例外を投げず、読めないときは既定へ倒す。
//   消えても遊びは壊れない（既定 = これまでどおりのタップモード）。

import { Platform } from "react-native";
import { LevelMode } from "./types";

const KEY_MODE = "meiro.mode"; // 'queue' のときだけ②。それ以外（未設定・壊れた値）は①。

// 型の都合で最小限だけ宣言（DOM lib に依存しない。progress.ts / bgm.ts と同じ流儀）。
interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
function ls(): WebStorage | null {
  if (Platform.OS !== "web") return null;
  try {
    const s = (globalThis as unknown as { localStorage?: WebStorage })
      .localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

// セッション内キャッシュ（native の永続化が無くても同一起動中は保持される）。
let modeCache: LevelMode | null = null;

// いまのあそびかた（未設定・読めない・壊れた値はすべて 'tap'）。
export function getPlayMode(): LevelMode {
  if (modeCache !== null) return modeCache;
  const store = ls();
  if (!store) return (modeCache = "tap");
  try {
    return (modeCache = store.getItem(KEY_MODE) === "queue" ? "queue" : "tap");
  } catch {
    return (modeCache = "tap");
  }
}

// おとなモードのトグルから呼ぶ。保存できなくても遊びは壊さない。
export function setPlayMode(mode: LevelMode): void {
  modeCache = mode;
  const store = ls();
  if (!store) return;
  try {
    store.setItem(KEY_MODE, mode);
  } catch {
    // 保存できなくても遊びは壊さない（この起動のあいだは切り替わる）。
  }
}
