// アプリ内で共有するデータ型。docs/DESIGN.md §7 のデータモデルに対応。

// 盤面の座標。x=列（左→右）, y=行（上→下）, どちらも0起点。
export interface Coord {
  x: number;
  y: number;
}

// 移動の向き。▲=up(y-1) / ▼=down(y+1) / ◀=left(x-1) / ▶=right(x+1)。
export type Direction = "up" | "down" | "left" | "right";

// めいろの遊びモード。MVP（フェーズ1）は 'tap' のみ。'queue' はフェーズ4。
export type LevelMode = "tap" | "queue";

// むずかしさテンプレート（アプリ同梱の静的JSON templates.json の1件 ＝ レベルえらびのカード1枚）。
// カードを選ぶたびに、このテンプレートから迷路(Level)を「その場で」ランダム生成する（DESIGN §7）。
// さんすうドリルのように、同じカードでも毎回ちがう迷路が出て何回も遊べる。
export interface Template {
  id: string; // 進捗(⭐)のキー。カードの並び順の識別子（例: 'level-01'）
  label: string; // カードの見出し（ひらがな。むずかしさが伝わる表現）
  cols: number; // 横のマス数
  rows: number; // 縦のマス数
  obstacleMin: number; // 生成時に置く障害物の最小数
  obstacleMax: number; // 生成時に置く障害物の最大数
  // 生成する迷路の最短手数の下限（近すぎるゴールを防ぐ）。
  // 不変条件: minSteps <= (cols-1)+(rows-1)（対角コーナーの最短手数）を必ず満たす。
  // これにより「対角コーナー・障害物ゼロ」の決定的フォールバックが常に有効になる。
  minSteps: number;
}

// レベル定義（テンプレートから生成される、その場かぎりの1つの迷路）。
// 移動ロジック(maze.ts)・盤面描画(MazeGrid)・プレイ画面はこの Level 型で動く（構造は不変）。
export interface Level {
  id: string; // 生成元テンプレートの id をそのまま持つ（進捗⭐のキー）
  title: string; // 表示・音声読み上げ用（生成元テンプレートの label）
  cols: number; // 横のマス数
  rows: number; // 縦のマス数
  start: Coord; // アバターの初期位置
  goal: Coord; // ゴールのマス
  obstacles: Coord[]; // 通れないマス（無ければ空配列）
  // あそびかた（①/②）は Level に持たせない。端末の設定（settings.ts）をプレイ画面が読んで
  // 描き分けるだけで、生成される迷路は①でも②でも同一（DESIGN §16.3）。
  maxSteps: number; // ②で並べられる最大手数（①では無視）
  goalImage: string | null; // 差し替え後の写真パス。null → 既定イラスト（goalEmoji）
  goalVoice: string | null; // 差し替え後の音声パス。null → 既定SE

  // --- MVP拡張（プレースホルダ用。外部素材ゼロで成立させるため絵文字で代用）---
  // goalImage が null のとき既定イラストとして表示する絵文字。生成のたびプールからランダムに選ぶ。
  goalEmoji: string; // 例: '🍎' '🏠' '🍰' '🍓' '🎈' '🍦'
  // アバター（言われた順にしか歩けないおともだち）のプレースホルダ絵文字。
  avatarEmoji: string;
}

// 画面ルート（App.tsx の簡易ステートルーターで使用）。
// react-navigation を使わず、文字ヘッダの無い全画面遷移にするための最小ルーター。
export type Route =
  | { name: "title" }
  | { name: "select" }
  | { name: "play"; templateId: string } // むずかしさテンプレートのid。画面側で迷路を生成する
  | { name: "ganbari" } // 全5レベルの⭐が揃ったときの「ぜんぶ できたね! がんばりカード」
  | { name: "otona" };
