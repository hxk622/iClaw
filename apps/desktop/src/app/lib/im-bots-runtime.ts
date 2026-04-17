type JsonRecord = Record<string, unknown>;

export type ManagedImBotPlatformId =
  | 'dingtalk'
  | 'feishu-china'
  | 'wecom'
  | 'wecom-app'
  | 'wecom-kf'
  | 'qqbot'
  | 'wechat-mp'
  | 'openclaw-weixin';

export type ManagedImBotBindingScope = 'organization' | 'group' | 'private';
export type ManagedImBotTriggerMode = 'mention' | 'all' | 'keyword';
export type ManagedImBotReplyFormat = 'text' | 'card' | 'markdown';

export type ManagedImBotRuntimeRecord = {
  platformId: ManagedImBotPlatformId;
  enabled: boolean;
  name: string;
  bindingScope: ManagedImBotBindingScope;
  triggerMode: ManagedImBotTriggerMode;
  replyFormat: ManagedImBotReplyFormat;
  credentials: Record<string, string>;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function trimText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function trimTextOrUndefined(value: unknown): string | undefined {
  const trimmed = trimText(value);
  return trimmed || undefined;
}

function trimStringRecord(input: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, trimText(value)]),
  );
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function parseWebhookPath(input: Record<string, string>, fallback: string): string {
  const rawCallbackUrl = trimText(input.callback_url);
  if (!rawCallbackUrl) {
    return fallback;
  }
  try {
    const url = new URL(rawCallbackUrl);
    return url.pathname || fallback;
  } catch {
    return fallback;
  }
}

function resolvePolicies(
  platformId: ManagedImBotPlatformId,
  bindingScope: ManagedImBotBindingScope,
): {
  dmPolicy?: 'open' | 'pairing' | 'allowlist' | 'disabled';
  groupPolicy?: 'open' | 'allowlist' | 'disabled';
} {
  const supportsDisabledDm =
    platformId === 'wecom' ||
    platformId === 'wecom-app' ||
    platformId === 'wecom-kf' ||
    platformId === 'wechat-mp';

  if (bindingScope === 'private') {
    return {
      dmPolicy: 'open',
      groupPolicy: 'disabled',
    };
  }

  if (bindingScope === 'group') {
    return {
      dmPolicy: supportsDisabledDm ? 'disabled' : 'pairing',
      groupPolicy: 'open',
    };
  }

  return {
    dmPolicy: 'open',
    groupPolicy: 'open',
  };
}

function resolveRequireMention(triggerMode: ManagedImBotTriggerMode): boolean {
  return triggerMode === 'mention';
}

function inferBindingScope(params: {
  platformId: ManagedImBotPlatformId;
  dmPolicy?: string;
  groupPolicy?: string;
}): ManagedImBotBindingScope {
  const dmPolicy = trimText(params.dmPolicy).toLowerCase();
  const groupPolicy = trimText(params.groupPolicy).toLowerCase();
  const supportsDisabledDm =
    params.platformId === 'wecom' ||
    params.platformId === 'wecom-app' ||
    params.platformId === 'wecom-kf' ||
    params.platformId === 'wechat-mp';

  if (groupPolicy === 'disabled') {
    return 'private';
  }
  if ((supportsDisabledDm && dmPolicy === 'disabled') || (!supportsDisabledDm && dmPolicy === 'pairing')) {
    return 'group';
  }
  return 'organization';
}

function inferTriggerMode(requireMention: unknown): ManagedImBotTriggerMode {
  return requireMention === true ? 'mention' : 'all';
}

function buildDingtalkConfig(bot: ManagedImBotRuntimeRecord): JsonRecord | null {
  const credentials = trimStringRecord(bot.credentials);
  if (!credentials.client_id || !credentials.client_secret) {
    return null;
  }
  const { dmPolicy, groupPolicy } = resolvePolicies(bot.platformId, bot.bindingScope);
  return {
    enabled: bot.enabled,
    name: bot.name,
    clientId: credentials.client_id,
    clientSecret: credentials.client_secret,
    connectionMode: 'stream',
    dmPolicy,
    groupPolicy,
    requireMention: resolveRequireMention(bot.triggerMode),
    enableAICard: bot.replyFormat === 'card',
  };
}

function buildFeishuConfig(bot: ManagedImBotRuntimeRecord): JsonRecord | null {
  const credentials = trimStringRecord(bot.credentials);
  if (!credentials.app_id || !credentials.app_secret) {
    return null;
  }
  const { dmPolicy, groupPolicy } = resolvePolicies(bot.platformId, bot.bindingScope);
  return {
    enabled: bot.enabled,
    appId: credentials.app_id,
    appSecret: credentials.app_secret,
    connectionMode: 'websocket',
    dmPolicy,
    groupPolicy,
    requireMention: resolveRequireMention(bot.triggerMode),
    sendMarkdownAsCard: bot.replyFormat === 'card',
  };
}

function buildWecomConfig(bot: ManagedImBotRuntimeRecord): JsonRecord | null {
  const credentials = trimStringRecord(bot.credentials);
  if (!credentials.bot_id || !credentials.secret) {
    return null;
  }
  const { dmPolicy, groupPolicy } = resolvePolicies(bot.platformId, bot.bindingScope);
  return {
    enabled: bot.enabled,
    name: bot.name,
    mode: 'ws',
    botId: credentials.bot_id,
    secret: credentials.secret,
    dmPolicy,
    groupPolicy,
    requireMention: resolveRequireMention(bot.triggerMode),
  };
}

function buildWecomAppConfig(bot: ManagedImBotRuntimeRecord): JsonRecord | null {
  const credentials = trimStringRecord(bot.credentials);
  if (!credentials.corp_id || !credentials.secret || !credentials.agent_id) {
    return null;
  }
  const { dmPolicy, groupPolicy } = resolvePolicies(bot.platformId, bot.bindingScope);
  const agentId = coerceNumber(credentials.agent_id);
  if (!agentId) {
    return null;
  }
  return {
    enabled: bot.enabled,
    name: bot.name,
    corpId: credentials.corp_id,
    corpSecret: credentials.secret,
    agentId,
    webhookPath: parseWebhookPath(credentials, '/wecom-app'),
    token: trimTextOrUndefined(credentials.token),
    encodingAESKey: trimTextOrUndefined(credentials.encoding_aes_key),
    receiveId: credentials.corp_id,
    dmPolicy,
    groupPolicy,
    requireMention: resolveRequireMention(bot.triggerMode),
  };
}

function buildWecomKfConfig(bot: ManagedImBotRuntimeRecord): JsonRecord | null {
  const credentials = trimStringRecord(bot.credentials);
  if (!credentials.corp_id || !credentials.secret || !credentials.open_kf_id) {
    return null;
  }
  const { dmPolicy } = resolvePolicies(bot.platformId, bot.bindingScope);
  return {
    enabled: bot.enabled,
    name: bot.name,
    corpId: credentials.corp_id,
    corpSecret: credentials.secret,
    openKfId: credentials.open_kf_id,
    webhookPath: parseWebhookPath(credentials, '/wecom-kf'),
    token: trimTextOrUndefined(credentials.token),
    encodingAESKey: trimTextOrUndefined(credentials.encoding_aes_key),
    dmPolicy,
  };
}

function buildQqbotConfig(bot: ManagedImBotRuntimeRecord): JsonRecord | null {
  const credentials = trimStringRecord(bot.credentials);
  if (!credentials.app_id || !credentials.app_secret) {
    return null;
  }
  const { dmPolicy, groupPolicy } = resolvePolicies(bot.platformId, bot.bindingScope);
  return {
    enabled: bot.enabled,
    name: bot.name,
    appId: credentials.app_id,
    clientSecret: credentials.app_secret,
    markdownSupport: bot.replyFormat !== 'text',
    dmPolicy,
    groupPolicy,
    requireMention: resolveRequireMention(bot.triggerMode),
  };
}

function buildWechatMpConfig(bot: ManagedImBotRuntimeRecord): JsonRecord | null {
  const credentials = trimStringRecord(bot.credentials);
  if (!credentials.app_id || !credentials.app_secret) {
    return null;
  }
  const { dmPolicy } = resolvePolicies(bot.platformId, bot.bindingScope);
  return {
    enabled: bot.enabled,
    name: bot.name,
    appId: credentials.app_id,
    appSecret: credentials.app_secret,
    token: trimTextOrUndefined(credentials.token),
    encodingAESKey: trimTextOrUndefined(credentials.encoding_aes_key),
    webhookPath: parseWebhookPath(credentials, '/wechat-mp'),
    messageMode: credentials.encoding_aes_key ? 'safe' : 'plain',
    replyMode: 'active',
    activeDeliveryMode: 'split',
    dmPolicy,
  };
}

function buildPlatformChannelConfig(bot: ManagedImBotRuntimeRecord): JsonRecord | null {
  switch (bot.platformId) {
    case 'dingtalk':
      return buildDingtalkConfig(bot);
    case 'feishu-china':
      return buildFeishuConfig(bot);
    case 'wecom':
      return buildWecomConfig(bot);
    case 'wecom-app':
      return buildWecomAppConfig(bot);
    case 'wecom-kf':
      return buildWecomKfConfig(bot);
    case 'qqbot':
      return buildQqbotConfig(bot);
    case 'wechat-mp':
      return buildWechatMpConfig(bot);
    case 'openclaw-weixin':
      return null;
  }
}

function defaultReplyFormatForPlatform(platformId: ManagedImBotPlatformId): ManagedImBotReplyFormat {
  if (platformId === 'dingtalk' || platformId === 'qqbot' || platformId === 'wechat-mp') {
    return 'markdown';
  }
  return 'card';
}

function restoreDingtalkConfig(channelConfig: JsonRecord): ManagedImBotRuntimeRecord | null {
  const clientId = trimText(channelConfig.clientId);
  const clientSecret = trimText(channelConfig.clientSecret);
  if (!clientId || !clientSecret) {
    return null;
  }
  return {
    platformId: 'dingtalk',
    enabled: coerceBoolean(channelConfig.enabled, true),
    name: trimText(channelConfig.name) || '钉钉办公助手',
    bindingScope: inferBindingScope({
      platformId: 'dingtalk',
      dmPolicy: trimText(channelConfig.dmPolicy),
      groupPolicy: trimText(channelConfig.groupPolicy),
    }),
    triggerMode: inferTriggerMode(channelConfig.requireMention),
    replyFormat: channelConfig.enableAICard === true ? 'card' : 'markdown',
    credentials: {
      client_id: clientId,
      client_secret: clientSecret,
    },
  };
}

function restoreFeishuConfig(channelConfig: JsonRecord): ManagedImBotRuntimeRecord | null {
  const appId = trimText(channelConfig.appId);
  const appSecret = trimText(channelConfig.appSecret);
  if (!appId || !appSecret) {
    return null;
  }
  return {
    platformId: 'feishu-china',
    enabled: coerceBoolean(channelConfig.enabled, true),
    name: '飞书办公助手',
    bindingScope: inferBindingScope({
      platformId: 'feishu-china',
      dmPolicy: trimText(channelConfig.dmPolicy),
      groupPolicy: trimText(channelConfig.groupPolicy),
    }),
    triggerMode: inferTriggerMode(channelConfig.requireMention),
    replyFormat: channelConfig.sendMarkdownAsCard === true ? 'card' : 'markdown',
    credentials: {
      app_id: appId,
      app_secret: appSecret,
    },
  };
}

function restoreWecomConfig(channelConfig: JsonRecord): ManagedImBotRuntimeRecord | null {
  const botId = trimText(channelConfig.botId);
  const secret = trimText(channelConfig.secret);
  if (!botId || !secret) {
    return null;
  }
  return {
    platformId: 'wecom',
    enabled: coerceBoolean(channelConfig.enabled, true),
    name: trimText(channelConfig.name) || '企微机器人',
    bindingScope: inferBindingScope({
      platformId: 'wecom',
      dmPolicy: trimText(channelConfig.dmPolicy),
      groupPolicy: trimText(channelConfig.groupPolicy),
    }),
    triggerMode: inferTriggerMode(channelConfig.requireMention),
    replyFormat: 'card',
    credentials: {
      bot_id: botId,
      secret,
    },
  };
}

function restoreWecomAppConfig(channelConfig: JsonRecord): ManagedImBotRuntimeRecord | null {
  const corpId = trimText(channelConfig.corpId);
  const corpSecret = trimText(channelConfig.corpSecret);
  const agentId = coerceNumber(channelConfig.agentId);
  if (!corpId || !corpSecret || !agentId) {
    return null;
  }
  return {
    platformId: 'wecom-app',
    enabled: coerceBoolean(channelConfig.enabled, true),
    name: trimText(channelConfig.name) || '企微自建应用助手',
    bindingScope: inferBindingScope({
      platformId: 'wecom-app',
      dmPolicy: trimText(channelConfig.dmPolicy),
      groupPolicy: trimText(channelConfig.groupPolicy),
    }),
    triggerMode: inferTriggerMode(channelConfig.requireMention),
    replyFormat: 'card',
    credentials: {
      corp_id: corpId,
      secret: corpSecret,
      agent_id: String(agentId),
      callback_url: trimText(channelConfig.webhookPath),
      token: trimText(channelConfig.token),
      encoding_aes_key: trimText(channelConfig.encodingAESKey),
    },
  };
}

function restoreWecomKfConfig(channelConfig: JsonRecord): ManagedImBotRuntimeRecord | null {
  const corpId = trimText(channelConfig.corpId);
  const corpSecret = trimText(channelConfig.corpSecret);
  const openKfId = trimText(channelConfig.openKfId);
  if (!corpId || !corpSecret || !openKfId) {
    return null;
  }
  return {
    platformId: 'wecom-kf',
    enabled: coerceBoolean(channelConfig.enabled, true),
    name: trimText(channelConfig.name) || '企微客服助手',
    bindingScope: inferBindingScope({
      platformId: 'wecom-kf',
      dmPolicy: trimText(channelConfig.dmPolicy),
    }),
    triggerMode: 'all',
    replyFormat: 'card',
    credentials: {
      corp_id: corpId,
      secret: corpSecret,
      open_kf_id: openKfId,
      callback_url: trimText(channelConfig.webhookPath),
      token: trimText(channelConfig.token),
      encoding_aes_key: trimText(channelConfig.encodingAESKey),
    },
  };
}

function restoreQqbotConfig(channelConfig: JsonRecord): ManagedImBotRuntimeRecord | null {
  const appId = trimText(channelConfig.appId);
  const clientSecret = trimText(channelConfig.clientSecret);
  if (!appId || !clientSecret) {
    return null;
  }
  return {
    platformId: 'qqbot',
    enabled: coerceBoolean(channelConfig.enabled, true),
    name: trimText(channelConfig.name) || 'QQ 办公助手',
    bindingScope: inferBindingScope({
      platformId: 'qqbot',
      dmPolicy: trimText(channelConfig.dmPolicy),
      groupPolicy: trimText(channelConfig.groupPolicy),
    }),
    triggerMode: inferTriggerMode(channelConfig.requireMention),
    replyFormat: channelConfig.markdownSupport === false ? 'text' : 'markdown',
    credentials: {
      app_id: appId,
      app_secret: clientSecret,
    },
  };
}

function restoreWechatMpConfig(channelConfig: JsonRecord): ManagedImBotRuntimeRecord | null {
  const appId = trimText(channelConfig.appId);
  const appSecret = trimText(channelConfig.appSecret);
  if (!appId || !appSecret) {
    return null;
  }
  return {
    platformId: 'wechat-mp',
    enabled: coerceBoolean(channelConfig.enabled, true),
    name: trimText(channelConfig.name) || '公众号助手',
    bindingScope: inferBindingScope({
      platformId: 'wechat-mp',
      dmPolicy: trimText(channelConfig.dmPolicy),
    }),
    triggerMode: 'all',
    replyFormat: 'markdown',
    credentials: {
      app_id: appId,
      app_secret: appSecret,
      callback_url: trimText(channelConfig.webhookPath),
      token: trimText(channelConfig.token),
      encoding_aes_key: trimText(channelConfig.encodingAESKey),
    },
  };
}

function restorePlatformChannelConfig(
  platformId: ManagedImBotPlatformId,
  channelConfig: JsonRecord,
): ManagedImBotRuntimeRecord | null {
  switch (platformId) {
    case 'dingtalk':
      return restoreDingtalkConfig(channelConfig);
    case 'feishu-china':
      return restoreFeishuConfig(channelConfig);
    case 'wecom':
      return restoreWecomConfig(channelConfig);
    case 'wecom-app':
      return restoreWecomAppConfig(channelConfig);
    case 'wecom-kf':
      return restoreWecomKfConfig(channelConfig);
    case 'qqbot':
      return restoreQqbotConfig(channelConfig);
    case 'wechat-mp':
      return restoreWechatMpConfig(channelConfig);
    case 'openclaw-weixin':
      return {
        platformId: 'openclaw-weixin',
        enabled: true,
        name: '微信助手',
        bindingScope: 'private',
        triggerMode: 'all',
        replyFormat: defaultReplyFormatForPlatform('openclaw-weixin'),
        credentials: {},
      };
  }
}

export function buildRuntimeConfigWithManagedImBots(
  currentConfig: JsonRecord | null | undefined,
  bots: ManagedImBotRuntimeRecord[],
): JsonRecord {
  const nextConfig = cloneJson(isRecord(currentConfig) ? currentConfig : {});
  const nextChannels = isRecord(nextConfig.channels) ? cloneJson(nextConfig.channels) : {};
  const managedPlatforms = new Set<ManagedImBotPlatformId>([
    'dingtalk',
    'feishu-china',
    'wecom',
    'wecom-app',
    'wecom-kf',
    'qqbot',
    'wechat-mp',
  ]);

  for (const platformId of managedPlatforms) {
    delete nextChannels[platformId];
  }

  for (const bot of bots) {
    const channelConfig = buildPlatformChannelConfig(bot);
    if (channelConfig) {
      nextChannels[bot.platformId] = channelConfig;
    }
  }

  if (Object.keys(nextChannels).length > 0) {
    nextConfig.channels = nextChannels;
  } else {
    delete nextConfig.channels;
  }

  return nextConfig;
}

export function restoreManagedImBotsFromRuntimeConfig(
  currentConfig: JsonRecord | null | undefined,
): ManagedImBotRuntimeRecord[] {
  if (!isRecord(currentConfig) || !isRecord(currentConfig.channels)) {
    return [];
  }
  const channels = currentConfig.channels;
  const platformIds: ManagedImBotPlatformId[] = [
    'dingtalk',
    'feishu-china',
    'wecom',
    'wecom-app',
    'wecom-kf',
    'qqbot',
    'wechat-mp',
    'openclaw-weixin',
  ];

  return platformIds
    .map((platformId) => {
      const channelConfig = channels[platformId];
      if (!isRecord(channelConfig)) {
        return null;
      }
      return restorePlatformChannelConfig(platformId, channelConfig);
    })
    .filter((item): item is ManagedImBotRuntimeRecord => Boolean(item));
}
