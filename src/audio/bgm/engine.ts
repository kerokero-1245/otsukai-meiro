// ぴよぴよランド 共通BGMエンジン（オルゴール風・手続き生成ループ）
// ------------------------------------------------------------------
// Expo（React Native / react-native-web）3アプリ用。街の静的HTML用 engine.js と同一ロジック
// （同じ音色・同じ lookahead スケジューラ）。src/audio/ に置いて使う。
//
// 設計思想は既存の効果音／声（sounds.ts・clips.ts・voice.ts）と同じ:
//   - 音源ファイルを同梱しない。Web Audio API でその場合成する（完全オフライン）。
//   - 音は必ず「ユーザー操作起点」で鳴らす（iOS Safari の自動再生制限に合わせる）。
//   - web でのみ鳴らす。native（iOS/Android 実機）は無音スタブ。AudioContext 非対応でも
//     全 API は無害な no-op（クラッシュ厳禁）。
//
// つなぎ目のないループ: 曲を「無限に続くノート列」として ctx.currentTime 基準の絶対時刻へ
// 前もって予約する。止めて鳴らし直さないのでループ境界に切れ目が出ない。
//
// 既存実装との整合（同じ AudioContext を共有する）:
//   sounds.ts / clips.ts は各自 AudioContext を持つ。次フェーズで sounds.ts に ctx の getter を
//   足し、configureBgm({ getCtx }) で注入すれば、声・効果音・BGM が同一 ctx を共有できる。
//   注入が無ければ本モジュールが自前で 1つ生成する（それでも動く）。
//
// 使い方:
//   import { startBgm, stopBgm, duckBgm, unduckBgm, setBgmEnabled } from './bgm/engine';
//   // 最初のユーザー操作（「あそぶ」タップ）で:
//   startBgm('sansu');
//   // 声を鳴らす直前／直後:
//   duckBgm(); ... unduckBgm();

import { Platform } from 'react-native';
import { SONGS, type SongId, type BgmSong } from './songs';

// ── 音色パラメータ（オルゴール風）────────────────────────────────────
const MASTER_VOLUME = 0.1; // 控えめ既定音量（マスターゲイン）
const DUCK_RATIO = 0.35; // 声再生中はこの比率まで下げる
const DUCK_TAU = 0.08; // ダッキング時定数（速く沈む）
const UNDUCK_TAU = 0.22; // 復帰時定数（ゆっくり戻る）
const LOWPASS_HZ = 4500; // 全体をやわらげるローパス
const LOWPASS_Q = 0.7;
const OVERTONE_RATIO = 2.0; // 高次倍音1本（1オクターブ上）
const OVERTONE_GAIN = 0.32; // 倍音の相対ゲイン（小さめ）
const ATTACK = 0.005; // アタック 約5ms
const PARTIAL_ATTACK = 0.003;
const DECAY_MIN = 0.9; // 指数減衰の最小・最大（秒）
const DECAY_MAX = 2.0;
const DECAY_SCALE = 1.4; // 音価に対する余韻の伸び
const PARTIAL_DECAY_RATIO = 0.45; // 倍音は速く減衰

// ── スケジューラ・パラメータ ────────────────────────────────────────
const LOOKAHEAD_MS = 200; // インターバル
const SCHEDULE_AHEAD = 0.6; // 先読み秒
const START_DELAY = 0.12; // start 時、最初のノートまでの余裕

// DOM lib に依存しないよう、必要な最小の形だけ宣言して globalThis から取り出す。
type AC = AudioContext;
type ACtor = new () => AC;

function getACtor(): ACtor | null {
  if (Platform.OS !== 'web') return null;
  try {
    const g = globalThis as unknown as { AudioContext?: ACtor; webkitAudioContext?: ACtor };
    return g.AudioContext ?? g.webkitAudioContext ?? null;
  } catch {
    return null;
  }
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ── オルゴール1音の合成 ─────────────────────────────────────────────
// 基音（triangle）＋高次倍音1本（sine, 小ゲイン・速い減衰）。指数減衰でチンと鳴らす。
function voice(
  ctx: AC,
  out: AudioNode,
  t: number,
  midi: number,
  durBeats: number,
  vel: number,
  secPerBeat: number
): void {
  const freq = midiToFreq(midi);
  const decay = clamp(durBeats * secPerBeat * DECAY_SCALE, DECAY_MIN, DECAY_MAX);
  const peak = Math.max(0.0002, vel);

  const osc1 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.value = freq;
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.0001, t);
  g1.gain.exponentialRampToValueAtTime(peak, t + ATTACK);
  g1.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc1.connect(g1);
  g1.connect(out);
  osc1.start(t);
  osc1.stop(t + decay + 0.05);

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = freq * OVERTONE_RATIO;
  const g2 = ctx.createGain();
  const pdecay = clamp(decay * PARTIAL_DECAY_RATIO, 0.3, DECAY_MAX);
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(peak * OVERTONE_GAIN, t + PARTIAL_ATTACK);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + pdecay);
  osc2.connect(g2);
  g2.connect(out);
  osc2.start(t);
  osc2.stop(t + pdecay + 0.05);
}

interface PreppedSong {
  secPerBeat: number;
  loopDur: number;
  mix: number;
  notes: BgmSong['notes'];
}
function prepSong(song: BgmSong): PreppedSong {
  const secPerBeat = 60 / song.bpm;
  const loopBeats = song.beatsPerBar * song.bars;
  return {
    secPerBeat,
    loopDur: loopBeats * secPerBeat,
    mix: typeof song.mix === 'number' ? song.mix : 1,
    notes: song.notes,
  };
}

// ── エンジン設定（外部 ctx の注入など）──────────────────────────────
export interface BgmConfig {
  /** 既存 ctx（声・効果音と共有）を返す関数。省略時は自前で生成。 */
  getCtx?: () => AC | null;
  /** マスターゲイン既定値（0.10前後）。 */
  masterVolume?: number;
}

// ── 状態（モジュール singleton）─────────────────────────────────────
let injectedGetCtx: (() => AC | null) | null = null;
let masterVolume = MASTER_VOLUME;

let ctx: AC | null = null;
let ownsCtx = false;
let master: GainNode | null = null;
let lowpass: BiquadFilterNode | null = null;

let enabled = true; // 初期状態 ON
let running = false;
let songId: SongId | null = null;
let song: PreppedSong | null = null;

let timer: ReturnType<typeof setInterval> | null = null;
let loopStart = 0;
let loopIndex = 0;
let noteCursor = 0;
let duckCount = 0;
let baseVolume = MASTER_VOLUME;
let visibilityBound = false;

function supported(): boolean {
  return getACtor() != null || injectedGetCtx != null;
}

// 外部 ctx の注入など（アプリ初期化時に1回。任意）。
export function configureBgm(cfg: BgmConfig): void {
  if (typeof cfg.getCtx === 'function') injectedGetCtx = cfg.getCtx;
  if (typeof cfg.masterVolume === 'number') {
    masterVolume = cfg.masterVolume;
    baseVolume = masterVolume;
  }
}

function ensureCtx(): AC | null {
  if (ctx) return ctx;
  if (injectedGetCtx) {
    try {
      const c = injectedGetCtx();
      if (c) {
        ctx = c;
        ownsCtx = false;
        bindVisibility();
        return ctx;
      }
    } catch {
      /* noop */
    }
  }
  const ACtor = getACtor();
  if (!ACtor) return null;
  try {
    ctx = new ACtor();
    ownsCtx = true;
    bindVisibility();
  } catch {
    ctx = null;
  }
  return ctx;
}

function ensureGraph(): boolean {
  if (!ctx) return false;
  if (master) return true;
  try {
    master = ctx.createGain();
    master.gain.value = baseVolume;
    lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = LOWPASS_HZ;
    lowpass.Q.value = LOWPASS_Q;
    master.connect(lowpass);
    lowpass.connect(ctx.destination);
    return true;
  } catch {
    master = null;
    lowpass = null;
    return false;
  }
}

function currentDuckTarget(): number {
  return duckCount > 0 ? baseVolume * DUCK_RATIO : baseVolume;
}

function scheduleTick(): void {
  if (!running || !ctx || !master || !song) return;
  const now = ctx.currentTime;
  const horizon = now + SCHEDULE_AHEAD;
  const notes = song.notes;
  let guard = 0;
  while (guard++ < 512) {
    if (noteCursor >= notes.length) {
      loopIndex += 1;
      noteCursor = 0;
      if (notes.length === 0) break;
    }
    const n = notes[noteCursor];
    const at = loopStart + loopIndex * song.loopDur + n.t * song.secPerBeat;
    if (at >= horizon) break;
    if (at >= now - 0.02) {
      voice(ctx, master, at, n.midi, n.dur, n.vel, song.secPerBeat);
    }
    noteCursor += 1;
  }
}

function startTimer(): void {
  if (timer != null) return;
  timer = setInterval(scheduleTick, LOOKAHEAD_MS);
  scheduleTick();
}
function stopTimer(): void {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}

// ── 公開API ──────────────────────────────────────────────────────────

/**
 * 曲を再生開始（必ずユーザー操作起点で呼ぶ前提）。
 * - 同じ曲が既に再生中なら冪等（カーソル・ゲインを一切いじらず即リターン）。
 * - 別の曲で呼ばれたら内部的に stop → カーソル／ゲイン再初期化 → 新曲を start（安全な切替）。
 */
export function startBgm(id: SongId): void {
  if (!supported()) return;
  const data = SONGS[id];
  if (!data) return;

  // 同一曲がすでに回っているなら冪等リターン（song/baseVolume を差し替えて
  // 走行中カーソルと不整合を起こす事故を防ぐ）。
  if (running && songId === id && ctx && master) return;

  // 別曲へ切替中か（running なのに曲IDが違う）。
  const switching = running && songId !== id;

  songId = id;
  song = prepSong(data);
  baseVolume = masterVolume * song.mix;

  if (!enabled) return; // OFF のときは予約だけ覚えて鳴らさない

  // 別曲へ切替: 走っているスケジューラを止めてから、下でカーソル・ゲインを作り直す。
  // 予約済みの旧曲ノートは各自の減衰で自然に消える（ハードカットしないのでクリック無し）。
  if (switching) {
    stopTimer();
    running = false;
  }

  if (!ensureCtx()) return;
  if (!ensureGraph()) return;
  try {
    if (ctx!.state === 'suspended') void ctx!.resume();
  } catch {
    /* noop */
  }
  try {
    master!.gain.cancelScheduledValues(ctx!.currentTime);
    master!.gain.setValueAtTime(currentDuckTarget(), ctx!.currentTime);
  } catch {
    /* noop */
  }
  loopStart = ctx!.currentTime + START_DELAY;
  loopIndex = 0;
  noteCursor = 0;
  running = true;
  startTimer();
}

/** 再生停止（fadeSec でフェードアウト、既定0.4秒）。 */
export function stopBgm(fadeSec?: number): void {
  stopTimer();
  running = false;
  if (!ctx || !master) return;
  const f = typeof fadeSec === 'number' && fadeSec >= 0 ? fadeSec : 0.4;
  try {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    if (f <= 0.001) master.gain.setValueAtTime(0.0001, now);
    else master.gain.setTargetAtTime(0.0001, now, f / 3);
  } catch {
    /* noop */
  }
}

/** ON/OFF トグル（おとなモード用）。false で止め、true で予定曲を鳴らし直す。 */
export function setBgmEnabled(on: boolean): void {
  on = !!on;
  if (enabled === on) return;
  enabled = on;
  if (!on) stopBgm(0.3);
  else if (songId) startBgm(songId);
}

export function isBgmEnabled(): boolean {
  return enabled;
}

/** 公開の状態スナップショット（検証・デバッグ用）。engine.js の getBgmState と同形。 */
export interface BgmState {
  supported: boolean; // Web Audio 利用可能か
  enabled: boolean; // ON/OFF（おとなモード）
  running: boolean; // ループ再生中か
  songId: SongId | null; // 再生中／再生予定の曲ID
  ducked: boolean; // 声ダッキング中か（duckCount>0）
  ownsCtx: boolean; // 自前生成の ctx か（注入でない）
}

/** 現在の再生状態を返す（検証・デバッグ用）。 */
export function getBgmState(): BgmState {
  return {
    supported: supported(),
    enabled,
    running,
    songId,
    ducked: duckCount > 0,
    ownsCtx,
  };
}

/** 声クリップ再生中のダッキング（なめらかに沈める）。多重呼び出しに耐える。 */
export function duckBgm(): void {
  duckCount += 1;
  if (!ctx || !master) return;
  try {
    master.gain.setTargetAtTime(baseVolume * DUCK_RATIO, ctx.currentTime, DUCK_TAU);
  } catch {
    /* noop */
  }
}

/** ダッキング解除（なめらかに戻す）。ネストが全部解けたら基準音量へ。 */
export function unduckBgm(): void {
  duckCount = Math.max(0, duckCount - 1);
  if (!ctx || !master) return;
  if (duckCount > 0) return;
  try {
    master.gain.setTargetAtTime(baseVolume, ctx.currentTime, UNDUCK_TAU);
  } catch {
    /* noop */
  }
}

// タブが隠れたら自動サスペンド、戻ったら復帰（自前 ctx のときのみ suspend）。
function onVisibility(): void {
  try {
    if (!ctx) return;
    const doc = (globalThis as unknown as { document?: { hidden?: boolean } }).document;
    if (doc && doc.hidden) {
      stopTimer();
      if (ownsCtx && ctx.state === 'running') void ctx.suspend();
    } else {
      if (running && enabled) {
        if (ctx.state === 'suspended') void ctx.resume();
        startTimer();
      }
    }
  } catch {
    /* noop */
  }
}
function bindVisibility(): void {
  if (visibilityBound) return;
  if (Platform.OS !== 'web') return;
  const doc = (globalThis as unknown as {
    document?: { addEventListener?: (t: string, cb: () => void) => void };
  }).document;
  if (doc && typeof doc.addEventListener === 'function') {
    try {
      doc.addEventListener('visibilitychange', onVisibility);
      visibilityBound = true;
    } catch {
      /* noop */
    }
  }
}
