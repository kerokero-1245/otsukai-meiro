// 読み上げの入口（DESIGN §4）。画面はこのモジュールだけを呼ぶ。内部で3段構えに解決する:
//   ① 同梱クリップ（tier1 / clips.ts）… VOICEVOX 事前生成の音声。あれば最優先で再生。
//   ② speechSynthesis（tier2 / speech.ts）… ブラウザ内蔵の日本語合成音声（ja-JP）。
//   ③ 無音（tier3）… どちらも無ければ何もしない。文字なしでもゲームは成立する。
//
// このアプリの声は「効果音（sounds.ts の合成音）」とは別レイヤー。喧嘩しないよう、声は効果音の
// あとに少し遅らせて鳴らす（呼び出し側の setTimeout で順序を作る。ゴール到達・がんばりカードを参照）。
//
// クリップ（tier1）は今回まだ同梱していない（voiceClips.CLIP_URLS は空）。よって現状は必ず ②→③ に
// 落ちる。定型フレーズごとに「クリップ基名」を対応付けてあるので、後工程で assets/voice/ に VOICEVOX
// ずんだもんの m4a を置き voiceClips に登録すれば、同じ呼び出しのまま tier1 が効く（画面の変更は不要）。
//
// iOS Safari の自動再生制限（最初のユーザー操作より前に音を出せない）は warmUpVoice() で守る。

import { isClipAvailable, playClip, warmUpClips, cancelClip } from './clips';
import { CLIP_URLS } from './voiceClips';
import { speak, warmUpSpeech, cancelSpeech, isSpeechAvailable } from './speech';
import { duckForVoice, unduckForVoice } from './bgm';

// 読み上げ1回ぶんの指定。clip=同梱クリップの基名（無ければ tier2 へ）/ text=フォールバック読み上げ文字列。
export interface VoiceSpec {
  clip?: string; // 同梱クリップ基名（voiceClips のキー）。あれば tier1 で再生。
  text: string; // tier2（speechSynthesis）で読む文字列（ひらがな）。
}

// ── 定型フレーズ（このアプリで鳴らす3つ）─────────────────────────────
// title … タイトルをタップして「おつかいめいろ」（タップ起点）。
// tsuita … ゴール到達の「ついたね」（ClearOverlay。既存の clear 効果音のあとに遅らせて鳴らす）。
// zenbu  … 全レベル制覇の「ぜんぶ できたね」（がんばりカード。fanfare 効果音のあとに鳴らす）。
// clip 基名は将来 assets/voice/ に置く VOICEVOX ずんだもんクリップのファイル基名と一致させてある。
export type PhraseKey = 'title' | 'tsuita' | 'zenbu';
export const PHRASE_VOICE: Record<PhraseKey, VoiceSpec> = {
  title: { clip: 'p_title', text: 'おつかいめいろ' },
  tsuita: { clip: 'p_tsuita', text: 'ついたね' },
  zenbu: { clip: 'p_zenbu', text: 'ぜんぶ できたね' },
};

// ── BGM ダッキング（声の再生中だけ BGM を沈める）─────────────────────
// 声（tier1 クリップ／tier2 TTS）の再生開始で duckForVoice()、終了（ended/error/停止/無音）で
// unduckForVoice()。エンジン側は duck/unduck の回数を数えて多重再生に耐える（duckCount）。
// ここでは「1回の声＝duck 1回・unduck 1回」を厳守する（finish は最初の一度だけ実行）。
// 声のイベントを取りこぼしても BGM が沈みっぱなしにならないよう、保険のタイマも張る。
const DUCK_SAFETY_MS = 8000; // 定型フレーズはどれも数秒。取りこぼし時の最終保険。
let pendingUnduck: (() => void) | null = null;

function beginDuck(): () => void {
  // 直前の声がまだダッキング中なら先に解除（新しい声で1回だけ沈め直す）。
  if (pendingUnduck) {
    const prev = pendingUnduck;
    pendingUnduck = null;
    prev();
  }
  duckForVoice();
  let done = false;
  let safety: ReturnType<typeof setTimeout> | null = null;
  const finish = () => {
    if (done) return;
    done = true;
    if (safety) {
      clearTimeout(safety);
      safety = null;
    }
    if (pendingUnduck === finish) pendingUnduck = null;
    unduckForVoice();
  };
  try {
    safety = setTimeout(finish, DUCK_SAFETY_MS);
  } catch {
    // タイマが張れなくても end/cancel 側で解除される
  }
  pendingUnduck = finish;
  return finish;
}

// ── 再生（3段構えの解決）─────────────────────────────────────────────
// enabled=false なら何もしない（将来おとなモードで読み上げオフにする時の対応点）。
export function playVoice(spec: VoiceSpec, opts?: { enabled?: boolean }): void {
  if (opts && opts.enabled === false) return;
  // 声が鳴っている間だけ BGM を沈める。鳴らせた tier の終了で finish（＝解除）が呼ばれる。
  const finish = beginDuck();
  // ① 同梱クリップ
  if (isClipAvailable(spec.clip) && playClip(spec.clip as string, finish)) return;
  // ② speechSynthesis
  if (speak(spec.text, { enabled: true }, finish)) return;
  // ③ 無音（どちらも鳴らせない）: ダッキングを即解除
  finish();
}

// 定型フレーズを読む（タイトル「おつかいめいろ」・ゴール「ついたね」・全制覇「ぜんぶ できたね」）。
export function sayPhrase(key: PhraseKey, opts?: { enabled?: boolean }): void {
  playVoice(PHRASE_VOICE[key], opts);
}

// タイトルの操作で1回呼ぶ。tier1（クリップ）と tier2（TTS）両方をアンロックする。
export function warmUpVoice(): void {
  warmUpClips();
  warmUpSpeech();
}

// 発声を止める（画面を離れるとき・次の発声の前）。両 tier を止め、ダッキングも確実に解除する。
export function cancelVoice(): void {
  cancelClip();
  cancelSpeech();
  if (pendingUnduck) {
    const f = pendingUnduck;
    pendingUnduck = null;
    f();
  }
}

// 読み上げが1つでも使えるか（同梱クリップが1つでもある or TTS が使える）。
// 両方無い環境のみ false ＝ 文字なしで成立（tier3）。
export function isVoiceAvailable(): boolean {
  const anyClip = Object.keys(CLIP_URLS).some((name) => isClipAvailable(name));
  return anyClip || isSpeechAvailable();
}
