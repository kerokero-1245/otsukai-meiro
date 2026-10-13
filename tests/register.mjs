/**
 * `node --test` が src/ の TypeScript を読めるようにする準備（`--import ./tests/register.mjs`）。
 *
 * 新しい依存は入れない。入っている `typescript` だけで、Node が自力では読めない次の 4 つを埋める。
 *  1) .ts / .tsx の変換 … 型だけの import（`import { Coord } from "../types"`）は `import type` ではないので、
 *     Node の型除去（strip-only）だと「types に Coord という export が無い」で落ちる。`ts.transpileModule` は
 *     値として使われない import を落とすので、アプリ本体（Expo / Metro）と同じ書き方のまま読める。
 *  2) 拡張子なしの相対 import（`"./maze"`）… bundler 解決向けに書かれているので、実在するファイルへ補う。
 *  3) JSON の import（`import raw from "./templates.json"`）… import 属性（with { type: "json" }）無しで読む。
 *  4) Node では読めないもの … `react-native`・`expo-*` は tests/stubs/ の差し替えへ、画像・音声の
 *     `require("../assets/x.svg")` は「ファイルの場所を示す文字列」へ置き換える（Metro が web で返すのと同じ形）。
 *
 * 検査するのは react-native に依存しない純粋なロジックと保存の規則。画面（描画）は import できることだけを
 * tests/loader.test.ts で確かめ、見た目は検査しない。
 */
import { registerHooks } from "node:module";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STUBS = path.join(ROOT, "tests", "stubs");
const NODE_MODULES = `${path.sep}node_modules${path.sep}`;

// 失敗したテストのスタックを、変換後ではなく元の .ts の行番号で出す。
process.setSourceMapsEnabled(true);

const SOURCE_EXT = /\.tsx?$/;
const ASSET_EXT = /\.(?:svg|png|jpe?g|gif|webp|m4a|mp3|wav)$/;
// 拡張子なしの import に補う候補（この順に探す）。
const SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function isFile(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

// このリポジトリのファイルだけを変換の対象にする（node_modules の中の CommonJS などには触れない）。
// ただし共有パッケージ piyo-assets は .ts のまま配られ、Node は node_modules の中の .ts の型を除去しない
// （ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING）ので、このパッケージの中だけは変換する。
const SHARED =
  path.join(ROOT, "node_modules", "@kerokero-1245", "piyo-assets") + path.sep;
function inProject(file) {
  if (file.startsWith(SHARED)) return true;
  return file.startsWith(ROOT + path.sep) && !file.includes(NODE_MODULES);
}

// Node では読めない（または読ませたくない）パッケージ → tests/stubs/ の差し替えファイル。
function stubFile(specifier) {
  const isExpo = specifier === "expo" || specifier.startsWith("expo-");
  if (specifier !== "react-native" && !isExpo) return null;
  const file = path.join(STUBS, `${specifier}.ts`);
  if (!isFile(file)) {
    throw new Error(
      `tests/stubs/${specifier}.ts がありません。Node では ${specifier} を読めないので、` +
        "読む側のテストと一緒に、使う分だけの差し替えを足してください。",
    );
  }
  return file;
}

const TRANSPILE_OPTIONS = {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX, // tsconfig（expo/tsconfig.base）の "react-jsx" と同じ
  inlineSourceMap: true,
  inlineSources: true,
};

// 同じファイルを ?query 違いで何度も読み直す（tests/helpers/importFresh.ts）ので、変換の結果は覚えておく。
const transpiled = new Map();

function transpile(file) {
  let output = transpiled.get(file);
  if (output === undefined) {
    output = transpileUncached(file);
    transpiled.set(file, output);
  }
  return output;
}

function transpileUncached(file) {
  const result = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: TRANSPILE_OPTIONS,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (d) => d.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length > 0) {
    throw new Error(
      `${path.relative(ROOT, file)} を変換できません:\n` +
        ts.formatDiagnostics(errors, {
          getCanonicalFileName: (name) => name,
          getCurrentDirectory: () => ROOT,
          getNewLine: () => "\n",
        }),
    );
  }
  // ESM には require が無い。画像・音声の require("../assets/x.svg") を使うモジュールにだけ足す
  // （1 行目に同居させて、ソースマップの行番号をずらさない）。
  return /\brequire\(/.test(result.outputText)
    ? 'import { createRequire as __createRequire } from "node:module"; ' +
        "const require = __createRequire(import.meta.url); " +
        result.outputText
    : result.outputText;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const stub = stubFile(specifier);
    if (stub) return { url: pathToFileURL(stub).href, shortCircuit: true };

    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    if (relative && context.parentURL?.startsWith("file:")) {
      const target = path.resolve(
        path.dirname(fileURLToPath(context.parentURL)),
        specifier,
      );
      if (!isFile(target)) {
        for (const suffix of SUFFIXES) {
          if (isFile(target + suffix)) {
            return {
              url: pathToFileURL(target + suffix).href,
              shortCircuit: true,
            };
          }
        }
      }
    }
    return nextResolve(specifier, context);
  },

  load(url, context, nextLoad) {
    if (!url.startsWith("file:")) return nextLoad(url, context);
    const file = fileURLToPath(url); // ?query は落ちる（テストが「読み直し」に使う）
    if (!inProject(file)) return nextLoad(url, context);

    if (SOURCE_EXT.test(file)) {
      return { format: "module", source: transpile(file), shortCircuit: true };
    }
    if (file.endsWith(".json")) {
      const value = JSON.parse(readFileSync(file, "utf8"));
      return {
        format: "module",
        source: `export default ${JSON.stringify(value)};`,
        shortCircuit: true,
      };
    }
    if (ASSET_EXT.test(file)) {
      const place = "/" + path.relative(ROOT, file).split(path.sep).join("/");
      return {
        format: "commonjs",
        source: `module.exports = ${JSON.stringify(place)};`,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});
