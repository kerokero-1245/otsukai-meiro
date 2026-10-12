// web の API を globalThis から取り出す入口。
// 音（AudioContext・Audio・speechSynthesis）・保存（localStorage・indexedDB）・写真（document・URL・createImageBitmap）・
// 録音（MediaRecorder・navigator・Blob）の各モジュールが、同じ形（web 以外は null・globalThis を二重キャストして取る・
// 例外は null）の関数を 15 か所で別々に書いていた。その形をここに 1 つだけ置く（二重キャストもここだけ）。
//
// 各モジュールは、使う API の「必要な形だけの最小の型」を自分で宣言して webGlobal<T> に渡す
// （DOM lib の型には直接依存しない）。3 つのアプリ共通の写し bgm/engine.ts はここを使わない（触らない）。

import { Platform } from "react-native";

// web でだけ globalThis[name] を返す。web 以外・その名前が無い（undefined / null）・取り出しで例外
// （サンドボックス化された iframe の localStorage が SecurityError を投げる、など）のときは null。
export function webGlobal<T>(name: string): T | null {
  if (Platform.OS !== "web") return null;
  try {
    const value = (
      globalThis as unknown as Record<string, T | null | undefined>
    )[name];
    return value ?? null;
  } catch {
    return null;
  }
}
