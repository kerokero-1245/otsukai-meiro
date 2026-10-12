/**
 * 端末内ストレージ IndexedDB の最小ラッパー（src/personal/idb.ts）。
 *
 * 写真・おじの声の保存の土台。4 歳が使うので「壊れないこと」が最優先: indexedDB が無い・open が失敗する・固まる・
 * ブロックされる環境でも、どの関数も例外を投げず、null・[]・false に丸める。書き込みの成否は「トランザクションが commit
 * したか」で決める（リクエストの onsuccess は commit の前に鳴る）。1 回だけ解決する旗（settled / done）を
 * idb.ts の中の 3 か所が別々に持っている（M-23）。まとめる前に、成功・失敗・タイムアウトのどれが先でも最初の 1 つだけが採用されることを固定する。
 * 偽の indexedDB で呼び出しを組み立てる（実際のブラウザでの保存は、写真の追加・録音を手で確かめる）。
 */
import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { importFresh } from "./helpers/importFresh";
import { Platform } from "./stubs/react-native";

type Idb = typeof import("../src/personal/idb");
const open = () => importFresh<Idb>("personal/idb.ts");

type Fn = (() => void) | null;
class Req<T = unknown> {
  result: T = undefined as T;
  error: unknown = null;
  onsuccess: Fn = null;
  onerror: Fn = null;
  onupgradeneeded: Fn = null;
  onblocked: Fn = null;
}

/** open の動かし方。 */
type OpenMode =
  | "success"
  | "error"
  | "blocked"
  | "throw"
  | "hang"
  | "successThenError" // onsuccess のあとに onerror・onblocked も鳴る（最初の 1 つだけが採用される）
  | "errorThenSuccess"; // onerror のあとに onsuccess が鳴る
/** 読み書きの動かし方。 */
type TxMode =
  | "ok"
  | "txError"
  | "abort"
  | "reqError"
  | "throw"
  | "readSuccessThenError" // 読み取り: onsuccess のあとに onerror も鳴る
  | "readErrorThenSuccess" // 読み取り: onerror のあとに onsuccess が鳴る
  | "completeThenAbort" // 書き込み: oncomplete のあとに onabort も鳴る
  | "abortThenComplete"; // 書き込み: onabort のあとに oncomplete が鳴る

interface World {
  openMode: OpenMode;
  txMode: TxMode;
  /** 古い版からの作り直し（onupgradeneeded を呼ぶ）か。 */
  upgrade: boolean;
  openCalls: { name: string; version?: number }[];
  created: { name: string; keyPath?: string }[];
  data: Map<string, Map<unknown, unknown>>;
  db: FakeDb | null;
  /** 最後に開いた DB の onversionchange を起こす。 */
  versionChange: () => void;
}

let world: World;

class FakeStore {
  constructor(private readonly name: string) {}
  private rows() {
    let m = world.data.get(this.name);
    if (!m) world.data.set(this.name, (m = new Map()));
    return m;
  }
  private request<T>(run: () => T, tx: FakeTx, write: boolean): Req<T> {
    const req = new Req<T>();
    queueMicrotask(() => {
      const mode = world.txMode;
      if (mode === "reqError") {
        req.onerror?.();
        tx.onerror?.();
        return;
      }
      if (mode === "readErrorThenSuccess" && !write) {
        req.onerror?.();
        req.result = run();
        req.onsuccess?.();
        return;
      }
      req.result = run();
      req.onsuccess?.();
      if (mode === "readSuccessThenError" && !write) {
        req.onerror?.();
        tx.onerror?.();
      }
      if (write) {
        if (mode === "abort") tx.onabort?.();
        else if (mode === "txError") tx.onerror?.();
        else if (mode === "completeThenAbort") {
          tx.oncomplete?.();
          tx.onabort?.();
        } else if (mode === "abortThenComplete") {
          tx.onabort?.();
          tx.oncomplete?.();
        } else tx.oncomplete?.();
      }
    });
    return req;
  }
  tx!: FakeTx;
  put(value: unknown) {
    return this.request(
      () => {
        const key =
          (value as { id?: unknown; slot?: unknown }).id ??
          (value as { slot?: unknown }).slot;
        this.rows().set(key, value);
        return key;
      },
      this.tx,
      true,
    );
  }
  get(key: unknown) {
    return this.request(() => this.rows().get(key), this.tx, false);
  }
  getAll() {
    return this.request(() => [...this.rows().values()], this.tx, false);
  }
  delete(key: unknown) {
    return this.request(() => this.rows().delete(key), this.tx, true);
  }
  clear() {
    return this.request(() => this.rows().clear(), this.tx, true);
  }
}
class FakeTx {
  oncomplete: Fn = null;
  onerror: Fn = null;
  onabort: Fn = null;
  objectStore(name: string) {
    const s = new FakeStore(name);
    s.tx = this;
    return s;
  }
}
class FakeDb {
  readonly names = new Set<string>();
  onversionchange: Fn = null;
  closed = 0;
  objectStoreNames = { contains: (n: string) => this.names.has(n) };
  createObjectStore(name: string, options?: { keyPath?: string }) {
    this.names.add(name);
    world.created.push({ name, keyPath: options?.keyPath });
    return new FakeStore(name);
  }
  transaction(names: string | string[]) {
    void names;
    if (world.txMode === "throw") throw new Error("transaction が使えない");
    return new FakeTx();
  }
  close() {
    this.closed++;
  }
}

function installFakeIndexedDb() {
  const factory = {
    open(name: string, version?: number) {
      world.openCalls.push({ name, version });
      if (world.openMode === "throw") throw new Error("open が使えない");
      const req = new Req<FakeDb>();
      const db = new FakeDb();
      world.db = db;
      req.result = db;
      world.versionChange = () => db.onversionchange?.();
      if (world.openMode === "hang") return req;
      queueMicrotask(() => {
        if (world.openMode === "error") return void req.onerror?.();
        if (world.openMode === "blocked") return void req.onblocked?.();
        if (world.openMode === "errorThenSuccess") {
          req.onerror?.();
          req.onsuccess?.();
          return;
        }
        if (world.upgrade) req.onupgradeneeded?.();
        req.onsuccess?.();
        if (world.openMode === "successThenError") {
          req.onerror?.();
          req.onblocked?.();
        }
      });
      return req;
    },
  };
  Object.defineProperty(globalThis, "indexedDB", {
    value: factory,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  Platform.OS = "web";
  world = {
    openMode: "success",
    txMode: "ok",
    upgrade: true,
    openCalls: [],
    created: [],
    data: new Map(),
    db: null,
    versionChange: () => {},
  };
  installFakeIndexedDb();
});
afterEach(() => {
  mock.timers.reset();
  Platform.OS = "web";
  Reflect.deleteProperty(globalThis, "indexedDB");
});

test("開ける: DB 名 meiro-personal・版 1 で開き、初回に写真（keyPath id）と録音（keyPath slot）の 2 つを作る", async () => {
  const idb = await open();
  assert.equal(idb.hasIndexedDb(), true);
  assert.equal(await idb.probeStorage(), true);
  assert.deepEqual(world.openCalls, [{ name: "meiro-personal", version: 1 }]);
  assert.deepEqual(world.created, [
    { name: "photos", keyPath: "id" },
    { name: "voices", keyPath: "slot" },
  ]);
  assert.equal(idb.DB_NAME, "meiro-personal");
  assert.equal(idb.STORE_PHOTOS, "photos");
  assert.equal(idb.STORE_VOICES, "voices");
  // 2 回目以降は、開いた接続を使い回す
  await idb.probeStorage();
  await idb.idbGetAll("photos");
  assert.equal(world.openCalls.length, 1);
});

test("書く・読む・消す: put した値が getAll・get で読め、delete・clear で消える。成否は commit で true", async () => {
  const idb = await open();
  assert.equal(await idb.idbPut("photos", { id: "a", n: 1 }), true);
  assert.equal(await idb.idbPut("photos", { id: "b", n: 2 }), true);
  assert.deepEqual(await idb.idbGetAll("photos"), [
    { id: "a", n: 1 },
    { id: "b", n: 2 },
  ]);
  assert.equal(await idb.idbDelete("photos", "a"), true);
  assert.deepEqual(await idb.idbGetAll("photos"), [{ id: "b", n: 2 }]);
  assert.equal(await idb.idbPut("voices", { slot: "tsuita", n: 3 }), true);
  assert.deepEqual(await idb.idbGetAll("voices"), [{ slot: "tsuita", n: 3 }]);
  assert.equal(await idb.idbClear("photos"), true);
  assert.deepEqual(await idb.idbGetAll("photos"), []);
});

test("open が失敗・ブロック・例外・固まる（4 秒）: 使えない（false）と記録し、以後は開きにいかず、読み書きは false・[]・null", async () => {
  for (const mode of ["error", "blocked", "throw"] as const) {
    world.openMode = mode;
    world.openCalls = [];
    const idb = await open();
    assert.equal(await idb.probeStorage(), false, mode);
    assert.equal(await idb.idbPut("photos", { id: "a" }), false, mode);
    assert.deepEqual(await idb.idbGetAll("photos"), [], mode);
    assert.equal(await idb.idbDelete("photos", "a"), false, mode);
    assert.equal(await idb.idbClear("photos"), false, mode);
    assert.equal(
      world.openCalls.length,
      1,
      `${mode}: 失敗のあとは開き直さない`,
    );
  }

  mock.timers.enable({ apis: ["setTimeout"] });
  world.openMode = "hang";
  world.openCalls = [];
  const idb = await open();
  const probe = idb.probeStorage();
  mock.timers.tick(3999);
  let settled = false;
  void probe.then(() => (settled = true));
  await Promise.resolve();
  assert.equal(settled, false, "4 秒より前は待つ");
  mock.timers.tick(1);
  assert.equal(await probe, false, "4 秒で諦める");
  assert.equal(await idb.idbPut("photos", { id: "a" }), false);
  assert.equal(world.openCalls.length, 1);
});

test("open は、成功・失敗・ブロック・タイムアウトのうち最初の 1 つだけを採用する（あとから鳴っても無視）", async () => {
  // 成功のあとに onerror・onblocked が鳴っても、使える
  world.openMode = "successThenError";
  let idb = await open();
  assert.equal(await idb.probeStorage(), true);
  assert.equal(await idb.idbPut("photos", { id: "a" }), true);

  // 失敗のあとに onsuccess が鳴っても、使えないまま（以後は開き直さない）
  world.openMode = "errorThenSuccess";
  world.openCalls = [];
  idb = await open();
  assert.equal(await idb.probeStorage(), false);
  assert.equal(await idb.idbPut("photos", { id: "a" }), false);
  assert.equal(world.openCalls.length, 1);

  // 成功のあとの 4 秒（タイムアウト）で、使えるのに「使えない」へ変わらない
  mock.timers.enable({ apis: ["setTimeout"] });
  world.openMode = "success";
  idb = await open();
  assert.equal(await idb.probeStorage(), true);
  mock.timers.tick(5000);
  assert.equal(await idb.probeStorage(), true);
  assert.equal(await idb.idbPut("photos", { id: "b" }), true);
});

test("読み取りの失敗（トランザクションを作れない・リクエストのエラー）は null / []。成功と失敗の両方が来たら最初の 1 つ", async () => {
  const idb = await open();
  assert.equal(await idb.idbPut("photos", { id: "a" }), true);
  world.txMode = "throw";
  assert.deepEqual(await idb.idbGetAll("photos"), []);
  world.txMode = "reqError";
  assert.deepEqual(await idb.idbGetAll("photos"), []);
  // 成功のあとにエラーが鳴っても、読めた値を返す
  world.txMode = "readSuccessThenError";
  assert.deepEqual(await idb.idbGetAll("photos"), [{ id: "a" }]);
  // エラーのあとに成功が鳴っても、null / [] のまま
  world.txMode = "readErrorThenSuccess";
  assert.deepEqual(await idb.idbGetAll("photos"), []);
});

test("書き込みの失敗（abort・トランザクションのエラー・リクエストのエラー・トランザクションを作れない）は false", async () => {
  const idb = await open();
  for (const mode of ["abort", "txError", "reqError", "throw"] as const) {
    world.txMode = mode;
    assert.equal(await idb.idbPut("photos", { id: "a" }), false, mode);
    assert.equal(await idb.idbDelete("photos", "a"), false, mode);
    assert.equal(await idb.idbClear("photos"), false, mode);
  }
  world.txMode = "ok";
  assert.equal(
    await idb.idbPut("photos", { id: "a" }),
    true,
    "もとに戻せば書ける",
  );
});

test("書き込みの成否は commit（oncomplete）で決める。リクエストの成功だけでは true にしない（abort で後から落ちる）。complete と abort の両方が来たら最初の 1 つ", async () => {
  const idb = await open();
  world.txMode = "abort"; // リクエストは onsuccess を鳴らすが、トランザクションは abort で終わる
  assert.equal(await idb.idbPut("voices", { slot: "tsuita" }), false);
  world.txMode = "completeThenAbort";
  assert.equal(await idb.idbPut("voices", { slot: "tsuita" }), true);
  assert.equal(await idb.idbDelete("voices", "tsuita"), true);
  assert.equal(await idb.idbClear("voices"), true);
  world.txMode = "abortThenComplete";
  assert.equal(await idb.idbPut("voices", { slot: "tsuita" }), false);
  assert.equal(await idb.idbDelete("voices", "tsuita"), false);
  assert.equal(await idb.idbClear("voices"), false);
});

test("別のタブが新しい版で開いたら、握っている接続を閉じ、次の読み書きでは開き直す", async () => {
  const idb = await open();
  assert.equal(await idb.probeStorage(), true);
  const first = world.db!;
  world.versionChange();
  assert.equal(first.closed, 1);
  assert.equal(await idb.idbPut("photos", { id: "a" }), true);
  assert.equal(world.openCalls.length, 2, "開き直した");
});

test("native（Platform.OS が web 以外）・indexedDB が無い・open が関数でない: 見えない（false）、読み書きは false・[]", async () => {
  Platform.OS = "android";
  let idb = await open();
  assert.equal(idb.hasIndexedDb(), false);
  assert.equal(await idb.probeStorage(), false);
  assert.equal(await idb.idbPut("photos", { id: "a" }), false);
  assert.deepEqual(await idb.idbGetAll("photos"), []);

  Platform.OS = "web";
  Reflect.deleteProperty(globalThis, "indexedDB");
  idb = await open();
  assert.equal(idb.hasIndexedDb(), false);
  assert.equal(await idb.probeStorage(), false);

  Object.defineProperty(globalThis, "indexedDB", {
    value: { open: "関数でない" },
    configurable: true,
    writable: true,
  });
  idb = await open();
  assert.equal(idb.hasIndexedDb(), false);
});

test("idbGetAll は、配列でない結果（null など）を [] にする", async () => {
  const idb = await open();
  await idb.probeStorage();
  world.data.set("photos", new Map());
  const proto = FakeStore.prototype;
  const original = proto.getAll;
  proto.getAll = function (this: FakeStore) {
    const req = new Req<unknown>();
    queueMicrotask(() => {
      req.result = null;
      req.onsuccess?.();
    });
    return req as never;
  };
  try {
    assert.deepEqual(await idb.idbGetAll("photos"), []);
  } finally {
    proto.getAll = original;
  }
});
