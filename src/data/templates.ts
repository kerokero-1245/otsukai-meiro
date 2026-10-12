// むずかしさテンプレートの読み込み口。DESIGN.md §7 のとおり、レベルえらびの
// 5枚のカードは「固定レベル」ではなく「むずかしさテンプレート」で持つ（templates.json）。
// カードを選ぶたびに、テンプレートから迷路(Level)をその場でランダム生成する（src/game/generate.ts）。

import rawTemplates from "./templates.json";
import { Template } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min;
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// 読み込んだ JSON を検査して Template[] にする（型を黙って付けない）。壊れた欄があれば、どの何件目の何が
// 悪いかを書いて例外にする（同梱の静的データなので、テスト（全件）と起動時に気づく）。
// 不変条件 minSteps <= (cols-1)+(rows-1) は、迷路の生成の最終保証（対角コーナー）が必ず有効になる条件（types.ts）。
export function parseTemplates(raw: unknown): Template[] {
  if (!Array.isArray(raw)) {
    throw new Error(
      "templates.json は、テンプレートの配列でなければなりません",
    );
  }
  const seen = new Set<string>();
  return raw.map((item: unknown, index): Template => {
    const where = `templates.json の ${index + 1} 件目`;
    if (!isRecord(item))
      throw new Error(`${where}: オブジェクトではありません`);
    const { id, label, cols, rows, obstacleMin, obstacleMax, minSteps } = item;
    if (!isText(id)) throw new Error(`${where}: id が文字列ではありません`);
    if (seen.has(id)) throw new Error(`${where}: id「${id}」が重なっています`);
    seen.add(id);
    if (!isText(label))
      throw new Error(`${where}: label が文字列ではありません`);
    if (!isInt(cols, 1))
      throw new Error(`${where}: cols が 1 以上の整数ではありません`);
    if (!isInt(rows, 1))
      throw new Error(`${where}: rows が 1 以上の整数ではありません`);
    if (!isInt(obstacleMin, 0)) {
      throw new Error(`${where}: obstacleMin が 0 以上の整数ではありません`);
    }
    if (!isInt(obstacleMax, 0)) {
      throw new Error(`${where}: obstacleMax が 0 以上の整数ではありません`);
    }
    if (obstacleMin > obstacleMax) {
      throw new Error(`${where}: obstacleMin が obstacleMax より大きい`);
    }
    if (obstacleMax > cols * rows - 2) {
      throw new Error(
        `${where}: obstacleMax が、スタートとゴールの 2 マスを空けた残りのマス数を超えています`,
      );
    }
    if (!isInt(minSteps, 1)) {
      throw new Error(`${where}: minSteps が 1 以上の整数ではありません`);
    }
    if (minSteps > cols - 1 + (rows - 1)) {
      throw new Error(
        `${where}: minSteps が対角コーナーの最短手数 (cols-1)+(rows-1) を超えています`,
      );
    }
    return { id, label, cols, rows, obstacleMin, obstacleMax, minSteps };
  });
}

export const TEMPLATES: Template[] = parseTemplates(rawTemplates);

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

// 次のテンプレートのid（並び順）。最後なら undefined。
export function getNextTemplateId(id: string): string | undefined {
  const i = TEMPLATES.findIndex((t) => t.id === id);
  if (i < 0 || i >= TEMPLATES.length - 1) return undefined;
  return TEMPLATES[i + 1].id;
}
