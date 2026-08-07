// パーソナライズ資産（ゴール写真・おじの声）の在庫。画面はこのモジュールだけを呼ぶ。
// DESIGN §1「この子だけの世界地図」/ §7 データモデル / フェーズ2。
//
// 役割:
//   - IndexedDB（personal/idb.ts）から写真・録音を読み、**同期で引ける在庫**（メモリ上の
//     オブジェクトURL一覧）にする。迷路生成やクリア演出は同期なので、この形が要る。
//   - 追加・削除は IndexedDB を更新してから在庫を作り直し、購読者（おとなモード）へ通知する。
//
// 壊れないこと（4歳が使う）:
//   - 保存が使えない環境（プライベートブラウズ等）では available=false。全 API は無害な既定値を返し、
//     おとなモードは機能を「つかえません」と静かに表示する。こども側の見た目・操作は一切変わらない。
//   - 読み込みに失敗した写真は在庫に載せない → ゴールは絵文字プールに戻る（GoalArt も onError で戻す）。
//   - 録音が無ければ声は従来どおり ずんだもんクリップ（voice.ts の tier1）。
//
// 外部送信ゼロ: Blob は IndexedDB とメモリ上の blob: URL にしか存在しない。
//
// 命名: 写真は最大 MAX_PHOTOS 枚。ゴールは「写真を混ぜたプール」から選ぶ（PHOTO_GOAL_CHANCE）。

import { Platform } from 'react-native';
import {
  BlobLike,
  STORE_PHOTOS,
  STORE_VOICES,
  hasIndexedDb,
  idbClear,
  idbDelete,
  idbGetAll,
  idbPut,
  probeStorage,
} from './idb';
import { objectUrl, resizeImageFile } from './image';

export const MAX_PHOTOS = 6;

// 写真が1枚以上あるとき、ゴールに写真が出る確率。
// 1.0（写真だけ）にしないのは、12種のシールポップ絵も「毎回ちがう」楽しさの一部だから（DESIGN §7）。
// 逆に低すぎると「おばあちゃんの家をゴールにした」という差別化の核が埋もれる。→ 2/3 を既定にする。
export const PHOTO_GOAL_CHANCE = 2 / 3;

export type VoiceSlot = 'tsuita' | 'zenbu';
export const VOICE_SLOTS: VoiceSlot[] = ['tsuita', 'zenbu'];

// IndexedDB に入るレコード（そのまま構造化複製される）。
interface PhotoRecord {
  id: string;
  blob: BlobLike;
  mime: string;
  width: number;
  height: number;
  createdAt: number;
}
interface VoiceRecord {
  slot: VoiceSlot;
  blob: BlobLike;
  mime: string;
  createdAt: number;
}

// 画面が使う形（blob: URL 付き）。
export interface PhotoItem {
  id: string;
  url: string;
  width: number;
  height: number;
  createdAt: number;
}
export interface VoiceItem {
  slot: VoiceSlot;
  url: string;
  mime: string;
  createdAt: number;
}

// ── 在庫（メモリ）─────────────────────────────────────────────────
let available = false; // IndexedDB を実際に開けたか
let ready = false; // 初回読み込みが済んだか
let initPromise: Promise<void> | null = null;
let photos: PhotoItem[] = [];
const voices = new Map<VoiceSlot, VoiceItem>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of [...listeners]) {
    try {
      cb();
    } catch {
      // 購読者側の例外で在庫更新を止めない
    }
  }
}

// おとなモードが在庫の変化を知るための購読。返り値を呼ぶと解除。
export function subscribePersonal(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function makeUrl(blob: BlobLike): string | null {
  const u = objectUrl();
  if (!u) return null;
  try {
    return u.createObjectURL(blob);
  } catch {
    return null;
  }
}

function revoke(url: string | null | undefined): void {
  if (!url) return;
  const u = objectUrl();
  if (!u) return;
  try {
    u.revokeObjectURL(url);
  } catch {
    // 無視
  }
}

function newId(): string {
  return `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// ── 初期化 ───────────────────────────────────────────────────────────
// App.tsx のマウントで1回呼ぶ。失敗しても例外は投げない。
export function initPersonal(): Promise<void> {
  if (initPromise) return initPromise;
  if (Platform.OS !== 'web' || !hasIndexedDb()) {
    available = false;
    ready = true;
    initPromise = Promise.resolve();
    return initPromise;
  }
  initPromise = (async () => {
    try {
      available = await probeStorage();
      if (!available) return;
      await reloadPhotos();
      await reloadVoices();
    } catch {
      available = false;
    } finally {
      ready = true;
      notify();
    }
  })();
  return initPromise;
}

async function reloadPhotos(): Promise<void> {
  const rows = await idbGetAll<PhotoRecord>(STORE_PHOTOS);
  for (const p of photos) revoke(p.url);
  const next: PhotoItem[] = [];
  for (const r of rows) {
    if (!r || !r.blob) continue;
    const url = makeUrl(r.blob);
    if (!url) continue; // URL が作れない環境では在庫に載せない（＝絵文字ゴールのまま）
    next.push({
      id: String(r.id),
      url,
      width: Number(r.width) || 0,
      height: Number(r.height) || 0,
      createdAt: Number(r.createdAt) || 0,
    });
  }
  next.sort((a, b) => a.createdAt - b.createdAt);
  photos = next;
}

async function reloadVoices(): Promise<void> {
  const rows = await idbGetAll<VoiceRecord>(STORE_VOICES);
  for (const v of voices.values()) revoke(v.url);
  voices.clear();
  for (const r of rows) {
    if (!r || !r.blob) continue;
    const slot = r.slot as VoiceSlot;
    if (VOICE_SLOTS.indexOf(slot) < 0) continue;
    const url = makeUrl(r.blob);
    if (!url) continue;
    voices.set(slot, {
      slot,
      url,
      mime: String(r.mime || ''),
      createdAt: Number(r.createdAt) || 0,
    });
  }
}

// ── 状態の問い合わせ（同期）───────────────────────────────────────
export function isPersonalAvailable(): boolean {
  return available;
}
export function isPersonalReady(): boolean {
  return ready;
}
export function listPhotos(): PhotoItem[] {
  return photos;
}
export function photoCount(): number {
  return photos.length;
}
export function getVoice(slot: VoiceSlot): VoiceItem | null {
  return voices.get(slot) ?? null;
}
export function voiceUrl(slot: VoiceSlot): string | null {
  return voices.get(slot)?.url ?? null;
}

// このプレイのゴールに使う写真の URL（無ければ null → 従来どおり絵文字プール）。
// 写真があるときは PHOTO_GOAL_CHANCE で写真、残りは絵文字。写真が複数枚なら毎回そこからランダム。
export function pickGoalPhotoUrl(): string | null {
  if (photos.length === 0) return null;
  if (Math.random() >= PHOTO_GOAL_CHANCE) return null;
  return photos[Math.floor(Math.random() * photos.length)].url;
}

// ── 追加・削除 ───────────────────────────────────────────────────────

export type AddPhotoResult = 'ok' | 'full' | 'unavailable' | 'failed';

// 選ばれた画像ファイルを縮小して保存する（長辺512px・JPEG 0.8 / image.ts）。
export async function addPhotoFile(file: unknown): Promise<AddPhotoResult> {
  await initPersonal();
  if (!available) return 'unavailable';
  if (photos.length >= MAX_PHOTOS) return 'full';
  const resized = await resizeImageFile(file);
  if (!resized) return 'failed';
  const rec: PhotoRecord = {
    id: newId(),
    blob: resized.blob,
    mime: resized.mime,
    width: resized.width,
    height: resized.height,
    createdAt: Date.now(),
  };
  const ok = await idbPut(STORE_PHOTOS, rec);
  if (!ok) return 'failed';
  await reloadPhotos();
  notify();
  return 'ok';
}

// 複数枚をまとめて。空きぶんだけ入れる（残りは 'full'）。結果の内訳を返す。
export async function addPhotoFiles(
  files: unknown[]
): Promise<{ added: number; full: boolean; failed: number }> {
  let added = 0;
  let failed = 0;
  let full = false;
  for (const f of files) {
    const r = await addPhotoFile(f);
    if (r === 'ok') added++;
    else if (r === 'full') {
      full = true;
      break;
    } else failed++;
  }
  return { added, full, failed };
}

export async function removePhoto(id: string): Promise<boolean> {
  await initPersonal();
  if (!available) return false;
  const ok = await idbDelete(STORE_PHOTOS, id);
  await reloadPhotos();
  notify();
  return ok;
}

export async function clearAllPhotos(): Promise<boolean> {
  await initPersonal();
  if (!available) return false;
  const ok = await idbClear(STORE_PHOTOS);
  await reloadPhotos();
  notify();
  return ok;
}

export async function saveVoice(slot: VoiceSlot, blob: BlobLike, mime: string): Promise<boolean> {
  await initPersonal();
  if (!available) return false;
  const rec: VoiceRecord = { slot, blob, mime, createdAt: Date.now() };
  const ok = await idbPut(STORE_VOICES, rec);
  if (!ok) return false;
  await reloadVoices();
  notify();
  return true;
}

export async function removeVoice(slot: VoiceSlot): Promise<boolean> {
  await initPersonal();
  if (!available) return false;
  const ok = await idbDelete(STORE_VOICES, slot);
  await reloadVoices();
  notify();
  return ok;
}
