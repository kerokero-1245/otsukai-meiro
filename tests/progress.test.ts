/**
 * ごほうび（⭐スタンプ）の保存の規則（src/progress.ts）の現状を固定する。DESIGN §7・§14。
 *
 * ここが壊れると、姪の端末に貯まった⭐や、街（ランチャー）の燃料 meiro.totalStars が消える・増えすぎる。
 * 保存データなので、キーの文字列と値の形（JSON 配列 / "1" / 数値の文字列）も文字どおり固定する。
 *  - meiro.stars         クリア済みレベル id の JSON 配列
 *  - meiro.celebratedAll 「ぜんぶ できたね!」を見せたか（"1"）
 *  - meiro.totalStars    累計クリア回数（再クリアも +1）。初回（キーが無いとき）だけ⭐の件数で移行する。
 *                        「⭐をリセット」では消さない（街の成長を巻き戻さないため）。
 *
 * progress.ts は モジュールの中に let のキャッシュを持つので、テストごとに読み込み直した別の実体を使う
 * （「ページを開き直した」状態の再現）。localStorage は偽物（helpers/storage.ts）。
 */
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES } from "../src/data/templates";
import { importFresh } from "./helpers/importFresh";
import {
  FakeStorage,
  installLocalStorage,
  installThrowingLocalStorage,
  removeLocalStorage,
} from "./helpers/storage";
import { Platform } from "./stubs/react-native";

type Progress = typeof import("../src/progress");
const open = () => importFresh<Progress>("progress.ts");

/** 偽の localStorage（中身つき）を置いて、読み込み直した progress を返す。 */
async function openWith(initial: Record<string, string> = {}) {
  const storage = new FakeStorage(initial);
  installLocalStorage(storage);
  return { storage, progress: await open() };
}

beforeEach(() => {
  Platform.OS = "web";
});
afterEach(() => {
  Platform.OS = "web";
  removeLocalStorage();
});

const sorted = (xs: string[]) => [...xs].sort();

// ── ⭐（meiro.stars）─────────────────────────────────────────────

test("⭐: 付けると meiro.stars に id の JSON 配列（付けた順）で保存される", async () => {
  const { storage, progress } = await openWith();
  assert.equal(progress.markCleared("level-02"), true);
  assert.equal(progress.markCleared("level-01"), true);
  assert.equal(storage.data.get("meiro.stars"), '["level-02","level-01"]');
  assert.equal(progress.isCleared("level-01"), true);
  assert.equal(progress.isCleared("level-03"), false);
  assert.equal(progress.clearedCount(), 2);
});

test("⭐: 再クリアは false で、増えも減りもしない（マイナス要素ゼロ）", async () => {
  const { storage, progress } = await openWith();
  assert.equal(progress.markCleared("level-01"), true);
  const written = storage.written.length;
  assert.equal(progress.markCleared("level-01"), false);
  assert.equal(progress.clearedCount(), 1);
  assert.equal(progress.isCleared("level-01"), true);
  assert.equal(storage.written.length, written, "変化が無いので書き込まない");
  assert.equal(storage.data.get("meiro.stars"), '["level-01"]');
});

test("⭐: 開き直しても残る（meiro.stars から読み直す）", async () => {
  const { progress } = await openWith();
  progress.markCleared("level-01");
  progress.markCleared("level-04");
  const reopened = await open();
  assert.equal(reopened.isCleared("level-01"), true);
  assert.equal(reopened.isCleared("level-04"), true);
  assert.equal(reopened.isCleared("level-02"), false);
  assert.equal(reopened.clearedCount(), 2);
});

test("⭐: meiro.stars が壊れていても『まだ何も無い』として遊べる／文字列の id だけ読む", async () => {
  const broken = [
    "{",
    "null",
    '{"a":1}',
    '"level-01"',
    "",
    "123",
    "[",
    "undefined",
  ];
  for (const raw of broken) {
    const { progress } = await openWith({ "meiro.stars": raw });
    assert.equal(progress.clearedCount(), 0, `値 ${JSON.stringify(raw)}`);
    assert.equal(
      progress.isCleared("level-01"),
      false,
      `値 ${JSON.stringify(raw)}`,
    );
  }
  const { progress } = await openWith({
    "meiro.stars": '[1,"level-02",null,"level-04",{"id":"level-05"}]',
  });
  assert.equal(progress.clearedCount(), 2);
  assert.equal(progress.isCleared("level-02"), true);
  assert.equal(progress.isCleared("level-04"), true);
});

test("allCleared: 同梱の全テンプレートに⭐が揃ったときだけ true（知らない id は数えない）", async () => {
  assert.ok(TEMPLATES.length > 0, "TEMPLATES が 0 件");
  const ids = TEMPLATES.map((t) => t.id);
  const { progress } = await openWith();
  assert.equal(progress.allCleared(), false, "何も無いとき");
  progress.markCleared("not-a-template");
  for (const id of ids.slice(0, -1)) progress.markCleared(id);
  assert.equal(progress.allCleared(), false, "あと 1 枚足りないとき");
  progress.markCleared(ids[ids.length - 1]);
  assert.equal(progress.allCleared(), true, "全部そろったとき");
  assert.equal(progress.clearedCount(), ids.length + 1);

  const only = await openWith({ "meiro.stars": '["a","b","c","d","e"]' });
  assert.equal(only.progress.allCleared(), false, "件数だけ合っても id が違う");
});

// ── 累計（meiro.totalStars）─────────────────────────────────────

test("totalStars: キーが無い初回だけ、既存の⭐の件数を初期値にして書き込む（移行）", async () => {
  const { storage, progress } = await openWith({
    "meiro.stars": '["level-01","level-02","level-03"]',
  });
  assert.equal(progress.totalStars(), 3);
  assert.equal(storage.data.get("meiro.totalStars"), "3");
  assert.deepEqual(storage.written, ["meiro.totalStars"]);

  // 移行したあとは、⭐が増えても累計はそのまま。開き直しても保存された値を読む。
  progress.markCleared("level-04");
  assert.equal(progress.totalStars(), 3);
  const reopened = await open();
  assert.equal(reopened.clearedCount(), 4);
  assert.equal(reopened.totalStars(), 3);
});

test("totalStars: ⭐も累計も無い初回は 0 を書き込む", async () => {
  const { storage, progress } = await openWith();
  assert.equal(progress.totalStars(), 0);
  assert.equal(storage.data.get("meiro.totalStars"), "0");
});

test("totalStars: キーがあれば⭐の件数は見ない／書き換えない（再クリアぶんの累計を守る）", async () => {
  const { storage, progress } = await openWith({
    "meiro.stars": '["level-01"]',
    "meiro.totalStars": "7",
  });
  assert.equal(progress.totalStars(), 7);
  assert.deepEqual(storage.written, []);
  assert.equal(storage.data.get("meiro.totalStars"), "7");
});

test("totalStars: 壊れた値は 0、小数は切り捨て（⭐は 5 つあっても、そこからは数え直さない）", async () => {
  const table: [raw: string, expected: number][] = [
    ["0", 0],
    ["12", 12],
    ["12.9", 12],
    ["-1", 0],
    ["abc", 0],
    ["Infinity", 0],
    ["NaN", 0],
    ["", 0],
  ];
  for (const [raw, expected] of table) {
    const { storage, progress } = await openWith({
      "meiro.stars": '["a","b","c","d","e"]',
      "meiro.totalStars": raw,
    });
    assert.equal(progress.totalStars(), expected, `値 ${JSON.stringify(raw)}`);
    assert.deepEqual(storage.written, [], `値 ${JSON.stringify(raw)}`);
  }
});

test("totalStars: 読めない環境（getItem が例外）でも 0 で遊べる", async () => {
  const { storage, progress } = await openWith({ "meiro.totalStars": "9" });
  storage.failGet = true;
  assert.equal(progress.totalStars(), 0);
  assert.equal(progress.clearedCount(), 0);
  assert.equal(progress.hasCelebratedAll(), false);
});

test("bumpTotalStars: クリアのたび +1（再クリアも +1）して、meiro.totalStars に数値の文字列で保存する", async () => {
  const { storage, progress } = await openWith();
  assert.equal(progress.bumpTotalStars(), 1);
  assert.equal(storage.data.get("meiro.totalStars"), "1");
  assert.equal(progress.bumpTotalStars(), 2);
  assert.equal(progress.markCleared("level-01"), true);
  assert.equal(progress.markCleared("level-01"), false); // バッジは増えない
  assert.equal(progress.bumpTotalStars(), 3); // 累計は再クリアでも増える
  assert.equal(storage.data.get("meiro.totalStars"), "3");
  assert.equal(progress.totalStars(), 3);
  assert.equal((await open()).totalStars(), 3);
});

test("bumpTotalStars: 先に読むので、キーが無い初回は移行（⭐の件数）に +1 になる／壊れた値は 0 から数え直す", async () => {
  const legacy = await openWith({ "meiro.stars": '["level-01","level-02"]' });
  assert.equal(legacy.progress.bumpTotalStars(), 3);
  assert.equal(legacy.storage.data.get("meiro.totalStars"), "3");

  const broken = await openWith({ "meiro.totalStars": "abc" });
  assert.equal(broken.progress.bumpTotalStars(), 1);
  assert.equal(broken.storage.data.get("meiro.totalStars"), "1");
});

test("bumpTotalStars: 累計を先に積む。⭐を先に付けると、初回の移行で今回のクリアを二重に数える（PlayScreen の順序の理由）", async () => {
  // 累計の機能が入る前に遊んでいた端末: ⭐が 2 つ、meiro.totalStars は無い。ここで level-03 をクリアする。
  const legacy = { "meiro.stars": '["level-01","level-02"]' };

  const right = await openWith(legacy);
  right.progress.bumpTotalStars(); // 先に累計: 移行 2 + 今回 1
  right.progress.markCleared("level-03");
  assert.equal(right.progress.totalStars(), 3);
  assert.equal(right.progress.clearedCount(), 3);

  const wrong = await openWith(legacy);
  wrong.progress.markCleared("level-03"); // 先に⭐: 移行が 3 件を数えてしまう
  wrong.progress.bumpTotalStars();
  assert.equal(
    wrong.progress.totalStars(),
    4,
    "今回のクリアが二重に数えられる",
  );
});

test("bumpTotalStars: 書けなくても累計は進み、例外にならない（遊びは壊さない）", async () => {
  const { storage, progress } = await openWith({ "meiro.totalStars": "4" });
  storage.failSet = true;
  assert.equal(progress.bumpTotalStars(), 5);
  assert.equal(progress.totalStars(), 5);
  assert.equal(storage.data.get("meiro.totalStars"), "4", "保存はされていない");
  assert.equal(progress.markCleared("level-01"), true, "⭐も書けなくても付く");
  assert.equal(progress.isCleared("level-01"), true);
  assert.equal(storage.data.has("meiro.stars"), false, "保存はされていない");
});

// ── 祝福フラグ（meiro.celebratedAll）──────────────────────────

test('祝福フラグ: meiro.celebratedAll は "1" のときだけ祝福済み。false にするとキーを消す', async () => {
  const { storage, progress } = await openWith();
  assert.equal(progress.hasCelebratedAll(), false);
  progress.setCelebratedAll(true);
  assert.equal(storage.data.get("meiro.celebratedAll"), "1");
  assert.equal(progress.hasCelebratedAll(), true);
  assert.equal((await open()).hasCelebratedAll(), true);
  progress.setCelebratedAll(false);
  assert.equal(storage.data.has("meiro.celebratedAll"), false);
  assert.equal(progress.hasCelebratedAll(), false);

  for (const raw of ["true", "0", "", "yes", " 1"]) {
    const other = await openWith({ "meiro.celebratedAll": raw });
    assert.equal(
      other.progress.hasCelebratedAll(),
      false,
      `値 ${JSON.stringify(raw)}`,
    );
  }
});

// ── リセット ─────────────────────────────────────────────────

test("resetProgress: ⭐と祝福フラグを消し、meiro.totalStars は消さない（街の成長を巻き戻さない）", async () => {
  const { storage, progress } = await openWith({
    "meiro.stars": '["level-01","level-02"]',
    "meiro.celebratedAll": "1",
    "meiro.totalStars": "8",
  });
  assert.equal(progress.clearedCount(), 2);
  assert.equal(progress.hasCelebratedAll(), true);

  progress.resetProgress();

  assert.equal(progress.clearedCount(), 0);
  assert.equal(progress.isCleared("level-01"), false);
  assert.equal(progress.hasCelebratedAll(), false);
  assert.equal(progress.totalStars(), 8);
  assert.deepEqual(storage.contents(), { "meiro.totalStars": "8" });
  // 消したのはこの 2 つだけ。累計のキーには触っていない（読み書き・削除のどれでも）。
  assert.deepEqual(sorted(storage.removed), [
    "meiro.celebratedAll",
    "meiro.stars",
  ]);
  assert.equal(storage.written.includes("meiro.totalStars"), false);
});

test("resetProgress: 開き直しても、⭐は空・累計は残る。リセット後にまた⭐が付く", async () => {
  const { progress } = await openWith({
    "meiro.stars": '["level-01"]',
    "meiro.totalStars": "5",
  });
  progress.resetProgress();
  const reopened = await open();
  assert.equal(reopened.clearedCount(), 0);
  assert.equal(reopened.totalStars(), 5);
  assert.equal(
    reopened.markCleared("level-01"),
    true,
    "リセットしたので、また新しい⭐",
  );
  assert.equal(reopened.bumpTotalStars(), 6);
});

test("resetProgress: 消せなくても例外にならず、この起動の間は⭐が空になる", async () => {
  const { storage, progress } = await openWith({
    "meiro.stars": '["level-01"]',
    "meiro.celebratedAll": "1",
  });
  assert.equal(progress.clearedCount(), 1);
  storage.failRemove = true;
  assert.doesNotThrow(() => progress.resetProgress());
  assert.equal(progress.clearedCount(), 0);
  assert.equal(progress.hasCelebratedAll(), false);
});

// ── 保存先が使えないとき ─────────────────────────────────────

test("native（Platform.OS が web 以外）: localStorage には一切触らず、この起動の間だけ覚える", async () => {
  Platform.OS = "ios";
  const { storage, progress } = await openWith({
    "meiro.stars": '["level-01"]',
    "meiro.totalStars": "9",
  });
  assert.equal(progress.clearedCount(), 0, "保存済みの⭐は読まない");
  assert.equal(progress.markCleared("level-02"), true);
  assert.equal(progress.markCleared("level-02"), false);
  assert.equal(progress.isCleared("level-02"), true);
  assert.equal(progress.totalStars(), 0, "累計は 0 起点のセッション内カウント");
  assert.equal(progress.bumpTotalStars(), 1);
  assert.equal(progress.bumpTotalStars(), 2);
  progress.setCelebratedAll(true);
  assert.equal(progress.hasCelebratedAll(), true);
  progress.resetProgress();
  assert.equal(progress.clearedCount(), 0);
  assert.equal(progress.totalStars(), 2, "リセットしても累計は残る");
  assert.deepEqual(storage.read, []);
  assert.deepEqual(storage.written, []);
  assert.deepEqual(storage.removed, []);
});

test("web でも localStorage が無い・取り出せない環境は、落ちずにこの起動の間だけ覚える", async () => {
  removeLocalStorage();
  const none = await open();
  assert.equal(none.markCleared("level-01"), true);
  assert.equal(none.bumpTotalStars(), 1);
  assert.equal(none.totalStars(), 1);

  installThrowingLocalStorage(); // プライベートブラウズ・サンドボックス化された iframe など
  const blocked = await open();
  assert.equal(blocked.clearedCount(), 0);
  assert.equal(blocked.markCleared("level-01"), true);
  assert.equal(blocked.hasCelebratedAll(), false);
  assert.doesNotThrow(() => blocked.setCelebratedAll(true));
  assert.equal(blocked.bumpTotalStars(), 1);
  assert.doesNotThrow(() => blocked.resetProgress());
});
