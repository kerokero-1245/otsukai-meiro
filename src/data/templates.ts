// むずかしさテンプレートの読み込み口。DESIGN.md §7 のとおり、レベルえらびの
// 5枚のカードは「固定レベル」ではなく「むずかしさテンプレート」で持つ（templates.json）。
// カードを選ぶたびに、テンプレートから迷路(Level)をその場でランダム生成する（src/game/generate.ts）。

import rawTemplates from './templates.json';
import { Template } from '../types';

// JSON の推論型は緩いので Template[] として扱う。
export const TEMPLATES: Template[] = rawTemplates as unknown as Template[];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

// 次のテンプレートのid（並び順）。最後なら undefined。
export function getNextTemplateId(id: string): string | undefined {
  const i = TEMPLATES.findIndex((t) => t.id === id);
  if (i < 0 || i >= TEMPLATES.length - 1) return undefined;
  return TEMPLATES[i + 1].id;
}