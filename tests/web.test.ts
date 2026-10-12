/**
 * web のグローバルの取り出し口（src/web.ts の webGlobal）。
 *
 * 音・保存・写真・録音の各モジュールが、同じ形（web 以外は null・globalThis から取る・例外は null）の関数を
 * 15 か所で別々に書いていた。1 か所にまとめたので、その形を固定する。取り出しが例外になる環境
 * （サンドボックス化された iframe の localStorage など）でも、こどもの画面は落ちない（null → 既定の動き）。
 */
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { webGlobal } from "../src/web";
import { Platform } from "./stubs/react-native";

const NAME = "__meiroWebGlobalTest";
const g = globalThis as unknown as Record<string, unknown>;

function define(value: unknown) {
  Object.defineProperty(globalThis, NAME, {
    value,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  Platform.OS = "web";
});
afterEach(() => {
  Platform.OS = "web";
  Reflect.deleteProperty(globalThis, NAME);
});

test("web: globalThis にある値をそのまま（同じ実体で）返す", () => {
  const value = { kind: "object" };
  define(value);
  assert.equal(webGlobal<typeof value>(NAME), value);
});

test("コンストラクタ・関数も、そのまま取り出して new・呼び出しに使える", () => {
  class Ctor {
    readonly made = true;
  }
  define(Ctor);
  const C = webGlobal<typeof Ctor>(NAME);
  assert.equal(C, Ctor);
  assert.equal(new C!().made, true);
});

test("web 以外（native）は、グローバルにあっても null", () => {
  define({ kind: "object" });
  for (const os of ["ios", "android", "windows", "macos"]) {
    Platform.OS = os;
    assert.equal(webGlobal(NAME), null, os);
  }
});

test("Platform.OS は呼ぶたびに見る（取り出す前に決めて覚えない）", () => {
  define("値");
  Platform.OS = "android";
  assert.equal(webGlobal(NAME), null);
  Platform.OS = "web";
  assert.equal(webGlobal(NAME), "値");
});

test("グローバルに無い・undefined・null は null", () => {
  assert.equal(webGlobal("__meiroNoSuchGlobal"), null);
  define(undefined);
  assert.equal(webGlobal(NAME), null);
  define(null);
  assert.equal(webGlobal(NAME), null);
});

test("0・空文字・false も『ある』値として、そのまま返す（null と undefined だけを『無い』とみなす）", () => {
  for (const value of [0, "", false]) {
    define(value);
    assert.strictEqual(webGlobal(NAME), value, JSON.stringify(value));
  }
});

test("取り出しが例外になる環境（サンドボックス化された iframe の localStorage など）は、投げずに null", () => {
  Object.defineProperty(globalThis, NAME, {
    get() {
      throw new Error("SecurityError: アクセスできません");
    },
    configurable: true,
  });
  assert.doesNotThrow(() => webGlobal(NAME));
  assert.equal(webGlobal(NAME), null);
});

test("globalThis 以外から取らない（同名のモジュール内の値や、別の名前の値は返さない）", () => {
  define("これ");
  g.__meiroOther = "あれ";
  try {
    assert.equal(webGlobal(NAME), "これ");
    assert.equal(webGlobal("__meiroOther"), "あれ");
    assert.equal(webGlobal(`${NAME}x`), null);
  } finally {
    Reflect.deleteProperty(globalThis, "__meiroOther");
  }
});
