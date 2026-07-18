// 読み上げ（TTS／DESIGN §4）。ブラウザ内蔵 window.speechSynthesis（Web Speech API）で日本語（ja-JP）の
// 合成音声を鳴らす。expo 依存を増やさず web 専用に隔離（native は無音スタブ）。
//
// これは voice.ts の3段構えの「tier2」実装。画面は voice.ts を呼び、voice.ts が①同梱クリップ（clips.ts）
// → ②このモジュール（speechSynthesis）→ ③無音 の順に解決する。画面から直接は呼ばない。
//
// - いつ鳴らすか: ①タイトルをタップして「おつかいめいろ」、②ゴール到達の「ついたね」、
//   ③全レベル制覇の「ぜんぶ できたね」。いずれもユーザー操作（タップ）を起点にした流れの中で鳴る。
// - iOS Safari 対策: speechSynthesis は最初のユーザー操作より前には発声できない。タイトルの
//   タップで warmUpSpeech() を1回だけ呼び、無音（volume=0）の発声でアンロックする。
// - 声の選択: getVoices() から lang が ja で始まる音声を優先。getVoices() が非同期な環境では
//   voiceschanged を待って選び直す。読み上げ速度は少しゆっくり（rate≈0.9）。
// - フォールバック: speechSynthesis が無い／声が無い でも、ゲームは完全に成立する（③無音）。
// - 外部送信ゼロ: 合成は端末内。ネットワークを一切使わない。
//
// DOM lib に依存しないよう、必要な形だけを最小宣言して globalThis から取り出す。

import { Platform } from 'react-native';

interface SSVoice {
  lang: string;
  name: string;
}
interface SSUtterance {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: SSVoice | null;
}
type UtteranceCtor = new (text?: string) => SSUtterance;
interface SS {
  speak(u: SSUtterance): void;
  cancel(): void;
  getVoices(): SSVoice[];
  onvoiceschanged: (() => void) | null;
}

function getSynth(): SS | null {
  if (Platform.OS !== 'web') return null;
  try {
    const g = globalThis as unknown as { speechSynthesis?: SS };
    return g.speechSynthesis ?? null;
  } catch {
    return null;
  }
}

function getUtteranceCtor(): UtteranceCtor | null {
  if (Platform.OS !== 'web') return null;
  try {
    const g = globalThis as unknown as { SpeechSynthesisUtterance?: UtteranceCtor };
    return g.SpeechSynthesisUtterance ?? null;
  } catch {
    return null;
  }
}

let jaVoice: SSVoice | null = null;
let voicesWired = false;

function refreshVoice(): void {
  const s = getSynth();
  if (!s) return;
  try {
    const voices = s.getVoices();
    if (!voices || voices.length === 0) return;
    // lang が ja で始まる音声を優先。無ければ null のまま（ブラウザ既定にまかせる）。
    const ja = voices.find((v) => /^ja/i.test(v.lang));
    if (ja) jaVoice = ja;
  } catch {
    // 無視（声が選べなくても lang=ja-JP で発声は試みる）
  }
}

function wireVoices(): void {
  if (voicesWired) return;
  const s = getSynth();
  if (!s) return;
  voicesWired = true;
  refreshVoice();
  // getVoices() が非同期な環境（Safari/Chrome）では voiceschanged を待って選び直す。
  try {
    s.onvoiceschanged = () => refreshVoice();
  } catch {
    // 無視
  }
}

// speechSynthesis が使えるか（native/非対応では false）。
export function isSpeechAvailable(): boolean {
  return getSynth() != null && getUtteranceCtor() != null;
}

// タイトルのタップで1回呼ぶ。無音の短い発声でエンジンをアンロック（iOS Safari 対策）。
// 1ページロードにつき1回で足りる。
export function warmUpSpeech(): void {
  const s = getSynth();
  const U = getUtteranceCtor();
  if (!s || !U) return;
  wireVoices();
  try {
    const u = new U(' ');
    u.volume = 0;
    u.rate = 1;
    u.pitch = 1;
    u.lang = 'ja-JP';
    s.cancel();
    s.speak(u);
  } catch {
    // アンロックできなくても遊びは壊さない
  }
}

// text を ja-JP で少しゆっくり読み上げる。enabled=false / 非対応 では何もしない。
export function speak(text: string, opts?: { enabled?: boolean }): void {
  if (opts && opts.enabled === false) return;
  const s = getSynth();
  const U = getUtteranceCtor();
  if (!s || !U) return;
  wireVoices();
  try {
    s.cancel(); // 前の発声を止めて重ならないように
    const u = new U(text);
    u.lang = 'ja-JP';
    u.rate = 0.9; // 少しゆっくり
    u.pitch = 1;
    u.volume = 1;
    if (jaVoice) u.voice = jaVoice;
    s.speak(u);
  } catch {
    // 読み上げできなくても遊びは壊さない
  }
}

// 発声を止める（画面を離れるときなど）。
export function cancelSpeech(): void {
  const s = getSynth();
  if (!s) return;
  try {
    s.cancel();
  } catch {
    // 無視
  }
}
