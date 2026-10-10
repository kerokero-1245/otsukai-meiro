// タイトル画面。文字ゼロでも進める大ボタン「あそぶ」＋概念の絵（🐥→🍎）。
// 隅の歯車を3秒長押しでおとなモードへ（4歳が偶発しにくい親ゲート／DESIGN §6）。
// 左上の「まちへ もどる」（TownLink）で ぴよぴよランド（街）へ帰る。あそんでいる途中の画面には置かない。
//
// 並びは上から「まちへ もどる の行 → 題字〜あそぶ（残りの高さの中央）→ 歯車の行」。要素を重ねず流すので、
// 横向き（844x390・568x320 など）でも「まちへ もどる」が題字に、歯車が「あそぶ」に重ならない。高さが足りない
// ときは全体をスクロールして全部に届く。並びの順がそのまま Tab の順（まちへ もどる → 題字 → あそぶ → 歯車）になる。
// ぴよぴよさんすうのタイトルと同じ作り。

import React, { useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { colors, font, space } from "../theme";
import BigButton from "../components/BigButton";
import PiyoArt from "../components/PiyoArt";
import TownLink, { SHOW_TOWN, TOWN_LINK_HEIGHT } from "../components/TownLink";
import { playSound } from "../audio/sounds";
import { sayPhrase, warmUpVoice } from "../audio/voice";
import { startMeiroBgm } from "../audio/bgm";

interface Props {
  onPlay: () => void;
  onOtona: () => void;
}

const HOLD_MS = 3000;

// 題字を1行に収める文字の大きさ。題字は枠の左右の余白（space.md）まで使い、画面の端から TITLE_EDGE だけ離す。
// 1字 = 1em（7字）＋字間 1×7 で見積もる（保守的。ぴよぴよさんすう・ことばと同じ式。字間はこのアプリの題字の 1）。
// Mac のヒラギノの UI 用書体はかなが約 0.92em と狭いが、かなが全角（1em）の書体（Android の Noto Sans CJK JP など）
// でも2行に折り返さないよう、狭い方には寄せない。390 幅・360 幅で 44（従来どおり）、320 幅で 42
// （従来は 44 のまま「ろ」だけ2行目に折り返していた）。
const TITLE_CHARS = 7; // 「おつかいめいろ」
const TITLE_LETTER_SPACING = 1;
const TITLE_EDGE = 8;
const FRAME_MAX_W = 480; // App.tsx の frame の最大幅
function titleFontSize(windowW: number): number {
  const avail = Math.min(windowW, FRAME_MAX_W) - TITLE_EDGE * 2;
  return Math.min(
    font.huge,
    Math.floor((avail - TITLE_LETTER_SPACING * TITLE_CHARS) / TITLE_CHARS),
  );
}

export default function TitleScreen({ onPlay, onOtona }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width: windowW } = useWindowDimensions();

  const clearHold = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const startHold = () => {
    clearHold();
    timer.current = setTimeout(() => {
      timer.current = null;
      onOtona();
    }, HOLD_MS);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 街へ戻る（タイトルにだけ置く）。上に専用の行を取り、題字以下はその下に流す。 */}
        {SHOW_TOWN ? (
          <View style={styles.townRow}>
            <TownLink onPress={() => playSound("tap")} />
          </View>
        ) : null}

        <View style={styles.center}>
          {/* 題字は枠の左右の余白まで使う（全角かなの書体でも1行に収めるため）。 */}
          <View style={styles.titleRow}>
            {/* タイトル＋概念の絵をタップすると「おつかいめいろ」と声が出る（ジェスチャ起点）。
                同時に声エンジンをアンロックして、以降のゴール到達・がんばりカードの声も鳴るようにする。 */}
            <Pressable
              onPress={() => {
                // 最初のタップ起点で BGM（オルゴール）も流し始める（同一曲の再呼び出しは冪等）。
                startMeiroBgm();
                warmUpVoice();
                sayPhrase("title");
              }}
              accessibilityRole="button"
              accessibilityLabel="おつかいめいろ（こえ）"
              style={styles.titleTap}
            >
              <Text
                style={[styles.title, { fontSize: titleFontSize(windowW) }]}
              >
                おつかいめいろ
              </Text>

              <View style={styles.concept}>
                <PiyoArt glyph="🐥" size={82} emojiSize={64} />
                <Text style={styles.conceptArrow}>➡️</Text>
                <PiyoArt glyph="🍎" size={82} emojiSize={64} />
              </View>
            </Pressable>
          </View>

          <View style={styles.playWrap}>
            <BigButton
              emoji="▶️"
              label="あそぶ"
              size="huge"
              color={colors.play}
              pressedColor={colors.playPressed}
              onPress={() => {
                // 声を出さずに次へ進むが、ここでも声エンジンをアンロックしておく
                // （タイトルをタップせず直接「あそぶ」を押した子でも、後の声が鳴るように）。
                // BGM も同じタップ起点で流し始める（以降の画面遷移でも途切れず続く）。
                startMeiroBgm();
                warmUpVoice();
                playSound("tap");
                onPlay();
              }}
            />
          </View>
        </View>

        {/* 親ゲート: 3秒長押しでおとなモード（右下。ほかの要素と重ならないよう行として置く） */}
        <View style={styles.gearRow}>
          <Pressable
            onPressIn={startHold}
            onPressOut={clearHold}
            accessibilityRole="button"
            accessibilityLabel="おとなモード（長押し）"
            hitSlop={12}
            style={styles.gear}
          >
            <Text style={styles.gearGlyph}>⚙️</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // スクロールの入れ物は枠の左右の余白（space.md）まで広げ、中身の側で同じ余白を取り直す
  // （題字だけがその余白まで使えるようにするため。ほかの要素の位置は従来と同じ）。
  scroll: {
    flex: 1,
    marginHorizontal: -space.md,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: space.md,
  },
  townRow: {
    height: TOWN_LINK_HEIGHT,
    marginBottom: space.sm,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    alignSelf: "stretch",
    marginHorizontal: -space.md,
    alignItems: "center",
  },
  titleTap: {
    alignItems: "center",
  },
  title: {
    fontSize: font.huge,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: TITLE_LETTER_SPACING,
  },
  concept: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: space.lg,
    marginBottom: space.xl,
  },
  conceptArrow: {
    fontSize: 40,
    marginHorizontal: space.sm,
  },
  playWrap: {
    width: "100%",
    maxWidth: 320,
  },
  // 歯車の行（右下）。歯車の位置は従来（右 space.sm・下 space.sm）と同じ。
  gearRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingRight: space.sm,
    paddingBottom: space.sm,
  },
  gear: {
    padding: space.sm,
    opacity: 0.35,
  },
  gearGlyph: {
    fontSize: 30,
  },
});
