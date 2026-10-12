// パーソナライズ資産（ゴール写真・おじの声）の端末内ストレージ = IndexedDB の最小ラッパー。
// DESIGN §7「保存場所とプライバシー」/ §8「Web版の制約」。
//
// なぜ IndexedDB か:
//   - 写真・録音は localStorage（文字列 5MB 前後）に載らない。Blob をそのまま持てる IndexedDB を使う。
//   - 同一オリジン（kerokero-1245.github.io）に姉妹アプリが同居するので、DB 名で名前空間を分ける
//     （'meiro-personal'）。ぴよぴよランドの他アプリのデータとは絶対に混ざらない。
//
// 壊れないことが最優先（4歳が使う）:
//   - プライベートブラウズ等で indexedDB が無い／open が失敗する／固まる環境がある。
//     open にはタイムアウトを張り、失敗したら「使えない」と記録して以後すべて no-op（null/false）を返す。
//   - どの API も例外を投げない。呼び出し側は null/false を見て既定動作（絵文字ゴール・ずんだもん）へ戻る。
//   - native（Platform.OS !== 'web'）では常に「使えない」。フェーズ2の本命は web（DESIGN §0）。
//
// 外部送信ゼロ: Blob は端末内の IndexedDB にだけ入る。ネットワークは一切使わない。
//
// DOM の型には直接依存しないよう、必要な形だけ最小宣言し、web のグローバルは src/web.ts の webGlobal で取り出す。

import { webGlobal } from "../web";
import { once } from "../once";

// ── 最小型宣言 ───────────────────────────────────────────────────────
// Blob をそのままは持たない（RN と DOM の型が衝突しうる）。必要な形だけ。
export interface BlobLike {
  size: number;
  type: string;
}

interface IdbRequest<T> {
  result: T;
  error: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}
interface IdbOpenRequest extends IdbRequest<IdbDatabase> {
  onupgradeneeded: (() => void) | null;
  onblocked: (() => void) | null;
}
interface IdbObjectStore {
  put(value: unknown): IdbRequest<unknown>;
  get(key: unknown): IdbRequest<unknown>;
  getAll(): IdbRequest<unknown[]>;
  delete(key: unknown): IdbRequest<unknown>;
  clear(): IdbRequest<unknown>;
}
interface IdbTransaction {
  objectStore(name: string): IdbObjectStore;
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
}
interface IdbDatabase {
  objectStoreNames: { contains(name: string): boolean };
  createObjectStore(
    name: string,
    options?: { keyPath?: string },
  ): IdbObjectStore;
  transaction(
    names: string | string[],
    mode?: "readonly" | "readwrite",
  ): IdbTransaction;
  close(): void;
  onversionchange: (() => void) | null;
}
interface IdbFactory {
  open(name: string, version?: number): IdbOpenRequest;
}

export const DB_NAME = "meiro-personal"; // 姉妹アプリと混ざらないよう、このアプリ専用の名前空間
const DB_VERSION = 1;
export const STORE_PHOTOS = "photos"; // keyPath 'id'   … ゴール写真
export const STORE_VOICES = "voices"; // keyPath 'slot' … おじの声（スロットは 'tsuita' | 'zenbu'）

const OPEN_TIMEOUT_MS = 4000; // open が返ってこない環境（壊れたプロファイル等）で固まらないための保険

function getFactory(): IdbFactory | null {
  const f = webGlobal<IdbFactory>("indexedDB");
  try {
    // 「undefined を差し込んで潰す」テストも通す: 関数として使えなければ無しとみなす。
    if (!f || typeof f.open !== "function") return null;
    return f;
  } catch {
    return null;
  }
}

// indexedDB そのものが見えるか（open の成否は別。UI の初期表示判断に使う）。
export function hasIndexedDb(): boolean {
  return getFactory() != null;
}

let dbPromise: Promise<IdbDatabase | null> | null = null;
let broken = false; // 一度でも致命的に失敗したら以後は開きにいかない

function openDb(): Promise<IdbDatabase | null> {
  if (broken) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  const factory = getFactory();
  if (!factory) {
    broken = true;
    return Promise.resolve(null);
  }
  dbPromise = new Promise<IdbDatabase | null>((resolve) => {
    const done = once((db: IdbDatabase | null) => {
      if (!db) {
        broken = true;
        dbPromise = null; // 次回また試せるようにはしない（broken で止まる）が、参照は落としておく
      }
      resolve(db);
    });
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const req = factory.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
            db.createObjectStore(STORE_PHOTOS, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(STORE_VOICES)) {
            db.createObjectStore(STORE_VOICES, { keyPath: "slot" });
          }
        } catch {
          // ここで失敗しても onerror / タイムアウトで null に落ちる
        }
      };
      req.onsuccess = () => {
        if (timer) clearTimeout(timer);
        try {
          const db = req.result;
          // 別タブが新しいバージョンで開いたら握っている接続を閉じる（ブロック回避）。
          db.onversionchange = () => {
            try {
              db.close();
            } catch {
              // 無視
            }
            dbPromise = null;
          };
          done(db);
        } catch {
          done(null);
        }
      };
      req.onerror = () => {
        if (timer) clearTimeout(timer);
        done(null);
      };
      req.onblocked = () => {
        if (timer) clearTimeout(timer);
        done(null);
      };
      timer = setTimeout(() => done(null), OPEN_TIMEOUT_MS);
    } catch {
      if (timer) clearTimeout(timer);
      done(null);
    }
  });
  return dbPromise;
}

// 読み取り: リクエストの結果をそのまま返す。失敗はすべて null に丸める（例外を投げない）。
function readOp<T>(
  store: string,
  run: (s: IdbObjectStore) => IdbRequest<unknown>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        const done = once((v: T | null) => resolve(v));
        try {
          const tx = db.transaction(store, "readonly");
          tx.onerror = () => done(null);
          tx.onabort = () => done(null);
          const req = run(tx.objectStore(store));
          req.onsuccess = () => done((req.result as T) ?? null);
          req.onerror = () => done(null);
        } catch {
          done(null);
        }
      }),
  );
}

// 書き込み: 成否は「トランザクションが commit したか」で判定する。
// リクエストの onsuccess は commit 前に鳴るので、容量超過などで後からアボートすると取りこぼす。
function writeOp(
  store: string,
  run: (s: IdbObjectStore) => void,
): Promise<boolean> {
  return openDb().then(
    (db) =>
      new Promise<boolean>((resolve) => {
        if (!db) {
          resolve(false);
          return;
        }
        const done = once((v: boolean) => resolve(v));
        try {
          const tx = db.transaction(store, "readwrite");
          tx.oncomplete = () => done(true);
          tx.onerror = () => done(false);
          tx.onabort = () => done(false);
          run(tx.objectStore(store));
        } catch {
          done(false);
        }
      }),
  );
}

// ── 公開 API（すべて失敗を null/[]/false に丸める）───────────────────

export function idbGetAll<T>(store: string): Promise<T[]> {
  return readOp<T[]>(store, (s) => s.getAll()).then((v) =>
    Array.isArray(v) ? v : [],
  );
}

export function idbPut(store: string, value: unknown): Promise<boolean> {
  return writeOp(store, (s) => {
    s.put(value);
  });
}

export function idbDelete(store: string, key: unknown): Promise<boolean> {
  return writeOp(store, (s) => {
    s.delete(key);
  });
}

export function idbClear(store: string): Promise<boolean> {
  return writeOp(store, (s) => {
    s.clear();
  });
}

// DB を実際に開けるか（1回開いて判定。以後はキャッシュ）。UI の有効/無効表示に使う。
export function probeStorage(): Promise<boolean> {
  return openDb().then((db) => db != null);
}
