// モジュールの中に let のキャッシュを持つもの（progress.ts・settings.ts）を、読み込み直した別の実体として取り出す。
// 「ページを開き直した」状態の再現に使う。URL の ?query が違うと Node は別のモジュールとして読み込む。
// file は src/ からの相対（例: "progress.ts"）。型は呼び出し側が `typeof import("../../src/progress")` で渡す。

let count = 0;

export async function importFresh<T>(file: string): Promise<T> {
  const url = new URL(`../../src/${file}`, import.meta.url);
  url.searchParams.set("fresh", String(++count));
  const loaded: unknown = await import(url.href);
  return loaded as T;
}
