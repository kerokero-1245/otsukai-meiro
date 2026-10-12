// ゴール写真の縮小（端末内・canvas のみ / DESIGN §7 フェーズ2）。
//
// おとなモードで選んだ写真は、そのまま保存すると数MB〜十数MBある。IndexedDB に何枚も入れると
// 端末の容量を圧迫し、盤面（44〜116px）や祝福（〜200px）の表示にはまったく不要な解像度になる。
// そこで **保存前に必ず縮小**する: 長辺 512px・JPEG 品質 0.8。1枚おおむね 40〜120KB に収まる。
//
// - 向き（EXIF）は createImageBitmap の imageOrientation:'from-image' で正す。非対応環境では
//   <img> 経由（近年のブラウザは <img> に EXIF 向きを既定で適用する）にフォールバックする。
// - 失敗（読めない画像・canvas 非対応・toBlob 非対応）は null を返すだけ。呼び出し側は
//   「ふやせませんでした」を出して既定動作（絵文字ゴール）を続ける。クラッシュさせない。
// - 外部送信ゼロ: 読み込み・縮小はすべて端末内。ネットワークは使わない。
//
// DOM の型には直接依存しないよう、必要な形だけ最小宣言し、web のグローバルは src/web.ts の webGlobal で取り出す。

import { webGlobal } from "../web";
import { BlobLike } from "./idb";

const MAX_EDGE = 512; // 長辺の上限(px)
const JPEG_QUALITY = 0.8;

// ── 最小型宣言 ───────────────────────────────────────────────────────
interface Sized {
  width: number;
  height: number;
}
interface Ctx2D {
  drawImage(img: unknown, dx: number, dy: number, dw: number, dh: number): void;
  imageSmoothingEnabled?: boolean;
  imageSmoothingQuality?: string;
}
interface CanvasEl {
  width: number;
  height: number;
  getContext(kind: string): Ctx2D | null;
  toBlob(
    cb: (b: BlobLike | null) => void,
    type?: string,
    quality?: number,
  ): void;
}
interface ImgEl extends Sized {
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  decoding: string;
  naturalWidth: number;
  naturalHeight: number;
}
interface DocLike {
  createElement(tag: string): unknown;
}
interface UrlLike {
  createObjectURL(b: unknown): string;
  revokeObjectURL(u: string): void;
}

function doc(): DocLike | null {
  return webGlobal<DocLike>("document");
}

export function objectUrl(): UrlLike | null {
  const u = webGlobal<UrlLike>("URL");
  try {
    if (!u || typeof u.createObjectURL !== "function") return null;
    return u;
  } catch {
    return null;
  }
}

// createImageBitmap（あれば）。EXIF 向きを画像どおりに適用する。
type BitmapFactory = (
  blob: unknown,
  opts?: { imageOrientation?: string },
) => Promise<Sized>;
function bitmapFactory(): BitmapFactory | null {
  const f = webGlobal<BitmapFactory>("createImageBitmap");
  return typeof f === "function" ? f : null;
}

// <img> 経由の読み込み（createImageBitmap が無い／失敗したとき）。
function loadViaImg(file: unknown): Promise<Sized | null> {
  const d = doc();
  const u = objectUrl();
  if (!d || !u) return Promise.resolve(null);
  return new Promise<Sized | null>((resolve) => {
    let url: string | null = null;
    try {
      const img = d.createElement("img") as ImgEl;
      url = u.createObjectURL(file);
      const cleanup = () => {
        if (url) {
          try {
            u.revokeObjectURL(url);
          } catch {
            // 無視
          }
          url = null;
        }
      };
      img.onload = () => {
        cleanup();
        // naturalWidth があればそちらを信用する（未装飾のピクセル寸法）。
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(null);
          return;
        }
        // width/height を実寸に固定してから返す（drawImage の引数に使う）。
        img.width = w;
        img.height = h;
        resolve(img);
      };
      img.onerror = () => {
        cleanup();
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

export interface ResizedImage {
  blob: BlobLike;
  width: number;
  height: number;
  mime: string;
}

// 選ばれたファイル（<input type=file> の File）を長辺 MAX_EDGE の JPEG に縮小する。
// 失敗したら null（呼び出し側で「ふやせませんでした」）。
export async function resizeImageFile(
  file: unknown,
): Promise<ResizedImage | null> {
  const d = doc();
  if (!d || !file) return null;

  // ① 画像を読む（EXIF 向きを正す createImageBitmap を優先）。
  let source: Sized | null = null;
  const makeBitmap = bitmapFactory();
  if (makeBitmap) {
    try {
      source = await makeBitmap(file, { imageOrientation: "from-image" });
    } catch {
      source = null;
    }
    if (!source) {
      try {
        source = await makeBitmap(file);
      } catch {
        source = null;
      }
    }
  }
  if (!source) source = await loadViaImg(file);
  if (!source || !source.width || !source.height) return null;

  // ② 長辺 MAX_EDGE に収める（拡大はしない）。
  const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));

  // ③ canvas へ描いて JPEG 化。
  try {
    const canvas = d.createElement("canvas") as CanvasEl;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    try {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    } catch {
      // 無視（画質のヒントだけ）
    }
    ctx.drawImage(source, 0, 0, w, h);
    const blob = await new Promise<BlobLike | null>((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
      } catch {
        resolve(null);
      }
    });
    if (!blob || !blob.size) return null;
    return { blob, width: w, height: h, mime: "image/jpeg" };
  } catch {
    return null;
  }
}
