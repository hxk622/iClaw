import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRuntimeConfigWithManagedImBots,
  restoreManagedImBotsFromRuntimeConfig,
} from './im-bots-runtime.ts';

test('buildRuntimeConfigWithManagedImBots writes Feishu China channel using published schema fields', () => {
  const next = buildRuntimeConfigWithManagedImBots(
    { openai_api_key: 'sk-test' },
    [
      {
        platformId: 'feishu-china',
        enabled: true,
        name: '飞书办公助手',
        bindingScope: 'organization',
        triggerMode: 'mention',
        replyFormat: 'card',
        credentials: {
          app_id: 'cli_123',
          app_secret: 'secret_456',
        },
      },
    ],
  );

  assert.deepEqual(next.channels, {
    'feishu-china': {
      enabled: true,
      appId: 'cli_123',
      appSecret: 'secret_456',
      connectionMode: 'websocket',
      dmPolicy: 'open',
      groupPolicy: 'open',
      requireMention: true,
      sendMarkdownAsCard: true,
    },
  });
});

test('buildRuntimeConfigWithManagedImBots writes webhook-based channels with callback security fields', () => {
  const next = buildRuntimeConfigWithManagedImBots(
    {},
    [
      {
        platformId: 'wecom-app',
        enabled: true,
        name: '企微自建应用助手',
        bindingScope: 'organization',
        triggerMode: 'mention',
        replyFormat: 'card',
        credentials: {
          corp_id: 'ww123',
          secret: 'corp-secret',
          agent_id: '1000002',
          callback_url: 'https://api.iclaw.ai/webhooks/wecom-app',
          token: 'cb-token',
          encoding_aes_key: 'aes-key',
        },
      },
      {
        platformId: 'wechat-mp',
        enabled: true,
        name: '公众号助手',
        bindingScope: 'private',
        triggerMode: 'all',
        replyFormat: 'markdown',
        credentials: {
          app_id: 'wx123',
          app_secret: 'wx-secret',
          callback_url: 'https://api.iclaw.ai/webhooks/wechat-mp',
          token: 'mp-token',
          encoding_aes_key: 'mp-aes',
        },
      },
    ],
  );

  assert.deepEqual(next.channels, {
    'wecom-app': {
      enabled: true,
      name: '企微自建应用助手',
      corpId: 'ww123',
      corpSecret: 'corp-secret',
      agentId: 1000002,
      webhookPath: '/webhooks/wecom-app',
      token: 'cb-token',
      encodingAESKey: 'aes-key',
      receiveId: 'ww123',
      dmPolicy: 'open',
      groupPolicy: 'open',
      requireMention: true,
    },
    'wechat-mp': {
      enabled: true,
      name: '公众号助手',
      appId: 'wx123',
      appSecret: 'wx-secret',
      token: 'mp-token',
      encodingAESKey: 'mp-aes',
      webhookPath: '/webhooks/wechat-mp',
      messageMode: 'safe',
      replyMode: 'active',
      activeDeliveryMode: 'split',
      dmPolicy: 'open',
    },
  });
});

test('buildRuntimeConfigWithManagedImBots removes previously managed channels when bots are absent', () => {
  const next = buildRuntimeConfigWithManagedImBots(
    {
      channels: {
        'feishu-china': { enabled: true, appId: 'cli_old' },
        dingtalk: { enabled: true, clientId: 'ding_old' },
        custom: { untouched: true },
      },
    },
    [],
  );

  assert.deepEqual(next.channels, {
    custom: { untouched: true },
  });
});

test('restoreManagedImBotsFromRuntimeConfig rebuilds persisted records for multiple platforms', () => {
  const restored = restoreManagedImBotsFromRuntimeConfig({
    channels: {
      dingtalk: {
        enabled: true,
        name: '钉钉办公助手',
        clientId: 'ding-app',
        clientSecret: 'ding-secret',
        groupPolicy: 'disabled',
        dmPolicy: 'open',
        requireMention: false,
        enableAICard: false,
      },
      qqbot: {
        enabled: false,
        name: 'QQ 助手',
        appId: '1024',
        clientSecret: 'qq-secret',
        dmPolicy: 'pairing',
        groupPolicy: 'open',
        requireMention: true,
        markdownSupport: true,
      },
      'wecom-kf': {
        enabled: true,
        corpId: 'ww999',
        corpSecret: 'kf-secret',
        openKfId: 'wk123',
        webhookPath: '/wecom-kf',
        token: 'kf-token',
        encodingAESKey: 'kf-aes',
        dmPolicy: 'open',
      },
    },
  });

  assert.deepEqual(restored, [
    {
      platformId: 'dingtalk',
      enabled: true,
      name: '钉钉办公助手',
      bindingScope: 'private',
      triggerMode: 'all',
      replyFormat: 'markdown',
      credentials: {
        client_id: 'ding-app',
        client_secret: 'ding-secret',
      },
    },
    {
      platformId: 'wecom-kf',
      enabled: true,
      name: '企微客服助手',
      bindingScope: 'organization',
      triggerMode: 'all',
      replyFormat: 'card',
      credentials: {
        corp_id: 'ww999',
        secret: 'kf-secret',
        open_kf_id: 'wk123',
        callback_url: '/wecom-kf',
        token: 'kf-token',
        encoding_aes_key: 'kf-aes',
      },
    },
    {
      platformId: 'qqbot',
      enabled: false,
      name: 'QQ 助手',
      bindingScope: 'group',
      triggerMode: 'mention',
      replyFormat: 'markdown',
      credentials: {
        app_id: '1024',
        app_secret: 'qq-secret',
      },
    },
  ]);
});
