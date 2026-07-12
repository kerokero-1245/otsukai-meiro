// アプリ内で共有するデータ型。docs/DESIGN.md §7 のデータモデルに対応。

// 盤面の座標。x=列（左→右）, y=行（上→下）, どちらも0起点。
export interface Coord {
  x: number;
  y: number;
}

// 移動の向き。▲=up(y-1) / ▼=down(y+1) / ◀=left(x-1) / ▶=right(x+1)。
export type Direction = 'up' | 'down' | 'left' | 'right';

// めいろの遊びモード。MVP（フェーズ1）は 'tap' のみ。'queue' はフェーズ4。
export type LevelMode = 'tap' | 'queue';

// レベル定義（アプリ同梱の静的JSON levels.json の1件）。
export interface Level {
  id: string;
  title: string; // 表示・音声読み上げ用
  cols: number; // 横のマス数
  rows: number; // 縦のマス数
  start: Coord; // アバターの初期位置
  goal: Coord; // ゴールのマス
  obstacles: Coord[]; // 通れないマス（無ければ空配列）
  mode: LevelMode; // 'tap' | 'queue'
  maxSteps: number; // ②で並べられる最大手数（①では無視）
  goalImage: string | null; // 差し替え後の写真パス。null → 既定イラスト（goalEmoji）
  goalVoice: string | null; // 差し替え後の音声パス。null → 既定SE

  // --- MVP拡張（プレースホルダ用。外部素材ゼロで成立させるため絵文字で代用）---
  // goalImage が null のとき既定イラストとして表示する絵文字。
  goalEmoji: string; // 例: '🍎' '🏠' '🌳' '🍰'
  // アバター（言われた順にしか歩けないおともだち）のプレースホルダ絵文字。
  avatarEmoji: string;
}

// 画面ルート（App.tsx の簡易ステートルーターで使用）。
// react-navigation を使わず、文字ヘッダの無い全画面遷移にするための最小ルーター。
export type Route =
  | { name: 'title' }
  | { name: 'select' }
  | { name: 'play'; levelId: string }
  | { name: 'otona' };