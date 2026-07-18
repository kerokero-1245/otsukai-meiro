# おつかいめいろ

4歳の姪っ子のための知育アプリ。マス目の上でアバターを動かしてゴール（りんご・おうち）まで届ける、超やさしいプログラミング体験。プログラミング的思考（順序立て・試行錯誤）の下地を遊びとして届けることを狙う。絵本「ルビィのぼうけん」の延長、小学校プログラミング教育（2020年度〜必修）への接続を意識。

## 公開URL

**▶ https://kerokero-1245.github.io/otsukai-meiro/**

ブラウザで開いてそのまま遊べる。スマホなら「ホーム画面に追加」で全画面起動。
`main` に push すると GitHub Actions（[.github/workflows/deploy.yml](.github/workflows/deploy.yml)）が Web を書き出して自動デプロイする。

- 企画（厳選5案の比較）: [docs/IDEAS.md](docs/IDEAS.md)
- 設計（画面・データモデル・ロードマップ）: [docs/DESIGN.md](docs/DESIGN.md)

## 状態

**フェーズ1（タップで即1マス動く）実装済み・Webファースト。** タイトル → レベルえらび → プレイ → 祝福（ついたね!）まで遊べる。同梱レベル5個（2×2→3×3、障害物を段階的に導入）。おとなモード（写真・声の差し替え）はフェーズ2。

配布は **Webファースト**: Expo の web ビルドを URL で配布し、ブラウザで開いて「ホーム画面に追加」すれば全画面で遊べる。ネイティブアプリ（App Store 等）は同じコードから後日。詳細は DESIGN.md §0。

## 前提・方針

- 対象: 4歳（未就学・ひらがなは読み始め）。スマホ操作経験あり
- 既存キャラIP（アンパンマン等）は使わない — 姪っ子本人が主役になる設計
- 受け身の視聴ではなく「自分で操作して考える・作る」遊び
- 作り手（おじ/おば）は遠方在住 — 離れていても関われる要素を重視
- MVPはコア機能1つに絞る。まず姪っ子1人が喜べばOK、ストア公開は二の次
- 完全オフライン: バックエンド・アカウント・通信なし。データは端末内のみ
- 技術: Expo SDK 57 (React Native + TypeScript)、Node 20.20.0

## 動かし方

前提: **Node 20.20.0**（macOS 既定の v16 では Expo が動かない）。nvm なら `nvm use`（`.nvmrc` に 20.20.0）。

```sh
npm install          # 初回のみ
npm start            # Expo を起動 → ターミナルで w を押すと Web が開く
```

- `w` … ブラウザで開く（Webファースト。まずはこれ）
- `i` / `a` … iOS シミュレータ / Android エミュレータ（任意）
- 実機は Expo Go アプリで QR を読み取り（任意）

ショートカット: `npm run web`（`w` を押さず直接 Web 起動）。

### Web ビルド（配布用の静的サイト書き出し）

```sh
npx expo export --platform web      # dist/ に静的ファイルを書き出す（ルート配信用）
```

`dist/` を GitHub Pages 等に載せ、URL を配布 → ブラウザで開き「ホーム画面に追加」で全画面起動（DESIGN §0）。

GitHub Pages はサブパス（`/otsukai-meiro/`）配信のため、CI では `EXPO_BASE_URL=/otsukai-meiro` を渡して書き出す。この環境変数を [app.config.js](app.config.js) が `experiments.baseUrl` に反映し、**ビルド時のみ**アセットのベースパスを付ける（ローカルの `npm start` には影響しない）。手元でサブパス配信を再現するなら:

```sh
EXPO_BASE_URL=/otsukai-meiro npx expo export --platform web
```

### 遊び方（フェーズ1）

タイトルの「あそぶ」→ カードで**むずかしさ**を選ぶ → その難易度の迷路が**その場でランダム生成**される → ◀▲▼▶ をタップしてアバターを1マスずつ動かし、ゴール（りんご・おうち等、毎回ランダム）へ。壁や障害物の向きを押すとキャラが首をかしげるだけ（罰・ゲームオーバー無し）。ゴールで「ついたね!」の祝福。「もういちど」で同じ難易度の**新しい迷路**に挑戦（さんすうドリルのように何度でも）。
※ タイトル右下の歯車を **3秒長押し** すると、おとなモード（現在は準備中スタブ）に入る。

## 画面・ファイル構成

```
App.tsx                     文字ヘッダ無しの最小ステートルーター（title→select→play→otona）
src/
  theme.ts                  配色・フォント・余白の基準値（4歳向け）
  types.ts                  Template / Level / Coord / Direction / Route など（DESIGN §7 準拠）
  data/templates.json       むずかしさテンプレート定義（5個。カード＝難易度の型）
  data/templates.ts         テンプレート読み込み・次テンプレート取得
  game/maze.ts              move / canMove / isGoal など盤面の純粋関数
  game/generate.ts          テンプレートから迷路をランダム生成（BFS検証つき・詰み無し保証）
  audio/sounds.ts           効果音（web は Web Audio で合成、native は無音スタブ）
  audio/voice.ts            よみあげの入口（3段構え ①同梱クリップ→②speechSynthesis→③無音）
  audio/clips.ts            tier1: 同梱クリップ再生（HTMLAudioElement / native 無音）
  audio/voiceClips.ts       tier1: クリップ登録表（いまは空＝未同梱）
  audio/speech.ts           tier2: 端末の音声合成（Web Speech API / native 無音）
  components/
    MazeGrid.tsx            盤面（タイル・障害物・ゴール・アバター）
    DirPad.tsx              ◀▲▼▶ の巨大方向パッド
    Avatar.tsx              アバター（絵文字バッジ）
    Confetti.tsx            紙吹雪
    ClearOverlay.tsx        ゴール祝福オーバーレイ
    BigButton.tsx           共通の大ボタン
  screens/
    TitleScreen.tsx         タイトル（あそぶ / 親ゲート）
    LevelSelectScreen.tsx   レベルえらび（横スクロール）
    PlayScreen.tsx          プレイ本体（①タップモード）
    OtonaScreen.tsx         おとなモード（フェーズ2のスタブ）
```

## 音声（こえ）

効果音（`audio/sounds.ts` の合成音）とは別レイヤーで、3か所でずんだもんの声を鳴らす。
読み上げは3段構え（`audio/voice.ts`）: **① 同梱クリップ（VOICEVOX ずんだもん）→ ② 端末の音声合成（Web Speech API）→ ③ 無音**。
声はすべてユーザー操作（タップ）起点。効果音と喧嘩しないよう、声は効果音の**あと**に遅らせて鳴らす。

| 場面 | 声（同梱クリップ） | 効果音との順序 |
|---|---|---|
| タイトルをタップ | 「おつかいめいろ」（`p_title`） | ここで声エンジンをアンロック（warmUpVoice） |
| ゴール到達（ClearOverlay） | 「ついたね！」（`p_tsuita`） | 既存 `clear` 効果音の約0.75秒後に発声 |
| 全レベル制覇（がんばりカード） | 「ぜんぶ できたね！」（`p_zenbu`） | 既存 `fanfare` 効果音の約1秒後に発声 |

壁・障害物にぶつかったときは既存の `blocked` 効果音のまま（**声は出さない**）。

クリップは `assets/voice/` に同梱（`audio/voiceClips.ts` の `CLIP_URLS` で登録）。同梱クリップを持たない環境（native 等）は
② 端末の音声合成へ自動フォールバックし、それも無ければ ③ 無音（絵・文字だけで成立）。生成手順・パラメータ・クレジット
（**VOICEVOX:ずんだもん**）は [`assets/voice/README.md`](assets/voice/README.md) を参照。