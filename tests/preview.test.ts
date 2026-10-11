/**
 * レベルえらびのカードの「ミニめいろ」の障害物（src/game/preview.ts の previewObstacles）。
 *
 * 見た目のヒントなので実際に遊ぶ迷路とは別。スタート(0,0)とゴール(cols-1,rows-1)は避け、
 * 残りのマス（行ごとに左から）の中から count 個を等間隔に選ぶ。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { previewObstacles } from "../src/game/preview";
import { TEMPLATES } from "../src/data/templates";

test("4×4・3 本（level-05）: 行ごとに数えた 14 マス（スタートとゴールを除く）から 3・7・10 番目", () => {
  // 候補（行ごと・左から）: 0:(1,0) 1:(2,0) 2:(3,0) 3:(0,1) 4:(1,1) 5:(2,1) 6:(3,1) 7:(0,2) 8:(1,2) 9:(2,2) 10:(3,2) 11:(0,3) 12:(1,3) 13:(2,3)
  // i 番目 = floor((i+1) × 14 / (3+1)) → 3, 7, 10
  assert.deepEqual(previewObstacles(4, 4, 3), [
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 3, y: 2 },
  ]);
});

test("各カード（templates.json の obstacleMax）のミニめいろの障害物（いまの見た目を固定）", () => {
  const byId = Object.fromEntries(
    TEMPLATES.map((t) => [
      t.id,
      previewObstacles(t.cols, t.rows, t.obstacleMax),
    ]),
  );
  assert.deepEqual(byId["level-01"], []); // 2×2・障害物なし
  // 3×2・1 本: 候補 4 マス (1,0) (2,0) (0,1) (1,1) の floor(1×4/2) = 2 番目
  assert.deepEqual(byId["level-02"], [{ x: 0, y: 1 }]);
  // 3×3・1 本: 候補 7 マス (1,0) (2,0) (0,1) (1,1) (2,1) (0,2) (1,2) の floor(7/2) = 3 番目
  assert.deepEqual(byId["level-03"], [{ x: 1, y: 1 }]);
  // 3×3・2 本: floor(7/3) = 2 番目 (0,1)、floor(14/3) = 4 番目 (2,1)
  assert.deepEqual(byId["level-04"], [
    { x: 0, y: 1 },
    { x: 2, y: 1 },
  ]);
  assert.deepEqual(byId["level-05"], previewObstacles(4, 4, 3));
});

test("0 本なら空、候補より多く頼んでも候補の数まで（スタートとゴールは数えない）", () => {
  assert.deepEqual(previewObstacles(3, 3, 0), []);
  assert.equal(previewObstacles(2, 2, 10).length, 2); // 2×2 の候補は (1,0) (0,1) の 2 マス
  assert.equal(previewObstacles(4, 4, 99).length, 14);
});

test("性質: スタート・ゴールを含まず、盤の中で、頼んだ数（候補が足りるとき）だけ返し、候補の数までなら重複しない", () => {
  for (let cols = 1; cols <= 5; cols++) {
    for (let rows = 1; rows <= 5; rows++) {
      for (let count = 0; count <= 6; count++) {
        const got = previewObstacles(cols, rows, count);
        const where = `${cols}×${rows} ${count}本`;
        // 候補 = スタートとゴールを除いたマス（1×1 はスタートとゴールが同じマス）
        const candidates = Math.max(
          0,
          cols * rows - (cols * rows === 1 ? 1 : 2),
        );
        assert.equal(got.length, Math.min(count, candidates), where);
        const seen = new Set<string>();
        for (const c of got) {
          assert.ok(
            c.x >= 0 && c.x < cols && c.y >= 0 && c.y < rows,
            `${where}: 盤の外 ${c.x},${c.y}`,
          );
          assert.ok(!(c.x === 0 && c.y === 0), `${where}: スタートに置いた`);
          assert.ok(
            !(c.x === cols - 1 && c.y === rows - 1),
            `${where}: ゴールに置いた`,
          );
          seen.add(`${c.x},${c.y}`);
        }
        // 等間隔に選ぶので、候補より多く頼まない限り（カードの obstacleMax は最大 3）同じマスを 2 度選ばない
        if (count <= candidates)
          assert.equal(seen.size, got.length, `${where}: 重複`);
      }
    }
  }
});
