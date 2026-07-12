// ごほうび（スタンプ式）の進捗保存。DESIGN §7・§14。
// レベルをクリアすると、そのレベルに⭐が付く（何手で着いたかは問わない。クリア=⭐）。
// 既にクリア済みのレベルを再クリアしても剥奪・変化なし（マイナス要素ゼロ）。
//
// - web は localStorage に保存、native はセッション内キャッシュのみ（MVP）。外部送信なし。
// - 取得失敗時は「まだ何も無い」状態にフォールバック。消えても遊びは壊れない（進捗ロック無し）。
// - settings.ts（piyopiyo-sansu）の localStorage パターンを移植。

import { Platform } from 'react-native';
import { LEVELS } from './data/levels';

const KEY_STARS = 'meiro.stars'; // クリア済みレベルidの配列（JSON）
const KEY_CELEBRATED = 'meiro.celebratedAll'; // 「ぜんぶ できたね!」を一度見せたか（'1'）

// 型の都合で最小限だけ宣言（DOM lib に依存しない）。
interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
function ls(): WebStorage | null {
  if (Platform.OS !== 'web') return null;
  try {
    const s = (globalThis as unknown as { localStorage?: WebStorage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

// セッション内キャッシュ（native の永続化が無くても同一起動中は保持される）。
let starsCache: Set<string> | null = null;
let celebratedCache: boolean | null = null;

function loadStars(): Set<string> {
  if (starsCache) return starsCache;
  const store = ls();
  const set = new Set<string>();
  if (store) {
    try {
      const raw = store.getItem(KEY_STARS);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const id of arr) if (typeof id === 'string') set.add(id);
        }
      }
    } catch {
      // 壊れていたら「まだ何も無い」として扱う
    }
  }
  return (starsCache = set);
}

function persistStars(set: Set<string>): void {
  const store = ls();
  if (!store) return;
  try {
    store.setItem(KEY_STARS, JSON.stringify([...set]));
  } catch {
    // 保存できなくても遊びは壊さない
  }
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

// 全レベル（同梱の全5レベル）に⭐が揃っているか。
export function allCleared(): boolean {
  const set = loadStars();
  return LEVELS.length > 0 && LEVELS.every((lv) => set.has(lv.id));
}

// 「ぜんぶ できたね! がんばりカード」を既に一度見せたか。
export function hasCelebratedAll(): boolean {
  if (celebratedCache !== null) return celebratedCache;
  const store = ls();
  if (store) {
    try {
      return (celebratedCache = store.getItem(KEY_CELEBRATED) === '1');
    } catch {
      // 無視して未祝福へ
    }
  }
  return (celebratedCache = false);
}

export function setCelebratedAll(v: boolean): void {
  celebratedCache = v;
  const store = ls();
  if (store) {
    try {
      if (v) store.setItem(KEY_CELEBRATED, '1');
      else store.removeItem(KEY_CELEBRATED);
    } catch {
      // 保存できなくても遊びは壊さない
    }
  }
}

// おとなモードの「⭐をリセット」。全部の⭐と祝福フラグを消す。
export function resetProgress(): void {
  starsCache = new Set<string>();
  celebratedCache = false;
  const store = ls();
  if (store) {
    try {
      store.removeItem(KEY_STARS);
      store.removeItem(KEY_CELEBRATED);
    } catch {
      // 消せなくても遊びは壊さない
    }
  }
}