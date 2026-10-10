// アクセシビリティの小さなヘルパ。
//
// prefers-reduced-motion（「動きを減らす」設定）を読む。react-native の AccessibilityInfo は
// react-native-web 側で `window.matchMedia('(prefers-reduced-motion: reduce)')` に橋渡しされる
// （Expo SDK 57 に専用モジュールは無い＝新規 npm 依存はゼロ）。
//
// 使いどころは②ならべてゴーの新しい演出（首かしげの回転・スタートへ ぴょんと戻る弧）だけ。
// ①タップモードの見た目・挙動はフェーズ1のまま **一切変えない**（既定のリグレッションゼロ）。
// 1歩ずつの移動そのものは「観察」の核なので、動きを減らす設定でも省かない（弧と回転だけ控える）。

import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    try {
      void AccessibilityInfo.isReduceMotionEnabled()
        .then((v) => {
          if (alive) setReduced(!!v);
        })
        .catch(() => {
          // 取れなければ「減らさない」のまま（演出は既定どおり）。
        });
    } catch {
      // 非対応環境でもクラッシュさせない。
    }

    let sub: { remove?: () => void } | undefined;
    try {
      sub = AccessibilityInfo.addEventListener(
        "reduceMotionChanged",
        (v: boolean) => {
          if (alive) setReduced(!!v);
        },
      );
    } catch {
      // 購読できなくてもよい。
    }

    return () => {
      alive = false;
      try {
        sub?.remove?.();
      } catch {
        // no-op
      }
    };
  }, []);

  return reduced;
}
