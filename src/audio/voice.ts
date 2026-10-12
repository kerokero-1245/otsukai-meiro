// 読み上げの入口（DESIGN §4）。画面はこのモジュールだけを呼ぶ。内部で4段構えに解決する:
//   ⓪ おじの声（tier0 / personal/store.ts）… おとなモードで録った端末内の録音。あれば最優先。
//   ① 同梱クリップ（tier1 / clips.ts）… VOICEVOX 事前生成の音声。
//   ② speechSynthesis（tier2 / speech.ts）… ブラウザ内蔵の日本語合成音声（ja-JP）。
//   ③ 無音（tier3）… どれも無ければ何もしない。文字なしでもゲームは成立する。
//
// tier0 は「この子だけの世界地図」の核（DESIGN §1）。録音が無い／読めない場合は静かに tier1 へ
// 落ちるので、こども側の体験は決して壊れない。
//
// このアプリの声は「効果音（sounds.ts の合成音）」とは別レイヤー。喧嘩しないよう、声は効果音の
// あとに少し遅らせて鳴らす（呼び出し側の setTimeout で順序を作る。ゴール到達・がんばりカードを参照）。
//
// クリップ（tier1）は定型フレーズ3つ（p_title / p_tsuita / p_zenbu）とも assets/voice/ に同梱し、
// voiceClips.CLIP_URLS に登録してある（VOICEVOX ずんだもん）。クリップを鳴らせない環境（native 等）では
// ②→③ に落ちる。フレーズを足すときは m4a を置いて voiceClips に1行登録すれば、同じ呼び出しのまま
// tier1 が効く（画面の変更は不要）。
//
// iOS Safari の自動再生制限（最初のユーザー操作より前に音を出せない）は warmUpVoice() で守る。

import {
  isClipAvailable,
  playClip,
  playAudioUrl,
  warmUpClips,
  cancelClip,
} from "./clips";
import { speak, warmUpSpeech, cancelSpeech } from "./speech";
import { duckForVoice, unduckForVoice } from "./bgm";
import { VoiceSlot, voiceUrl } from "../personal/store";
import { once } from "../once";

// 読み上げ1回ぶんの指定。
//   slot … おとなモードの録音スロット（tier0）。録音があればここが最優先。
//   clip … 同梱クリップの基名（tier1）。
//   text … tier2（speechSynthesis）で読むひらがな。
export interface VoiceSpec {
  slot?: VoiceSlot; // おじの声のスロット（'tsuita' | 'zenbu'）。録音があれば tier0 で再生。
  clip?: string; // 同梱クリップ基名（voiceClips のキー）。あれば tier1 で再生。
  text: string; // tier2（speechSynthesis）で読む文字列（ひらがな）。
}

// ── 定型フレーズ（このアプリで鳴らす3つ）─────────────────────────────
// title … タイトルをタップして「おつかいめいろ」（タップ起点）。
// tsuita … ゴール到達の「ついたね」（ClearOverlay。既存の clear 効果音のあとに遅らせて鳴らす）。
// zenbu  … 全レベル制覇の「ぜんぶ できたね」（がんばりカード。fanfare 効果音のあとに鳴らす）。
// clip 基名は assets/voice/ に置いた VOICEVOX ずんだもんクリップのファイル基名と一致している。
// slot はおとなモードで録れる「おじの声」の置き場（tsuita / zenbu の2つ）。title は同梱のまま
// （アプリ名の読み上げなので差し替えの必要が薄い）。
export type PhraseKey = "title" | "tsuita" | "zenbu";
export const PHRASE_VOICE: Record<PhraseKey, VoiceSpec> = {
  title: { clip: "p_title", text: "おつかいめいろ" },
  tsuita: { slot: "tsuita", clip: "p_tsuita", text: "ついたね" },
  zenbu: { slot: "zenbu", clip: "p_zenbu", text: "ぜんぶ できたね" },
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
  let safety: ReturnType<typeof setTimeout> | null = null;
  const finish: () => void = once(() => {
    if (safety) {
      clearTimeout(safety);
      safety = null;
    }
    if (pendingUnduck === finish) pendingUnduck = null;
    unduckForVoice();
  });
  try {
    safety = setTimeout(finish, DUCK_SAFETY_MS);
  } catch {
    // タイマが張れなくても end/cancel 側で解除される
  }
  pendingUnduck = finish;
  return finish;
}

// ── 再生（4段構えの解決）─────────────────────────────────────────────
export function playVoice(spec: VoiceSpec): void {
  // 声が鳴っている間だけ BGM を沈める。鳴らせた tier の終了で finish（＝解除）が呼ばれる。
  const finish = beginDuck();
  // ⓪ おじの声（おとなモードの録音。あれば同梱クリップより優先）
  const personal = spec.slot ? voiceUrl(spec.slot) : null;
  if (personal && playAudioUrl(personal, finish)) return;
  // ① 同梱クリップ
  if (spec.clip && isClipAvailable(spec.clip) && playClip(spec.clip, finish))
    return;
  // ② speechSynthesis
  if (speak(spec.text, finish)) return;
  // ③ 無音（どれも鳴らせない）: ダッキングを即解除
  finish();
}

// 定型フレーズを読む（タイトル「おつかいめいろ」・ゴール「ついたね」・全制覇「ぜんぶ できたね」）。
export function sayPhrase(key: PhraseKey): void {
  playVoice(PHRASE_VOICE[key]);
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
