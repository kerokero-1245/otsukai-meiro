// localStorage の偽物。Node には localStorage が無いので、progress.ts・settings.ts が見る
// `globalThis.localStorage` の場所へ置く。中身・書き込みの記録・失敗のさせ方をテストから操作できる。

export class FakeStorage {
  readonly data = new Map<string, string>();
  /** getItem / setItem / removeItem が呼ばれたキー（呼ばれた順）。「このキーには触っていない」を確かめるのに使う。 */
  readonly read: string[] = [];
  readonly written: string[] = [];
  readonly removed: string[] = [];
  /** true にすると、その操作が例外を投げる（容量超過・プライベートブラウズなどの再現）。 */
  failGet = false;
  failSet = false;
  failRemove = false;

  constructor(initial: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initial)) {
      this.data.set(key, value);
    }
  }

  getItem(key: string): string | null {
    this.read.push(key);
    if (this.failGet) throw new Error("getItem: 読めません");
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failSet) throw new Error("setItem: 書けません");
    this.written.push(key);
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    if (this.failRemove) throw new Error("removeItem: 消せません");
    this.removed.push(key);
    this.data.delete(key);
  }

  /** 保存されている中身を、キー順の普通のオブジェクトにして返す（deepEqual で比べやすくする）。 */
  contents(): Record<string, string> {
    return Object.fromEntries(
      [...this.data].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  }
}

/** globalThis.localStorage に偽物を置く。 */
export function installLocalStorage(storage: FakeStorage): void {
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}

/** localStorage を取り出すこと自体が例外になる環境（サンドボックス化された iframe など）。 */
export function installThrowingLocalStorage(): void {
  Object.defineProperty(globalThis, "localStorage", {
    get() {
      throw new Error("SecurityError: localStorage にアクセスできません");
    },
    configurable: true,
  });
}

/** localStorage が無い状態（Node の既定）に戻す。 */
export function removeLocalStorage(): void {
  Reflect.deleteProperty(globalThis, "localStorage");
}
