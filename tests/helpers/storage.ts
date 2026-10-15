// localStorage の偽物。Node には localStorage が無いので、progress.ts・settings.ts が見る
// `globalThis.localStorage` の場所へ置く。本体は piyo-assets の testing/storage で、ここではこのアプリの
// テストが使う呼び名だけを足す（read・written・removed・contents・removeLocalStorage）。
import {
  FakeStorage as SharedFakeStorage,
  installLocalStorage as installShared,
} from "@kerokero-1245/piyo-assets/testing/storage";

export { installThrowingLocalStorage } from "@kerokero-1245/piyo-assets/testing/storage";

export class FakeStorage extends SharedFakeStorage {
  /** getItem が呼ばれたキー（呼ばれた順。読めなかった呼び出しも含む）。 */
  get read(): string[] {
    return this.log.flatMap((call) => (call.op === "get" ? [call.key] : []));
  }

  /** 書けたキー（呼ばれた順）。「このキーには触っていない」を確かめるのに使う。 */
  get written(): string[] {
    return this.succeeded().flatMap((call) =>
      call.op === "set" ? [call.key] : [],
    );
  }

  /** 消せたキー（呼ばれた順）。 */
  get removed(): string[] {
    return this.succeeded().flatMap((call) =>
      call.op === "remove" ? [call.key] : [],
    );
  }

  /** 保存されている中身を、キー順の普通のオブジェクトにして返す（deepEqual で比べやすくする）。 */
  contents(): Record<string, string> {
    return this.snapshot();
  }
}

/** globalThis.localStorage に偽物を置く。 */
export function installLocalStorage(storage: FakeStorage): void {
  installShared(storage);
}

/** localStorage が無い状態にする（localStorage は undefined。src/web.ts の webGlobal は null を返す）。 */
export function removeLocalStorage(): void {
  installShared(undefined);
}
