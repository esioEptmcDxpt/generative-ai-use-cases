# 最新 Claude モデル対応 (2026-10-08)

Claude Opus 5.5 / Sonnet 5.5 / Haiku 5.5 / Fable 5.1 を GenU で指定できるようにした変更のまとめです。

## 背景

`parameter.ts` の `modelIds` に `global.anthropic.claude-opus-5-5` などを指定すると、デプロイ時に次のエラーになっていました。

```
Unsupported Model Name: global.anthropic.claude-opus-5-5
```

GenU は、ソースコードのモデル定義テーブルに登録されたモデル ID しか受け付けません。Bedrock 側で使えるかどうかは関係ありません (詳細は [ADD_MODEL.md](./ADD_MODEL.md))。登録済みは Opus 5 / Sonnet 5 / Fable 5 までで、今回の 4 モデルは未登録でした。

## 調査結果

推論処理 (`createConverseCommandInput`、[packages/cdk/lambda/utils/models.ts](/packages/cdk/lambda/utils/models.ts)) は、新モデルの制約にすでに対応していたため、改修は不要でした。

| 新モデルの制約                                                                   | 既存処理の挙動                                |
| -------------------------------------------------------------------------------- | --------------------------------------------- |
| 思考を無効化 (`thinking: disabled`) できない (Opus 5.5 / Sonnet 5.5 / Fable 5.1) | 思考 OFF のときは `thinking` 自体を送らない   |
| temperature / topP など、サンプリング設定を既定値以外にするとエラー              | `noSamplingParams` フラグのモデルには送らない |
| effort の既定値が `medium` に変更 (Opus 5.5 / Haiku 5.5)                         | effort を毎回明示して送る (既定 `high`)       |
| ツール呼び出しの強制指定 (`tool_choice` の `any` / `tool`) がエラー              | 使用箇所なし                                  |

そのため、モデル登録の追加だけで対応しました。

## 変更内容

### [packages/common/src/application/model.ts](/packages/common/src/application/model.ts)

`modelMetadata` に追加しました。

| モデル ID                            | 表示名            | flags                                                    |
| ------------------------------------ | ----------------- | -------------------------------------------------------- |
| `global.anthropic.claude-fable-5-1`  | Claude Fable 5.1  | `TEXT_DOC_IMAGE_ADAPTIVE_THINKING_ALWAYS_ON_NO_SAMPLING` |
| `global.anthropic.claude-opus-5-5`   | Claude Opus 5.5   | `TEXT_DOC_IMAGE_ADAPTIVE_THINKING_ALWAYS_ON_NO_SAMPLING` |
| `global.anthropic.claude-sonnet-5-5` | Claude Sonnet 5.5 | `TEXT_DOC_IMAGE_ADAPTIVE_THINKING_ALWAYS_ON_NO_SAMPLING` |
| `global.anthropic.claude-haiku-5-5`  | Claude Haiku 5.5  | `TEXT_DOC_IMAGE_ADAPTIVE_THINKING_NO_SAMPLING`           |

- Opus 5.5 は思考を無効化できないため、Opus 5 とは違って「思考を常に ON」(`ALWAYS_ON`) の flags にしています。
- Haiku 5.5 は思考を無効化できるため、Opus 5 と同じ flags です。

`SUPPORTED_CACHE_FIELDS` (プロンプトキャッシュ) にも 4 モデルを追加しました (`anthropic.claude-opus-5-5` などのプレフィックスなし ID)。

### [packages/cdk/lambda/utils/models.ts](/packages/cdk/lambda/utils/models.ts)

- デフォルトパラメータを追加しました: `CLAUDE_FABLE_5_1_DEFAULT_PARAMS` / `CLAUDE_OPUS_5_5_DEFAULT_PARAMS` / `CLAUDE_SONNET_5_5_DEFAULT_PARAMS` / `CLAUDE_HAIKU_5_5_DEFAULT_PARAMS` (いずれも `maxTokens: 128000`、temperature 指定なし)。
- `BEDROCK_MODELS` に 4 モデルのエントリを追加しました。入出力処理は既存の Converse API 用関数を使っています。

### テストのスナップショット

`packages/cdk/test/__snapshots__/generative-ai-use-cases.test.ts.snap` を更新しました。差分は `SUPPORTED_CACHE_FIELDS` への 4 モデルの追加だけです。

## 対象外にしたもの

- **リージョン別プレフィックス (`us.` / `eu.` / `jp.` / `au.` など):** Bedrock に実在するか確認できていないため、追加していません。必要になったら、実在を確認したうえで同じ形式で追加してください。
- **`packages/cdk/parameter.ts`:** 環境ごとの設定のため、編集していません。
- **デフォルトのモデル一覧 (`stack-input.ts` / `cdk.json`) と `docs/*/DEPLOY_OPTION.md`:** 変更していません。

## 検証結果

| 項目                                                    | 結果                                          |
| ------------------------------------------------------- | --------------------------------------------- |
| prettier                                                | OK                                            |
| Lambda の型チェック (`npm run cdk:lambda-build-dryrun`) | OK                                            |
| CDK テスト (`npm run cdk:test`)                         | 39 件すべて成功 (スナップショット 3 件を更新) |
| 実デプロイと Bedrock での呼び出し                       | 未実施                                        |

## 利用手順

1. Bedrock で、利用するアカウントとリージョンの 4 モデルが有効になっていることを確認します。
2. `parameter.ts` の `modelIds` に、使いたいモデル ID を指定します。

   ```typescript
   modelIds: [
     'global.anthropic.claude-opus-5-5',
     'global.anthropic.claude-sonnet-5-5',
     'global.anthropic.claude-haiku-5-5',
     'global.anthropic.claude-fable-5-1',
   ],
   ```

3. デプロイし、Web 画面で新モデルを選びます。思考 ON/OFF や effort を切り替えても、エラーにならないことを確認してください。
