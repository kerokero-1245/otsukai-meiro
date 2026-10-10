/**
 * あそびかた（①タップ / ②ならべてゴー）の保存の規則（src/settings.ts）の現状を固定する。DESIGN §16.5。
 *
 * 保存は localStorage の meiro.mode だけ。'queue' と書いてあるときだけ②で、未設定・壊れた値・読めない環境は
 * すべて①（'tap'）。ここが逆になると、親がおとなモードで切り替えていないのに②で始まったり、
 * 保存が読めない端末で②に固定されたりする（こども側は「既定は①のまま」が約束）。
 *
 * settings.ts は モジュールの中に let のキャッシュを持つので、テストごとに読み込み直した別の実体を使う。
 */
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { importFresh } from "./helpers/importFresh";
import {
  FakeStorage,
  installLocalStorage,
  installThrowingLocalStorage,
  removeLocalStorage,
} from "./helpers/storage";
import { Platform } from "./stubs/react-native";

type Settings = typeof import("../src/settings");
const open = () => importFresh<Settings>("settings.ts");

async function openWith(initial: Record<string, string> = {}) {
  const storage = new FakeStorage(initial);
  installLocalStorage(storage);
  return { storage, settings: await open() };
}

beforeEach(() => {
  Platform.OS = "web";
});
afterEach(() => {
  Platform.OS = "web";
  removeLocalStorage();
});

test("getPlayMode: 何も保存されていなければ 'tap'（既定は①）", async () => {
  const { storage, settings } = await openWith();
  assert.equal(settings.getPlayMode(), "tap");
  assert.deepEqual(storage.written, [], "読むだけで書き込まない");
});

test("getPlayMode: meiro.mode が 'queue' のときだけ 'queue'。それ以外の値はすべて 'tap'", async () => {
  assert.equal(
    (await openWith({ "meiro.mode": "queue" })).settings.getPlayMode(),
    "queue",
  );
  for (const raw of [
    "tap",
    "",
    "QUEUE",
    "Queue",
    " queue",
    "queue ",
    "1",
    "true",
    "queue2",
  ]) {
    const { settings } = await openWith({ "meiro.mode": raw });
    assert.equal(settings.getPlayMode(), "tap", `値 ${JSON.stringify(raw)}`);
  }
});

test("setPlayMode: meiro.mode に 'queue' / 'tap' の文字列で保存し、開き直しても読める", async () => {
  const { storage, settings } = await openWith();
  settings.setPlayMode("queue");
  assert.equal(settings.getPlayMode(), "queue");
  assert.equal(storage.data.get("meiro.mode"), "queue");
  assert.equal((await open()).getPlayMode(), "queue");

  settings.setPlayMode("tap");
  assert.equal(settings.getPlayMode(), "tap");
  assert.equal(storage.data.get("meiro.mode"), "tap");
  assert.equal((await open()).getPlayMode(), "tap");
  // この設定が触るキーは meiro.mode だけ
  assert.deepEqual(storage.contents(), { "meiro.mode": "tap" });
  assert.deepEqual([...new Set(storage.written)], ["meiro.mode"]);
});

test("保存が読めない・書けない環境でも例外にならず、既定は 'tap'、切り替えはこの起動の間だけ効く", async () => {
  const { storage, settings } = await openWith({ "meiro.mode": "queue" });
  storage.failGet = true;
  assert.equal(settings.getPlayMode(), "tap", "読めないときは①");

  const writeFail = await openWith();
  writeFail.storage.failSet = true;
  assert.doesNotThrow(() => writeFail.settings.setPlayMode("queue"));
  assert.equal(
    writeFail.settings.getPlayMode(),
    "queue",
    "この起動のあいだは切り替わる",
  );
  assert.equal(writeFail.storage.data.has("meiro.mode"), false);
});

test("native（Platform.OS が web 以外）: localStorage には触らず、この起動の間だけ切り替わる", async () => {
  Platform.OS = "android";
  const { storage, settings } = await openWith({ "meiro.mode": "queue" });
  assert.equal(settings.getPlayMode(), "tap", "保存済みの値は読まない");
  settings.setPlayMode("queue");
  assert.equal(settings.getPlayMode(), "queue");
  assert.deepEqual(storage.read, []);
  assert.deepEqual(storage.written, []);
});

test("web でも localStorage が無い・取り出せない環境は、落ちずに 'tap' から始まる", async () => {
  removeLocalStorage();
  const none = await open();
  assert.equal(none.getPlayMode(), "tap");
  none.setPlayMode("queue");
  assert.equal(none.getPlayMode(), "queue");

  installThrowingLocalStorage();
  const blocked = await open();
  assert.equal(blocked.getPlayMode(), "tap");
  assert.doesNotThrow(() => blocked.setPlayMode("queue"));
  assert.equal(blocked.getPlayMode(), "queue");
});
