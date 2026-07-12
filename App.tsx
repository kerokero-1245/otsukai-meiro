// おつかいめいろ アプリのルート。
// react-navigation は使わず、文字ヘッダの無い全画面遷移にするための最小ステートルーター。
// 縦持ち前提のレイアウト（中央寄せ・最大幅制限）で横画面・大画面でも崩れにくくする（DESIGN §8）。

import React, { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { Route } from './src/types';
import { colors, space } from './src/theme';
import TitleScreen from './src/screens/TitleScreen';
import LevelSelectScreen from './src/screens/LevelSelectScreen';
import PlayScreen from './src/screens/PlayScreen';
import GanbariScreen from './src/screens/GanbariScreen';
import OtonaScreen from './src/screens/OtonaScreen';
import { setCelebratedAll } from './src/progress';

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'title' });
  const go = useCallback((r: Route) => setRoute(r), []);

  let screen: React.ReactNode = null;
  switch (route.name) {
    case 'title':
      screen = (
        <TitleScreen onPlay={() => go({ name: 'select' })} onOtona={() => go({ name: 'otona' })} />
      );
      break;
    case 'select':
      screen = (
        <LevelSelectScreen
          onPick={(id) => go({ name: 'play', levelId: id })}
          onBack={() => go({ name: 'title' })}
        />
      );
      break;
    case 'play':
      screen = (
        // key を付けてレベルごとに作り直す（アバター位置などの状態をリセット）。
        <PlayScreen
          key={route.levelId}
          levelId={route.levelId}
          onHome={() => go({ name: 'select' })}
          onNext={(nextId) => go({ name: 'play', levelId: nextId })}
          onCelebrateAll={() => {
            // 大祝福を見せる＝一度きり。以降はレベルえらびの控えめな王冠だけ。
            setCelebratedAll(true);
            go({ name: 'ganbari' });
          }}
        />
      );
      break;
    case 'ganbari':
      screen = <GanbariScreen onDone={() => go({ name: 'select' })} />;
      break;
    case 'otona':
      screen = <OtonaScreen onBack={() => go({ name: 'title' })} />;
      break;
  }

  return (
    <View style={styles.root}>
      <View style={styles.frame}>{screen}</View>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    paddingTop: space.lg,
    paddingBottom: space.md,
    paddingHorizontal: space.md,
  },
});