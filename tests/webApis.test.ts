/**
 * web の API（音・読み上げ・写真・保存・録音）を globalThis から取り出す各モジュールの「使えるか」の判定。
 *
 * どのモジュールも、同じ規則で web の API を取り出す: web 以外は使えない・グローバルに無ければ使えない・
 * 形がおかしければ（関数でない・body が無い）使えない・例外になる環境でも投げない。この規則を 15 か所に別々に書いている。
 * 1 か所にまとめる前に、各モジュールの判定を現状のまま固定する（まとめたあとも同じ判定で緑のまま、が条件）。
 * 音そのもの・録音そのものは、ブラウザで鳴らして確かめる（ここでは偽のグローバルで判定だけを見る）。
 */
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { importFresh } from "./helpers/importFresh";
import { isClipAvailable } from "../src/audio/clips";
import { isSpeechAvailable } from "../src/audio/speech";
import { canPickPhotos } from "../src/personal/filePicker";
import { hasIndexedDb } from "../src/personal/idb";
import { objectUrl } from "../src/personal/image";
import { canRecord } from "../src/personal/recorder";
import { Platform } from "./stubs/react-native";

/** 置き換えたグローバルの、もとの状態（無かったなら undefined）。afterEach で元に戻す（本物の URL なども壊さない）。 */
const originals = new Map<string, PropertyDescriptor | undefined>();

function remember(name: string) {
  if (!originals.has(name)) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
}

/** globalThis に偽のものを置く（afterEach で元に戻す）。 */
function setGlobal(name: string, value: unknown) {
  remember(name);
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}
function throwingGlobal(name: string) {
  remember(name);
  Object.defineProperty(globalThis, name, {
    get() {
      throw new Error("SecurityError");
    },
    configurable: true,
  });
}

beforeEach(() => {
  Platform.OS = "web";
});
afterEach(() => {
  Platform.OS = "web";
  for (const [name, original] of originals) {
    if (original) Object.defineProperty(globalThis, name, original);
    else Reflect.deleteProperty(globalThis, name);
  }
  originals.clear();
});

class FakeAudio {}
class FakeUtterance {}

test("同梱クリップ（clips.ts）: Audio があるときだけ、登録のある基名が使える", () => {
  assert.equal(isClipAvailable("p_tsuita"), false, "Audio が無い");
  setGlobal("Audio", FakeAudio);
  assert.equal(isClipAvailable("p_tsuita"), true);
  assert.equal(isClipAvailable("p_zenbu"), true);
  assert.equal(isClipAvailable("p_no_such"), false, "登録の無い基名");
  assert.equal(isClipAvailable(undefined), false);
  Platform.OS = "ios";
  assert.equal(isClipAvailable("p_tsuita"), false, "native");
  Platform.OS = "web";
  throwingGlobal("Audio");
  assert.doesNotThrow(() => isClipAvailable("p_tsuita"));
  assert.equal(isClipAvailable("p_tsuita"), false, "取り出しが例外");
});

test("読み上げ（speech.ts）: speechSynthesis と SpeechSynthesisUtterance の両方があるときだけ使える", () => {
  assert.equal(isSpeechAvailable(), false);
  setGlobal("speechSynthesis", {});
  assert.equal(isSpeechAvailable(), false, "発声の部品だけでは使えない");
  setGlobal("SpeechSynthesisUtterance", FakeUtterance);
  assert.equal(isSpeechAvailable(), true);
  Platform.OS = "android";
  assert.equal(isSpeechAvailable(), false, "native");
  Platform.OS = "web";
  remember("speechSynthesis");
  Reflect.deleteProperty(globalThis, "speechSynthesis");
  assert.equal(isSpeechAvailable(), false, "speechSynthesis が無い");
  throwingGlobal("speechSynthesis");
  assert.equal(isSpeechAvailable(), false, "取り出しが例外");
});

test("写真を選べるか（filePicker.ts）: document に createElement（関数）と body があるときだけ", () => {
  assert.equal(canPickPhotos(), false);
  setGlobal("document", { createElement: () => ({}), body: {} });
  assert.equal(canPickPhotos(), true);
  setGlobal("document", { createElement: () => ({}), body: null });
  assert.equal(canPickPhotos(), false, "body が無い");
  setGlobal("document", { createElement: "関数でない", body: {} });
  assert.equal(canPickPhotos(), false, "createElement が関数でない");
  setGlobal("document", { createElement: () => ({}), body: {} });
  Platform.OS = "ios";
  assert.equal(canPickPhotos(), false, "native");
  Platform.OS = "web";
  throwingGlobal("document");
  assert.equal(canPickPhotos(), false, "取り出しが例外");
});

test("IndexedDB（idb.ts）: indexedDB.open が関数のときだけ見える。undefined・null・open の無いものは無しとみなす", () => {
  assert.equal(hasIndexedDb(), false);
  setGlobal("indexedDB", { open: () => ({}) });
  assert.equal(hasIndexedDb(), true);
  for (const bad of [undefined, null, {}, { open: "関数でない" }]) {
    setGlobal("indexedDB", bad);
    assert.equal(hasIndexedDb(), false, JSON.stringify(bad) ?? "undefined");
  }
  setGlobal("indexedDB", { open: () => ({}) });
  Platform.OS = "android";
  assert.equal(hasIndexedDb(), false, "native");
  Platform.OS = "web";
  throwingGlobal("indexedDB");
  assert.equal(hasIndexedDb(), false, "取り出しが例外");
});

test("オブジェクト URL（image.ts の objectUrl）: URL.createObjectURL が関数のときだけ使える", () => {
  // Node の URL には createObjectURL がある（関数）。web ならそのまま見える
  assert.equal(typeof objectUrl()?.createObjectURL, "function");
  setGlobal("URL", { createObjectURL: "関数でない" });
  assert.equal(objectUrl(), null);
  setGlobal("URL", undefined);
  assert.equal(objectUrl(), null);
  const fake = { createObjectURL: () => "blob:x", revokeObjectURL: () => {} };
  setGlobal("URL", fake);
  assert.equal(objectUrl(), fake);
  Platform.OS = "ios";
  assert.equal(objectUrl(), null, "native");
  Platform.OS = "web";
  throwingGlobal("URL");
  assert.equal(objectUrl(), null, "取り出しが例外");
});

test("録音できるか（recorder.ts）: MediaRecorder・navigator.mediaDevices.getUserMedia（関数）・Blob がそろったときだけ", () => {
  class FakeRecorder {}
  const md = { getUserMedia: () => Promise.resolve({}) };
  // Node には navigator（Node 21 以降）と Blob があるので、まず MediaRecorder が無い状態を見る
  assert.equal(canRecord(), false, "MediaRecorder が無い");

  setGlobal("MediaRecorder", FakeRecorder);
  setGlobal("navigator", { mediaDevices: md });
  assert.equal(canRecord(), true);

  setGlobal("navigator", { mediaDevices: { getUserMedia: "関数でない" } });
  assert.equal(canRecord(), false, "getUserMedia が関数でない");
  setGlobal("navigator", {});
  assert.equal(canRecord(), false, "mediaDevices が無い");
  setGlobal("navigator", undefined);
  assert.equal(canRecord(), false, "navigator が無い");

  setGlobal("navigator", { mediaDevices: md });
  setGlobal("Blob", undefined);
  assert.equal(canRecord(), false, "Blob が無い");
  setGlobal("Blob", class {});
  assert.equal(canRecord(), true);

  Platform.OS = "ios";
  assert.equal(canRecord(), false, "native");
  Platform.OS = "web";
  throwingGlobal("navigator");
  assert.equal(canRecord(), false, "取り出しが例外");
});

test("効果音の AudioContext（sounds.ts）: AudioContext、無ければ webkitAudioContext。同じものを使い回し、無い・native は null", async () => {
  type Sounds = typeof import("../src/audio/sounds");
  const open = () => importFresh<Sounds>("audio/sounds.ts");
  let made = 0;
  class FakeCtx {
    state = "running";
    constructor() {
      made++;
    }
  }
  assert.equal((await open()).getSharedAudioContext(), null, "無い");

  setGlobal("AudioContext", FakeCtx);
  const a = await open();
  const first = a.getSharedAudioContext();
  assert.ok(first instanceof FakeCtx);
  assert.equal(a.getSharedAudioContext(), first, "同じ実体を使い回す");
  assert.equal(made, 1);

  remember("AudioContext");
  Reflect.deleteProperty(globalThis, "AudioContext");
  class WebkitCtx extends FakeCtx {}
  setGlobal("webkitAudioContext", WebkitCtx);
  assert.ok((await open()).getSharedAudioContext() instanceof WebkitCtx);

  Platform.OS = "android";
  assert.equal((await open()).getSharedAudioContext(), null, "native");
  Platform.OS = "web";
  remember("webkitAudioContext");
  Reflect.deleteProperty(globalThis, "webkitAudioContext");
  throwingGlobal("AudioContext");
  assert.equal((await open()).getSharedAudioContext(), null, "取り出しが例外");
});
