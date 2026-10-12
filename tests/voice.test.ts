/**
 * 声の再生と BGM のダッキング（src/audio/voice.ts・clips.ts・speech.ts）。
 *
 * 声が鳴っている間だけ BGM を沈める。約束は「1 回の声 = 沈める 1 回・戻す 1 回」。ended・error・停止のどれが先に来ても、
 * 戻すのは 1 回だけ（2 回戻すと、次の声がまだ鳴っている最中に BGM が元の音量へ戻る）。どの通知も取りこぼしたときの
 * 保険のタイマ（8 秒）でも戻る。「1 回だけ呼ぶ」旗を 1 か所（src/once.ts）にまとめた（M-23）ので、その順序と回数を固定する。
 * 音そのものは鳴らさない（偽の Audio・speechSynthesis で、呼ばれ方と沈み方だけを見る）。
 */
import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { getBgmState, setBgmEnabled, unduckBgm } from "../src/audio/bgm/engine";
import { CLIP_URLS } from "../src/audio/voiceClips";
import { cancelVoice, playVoice, sayPhrase } from "../src/audio/voice";
import { Platform } from "./stubs/react-native";

const originals = new Map<string, PropertyDescriptor | undefined>();
function setGlobal(name: string, value: unknown) {
  if (!originals.has(name)) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

/** 偽の Audio。作られた全部を覚え、ended / error を好きなタイミングで起こせる。 */
class FakeAudio {
  static made: FakeAudio[] = [];
  readonly listeners = new Map<string, (() => void)[]>();
  played = 0;
  paused = 0;
  muted = false;
  currentTime = 0;
  constructor(readonly src?: string) {
    FakeAudio.made.push(this);
  }
  addEventListener(type: string, cb: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), cb]);
  }
  play() {
    this.played++;
    return Promise.resolve();
  }
  pause() {
    this.paused++;
  }
  fire(type: "ended" | "error") {
    for (const cb of this.listeners.get(type) ?? []) cb();
  }
}

/** 偽の speechSynthesis。speak された発声を覚え、end / error を好きなタイミングで起こせる。 */
class FakeUtterance {
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  lang = "";
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: unknown = null;
  constructor(readonly text = "") {}
}
const spoken: FakeUtterance[] = [];
const fakeSynth = {
  speak: (u: FakeUtterance) => {
    spoken.push(u);
  },
  cancel: () => {},
  getVoices: () => [],
  onvoiceschanged: null,
};

function resetDucking() {
  while (getBgmState().ducked) unduckBgm();
}

beforeEach(() => {
  Platform.OS = "web";
  FakeAudio.made = [];
  spoken.length = 0;
  setBgmEnabled(true);
  resetDucking();
});
afterEach(() => {
  cancelVoice();
  resetDucking();
  mock.timers.reset();
  Platform.OS = "web";
  for (const [name, original] of originals) {
    if (original) Object.defineProperty(globalThis, name, original);
    else Reflect.deleteProperty(globalThis, name);
  }
  originals.clear();
});

test("同梱クリップ: 鳴らすと BGM が沈み、ended で戻る。クリップは登録のある URL で、1 つだけ作って 1 回 play する", () => {
  setGlobal("Audio", FakeAudio);
  sayPhrase("title");
  assert.equal(FakeAudio.made.length, 1);
  assert.equal(FakeAudio.made[0].src, CLIP_URLS.p_title);
  assert.equal(FakeAudio.made[0].played, 1);
  assert.equal(getBgmState().ducked, true);
  FakeAudio.made[0].fire("ended");
  assert.equal(getBgmState().ducked, false);
});

test("error でも戻る。ended と error の両方が来ても、戻すのは 1 回だけ（次の声を沈めたままにする）", () => {
  setGlobal("Audio", FakeAudio);
  sayPhrase("title"); // A
  const a = FakeAudio.made[0];
  a.fire("error");
  assert.equal(getBgmState().ducked, false);

  sayPhrase("tsuita"); // B（A が戻ったあとに沈める）
  assert.equal(getBgmState().ducked, true);
  // A の後から来た通知（ended・error）は、B の分を戻さない
  a.fire("ended");
  a.fire("error");
  assert.equal(
    getBgmState().ducked,
    true,
    "A の遅れた通知で B の声が鳴っている間に戻ってはいけない",
  );
  FakeAudio.made[1].fire("ended");
  assert.equal(getBgmState().ducked, false);
});

test("声の途中で次の声を鳴らすと、前の分を先に戻してから沈め直す。前の声の終了通知は無効", () => {
  setGlobal("Audio", FakeAudio);
  sayPhrase("title"); // A
  sayPhrase("tsuita"); // B（A を止めて沈め直す）
  assert.equal(FakeAudio.made.length, 2);
  assert.equal(FakeAudio.made[0].paused >= 1, true, "前の声は止める");
  assert.equal(getBgmState().ducked, true);
  FakeAudio.made[0].fire("ended"); // A の通知（B の分を戻さない）
  assert.equal(getBgmState().ducked, true);
  FakeAudio.made[1].fire("ended");
  assert.equal(getBgmState().ducked, false);
});

test("cancelVoice: 鳴っている声を止めて戻す。止めたあとに来た終了通知は何もしない", () => {
  setGlobal("Audio", FakeAudio);
  sayPhrase("title");
  const a = FakeAudio.made[0];
  assert.equal(getBgmState().ducked, true);
  cancelVoice();
  assert.equal(getBgmState().ducked, false);
  assert.equal(a.paused >= 1, true);

  sayPhrase("tsuita"); // 次の声
  assert.equal(getBgmState().ducked, true);
  a.fire("ended"); // 止めた声の遅れた通知
  assert.equal(getBgmState().ducked, true);
});

test("どの通知も来ないとき、保険のタイマ（8 秒）で戻る。8 秒より前は沈んだまま", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  setGlobal("Audio", FakeAudio);
  sayPhrase("title");
  mock.timers.tick(7999);
  assert.equal(getBgmState().ducked, true);
  mock.timers.tick(1);
  assert.equal(getBgmState().ducked, false);
  // 保険のあとに ended が来ても、もう戻さない（次の声は沈んだまま）
  sayPhrase("tsuita");
  FakeAudio.made[0].fire("ended");
  assert.equal(getBgmState().ducked, true);
});

test("同梱クリップが鳴らせないとき（Audio が無い）は読み上げへ: 発声の text・ended 相当（onend・onerror）で 1 回だけ戻る", () => {
  setGlobal("speechSynthesis", fakeSynth);
  setGlobal("SpeechSynthesisUtterance", FakeUtterance);
  sayPhrase("tsuita"); // { clip: p_tsuita, text: "ついたね" } だが Audio が無い
  assert.equal(spoken.length >= 1, true);
  const u = spoken[spoken.length - 1];
  assert.equal(u.text, "ついたね");
  assert.equal(getBgmState().ducked, true);
  u.onend?.();
  assert.equal(getBgmState().ducked, false);

  sayPhrase("zenbu");
  assert.equal(getBgmState().ducked, true);
  u.onend?.(); // 前の発声の遅れた通知
  u.onerror?.();
  assert.equal(getBgmState().ducked, true, "前の発声の通知で戻してはいけない");
  const next = spoken[spoken.length - 1];
  assert.equal(next.text, "ぜんぶ できたね");
  next.onerror?.();
  assert.equal(getBgmState().ducked, false);
  next.onend?.();
  assert.equal(getBgmState().ducked, false);
});

test("どれも鳴らせない環境（Audio も speechSynthesis も無い・native）は、沈めずに終わる", () => {
  sayPhrase("title");
  assert.equal(getBgmState().ducked, false);
  setGlobal("Audio", FakeAudio);
  setGlobal("speechSynthesis", fakeSynth);
  setGlobal("SpeechSynthesisUtterance", FakeUtterance);
  Platform.OS = "android";
  sayPhrase("title");
  assert.equal(getBgmState().ducked, false);
  assert.equal(FakeAudio.made.length, 0);
  assert.equal(spoken.length, 0);
});

test("playVoice に登録の無いクリップ名だけを渡すと、読み上げの text へ落ちる", () => {
  setGlobal("Audio", FakeAudio);
  setGlobal("speechSynthesis", fakeSynth);
  setGlobal("SpeechSynthesisUtterance", FakeUtterance);
  playVoice({ clip: "p_no_such", text: "てすと" });
  assert.equal(FakeAudio.made.length, 0);
  assert.equal(spoken[spoken.length - 1].text, "てすと");
});
