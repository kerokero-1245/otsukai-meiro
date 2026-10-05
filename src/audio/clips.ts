// 音声クリップ再生（tier1 / DESIGN §4 の3段構え「①同梱クリップ」担当）。
// web では HTMLAudioElement で同梱クリップ（VOICEVOX 事前生成）を鳴らす。native は無音スタブ。
//
// フェーズ2（パーソナライズ）で playAudioUrl() を追加した。おとなモードで録った「おじの声」の
// blob: URL を、同梱クリップと**まったく同じ経路**（同じ停止・同じ終了通知＝BGM ダッキング）で
// 鳴らすため。どちらを鳴らすかは voice.ts が決める（tier0=おじの声 → tier1=同梱クリップ）。
//
// - iOS Safari の自動再生制限: 音は最初のユーザー操作より前には鳴らせない。タイトルの操作で
//   warmUpClips() を1回呼び、（クリップがあれば）muted で1つ触ってエンジンをアンロックする。
//   以降は自動再生（ゴール到達・がんばりカードの祝福など、タップ直後の非同期）も鳴る。1ページロードにつき1回で足りる。
// - CLIP_URLS に登録の無い基名・native・Audio の無い環境では何もしない（no-op）。呼び出し側（voice.ts）が
//   speechSynthesis（tier2）へフォールバックする。
// - 外部送信ゼロ: 同梱アセットのみ。ネットワークは使わない。
//
// DOM lib に依存しないよう、必要な形だけ最小宣言して globalThis から取り出す。

import { Platform } from 'react-native';
import { CLIP_URLS, hasClip } from './voiceClips';

interface AudioEl {
  play(): Promise<void> | void;
  pause(): void;
  currentTime: number;
  muted: boolean;
  addEventListener?: (type: string, cb: () => void) => void;
}
type AudioCtor = new (src?: string) => AudioEl;

function getAudioCtor(): AudioCtor | null {
  if (Platform.OS !== 'web') return null;
  try {
    const g = globalThis as unknown as { Audio?: AudioCtor };
    return g.Audio ?? null;
  } catch {
    return null;
  }
}

// この基名のクリップを tier1 で鳴らせるか（native/非対応/登録の無い基名では false）。
export function isClipAvailable(name: string | undefined): boolean {
  return getAudioCtor() != null && hasClip(name);
}

let current: AudioEl | null = null;
// 現在の再生に紐づく「終了通知」（ended/error/停止のいずれか一度きり）。BGM ダッキング解除に使う。
let currentOnEnd: (() => void) | null = null;

function fireCurrentOnEnd(): void {
  const cb = currentOnEnd;
  currentOnEnd = null;
  if (cb) {
    try {
      cb();
    } catch {
      // 無視
    }
  }
}

// 直前の再生を止める（発声が重ならないように）。停止も「終了」として通知する（ダッキング解除のため）。
export function cancelClip(): void {
  try {
    if (current) current.pause();
  } catch {
    // 無視
  }
  current = null;
  fireCurrentOnEnd();
}

// 任意の音声URLを、クリップと同じ経路（＝同じ停止・終了通知）で鳴らす。
// おとなモードで録った「おじの声」（blob: URL / personal/store.ts）を tier0 として鳴らすのに使う。
// 鳴らせたら true、無理なら false（呼び出し側が次の tier へ）。
export function playAudioUrl(src: string, onEnd?: () => void): boolean {
  if (!src) return false;
  return playSrc(src, onEnd);
}

// name のクリップを再生する。鳴らせたら true、無理なら false（呼び出し側が tier2 へ）。
// onEnd を渡すと ended/error/停止のいずれか最初の一度だけ呼ぶ（BGM ダッキング解除に使う）。
export function playClip(name: string, onEnd?: () => void): boolean {
  if (!hasClip(name)) return false;
  return playSrc(CLIP_URLS[name], onEnd);
}

// 実体（クリップも録音も同じ HTMLAudioElement 経路で鳴らす）。
function playSrc(src: string, onEnd?: () => void): boolean {
  const A = getAudioCtor();
  if (!A) return false;
  try {
    cancelClip();
    const a = new A(src);
    current = a;
    if (onEnd) {
      let fired = false;
      const fire = () => {
        if (fired) return;
        fired = true;
        onEnd();
      };
      currentOnEnd = fire;
      // 自然終了・読み込み失敗で終了通知（停止は cancelClip 側で通知）。
      try {
        a.addEventListener?.('ended', fire);
        a.addEventListener?.('error', fire);
      } catch {
        // リスナを付けられなくても cancelClip / 呼び出し側の保険で解除される
      }
    } else {
      currentOnEnd = null;
    }
    const p = a.play();
    // play() の Promise 拒否（ユーザー操作前など）は握りつぶす（遊びは壊さない）。
    if (p && typeof (p as Promise<void>).catch === 'function') {
      (p as Promise<void>).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

// タイトルの操作で1回呼ぶ。クリップがあれば muted で1つ触ってアンロック（iOS Safari 対策）。
// 登録されたクリップが1つも無ければ no-op。
let warmed = false;
export function warmUpClips(): void {
  if (warmed) return;
  warmed = true;
  const A = getAudioCtor();
  if (!A) return;
  const first = Object.keys(CLIP_URLS)[0];
  if (!first) return; // 登録の無い状態: 何もしない
  try {
    const a = new A(CLIP_URLS[first]);
    a.muted = true;
    const p = a.play();
    if (p && typeof (p as Promise<void>).then === 'function') {
      (p as Promise<void>)
        .then(() => {
          try {
            a.pause();
            a.currentTime = 0;
          } catch {
            // 無視
          }
        })
        .catch(() => {});
    }
  } catch {
    // アンロックできなくても遊びは壊さない
  }
}
