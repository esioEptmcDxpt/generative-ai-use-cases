# 音声からスライド作成（Speech to Slides）実装記録

## 概要

音声・動画ファイル（Web 会議の録画 mp4 を含む）を Amazon Transcribe で文字起こしし、Bedrock のモデルで内容を要約して、1 ファイルで完結する HTML スライドを作成するユースケースです。

- 画面パス：`/speech-to-slides`（メニュー名「音声からスライド作成」）
- ブランチ：`f/speech-to-slides`（ベース：`f/update-20260908`）
- 経緯：AutoMinutes（Claude Code のスキル `speech-to-slides` / `auto-minutes`）で CLI 実行していた「文字起こし → 要約 → HTML スライド化」を、GenU の 1 機能として利用できるようにしたもの
- バックエンド（CDK の Lambda・API）の追加はありません。既存の Transcribe API と PredictStream を利用します。

## 機能

| 項目         | 内容                                                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 入力ファイル | mp3, mp4, wav, flac, ogg, amr, webm, m4a（既存の議事録画面と同じ）。2GB を超えるファイルはアップロード前にエラー表示                           |
| 文字起こし   | 既存の `MeetingMinutesFile` コンポーネントを再利用（言語選択・話者認識・話者名の指定が可能）                                                   |
| 内容の種類   | 「訓話・挨拶・スピーチ」／「会議（Web 会議の録画など）」でプロンプトを切り替え                                                                 |
| モデル       | `modelIds` に設定された Bedrock モデルから選択。初期値は名前に `sonnet` を含む最初のモデル（無ければ先頭）                                     |
| 表紙写真     | 任意。ブラウザ内で EXIF の向きを補正し長辺 2000px に縮小、base64 で HTML に埋め込む。**写真は LLM に送信しない**。未指定の場合は写真なしの表紙 |
| 補足情報     | 話者・日付・場所など。表紙の記載や人名・組織名の補正に使用                                                                                     |
| 追加の指示   | 再作成時の指示（枚数、見出しの修正など）                                                                                                       |
| 出力         | サンドボックス化した iframe でプレビュー、HTML のコピー、`.html` ダウンロード                                                                  |
| 履歴         | チャット履歴への保存は行わない                                                                                                                 |

## 処理の流れ

```
[ブラウザ]
 音声/動画ファイル ──(署名付きURLでPUT)──▶ S3 (FileBucket)
                    ──transcribe/start──▶ StartTranscriptionJob
                    ◀─transcribe/result── 話者ラベル付きテキスト
 テキスト + システムプロンプト ──predictStream──▶ Bedrock（選択したモデル）
                    ◀── <section> 群のマークアップ（ストリーミング）
 buildSlidesHtml():
   サニタイズ → 表紙写真の挿入 → フッター（ページ番号）付与 → 固定 CSS と結合
 → iframe プレビュー / .html ダウンロード
```

### 設計上のポイント

- **LLM には `<section>` 要素だけを出力させる。** CSS・表紙写真・フッター（ページ番号）はアプリ側（`SpeechToSlidesUtils.ts`）で付与する。モデルによるレイアウトの揺れを抑え、出力トークンも減らすため。
  - 表紙は写真を切らずに横幅いっぱいで表示し、上下と右端を背景色でぼかすレイアウトに固定（CLI 版で人物が切れる問題があったため）。
  - カードの列数は `flex` でカード数に合わせる（2 枚でも空列が出ない）。
- **安全性**：生成マークアップから `script` / `iframe` / `object` / `embed` / `link` / `meta` / `style` / `form` / `img` 要素、`on*`・`style`・`src` 属性、`#` 以外の `href` を除去。プレビューは `sandbox=""`（スクリプト不可）の iframe で表示。
- **プロンプト**：i18n lint（日本語文字列の禁止）に合わせて英語で記述し、「文字起こしと同じ言語で書く」と指示。フィラーの除去、脚色の禁止、聞き取り誤りを文脈から補正した場合の注記などは CLI 版スキルの方針を踏襲。

## 変更ファイル

### 新規

| ファイル                                        | 内容                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/web/src/pages/SpeechToSlidesPage.tsx` | 画面本体（文字起こし → 設定 → 結果の 3 ステップ）                               |
| `packages/web/src/prompts/speechToSlides.ts`    | システムプロンプト（`speech` / `meeting`、補足情報、追加の指示）                |
| `packages/web/src/utils/SpeechToSlidesUtils.ts` | 固定 CSS、マークアップ抽出、サニタイズ、HTML 組み立て、画像縮小、ファイル名生成 |

### 既存ファイルへの追記

| ファイル                                                            | 内容                                                                                                                                                     |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/web/src/main.tsx`                                         | ルート `/speech-to-slides`                                                                                                                               |
| `packages/web/src/App.tsx`                                          | ドロワーのメニュー項目（アイコン `PiPresentationChart`）                                                                                                 |
| `packages/web/src/pages/LandingPage.tsx`                            | トップページのカード                                                                                                                                     |
| `packages/types/src/useCases.d.ts`                                  | `HiddenUseCases.speechToSlides`                                                                                                                          |
| `packages/cdk/lib/stack-input.ts`                                   | `hiddenUseCases.speechToSlides`（zod）                                                                                                                   |
| `packages/web/src/components/MeetingMinutes/MeetingMinutesFile.tsx` | 2GB 超のファイルをエラー表示（議事録画面にも適用される）                                                                                                 |
| `packages/web/public/locales/translation/{ja,en}.yaml`              | `speechToSlides.*`、`navigation.speechToSlides`、`landing.use_cases.speech-to-slides`、`transcribe.file_too_large`（ko/th/vi/zh は英語にフォールバック） |
| `docs/{ja,en,ko}/DEPLOY_OPTION.md`                                  | `hiddenUseCases` の設定例に `speechToSlides` を追記                                                                                                      |

## 設定

非表示にする場合は `packages/cdk/parameter.ts`（`envs.dev` など）または `cdk.json` の `hiddenUseCases` に追加します。

```typescript
hiddenUseCases: {
  speechToSlides: true, // 音声からスライド作成を非表示
},
```

> このリポジトリでは既定 env（`''`）・`dev` とも `parameter.ts` の `envs` が `cdk.json` より優先されます。

## 検証結果（2026-09-30）

| 項目                                                                             | 結果                                                                                                                                                        |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lint（追加・変更した TS/TSX）                                                    | 通過                                                                                                                                                        |
| 型チェック（web・cdk の `tsc --noEmit`）                                         | 通過                                                                                                                                                        |
| `vite build`                                                                     | 開発環境のメモリ不足（7GB）で未完了。デプロイ前に要確認                                                                                                     |
| 生成テスト（Claude Sonnet 5 `global.anthropic.claude-sonnet-5`、ap-northeast-1） | 挨拶（音声 約4.5分、写真あり）：約 57 秒・9 ページ／Web 会議（文字起こし 約 2.2 万字、写真なし）：約 83 秒・11 ページ。いずれもはみ出し・レイアウト崩れなし |

- 生成テストは、アプリと同じプロンプト・組み立て処理を esbuild でバンドルし、Bedrock を直接呼び出して Playwright で表示確認したもの。ログインした状態での画面操作による確認は未実施。
- yaml の lint には、ベースブランチ時点からの既存エラー（`navigation.sub` の並び順など）が残っている。今回の追加分による新たなエラーはなし。

## 既知の制約・留意点

- 処理時間の目安：Transcribe（5 分の音声で 30 秒〜1 分）＋ 生成（1〜2 分）。PredictStream のクライアント側タイムアウトは 300 秒のため、非常に長い会議では超過の可能性がある。
- 軽量モデル（Haiku・Nova Lite 等）ではレイアウトの指示に従わない、途中で打ち切られるなどの可能性がある。Sonnet / Opus クラスを推奨。
- 表紙写真の内容（写っている人物など）は LLM に渡していない。必要なら補足情報に記載する。
- Transcribe の制限（1 ファイル 2GB・4 時間）を超えるファイルは利用不可。大きな録画は音声のみに変換してから利用する。
- `parameter.ts` の `envs.dev.modelIds` にある `global.openai.gpt-5.6-luna`・`global.xai.grok-4.6` は `packages/common/src/application/model.ts` の `modelMetadata` に定義が無く、`useModel.ts` がガード無しで参照するため画面が落ちる可能性がある（本機能とは別の既存の問題）。

## 今後の拡張案

- 画像対応モデルの場合に、表紙写真を LLM に渡して内容を参考にするオプション
- 生成結果のチャット履歴への保存（`usecase: '/speech-to-slides'`）
- ko/th/vi/zh の翻訳追加
- 配色テーマの選択
