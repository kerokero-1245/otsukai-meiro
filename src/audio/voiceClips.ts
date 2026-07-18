// 同梱音声クリップの登録表（tier1 の素材）。
// VOICEVOX ENGINE（ずんだもん・あまあま / style id 1）で事前生成した m4a を assets/voice/ に同梱し、ここで登録する。
// クレジット表記: VOICEVOX:ずんだもん（VOICEVOX 利用規約）。生成手順・パラメータは assets/voice/README.md 参照。
//
// key = クリップ基名（voice.ts の PHRASE_VOICE と一致）。value = 再生可能な URL（require の戻り値）。
//   p_title  … タイトル「おつかいめいろ」
//   p_tsuita … ゴール到達「ついたね！」
//   p_zenbu  … 全レベル制覇「ぜんぶ できたね！」
//
// 登録した基名は clips.ts が tier1 として最優先で再生する（呼び出し側の変更は不要）。
// クリップが無い／未対応の環境（native 等）では、voice.ts が ② speechSynthesis → ③ 無音 へ自動フォールバックする。
// 外部送信ゼロ: クリップは端末内の同梱アセット。ネットワークは使わない。

// key = クリップ基名, value = 再生可能な URL（require の戻り値）。
export const CLIP_URLS: Record<string, string> = {
  p_title: require('../../assets/voice/p_title.m4a'), // おつかいめいろ
  p_tsuita: require('../../assets/voice/p_tsuita.m4a'), // ついたね！
  p_zenbu: require('../../assets/voice/p_zenbu.m4a'), // ぜんぶ できたね！
};

// 指定した基名のクリップが登録済みか。
export function hasClip(name: string | undefined): boolean {
  if (!name) return false;
  return Object.prototype.hasOwnProperty.call(CLIP_URLS, name) && !!CLIP_URLS[name];
}
