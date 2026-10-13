// ごほうび（スタンプ式）の進捗保存。DESIGN §7・§14。
// レベルをクリアすると、そのレベルに⭐が付く（何手で着いたかは問わない。クリア=⭐）。
// 既にクリア済みのレベルを再クリアしても剥奪・変化なし（マイナス要素ゼロ）。
//
// - web は localStorage に保存、native はセッション内キャッシュのみ（MVP）。外部送信なし。
// - 取得失敗時は「まだ何も無い」状態にフォールバック。消えても遊びは壊れない（進捗ロック無し）。
// - settings.ts（piyopiyo-sansu）の localStorage パターンを移植。

import { TOTAL_STARS } from "@kerokero-1245/piyo-assets/keys";
import { TEMPLATES } from "./data/templates";
import { readKey, removeKey, webStorage, writeKey } from "./storage";

const KEY_STARS = "meiro.stars"; // クリア済みレベルidの配列（JSON）
const KEY_CELEBRATED = "meiro.celebratedAll"; // 「ぜんぶ できたね!」を一度見せたか（'1'）
const KEY_TOTAL = TOTAL_STARS.meiro; // 累計クリア回数（再クリアも+1）。街（ランチャー）の燃料。DESIGN §7。

// セッション内キャッシュ（native の永続化が無くても同一起動中は保持される）。
let starsCache: Set<string> | null = null;
let celebratedCache: boolean | null = null;
let totalCache: number | null = null;

function loadStars(): Set<string> {
  if (starsCache) return starsCache;
  const set = new Set<string>();
  const raw = readKey(KEY_STARS);
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const id of arr) if (typeof id === "string") set.add(id);
      }
    } catch {
      // 壊れていたら「まだ何も無い」として扱う
    }
  }
  return (starsCache = set);
}

function persistStars(set: Set<string>): void {
  writeKey(KEY_STARS, JSON.stringify([...set]));
}

// このレベルに⭐が付いているか。
export function isCleared(levelId: string): boolean {
  return loadStars().has(levelId);
}

// クリアして⭐を付ける。まだ付いていなければ true（＝新しく獲得）を返す。
// 既にクリア済みなら false（変化なし。剥奪もしない）。
export function markCleared(levelId: string): boolean {
  const set = loadStars();
  if (set.has(levelId)) return false;
  set.add(levelId);
  persistStars(set);
  return true;
}

// クリア済みレベル数。
export function clearedCount(): number {
  return loadStars().size;
}

// 累計クリア回数（街＝ランチャーの燃料）。バッジ（meiro.stars）と違い再クリアでも増える。
// マイグレーション: キー未存在の初回読み取り時だけ、既存 meiro.stars の件数を初期値として書き込む。
// 読めない/壊れている場合も必ず 0 扱いにフォールバックし、遊びは壊さない。
export function totalStars(): number {
  if (totalCache !== null) return totalCache;
  const store = webStorage();
  if (!store) return (totalCache = 0); // native はセッション内カウントのみ（0 起点）。
  try {
    const raw = store.getItem(KEY_TOTAL);
    if (raw !== null) {
      const n = Number(raw);
      return (totalCache = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
    }
    // 初回（キー未存在）: 既存の⭐バッジ件数を初期値にして書き込む（マイグレーション）。
    const initial = loadStars().size;
    store.setItem(KEY_TOTAL, String(initial));
    return (totalCache = initial);
  } catch {
    return (totalCache = 0);
  }
}

// クリアのたびに +1（再クリアも +1）。街の燃料を積む。新しい累計値を返す。
export function bumpTotalStars(): number {
  const next = totalStars() + 1; // 先に読むことでマイグレーションも確実に済ませる。
  totalCache = next;
  writeKey(KEY_TOTAL, String(next)); // 保存できなくても遊びは壊さない
  return next;
}

// 全カード（同梱の全テンプレート）に⭐が揃っているか。
export function allCleared(): boolean {
  const set = loadStars();
  return TEMPLATES.length > 0 && TEMPLATES.every((t) => set.has(t.id));
}

// 「ぜんぶ できたね! がんばりカード」を既に一度見せたか。
export function hasCelebratedAll(): boolean {
  if (celebratedCache !== null) return celebratedCache;
  // 読めない・保存が無いときは未祝福へ
  return (celebratedCache = readKey(KEY_CELEBRATED) === "1");
}

export function setCelebratedAll(v: boolean): void {
  celebratedCache = v;
  if (v) writeKey(KEY_CELEBRATED, "1");
  else removeKey(KEY_CELEBRATED);
}

// おとなモードの「⭐をリセット」。バッジ（meiro.stars）と祝福フラグ（meiro.celebratedAll）を消す。
// 累計 meiro.totalStars は【意図的に残す】。街（ランチャー）の成長を巻き戻さないため（DESIGN §7）。
export function resetProgress(): void {
  starsCache = new Set<string>();
  celebratedCache = false;
  const store = webStorage();
  if (store) {
    try {
      store.removeItem(KEY_STARS);
      store.removeItem(KEY_CELEBRATED);
      // KEY_TOTAL は消さない（街の燃料は保持）。
    } catch {
      // 消せなくても遊びは壊さない
    }
  }
}
