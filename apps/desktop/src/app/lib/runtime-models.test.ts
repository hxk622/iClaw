import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveRuntimeKernelModelRef, type RuntimeModelCatalogResponse } from './runtime-models.ts';

function createRuntimeCatalog(): RuntimeModelCatalogResponse {
  return {
    appName: 'caiclaw',
    providerMode: 'provider_profile',
    resolvedScope: 'caiclaw',
    profile: {
      providerKey: 'bailian',
      providerLabel: 'Bailian',
      logoPresetKey: null,
    },
    models: [
      {
        modelRef: 'bailian/qwen3.5-plus',
        modelId: 'qwen3.5-plus',
        label: 'qwen3.5-plus',
        logoPresetKey: null,
        billingMultiplier: 1,
        reasoning: true,
        inputModalities: ['text', 'image'],
        contextWindow: 131072,
        maxTokens: 8192,
        enabled: true,
      },
      {
        modelRef: 'bailian/kimi-k2.5',
        modelId: 'kimi-k2.5',
        label: 'kimi-k2.5',
        logoPresetKey: null,
        billingMultiplier: 1,
        reasoning: true,
        inputModalities: ['text'],
        contextWindow: 131072,
        maxTokens: 8192,
        enabled: true,
      },
    ],
    version: 1,
  };
}

test('resolveRuntimeKernelModelRef translates modelId to provider-qualified modelRef', () => {
  assert.equal(
    resolveRuntimeKernelModelRef(createRuntimeCatalog(), 'qwen3.5-plus'),
    'bailian/qwen3.5-plus',
  );
});

test('resolveRuntimeKernelModelRef preserves already-qualified modelRef', () => {
  assert.equal(
    resolveRuntimeKernelModelRef(createRuntimeCatalog(), 'bailian/kimi-k2.5'),
    'bailian/kimi-k2.5',
  );
});
