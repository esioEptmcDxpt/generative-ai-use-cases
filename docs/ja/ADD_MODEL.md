# モデルの追加方法

Bedrock に新しいモデル (例: `global.anthropic.claude-opus-5-5`) が登場した際に、GenU で利用できるようにする手順です。

## 概要

GenU で利用できるテキスト生成モデルは、ソースコード内のモデル定義テーブルに登録されているものだけです。`parameter.ts` の `modelIds` に未登録のモデル ID を指定すると、デプロイ時に次のエラーになります。

```
Unsupported Model Name: global.anthropic.claude-opus-5-5
```

Bedrock 側でモデルが使えるかどうかではなく、**ソースコードに登録されているかどうか**で対応可否が決まります。

## エラーの発生箇所

[packages/cdk/lib/construct/api.ts](/packages/cdk/lib/construct/api.ts) で、`modelIds` の各要素が `BEDROCK_TEXT_MODELS` に含まれるかを検証しています。

```typescript
for (const model of modelIds) {
  if (!BEDROCK_TEXT_MODELS.includes(model.modelId)) {
    throw new Error(`Unsupported Model Name: ${model.modelId}`);
  }
}
```

`BEDROCK_TEXT_MODELS` は、[packages/common/src/application/model.ts](/packages/common/src/application/model.ts) の `modelMetadata` のキーのうち、`flags.text` が `true` のものです。

画像生成 (`imageGenerationModelIds`)、動画生成 (`videoGenerationModelIds`)、リランキング (`rerankingModelId`) も同様に、それぞれ `BEDROCK_IMAGE_GEN_MODELS`、`BEDROCK_VIDEO_GEN_MODELS`、`BEDROCK_RERANKING_MODELS` で検証されます。

## 追加手順

### 1. モデルのメタデータを登録する (必須)

[packages/common/src/application/model.ts](/packages/common/src/application/model.ts) の `modelMetadata` に、モデルの機能フラグと表示名を追加します。これがデプロイ時の検証と、Web の UI (モデル選択、機能の出し分け) に使われます。

```typescript
'global.anthropic.claude-opus-5-5': {
  flags: MODEL_FEATURE.TEXT_DOC_IMAGE_ADAPTIVE_THINKING_NO_SAMPLING,
  displayName: 'Claude Opus 5.5',
},
```

- `flags` には `MODEL_FEATURE` の定義済みの組み合わせから、モデルの実際の機能に合うものを選びます。合わないものを選ぶと、使えない機能が UI で有効になります。
- クロスリージョン推論のプレフィックス (`global.`、`us.`、`eu.`、`jp.`、`au.` など) は、Bedrock に実在するものだけを登録します。プレフィックスごとに別のエントリが必要です。

プロンプトキャッシュを利用できるモデルは、同ファイルの `SUPPORTED_CACHE_FIELDS` にも、プレフィックスなしのモデル ID で追加します。

```typescript
'anthropic.claude-opus-5-5': ['messages', 'system', 'tools'],
```

### 2. 推論処理を登録する (必須)

[packages/cdk/lambda/utils/models.ts](/packages/cdk/lambda/utils/models.ts) の `BEDROCK_MODELS` に、推論パラメータと Converse API の入出力処理を追加します。ここに無いと、デプロイが通っても実行時に失敗します。

```typescript
'global.anthropic.claude-opus-5-5': {
  defaultParams: CLAUDE_OPUS_5_DEFAULT_PARAMS,
  usecaseParams: USECASE_DEFAULT_PARAMS,
  createConverseCommandInput: createConverseCommandInput,
  createConverseStreamCommandInput: createConverseStreamCommandInput,
  extractConverseOutput: extractConverseOutput,
  extractConverseStreamOutput: extractConverseStreamOutput,
},
```

- `defaultParams` は `maxTokens`、`temperature` などの初期値です。既存の定義 (`CLAUDE_OPUS_5_DEFAULT_PARAMS` など) を流用するか、同じ形式で新規に定義します。モデルの上限に合わせてください。
- システムプロンプトを受け付けないモデルは、`createConverseCommandInput` の代わりに `createConverseCommandInputWithoutSystemContext` を、ストリーミング側も `createConverseStreamCommandInputWithoutSystemContext` を指定します。

既存の近いモデルのエントリをコピーして調整するのが安全です。

### 3. 必要に応じて更新するもの (任意)

- [packages/cdk/lib/stack-input.ts](/packages/cdk/lib/stack-input.ts): `modelIds` のデフォルト値
- `docs/*/DEPLOY_OPTION.md`: 対応モデルの一覧
- [packages/cdk/lambda-python/research-agent-core-runtime/src/config.py](/packages/cdk/lambda-python/research-agent-core-runtime/src/config.py): 該当する場合のみ

### 4. parameter.ts で指定する

```typescript
// packages/cdk/parameter.ts
modelIds: [
  'global.anthropic.claude-opus-5-5',
  // ...
],
```

## Claude 以外のモデルを追加する場合

GenU は Bedrock の **Converse / ConverseStream API** を共通の入口にしており、`createConverseCommandInput` や `extractConverseOutput` を Claude、Nova、Mistral、Qwen、OpenAI 系で共有しています。そのため、Converse API で呼べるモデルであれば、上記の手順 1〜2 だけで追加できます。

例として `openai.gpt-oss-120b-1:0` は次のように登録されています。

```typescript
// model.ts
'openai.gpt-oss-120b-1:0': {
  flags: MODEL_FEATURE.TEXT_ONLY,
  displayName: 'GPT OSS 120B',
},

// models.ts
'openai.gpt-oss-120b-1:0': {
  defaultParams: OPENAI_DEFAULT_PARAMS,
  usecaseParams: USECASE_DEFAULT_PARAMS,
  createConverseCommandInput: createConverseCommandInputWithoutSystemContext,
  createConverseStreamCommandInput:
    createConverseStreamCommandInputWithoutSystemContext,
  extractConverseOutput: extractConverseOutput,
  extractConverseStreamOutput: extractConverseStreamOutput,
},
```

## 追加できないケース・注意点

- **Converse API 非対応のモデル**: 独自のリクエスト/レスポンス形式に対応する実装が別途必要です。
- **モデル固有のパラメータが必要な機能**: Claude の adaptive thinking (`adaptiveThinking`、`xhighEffort`、`noSamplingParams` など) は、`flags` と `createConverseCommandInput` 内の分岐で専用に処理されています。他社モデルで同様の機能を使うには、追加の実装が必要です。
- **Bedrock に存在しないモデル ID**: 登録するとデプロイは通りますが、実行時に Bedrock がエラーを返します。登録前に、Bedrock のモデル一覧と推論プロファイルで ID を確認してください。
- **モデルアクセスとリージョン**: Bedrock のモデルアクセスの有効化と、`modelRegion` でそのモデルが提供されていることが必要です。
- **画像生成・動画生成・リランキングモデル**: テキスト用とは別のリストで管理され、画像生成は `createBodyImage*` 系の専用処理が必要です。

## 確認方法

1. 型チェックとビルドを確認します。

   ```bash
   npm run cdk:build
   npm run cdk:lambda-build-dryrun
   ```

2. スナップショットテストを実行します。モデル追加でスナップショットが変わる場合は更新します。

   ```bash
   npm run cdk:test
   npm run cdk:test:update-snapshot
   ```

3. デプロイして、Web の UI でモデルを選択でき、応答が返ることを確認します。

   ```bash
   npm run cdk:deploy
   ```
