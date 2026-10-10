// おつかいめいろ アプリのルート。
// react-navigation は使わず、文字ヘッダの無い全画面遷移にするための最小ステートルーター。
// 縦持ち前提のレイアウト（中央寄せ・最大幅制限）で横画面・大画面でも崩れにくくする（DESIGN §8）。
// 背の低い横向き（スマホの横持ち）では、めいろ画面だけ枠を広げて盤と方向パッドを左右に並べる（src/layout.ts）。

import React, { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Route } from "./src/types";
import { colors } from "./src/theme";
import {
  FRAME_MAX_W,
  FRAME_MAX_W_WIDE,
  FRAME_PAD_BOTTOM,
  FRAME_PAD_H,
  FRAME_PAD_TOP,
  isCompactLandscape,
} from "./src/layout";
import TitleScreen from "./src/screens/TitleScreen";
import LevelSelectScreen from "./src/screens/LevelSelectScreen";
import PlayScreen from "./src/screens/PlayScreen";
import GanbariScreen from "./src/screens/GanbariScreen";
import OtonaScreen from "./src/screens/OtonaScreen";
import { setCelebratedAll } from "./src/progress";
import { initPersonal } from "./src/personal/store";

export default function App() {
  const [route, setRoute] = useState<Route>({ name: "title" });
  const go = useCallback((r: Route) => setRoute(r), []);
  const { width: windowW, height: windowH } = useWindowDimensions();
  const compact = isCompactLandscape(windowW, windowH);

  // パーソナライズ資産（ゴール写真・おじの声）を端末内 IndexedDB から読み込んでおく。
  // 迷路生成・クリア演出は同期なので、先にメモリ上の在庫にしておく必要がある（personal/store.ts）。
  // 失敗しても例外は投げない（保存が使えない環境では静かに既定動作のまま）。
  useEffect(() => {
    void initPersonal();
  }, []);

  let screen: React.ReactNode = null;
  switch (route.name) {
    case "title":
      screen = (
        <TitleScreen
          onPlay={() => go({ name: "select" })}
          onOtona={() => go({ name: "otona" })}
        />
      );
      break;
    case "select":
      screen = (
        <LevelSelectScreen
          onPick={(id) => go({ name: "play", templateId: id })}
          onBack={() => go({ name: "title" })}
        />
      );
      break;
    case "play":
      screen = (
        // key を付けてテンプレートごとに作り直す（迷路・アバター位置などの状態をリセット）。
        // 同じテンプレート内の「もういちど」は PlayScreen 内で新しい迷路を生成する（remount しない）。
        <PlayScreen
          key={route.templateId}
          templateId={route.templateId}
          onHome={() => go({ name: "select" })}
          onNext={(nextId) => go({ name: "play", templateId: nextId })}
          onCelebrateAll={() => {
            // 大祝福を見せる＝一度きり。以降はレベルえらびの控えめな王冠だけ。
            setCelebratedAll(true);
            go({ name: "ganbari" });
          }}
        />
      );
      break;
    case "ganbari":
      screen = <GanbariScreen onDone={() => go({ name: "select" })} />;
      break;
    case "otona":
      screen = <OtonaScreen onBack={() => go({ name: "title" })} />;
      break;
  }

  // レベルえらびだけは横スクロールのカルーセルなので、広い画面では全カードを
  // 見せたい（480pxの枠に閉じ込めない）。そのため select のときだけ横方向の最大幅を
  // 外し、画面いっぱいに広げる（横の余白は画面側で持つ）。他画面は従来どおり中央寄せ・480px上限。
  const fullBleed = route.name === "select";

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.frame,
          fullBleed && styles.frameFull,
          compact && route.name === "play" && styles.frameWide,
        ]}
      >
        {screen}
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
  },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: FRAME_MAX_W,
    paddingTop: FRAME_PAD_TOP,
    paddingBottom: FRAME_PAD_BOTTOM,
    paddingHorizontal: FRAME_PAD_H,
  },
  // フルブリード（レベルえらび）: 横の最大幅と横パディングを外す。縦の余白は維持。
  frameFull: {
    maxWidth: 9999,
    paddingHorizontal: 0,
  },
  // 背の低い横向きのめいろ画面: 盤と方向パッドを左右に並べるので枠を広げる。余白は変えない。
  frameWide: {
    maxWidth: FRAME_MAX_W_WIDE,
  },
});
