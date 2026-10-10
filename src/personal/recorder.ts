// おじの声の録音（web のみ / DESIGN §8「写真・録音の取得」）。
//
// ネイティブの expo-audio は使わず、ブラウザ標準の getUserMedia + MediaRecorder で録る
// （新規 npm 依存ゼロの方針）。録れた Blob は personal/store.ts が IndexedDB に入れる。
//
// - mimeType はブラウザで違う: Chrome/Firefox は audio/webm(opus)、Safari は audio/mp4。
//   isTypeSupported で候補を上から試し、**採用した mime を録音と一緒に保存**する（再生は blob URL 経由）。
// - マイク権限が拒否された／マイクが無い／MediaRecorder が無い場合は null を返すだけ。
//   おとなモードは「ろくおんできません」を出し、こども側は既定（ずんだもん）のまま何も変わらない。
// - 撮りっぱなし防止に上限（MAX_MS）で自動停止する。停止時は必ずマイクのトラックを止めて
//   録音インジケータを消す（ブラウザのタブに赤丸が残らないように）。
// - 外部送信ゼロ: 音声は端末内。ネットワークは使わない。
//
// DOM lib に依存しないよう、必要な形だけ最小宣言して globalThis から取り出す。

import { Platform } from "react-native";
import { BlobLike } from "./idb";

export const MAX_MS = 6000; // 「ついたね！」は数秒。長すぎる録音を防ぐ自動停止。

// 上から順に試す mime 候補（Chrome/Firefox → Safari → ブラウザ既定）。
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

// ── 最小型宣言 ───────────────────────────────────────────────────────
interface TrackLike {
  stop(): void;
}
interface StreamLike {
  getTracks(): TrackLike[];
}
interface RecorderLike {
  state: string;
  mimeType: string;
  start(timeslice?: number): void;
  stop(): void;
  ondataavailable: ((e: { data: BlobLike }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
}
interface RecorderCtor {
  new (stream: StreamLike, opts?: { mimeType?: string }): RecorderLike;
  isTypeSupported?(type: string): boolean;
}
interface MediaDevicesLike {
  getUserMedia(c: { audio: boolean }): Promise<StreamLike>;
}

function getRecorderCtor(): RecorderCtor | null {
  if (Platform.OS !== "web") return null;
  try {
    const g = globalThis as unknown as { MediaRecorder?: RecorderCtor };
    return g.MediaRecorder ?? null;
  } catch {
    return null;
  }
}

function getMediaDevices(): MediaDevicesLike | null {
  if (Platform.OS !== "web") return null;
  try {
    const g = globalThis as unknown as {
      navigator?: { mediaDevices?: MediaDevicesLike };
    };
    const md = g.navigator?.mediaDevices;
    if (!md || typeof md.getUserMedia !== "function") return null;
    return md;
  } catch {
    return null;
  }
}

function getBlobCtor():
  (new (parts: unknown[], opts?: { type?: string }) => BlobLike) | null {
  try {
    const g = globalThis as unknown as {
      Blob?: new (parts: unknown[], opts?: { type?: string }) => BlobLike;
    };
    return g.Blob ?? null;
  } catch {
    return null;
  }
}

// この環境で録音できそうか（実際の権限は start してみるまで分からない）。
export function canRecord(): boolean {
  return (
    getRecorderCtor() != null &&
    getMediaDevices() != null &&
    getBlobCtor() != null
  );
}

function pickMime(Ctor: RecorderCtor): string | undefined {
  try {
    if (typeof Ctor.isTypeSupported !== "function") return undefined;
    for (const m of MIME_CANDIDATES) {
      if (Ctor.isTypeSupported(m)) return m;
    }
  } catch {
    // 無視（ブラウザ既定にまかせる）
  }
  return undefined;
}

export interface RecordedVoice {
  blob: BlobLike;
  mime: string;
}

export interface ActiveRecording {
  // 停止して結果を受け取る（自動停止済みでも同じ結果を返す）。失敗なら null。
  stop(): Promise<RecordedVoice | null>;
  // 破棄（保存しない）。マイクも止める。
  cancel(): void;
}

// 録音を始める。権限拒否・非対応なら null。
export async function startRecording(
  onAutoStop?: () => void,
): Promise<ActiveRecording | null> {
  const Ctor = getRecorderCtor();
  const md = getMediaDevices();
  const B = getBlobCtor();
  if (!Ctor || !md || !B) return null;

  let stream: StreamLike;
  try {
    stream = await md.getUserMedia({ audio: true });
  } catch {
    return null; // 権限拒否・デバイス無し
  }

  const stopTracks = () => {
    try {
      for (const t of stream.getTracks()) {
        try {
          t.stop();
        } catch {
          // 無視
        }
      }
    } catch {
      // 無視
    }
  };

  let rec: RecorderLike;
  const mime = pickMime(Ctor);
  try {
    rec = mime ? new Ctor(stream, { mimeType: mime }) : new Ctor(stream);
  } catch {
    // mimeType 指定が弾かれたらブラウザ既定で作り直す。
    try {
      rec = new Ctor(stream);
    } catch {
      stopTracks();
      return null;
    }
  }

  const chunks: unknown[] = [];
  let finished = false;
  let result: RecordedVoice | null = null;
  // stop() は複数回・自動停止と同時に呼ばれうる。結果を待っている全員に同じ値を返す。
  const waiters: ((v: RecordedVoice | null) => void)[] = [];
  let autoTimer: ReturnType<typeof setTimeout> | null = null;

  const clearAuto = () => {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
  };

  const settle = (v: RecordedVoice | null) => {
    if (finished) return;
    finished = true;
    clearAuto();
    stopTracks();
    result = v;
    while (waiters.length > 0) {
      const w = waiters.shift();
      if (w) w(v);
    }
  };

  rec.ondataavailable = (e) => {
    if (e && e.data && e.data.size > 0) chunks.push(e.data);
  };
  rec.onstop = () => {
    let out: RecordedVoice | null = null;
    try {
      const type = rec.mimeType || mime || "audio/webm";
      const blob = new B(chunks, { type });
      out = blob.size > 0 ? { blob, mime: type } : null;
    } catch {
      out = null;
    }
    settle(out);
  };
  rec.onerror = () => settle(null);

  try {
    rec.start();
  } catch {
    stopTracks();
    return null;
  }

  // 上限で自動停止（撮りっぱなし防止）。UI へも知らせる。
  autoTimer = setTimeout(() => {
    autoTimer = null;
    try {
      if (rec.state !== "inactive") rec.stop();
    } catch {
      settle(null);
    }
    if (onAutoStop) {
      try {
        onAutoStop();
      } catch {
        // 無視
      }
    }
  }, MAX_MS);

  return {
    stop(): Promise<RecordedVoice | null> {
      if (finished) return Promise.resolve(result);
      clearAuto();
      return new Promise<RecordedVoice | null>((resolve) => {
        waiters.push(resolve);
        try {
          // すでに inactive（自動停止が走っている最中）なら止め直さず onstop を待つ。
          if (rec.state !== "inactive") rec.stop();
        } catch {
          settle(null);
        }
        // onstop が来ない環境の保険（2秒）。
        setTimeout(() => settle(result), 2000);
      });
    },
    cancel(): void {
      clearAuto();
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch {
        // 無視
      }
      settle(null);
    },
  };
}
