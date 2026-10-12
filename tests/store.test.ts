/**
 * 端末内の写真・おじの声の在庫（src/personal/store.ts）のうち、保存された値を信用せずに確かめる部分。
 *
 * IndexedDB の中身は端末に残っていたものなので、読み込むときに「録音スロットの名前か」を確かめる（isVoiceSlot）。
 * 以前は `r.slot as VoiceSlot` と型を付けたあとに、別の行で実行時の検査をしていた。型の約束と実行時の検査を
 * 1 つの関数（型ガード）にした。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { VOICE_SLOTS, isVoiceSlot } from "../src/personal/store";

test("isVoiceSlot: 録音スロットの名前（tsuita・zenbu）だけ true", () => {
  assert.deepEqual(VOICE_SLOTS, ["tsuita", "zenbu"]);
  for (const slot of VOICE_SLOTS) assert.equal(isVoiceSlot(slot), true, slot);
  assert.equal(isVoiceSlot("tsuita"), true);
  assert.equal(isVoiceSlot("zenbu"), true);
});

test("isVoiceSlot: 名前が違う・大文字小文字・前後の空白・文字列でない値は false", () => {
  for (const value of [
    "title",
    "",
    "TSUITA",
    "Zenbu",
    " tsuita",
    "zenbu ",
    "tsuita,zenbu",
    null,
    undefined,
    0,
    1,
    true,
    {},
    [],
    ["tsuita"],
    { slot: "tsuita" },
  ]) {
    assert.equal(
      isVoiceSlot(value),
      false,
      JSON.stringify(value) ?? "undefined",
    );
  }
});
