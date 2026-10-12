/**
 * localStorage の入口（src/storage.ts）。
 *
 * progress.ts・settings.ts・audio/bgm.ts が、同じ作りの型の宣言と ls() を 3 つ別々に持っていたのを 1 か所にした。
 * 読めない・書けない・消せない・localStorage が取り出せない・native の、どれでも例外にならず、読めなければ null。
 * 保存できなくても遊びは壊さない（こども側の約束）。各モジュールの保存キー・値の形式は、それぞれのテスト
 * （progress・settings・bgm）が固定している。
 */
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readKey, removeKey, webStorage, writeKey } from "../src/storage";
import {
  FakeStorage,
  installLocalStorage,
  installThrowingLocalStorage,
  removeLocalStorage,
} from "./helpers/storage";
import { Platform } from "./stubs/react-native";

beforeEach(() => {
  Platform.OS = "web";
});
afterEach(() => {
  Platform.OS = "web";
  removeLocalStorage();
});

test("webStorage: web では localStorage そのもの。native・無い・取り出せない環境は null", () => {
  const storage = new FakeStorage();
  installLocalStorage(storage);
  assert.equal(webStorage(), storage);

  Platform.OS = "android";
  assert.equal(webStorage(), null);

  Platform.OS = "web";
  removeLocalStorage();
  assert.equal(webStorage(), null);

  installThrowingLocalStorage();
  assert.equal(webStorage(), null);
});

test("readKey: 保存された文字列をそのまま返す。無いキーは null", () => {
  installLocalStorage(new FakeStorage({ "meiro.x": "値", "meiro.empty": "" }));
  assert.equal(readKey("meiro.x"), "値");
  assert.equal(readKey("meiro.empty"), "", "空文字も『ある』値");
  assert.equal(readKey("meiro.nothing"), null);
});

test("readKey: 読めない（getItem が例外）・native・localStorage が無い・取り出せないは、投げずに null（native と無いときは触りもしない）", () => {
  const storage = new FakeStorage({ "meiro.x": "値" });
  installLocalStorage(storage);
  storage.failGet = true;
  assert.equal(readKey("meiro.x"), null);

  storage.failGet = false;
  Platform.OS = "android";
  const before = storage.read.length;
  assert.equal(readKey("meiro.x"), null);
  assert.equal(
    storage.read.length,
    before,
    "native では localStorage に触らない",
  );

  Platform.OS = "web";
  removeLocalStorage();
  assert.equal(readKey("meiro.x"), null);
  installThrowingLocalStorage();
  assert.equal(readKey("meiro.x"), null);
});

test("writeKey: 文字列で保存し、書いたキーを記録する。同じキーは上書き", () => {
  const storage = new FakeStorage();
  installLocalStorage(storage);
  writeKey("meiro.x", "1");
  writeKey("meiro.x", "2");
  assert.deepEqual(storage.contents(), { "meiro.x": "2" });
  assert.deepEqual(storage.written, ["meiro.x", "meiro.x"]);
});

test("writeKey: 書けない（容量超過など）・native・localStorage が無い・取り出せないは、投げずに何もしない", () => {
  const storage = new FakeStorage();
  installLocalStorage(storage);
  storage.failSet = true;
  assert.doesNotThrow(() => writeKey("meiro.x", "1"));
  assert.equal(storage.data.has("meiro.x"), false);

  storage.failSet = false;
  Platform.OS = "android";
  assert.doesNotThrow(() => writeKey("meiro.x", "1"));
  assert.deepEqual(storage.written, [], "native では localStorage に触らない");

  Platform.OS = "web";
  removeLocalStorage();
  assert.doesNotThrow(() => writeKey("meiro.x", "1"));
  installThrowingLocalStorage();
  assert.doesNotThrow(() => writeKey("meiro.x", "1"));
});

test("removeKey: 消す。ほかのキーは残る。消せない・native・無い・取り出せないは、投げずに何もしない", () => {
  const storage = new FakeStorage({ "meiro.a": "1", "meiro.b": "2" });
  installLocalStorage(storage);
  removeKey("meiro.a");
  assert.deepEqual(storage.contents(), { "meiro.b": "2" });
  assert.deepEqual(storage.removed, ["meiro.a"]);

  storage.failRemove = true;
  assert.doesNotThrow(() => removeKey("meiro.b"));
  assert.deepEqual(storage.contents(), { "meiro.b": "2" });

  storage.failRemove = false;
  Platform.OS = "android";
  assert.doesNotThrow(() => removeKey("meiro.b"));
  assert.deepEqual(
    storage.removed,
    ["meiro.a"],
    "native では localStorage に触らない",
  );

  Platform.OS = "web";
  removeLocalStorage();
  assert.doesNotThrow(() => removeKey("meiro.b"));
  installThrowingLocalStorage();
  assert.doesNotThrow(() => removeKey("meiro.b"));
});
