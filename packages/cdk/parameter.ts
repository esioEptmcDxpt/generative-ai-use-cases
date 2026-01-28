import * as cdk from 'aws-cdk-lib';
import {
  StackInput,
  stackInputSchema,
  ProcessedStackInput,
} from './lib/stack-input';
import { ModelConfiguration } from 'generative-ai-use-cases';
import { loadBrandingConfig } from './branding';

// Get parameters from CDK Context
const getContext = (app: cdk.App): StackInput => {
  const params = stackInputSchema.parse(app.node.getAllContext());
  return params;
};

// If you want to define parameters directly
const envs: Record<string, Partial<StackInput>> = {
  // If you want to define an anonymous environment, uncomment the following and the content of cdk.json will be ignored.
  // If you want to define an anonymous environment in parameter.ts, uncomment the following and the content of cdk.json will be ignored.
  '': {
    modelRegion: 'ap-northeast-1',
    modelIds: [
      'jp.anthropic.claude-sonnet-4-5-20250929-v1:0',
      'jp.anthropic.claude-haiku-4-5-20251001-v1:0',
      'jp.amazon.nova-2-lite-v1:0',
      'openai.gpt-oss-120b-1:0',
      {
        modelId: 'us.meta.llama4-maverick-17b-instruct-v1:0',
        region: 'us-west-2',
      },
      {
        modelId: 'us.meta.llama4-scout-17b-instruct-v1:0',
        region: 'us-east-1',
      },
    ],
    imageGenerationModelIds: [
      'amazon.nova-canvas-v1:0',
      { modelId: 'stability.sd3-5-large-v1:0', region: 'us-west-2' },
      { modelId: 'stability.stable-image-core-v1:1', region: 'us-west-2' },
      { modelId: 'stability.stable-image-ultra-v1:1', region: 'us-west-2' },
    ],
    videoGenerationModelIds: [
      'amazon.nova-reel-v1:0',
      { modelId: 'luma.ray-v2:0', region: 'us-west-2' },
    ],
    speechToSpeechModelIds: [
      { modelId: 'amazon.nova-sonic-v1:0', region: 'us-east-1' },
    ],
    allowedSignUpEmailDomains: ['jreast.co.jp'],
  },
  dev: {
    // Parameters for development environment
  },
  staging: {
    // Parameters for staging environment
  },
  prod: {
    // Parameters for production environment
  },
  // If you need other environments, customize them as needed
};

// For backward compatibility, get parameters from CDK Context > parameter.ts
export const getParams = (app: cdk.App): ProcessedStackInput => {
  // By default, get parameters from CDK Context
  let params = getContext(app);

  // If the env matches the ones defined in envs, use the parameters in envs instead of the ones in context
  if (envs[params.env]) {
    params = stackInputSchema.parse({
      ...envs[params.env],
      env: params.env,
    });
  }
  // Make the format of modelIds, imageGenerationModelIds consistent
  const convertToModelConfiguration = (
    models: (string | ModelConfiguration)[],
    defaultRegion: string
  ): ModelConfiguration[] => {
    return models.map((model) =>
      typeof model === 'string'
        ? { modelId: model, region: defaultRegion }
        : model
    );
  };

  return {
    ...params,
    modelIds: convertToModelConfiguration(params.modelIds, params.modelRegion),
    imageGenerationModelIds: convertToModelConfiguration(
      params.imageGenerationModelIds,
      params.modelRegion
    ),
    videoGenerationModelIds: convertToModelConfiguration(
      params.videoGenerationModelIds,
      params.modelRegion
    ),
    speechToSpeechModelIds: convertToModelConfiguration(
      params.speechToSpeechModelIds,
      params.modelRegion
    ),
    endpointNames: convertToModelConfiguration(
      params.endpointNames,
      params.modelRegion
    ),
    // Process agentCoreRegion: null -> modelRegion
    agentCoreRegion: params.agentCoreRegion || params.modelRegion,
    // Load branding configuration
    brandingConfig: loadBrandingConfig(),
  };
};
