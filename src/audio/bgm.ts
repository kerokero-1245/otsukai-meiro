// おつかいめいろの BGM 配線（オルゴール風の手続き生成ループ / piyo-assets 共通エンジン）。
// 画面はこのモジュールだけを呼ぶ。内部で bgm/engine.ts（依存ゼロの Web Audio エンジン）に橋渡しする。
//
// 方針（ぴよぴよランド 共通ルール）:
//   - 曲は 'meiro'（すこしわくわく・G メジャーペンタ・84BPM・16小節シームレスループ）。
//   - 初期 ON・控えめ音量。最初のユーザー操作（タイトルのタップ／「あそぶ」）で startMeiroBgm()。
//     iOS Safari の自動再生制限に合わせ、必ずタップ起点で鳴らす（同一曲の再呼び出しは冪等）。
//   - おとなモードの「BGM ながす/ながさない」トグル。保存キー meiro.bgm（localStorage・既定 ON）。
//   - 声（voice.ts のよみあげ）の再生中はダッキング（voice.ts が duckForVoice/unduckForVoice を呼ぶ）。
//   - AudioContext は効果音（sounds.ts）と共有する（getSharedAudioContext を注入）。
//   - AudioContext 非対応・localStorage 例外でもクラッシュしない（全 API 無害）。
//
// BGM: オリジナル（Web Audio 生成）。録音物・外部素材は使っていない。

import { Platform } from 'react-native';
import {
  configureBgm,
  startBgm,
  setBgmEnabled,
  duckBgm,
  unduckBgm,
  getBgmState,
} from './bgm/engine';
import { getSharedAudioContext } from './sounds';

const BGM_KEY = 'meiro.bgm'; // localStorage: '0'=OFF / それ以外（未設定含む）=ON（既定）

// 型の都合で最小限だけ宣言（DOM lib に依存しない。progress.ts と同じ流儀）。
interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
function ls(): WebStorage | null {
  if (Platform.OS !== 'web') return null;
  try {
    const s = (globalThis as unknown as { localStorage?: WebStorage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

// 保存された ON/OFF を読む（未設定・例外は既定 ON）。
function readEnabled(): boolean {
  const store = ls();
  if (!store) return true;
  try {
    return store.getItem(BGM_KEY) !== '0';
  } catch {
    return true;
  }
}
function writeEnabled(on: boolean): void {
  const store = ls();
  if (!store) return;
  try {
    store.setItem(BGM_KEY, on ? '1' : '0');
  } catch {
    // 保存できなくても遊びは壊さない
  }
}

let initialized = false;
// アプリの最初のユーザー操作前に1回だけ。ctx 共有の注入＋保存された ON/OFF をエンジンへ反映。
function ensureInit(): void {
  if (initialized) return;
  initialized = true;
  try {
    // 効果音・声と同じ AudioContext を共有する（注入が無ければエンジンが自前 ctx を作る）。
    configureBgm({ getCtx: getSharedAudioContext });
  } catch {
    // no-op
  }
  // エンジン内部は既定 ON。保存が OFF のときだけ OFF を反映する。
  if (!readEnabled()) {
    try {
      setBgmEnabled(false);
    } catch {
      // no-op
    }
  }
}

// 最初のユーザー操作（タイトルのタップ／「あそぶ」）で呼ぶ。曲=meiro。
// OFF のときは鳴らさず「予定曲」だけ覚える（後でトグル ON にすれば鳴る）。同一曲の再呼び出しは冪等。
export function startMeiroBgm(): void {
  ensureInit();
  try {
    startBgm('meiro');
  } catch {
    // 音が出せなくても遊びは壊さない
  }
}

// おとなモードのトグル現在値（保存が真実。未設定は ON）。
export function isBgmOn(): boolean {
  ensureInit();
  return readEnabled();
}

// おとなモードのトグル切替。保存 → エンジンへ反映。
// OFF で即フェード停止、ON で（ジェスチャ文脈なら）予定曲を即再開。
export function setBgmOn(on: boolean): void {
  ensureInit();
  writeEnabled(on);
  try {
    setBgmEnabled(on);
  } catch {
    // no-op
  }
}

// 声の再生中のダッキング（voice.ts から呼ぶ）。多重呼び出しはエンジン側で吸収（duckCount）。
export function duckForVoice(): void {
  try {
    duckBgm();
  } catch {
    // no-op
  }
}
export function unduckForVoice(): void {
  try {
    unduckBgm();
  } catch {
    // no-op
  }
}

// 検証・デバッグ用（getBgmState を素通し）。
export { getBgmState };
