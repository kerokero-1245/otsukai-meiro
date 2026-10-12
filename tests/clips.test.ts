/**
 * 同梱クリップ・録音の再生（src/audio/clips.ts）。
 *
 * 声は HTMLAudioElement で鳴らす。play() の Promise の拒否（最初のユーザー操作より前など）は握りつぶす
 * （こどもの画面を壊さない）。古い環境の play() は Promise を返さない（void）ので、その場合は待たない。
 * 型を黙らせる `as Promise<void>`（4 か所）をなくしたので、その扱いを固定する。
 * 終了通知（ended・error・停止）を 1 回だけにする旗は voice.test.ts が、ここは再生の呼び出し方を見る。
 */
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { importFresh } from "./helpers/importFresh";
import { Platform } from "./stubs/react-native";

type Clips = typeof import("../src/audio/clips");
const open = () => importFresh<Clips>("audio/clips.ts");

type PlayResult = "resolve" | "reject" | "void";
let playMode: PlayResult = "resolve";

class FakeAudio {
  static made: FakeAudio[] = [];
  listeners = new Map<string, (() => void)[]>();
  played = 0;
  paused = 0;
  muted = false;
  currentTime = 5;
  constructor(readonly src?: string) {
    FakeAudio.made.push(this);
  }
  addEventListener(type: string, cb: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), cb]);
  }
  play(): Promise<void> | void {
    this.played++;
    if (playMode === "reject")
      return Promise.reject(new Error("自動再生が許されない"));
    if (playMode === "void") return undefined;
    return Promise.resolve();
  }
  pause() {
    this.paused++;
  }
}

let original: PropertyDescriptor | undefined;
beforeEach(() => {
  Platform.OS = "web";
  FakeAudio.made = [];
  playMode = "resolve";
  original = Object.getOwnPropertyDescriptor(globalThis, "Audio");
  Object.defineProperty(globalThis, "Audio", {
    value: FakeAudio,
    configurable: true,
    writable: true,
  });
});
afterEach(() => {
  Platform.OS = "web";
  if (original) Object.defineProperty(globalThis, "Audio", original);
  else Reflect.deleteProperty(globalThis, "Audio");
});

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

test("playClip: 登録のある基名の URL で Audio を作り、1 回 play する。登録の無い基名・Audio が無い・native は false で鳴らさない", async () => {
  const clips = await open();
  assert.equal(clips.playClip("p_tsuita"), true);
  assert.equal(FakeAudio.made.length, 1);
  assert.equal(FakeAudio.made[0].src, "/assets/voice/p_tsuita.m4a");
  assert.equal(FakeAudio.made[0].played, 1);

  assert.equal(clips.playClip("p_no_such"), false);
  assert.equal(FakeAudio.made.length, 1);

  Platform.OS = "android";
  assert.equal(clips.playClip("p_tsuita"), false);
  Platform.OS = "web";
  Reflect.deleteProperty(globalThis, "Audio");
  assert.equal(clips.playClip("p_tsuita"), false);
});

test("play() の Promise が拒否されても、例外にも未処理の拒否にもならず、true を返す", async () => {
  playMode = "reject";
  const clips = await open();
  assert.doesNotThrow(() => clips.playClip("p_title"));
  assert.equal(clips.playAudioUrl("blob:録音"), true);
  await tick(); // 未処理の拒否が出ればテストが落ちる
});

test("play() が Promise を返さない古い環境（void）でも、落ちずに true を返す", async () => {
  playMode = "void";
  const clips = await open();
  assert.equal(clips.playClip("p_title"), true);
  assert.equal(FakeAudio.made[0].played, 1);
});

test("playAudioUrl: おじの録音（blob: URL）も同じ経路で鳴らす。空の URL は false。直前の再生は止める", async () => {
  const clips = await open();
  assert.equal(clips.playAudioUrl(""), false);
  assert.equal(FakeAudio.made.length, 0);
  assert.equal(clips.playAudioUrl("blob:一つ目"), true);
  assert.equal(clips.playAudioUrl("blob:二つ目"), true);
  assert.equal(FakeAudio.made[0].paused >= 1, true, "前の再生は止める");
  assert.equal(FakeAudio.made[1].src, "blob:二つ目");
});

test("warmUpClips: 最初のユーザー操作で 1 回だけ、先頭のクリップを muted で鳴らし、すぐ止めて頭出しする（iOS Safari のアンロック）", async () => {
  const clips = await open();
  clips.warmUpClips();
  clips.warmUpClips(); // 2 回目は何もしない
  assert.equal(FakeAudio.made.length, 1);
  const a = FakeAudio.made[0];
  assert.equal(a.src, "/assets/voice/p_title.m4a");
  assert.equal(a.muted, true);
  assert.equal(a.played, 1);
  await tick();
  assert.equal(a.paused, 1, "鳴らせたら止める");
  assert.equal(a.currentTime, 0, "頭出し");
});

test("warmUpClips: play() が拒否・void でも、落ちず、止める処理も走らせない（拒否されたものを止めない）", async () => {
  playMode = "reject";
  let clips = await open();
  assert.doesNotThrow(() => clips.warmUpClips());
  await tick();
  assert.equal(FakeAudio.made[0].paused, 0);
  assert.equal(FakeAudio.made[0].currentTime, 5);

  playMode = "void";
  FakeAudio.made = [];
  clips = await open();
  assert.doesNotThrow(() => clips.warmUpClips());
  await tick();
  assert.equal(
    FakeAudio.made[0].paused,
    0,
    "Promise を返さない環境では待たない",
  );
});

test("cancelClip: 鳴っている再生を止め、終了通知を 1 回だけ呼ぶ", async () => {
  const clips = await open();
  let ended = 0;
  clips.playClip("p_title", () => {
    ended++;
  });
  clips.cancelClip();
  clips.cancelClip();
  assert.equal(ended, 1);
  assert.equal(FakeAudio.made[0].paused >= 1, true);
});
