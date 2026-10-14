/**
 * BGM の ON/OFF の保存の規則（src/audio/bgm.ts）を固定する。
 *
 * 保存は localStorage の meiro.bgm だけ。書く値は "on" / "off"（さんすう・ことば・ランドと同じ形）。
 * 読み方（parseBgmValue）: "off" と旧値 "0" は OFF、"on" と旧値 "1" は ON、未設定・読めない環境・ほかのどんな値も ON（既定）。
 * 旧値 "1" / "0" を読んだら、その場で "on" / "off" に書き直す（書けなくても遊びは壊さない）。新しい値・未設定・壊れ値は書き直さない。
 * ここが逆になると、親がおとなモードで切ったのに BGM が鳴る、保存が読めない端末で鳴らなくなる、
 * 前の版で切った設定が引き継がれない、ということが起きる。
 * localStorage の取り出し口は progress.ts・settings.ts と同じ作りで 3 つ複製されていた（M-04）。1 か所にまとめる前に、
 * この保存の規則を先に固定しておく（まとめたあとも同じ値で緑のまま、が条件）。
 *
 * bgm.ts は モジュールの中に初期化済みの旗を持つので、テストごとに読み込み直した別の実体を使う。
 * エンジン（共有パッケージ piyo-assets の bgm/engine）は読み込み直しても同じ実体なので、各テストの前に ON に戻す。
 */
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  getBgmState,
  setBgmEnabled,
} from "@kerokero-1245/piyo-assets/bgm/engine";
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

test("isBgmOn: meiro.bgm が 'off' と旧値 '0' のときだけ OFF。それ以外の値はすべて ON", async () => {
  for (const raw of ["off", "0"]) {
    const { bgm } = await openWith({ "meiro.bgm": raw });
    assert.equal(bgm.isBgmOn(), false, `値 ${JSON.stringify(raw)}`);
  }
  for (const raw of [
    "on",
    "1",
    "",
    "false",
    "OFF",
    " off",
    "no",
    "2",
    "00",
    " 0",
    "0 ",
  ]) {
    const { bgm } = await openWith({ "meiro.bgm": raw });
    assert.equal(bgm.isBgmOn(), true, `値 ${JSON.stringify(raw)}`);
  }
});

test("setBgmOn: OFF は 'off'、ON は 'on' で meiro.bgm に保存し、開き直しても読める。触るキーは meiro.bgm だけ", async () => {
  const { storage, bgm } = await openWith();
  bgm.setBgmOn(false);
  assert.equal(storage.data.get("meiro.bgm"), "off");
  assert.equal((await open()).isBgmOn(), false);

  bgm.setBgmOn(true);
  assert.equal(storage.data.get("meiro.bgm"), "on");
  assert.equal((await open()).isBgmOn(), true);

  assert.deepEqual(storage.contents(), { "meiro.bgm": "on" });
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

// ── parseBgmValue（meiro.bgm の読み方。旧値 "1" / "0" の移行）──────────
// 期待値は シリーズ共通の規則（on/off に揃える・旧値は読んだときに書き直す）と、ランドの parseBgm（kerokero-1245.github.io 22a5876）から。

test('parseBgmValue: 新しい値 "off" は OFF（書き直さない）', async () => {
  const { parseBgmValue } = await open();
  assert.deepEqual(parseBgmValue("off"), { on: false, rewrite: null });
});

test('parseBgmValue: 新しい値 "on" は ON（書き直さない）', async () => {
  const { parseBgmValue } = await open();
  assert.deepEqual(parseBgmValue("on"), { on: true, rewrite: null });
});

test('parseBgmValue: 旧値 "0" は OFF で、"off" に書き直す', async () => {
  const { parseBgmValue } = await open();
  assert.deepEqual(parseBgmValue("0"), { on: false, rewrite: "off" });
});

test('parseBgmValue: 旧値 "1" は ON で、"on" に書き直す', async () => {
  const { parseBgmValue } = await open();
  assert.deepEqual(parseBgmValue("1"), { on: true, rewrite: "on" });
});

test("parseBgmValue: 未設定（null）は既定の ON（書き直さない）", async () => {
  const { parseBgmValue } = await open();
  assert.deepEqual(parseBgmValue(null), { on: true, rewrite: null });
});

test("parseBgmValue: 壊れ値は既定の ON（書き直さない）", async () => {
  const { parseBgmValue } = await open();
  for (const raw of [
    "",
    "abc",
    "ON",
    "OFF",
    " off",
    "off ",
    "2",
    "-1",
    "00",
    " 0",
    "true",
    "false",
    "null",
  ]) {
    assert.deepEqual(
      parseBgmValue(raw),
      { on: true, rewrite: null },
      JSON.stringify(raw),
    );
  }
});

test('旧値で開くと、その場で "on" / "off" に書き直す（読み直しても同じ ON/OFF で、もう書き直さない）', async () => {
  for (const [raw, on, next] of [
    ["0", false, "off"],
    ["1", true, "on"],
  ] as const) {
    const { storage, bgm } = await openWith({ "meiro.bgm": raw });
    assert.equal(bgm.isBgmOn(), on, `値 ${raw}`);
    assert.equal(storage.data.get("meiro.bgm"), next, `値 ${raw}`);
    assert.deepEqual(storage.written, ["meiro.bgm"], `値 ${raw}`);
    assert.deepEqual(storage.contents(), { "meiro.bgm": next });

    const again = await open();
    assert.equal(again.isBgmOn(), on, `値 ${raw} を読み直し`);
    assert.deepEqual(storage.written, ["meiro.bgm"], "2 回目は書かない");
  }

  // 最初の呼び出しが startMeiroBgm（タイトルのタップ）でも書き直し、エンジンへ OFF を反映する
  const tap = await openWith({ "meiro.bgm": "0" });
  tap.bgm.startMeiroBgm();
  assert.equal(tap.storage.data.get("meiro.bgm"), "off");
  assert.equal(getBgmState().enabled, false);
});

test("新しい値・未設定・壊れ値で開いたときは書き直さない", async () => {
  const cases: Record<string, string>[] = [
    { "meiro.bgm": "on" },
    { "meiro.bgm": "off" },
    {},
    { "meiro.bgm": "abc" },
  ];
  for (const initial of cases) {
    setBgmEnabled(true);
    const { storage, bgm } = await openWith(initial);
    bgm.startMeiroBgm();
    bgm.isBgmOn();
    assert.deepEqual(storage.written, [], JSON.stringify(initial));
    assert.deepEqual(storage.contents(), initial);
  }
});

test("旧値の書き直しが書けない storage でも落ちず、旧値のとおり ON/OFF を読む（保存は旧値のまま）", async () => {
  const off = await openWith({ "meiro.bgm": "0" });
  off.storage.failSet = true;
  assert.doesNotThrow(() => off.bgm.startMeiroBgm());
  assert.equal(getBgmState().enabled, false);
  assert.equal(off.bgm.isBgmOn(), false);
  assert.equal(off.storage.data.get("meiro.bgm"), "0");

  setBgmEnabled(true);
  const on = await openWith({ "meiro.bgm": "1" });
  on.storage.failSet = true;
  assert.equal(on.bgm.isBgmOn(), true);
  assert.equal(on.storage.data.get("meiro.bgm"), "1");
});
