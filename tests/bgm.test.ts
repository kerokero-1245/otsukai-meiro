/**
 * BGM の ON/OFF の保存の規則（src/audio/bgm.ts）の現状を固定する。
 *
 * 保存は localStorage の meiro.bgm だけ。'0' と書いてあるときだけ OFF で、未設定・読めない環境・ほかのどんな値も ON（既定）。
 * ここが逆になると、親がおとなモードで切ったのに BGM が鳴る、保存が読めない端末で鳴らなくなる、ということが起きる。
 * localStorage の取り出し口は progress.ts・settings.ts と同じ作りで 3 つ複製されていた（M-04）。1 か所にまとめる前に、
 * この保存の規則を先に固定しておく（まとめたあとも同じ値で緑のまま、が条件）。
 *
 * bgm.ts は モジュールの中に初期化済みの旗を持つので、テストごとに読み込み直した別の実体を使う。
 * エンジン（bgm/engine.ts。3 つのアプリ共通の写し）は読み込み直しても同じ実体なので、各テストの前に ON に戻す。
 */
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { getBgmState, setBgmEnabled } from "../src/audio/bgm/engine";
import { importFresh } from "./helpers/importFresh";
import {
  FakeStorage,
  installLocalStorage,
  installThrowingLocalStorage,
  removeLocalStorage,
} from "./helpers/storage";
import { Platform } from "./stubs/react-native";

type Bgm = typeof import("../src/audio/bgm");
const open = () => importFresh<Bgm>("audio/bgm.ts");

async function openWith(initial: Record<string, string> = {}) {
  const storage = new FakeStorage(initial);
  installLocalStorage(storage);
  return { storage, bgm: await open() };
}

beforeEach(() => {
  Platform.OS = "web";
  setBgmEnabled(true);
});
afterEach(() => {
  Platform.OS = "web";
  removeLocalStorage();
  setBgmEnabled(true);
});

test("isBgmOn: 何も保存されていなければ ON（既定）。読むだけで書き込まない", async () => {
  const { storage, bgm } = await openWith();
  assert.equal(bgm.isBgmOn(), true);
  assert.deepEqual(storage.written, []);
});

test("isBgmOn: meiro.bgm が '0' のときだけ OFF。それ以外の値はすべて ON", async () => {
  assert.equal((await openWith({ "meiro.bgm": "0" })).bgm.isBgmOn(), false);
  for (const raw of ["1", "", "false", "off", "no", "2", "00", " 0", "0 "]) {
    const { bgm } = await openWith({ "meiro.bgm": raw });
    assert.equal(bgm.isBgmOn(), true, `値 ${JSON.stringify(raw)}`);
  }
});

test("setBgmOn: OFF は '0'、ON は '1' で meiro.bgm に保存し、開き直しても読める。触るキーは meiro.bgm だけ", async () => {
  const { storage, bgm } = await openWith();
  bgm.setBgmOn(false);
  assert.equal(storage.data.get("meiro.bgm"), "0");
  assert.equal((await open()).isBgmOn(), false);

  bgm.setBgmOn(true);
  assert.equal(storage.data.get("meiro.bgm"), "1");
  assert.equal((await open()).isBgmOn(), true);

  assert.deepEqual(storage.contents(), { "meiro.bgm": "1" });
  assert.deepEqual([...new Set(storage.written)], ["meiro.bgm"]);
});

test("エンジンへの反映: 保存が OFF なら最初の呼び出しで OFF に、保存が無い・ON ならエンジンの既定（ON）のまま", async () => {
  const off = await openWith({ "meiro.bgm": "0" });
  off.bgm.startMeiroBgm();
  assert.equal(getBgmState().enabled, false);

  setBgmEnabled(true);
  const on = await openWith({ "meiro.bgm": "1" });
  on.bgm.startMeiroBgm();
  assert.equal(getBgmState().enabled, true);

  const unset = await openWith();
  unset.bgm.startMeiroBgm();
  assert.equal(getBgmState().enabled, true);
});

test("setBgmOn はエンジンの ON/OFF も切り替える（保存と同時）", async () => {
  const { bgm } = await openWith();
  bgm.setBgmOn(false);
  assert.equal(getBgmState().enabled, false);
  bgm.setBgmOn(true);
  assert.equal(getBgmState().enabled, true);
});

test("保存が読めない・書けない環境でも例外にならず、既定は ON、切り替えはこの起動の間だけ効く", async () => {
  const { storage, bgm } = await openWith({ "meiro.bgm": "0" });
  storage.failGet = true;
  assert.equal(bgm.isBgmOn(), true, "読めないときは ON");

  setBgmEnabled(true);
  const writeFail = await openWith();
  writeFail.storage.failSet = true;
  assert.doesNotThrow(() => writeFail.bgm.setBgmOn(false));
  assert.equal(
    getBgmState().enabled,
    false,
    "エンジンはこの起動のあいだ切り替わる",
  );
  assert.equal(writeFail.storage.data.has("meiro.bgm"), false);
});

test("native（Platform.OS が web 以外）: localStorage には触らず、常に ON として読む", async () => {
  Platform.OS = "android";
  const { storage, bgm } = await openWith({ "meiro.bgm": "0" });
  assert.equal(bgm.isBgmOn(), true, "保存済みの値は読まない");
  assert.doesNotThrow(() => bgm.setBgmOn(false));
  assert.deepEqual(storage.read, []);
  assert.deepEqual(storage.written, []);
});

test("web でも localStorage が無い・取り出せない環境は、落ちずに ON から始まる", async () => {
  removeLocalStorage();
  const none = await open();
  assert.equal(none.isBgmOn(), true);
  assert.doesNotThrow(() => none.setBgmOn(false));

  installThrowingLocalStorage();
  const blocked = await open();
  assert.equal(blocked.isBgmOn(), true);
  assert.doesNotThrow(() => blocked.setBgmOn(false));
});

test("声のダッキング: duckForVoice で沈み、同じ数の unduckForVoice で戻る（多重に耐え、戻しすぎても負にならない）", async () => {
  const { bgm } = await openWith();
  assert.equal(getBgmState().ducked, false);
  bgm.duckForVoice();
  assert.equal(getBgmState().ducked, true);
  bgm.duckForVoice();
  bgm.unduckForVoice();
  assert.equal(
    getBgmState().ducked,
    true,
    "2 回沈めて 1 回戻しただけでは、まだ沈んだまま",
  );
  bgm.unduckForVoice();
  assert.equal(getBgmState().ducked, false);
  bgm.unduckForVoice();
  assert.equal(getBgmState().ducked, false, "戻しすぎても沈んだ状態にならない");
  bgm.duckForVoice();
  assert.equal(getBgmState().ducked, true, "戻しすぎのあとも 1 回沈めれば沈む");
  bgm.unduckForVoice();
});
