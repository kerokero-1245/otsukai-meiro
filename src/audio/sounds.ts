// 効果音まわり。MVP（フェーズ1）は外部の音声ファイルを同梱しない方針なので、
// web ではブラウザ内蔵の Web Audio API でごく短い音を「合成」して鳴らす（外部素材ゼロ）。
//
// - docs/DESIGN.md §8 の web 音声メモに沿い、音は必ず「ユーザーのタップ起点」で鳴らす。
//   （ボタンを押した／到着した＝直前の操作起点）なので iOS Safari の自動再生制限にかからない。
// - native（iOS/Android 実機）では現状なにも鳴らさない“無音スタブ”。フェーズ2で expo-audio
//   に差し替える際は playSound() の中身だけ置き換えればよい（呼び出し側は変更不要）。
// - おじの声（掛け声「ついたね!」等）の差し替えもフェーズ2。ここに voice 種別を足して繋ぐ。

import { Platform } from 'react-native';

export type SoundName =
  | 'tap' // ボタン反応「ぽん」
  | 'move' // 1マス移動「てくてく」
  | 'blocked' // 動けないとき やさしい「?」
  | 'clear' // ゴール到達 ファンファーレ
  | 'star' // ⭐ゲットの瞬間「きらっ」
  | 'fanfare'; // ぜんぶ できたね! の大きな祝福

// 1音のパラメータ（周波数・長さ・波形）。
interface Note {
  freq: number;
  dur: number; // 秒
  type: OscillatorType;
}

// name ごとの音色。強い音を避け、やさしい音を意図（§4 感覚にやさしく）。
const TONES: Record<SoundName, Note[]> = {
  tap: [{ freq: 660, dur: 0.08, type: 'sine' }],
  move: [{ freq: 523, dur: 0.1, type: 'triangle' }],
  blocked: [{ freq: 300, dur: 0.16, type: 'sine' }],
  clear: [
    { freq: 523, dur: 0.13, type: 'sine' }, // ド
    { freq: 659, dur: 0.13, type: 'sine' }, // ミ
    { freq: 784, dur: 0.13, type: 'sine' }, // ソ
    { freq: 1047, dur: 0.3, type: 'sine' }, // 高いド
  ],
  // ⭐ゲットの「きらっ」。高めの2音を軽くはねさせる（強すぎない）。
  star: [
    { freq: 988, dur: 0.09, type: 'sine' }, // シ
    { freq: 1319, dur: 0.22, type: 'sine' }, // 高いミ
  ],
  // ぜんぶ できたね! の大きな祝福。上がっていくやさしいアルペジオ。
  fanfare: [
    { freq: 523, dur: 0.14, type: 'sine' }, // ド
    { freq: 659, dur: 0.14, type: 'sine' }, // ミ
    { freq: 784, dur: 0.14, type: 'sine' }, // ソ
    { freq: 1047, dur: 0.14, type: 'sine' }, // 高いド
    { freq: 1319, dur: 0.14, type: 'sine' }, // 高いミ
    { freq: 1568, dur: 0.36, type: 'sine' }, // 高いソ
  ],
};

// AudioContext は web でのみ。native/非対応では null のまま無音。
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  try {
    if (!ctx) {
      const g = globalThis as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const AC = g.AudioContext ?? g.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    // ユーザー操作起点で resume（iOS Safari 対策）。
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function playSound(name: SoundName): void {
  const c = getCtx();
  if (!c) return; // native / 非対応環境では無音（MVP許容）
  try {
    let t = c.currentTime;
    for (const note of TONES[name]) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = note.type;
      osc.frequency.value = note.freq;
      // やわらかいエンベロープ（プチッというクリック音を避ける）。
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.14, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note.dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + note.dur + 0.02);
      t += note.dur * 0.9;
    }
  } catch {
    // 音が出せなくても遊びは壊さない。
  }
}