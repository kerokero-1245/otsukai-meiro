# assets/voice — 同梱音声クリップ（tier1）

よみあげ（DESIGN §4）の3段構え「①同梱クリップ → ②speechSynthesis → ③無音」の、**①クリップ**を置く場所。
**VOICEVOX**（ずんだもん）で事前生成した日本語音声（`.m4a`）を同梱している。

## 同梱クリップ（3個）

| 場面 | クリップ | 読む内容 | 長さ | フォールバック読み上げ |
|---|---|---|---|---|
| タイトルをタップ | `p_title.m4a` | おつかいめいろ | 1.49s | `おつかいめいろ` |
| ゴール到達（ClearOverlay） | `p_tsuita.m4a` | ついたね！ | 1.17s | `ついたね` |
| 全レベル制覇（がんばりカード） | `p_zenbu.m4a` | ぜんぶ できたね！ | 2.40s | `ぜんぶ できたね` |

対応表の正典は `src/audio/voice.ts` の `PHRASE_VOICE`。`src/audio/voiceClips.ts` の `CLIP_URLS` で `require` 登録済み。
壁ぶつかり（`blocked` 効果音）は声を出さない。声は効果音の**あと**に遅らせて鳴らして喧嘩させている
（ゴール: clear の約0.75秒後 / がんばり: fanfare の約1秒後）。

`.m4a` は Expo SDK 57 / Metro の既定 assetExts に含まれるので、追加設定なしでバンドルされる。
tier1（同梱クリップ）が最優先。同梱クリップを持たない環境（native 等）では ② speechSynthesis → ③ 無音 へ自動フォールバックする。

## 生成の再現情報

| 項目 | 値 |
|---|---|
| エンジン | VOICEVOX ENGINE 0.25.2（macOS x64 CPU・公式GitHubリリース） |
| 話者 / スタイル | ずんだもん / あまあま（`speaker` = style id **1**） |
| 速度 | `speedScale` = 0.92（`p_title`）／ 0.95（`p_tsuita`・`p_zenbu`）。4〜5歳向けにやや遅め（姉妹アプリ ぴよぴよことば と同条件） |
| 疑問/感嘆の抑揚 | `/synthesis?enable_interrogative_upspeak=true` |
| その他パラメータ | `audio_query` の既定値（pitch/intonation 等は変更なし） |
| 音声形式 | 24kHz モノラル WAV → `afconvert -f m4af -d aac -b 64000`（AAC 64kbps モノラル m4a） |

手順（要約）: 公式リリースの ENGINE をローカル起動（HTTP `localhost:50021`）→ `/audio_query`（各フレーズ・`speedScale` 調整）
→ `/synthesis` で WAV → `afconvert` で m4a 化 → 本ディレクトリへ配置。エンジンは生成後に停止し、音声は端末内同梱アセットとして扱う（外部送信ゼロ）。

## クレジット表記

**VOICEVOX:ずんだもん**（VOICEVOX 利用規約に基づく）。おとなモード画面の下部と本 README に明記している。

## 追加・差し替えの手順

1. VOICEVOX で生成した `.m4a` を上表の基名でこのディレクトリに置く。
2. `src/audio/voiceClips.ts` の `CLIP_URLS` に `require` で登録する（存在しないファイルを require するとビルドが壊れるので、置いてから登録）。
3. 登録した基名は `src/audio/clips.ts` が tier1 として最優先で拾う。**呼び出し側（画面）の変更は不要**。

## メモ

- **外部送信ゼロ**: クリップは端末内の同梱アセット。ネットワークは使わない（WORLD §9）。
- **iOS Safari**: 音は最初のユーザー操作より前に鳴らせない。タイトルのタップ（「おつかいめいろ」発声／「あそぶ」）で
  `warmUpVoice()` を呼び、tier1（クリップを muted で1つ）と tier2（volume=0 の発声で）をアンロックする。1ページロード1回で足りる。
