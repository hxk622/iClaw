import type {McpCatalogEntryRecord} from './domain.ts';

export type DefaultCloudMcpSeed = Omit<McpCatalogEntryRecord, 'createdAt' | 'updatedAt'>;

function cloneObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const DEFAULT_CLOUD_MCP_SEEDS: DefaultCloudMcpSeed[] = [
  {
    mcpKey: 'lark',
    name: '飞书 CLI',
    description: '文档、消息与组织协作工作流。',
    transport: 'http',
    objectKey: null,
    config: {},
    metadata: {
      sourceType: 'default_seed',
      sourceLabel: 'system bootstrap',
      official: true,
      featured: true,
      tier: 'p0',
      publisher: 'Lark / Feishu',
      requiresApiKey: true,
      channel: 'official',
      categories: ['生产力', '团队协作'],
      tags: ['feishu', 'lark', 'docs', 'chat', '官方精选'],
      setup_schema: {
        version: 1,
        fields: [
          {
            key: 'app_id',
            label: 'App ID',
            type: 'text',
            required: true,
            inject_as: 'LARK_APP_ID',
            placeholder: 'cli_xxx 或 a-xxx',
            help_text: '填写飞书开放平台应用的 App ID。',
          },
          {
            key: 'app_secret',
            label: 'App Secret',
            type: 'secret',
            required: true,
            inject_as: 'LARK_APP_SECRET',
            placeholder: '应用密钥',
            help_text: '填写飞书开放平台应用的 App Secret。',
          },
        ],
      },
      docsUrl: 'https://open.feishu.cn/document/home/index',
      homepageUrl: 'https://www.larksuite.com/',
    },
    active: true,
  },
  {
    mcpKey: 'dingtalk',
    name: '钉钉 CLI',
    description: '机器人消息、群通知与组织协作工作流。',
    transport: 'http',
    objectKey: null,
    config: {},
    metadata: {
      sourceType: 'default_seed',
      sourceLabel: 'system bootstrap',
      official: true,
      featured: true,
      tier: 'p0',
      publisher: 'DingTalk',
      requiresApiKey: true,
      channel: 'official',
      categories: ['生产力', '团队协作'],
      tags: ['dingtalk', 'chat', 'robot', 'workflow', '官方精选'],
      setup_schema: {
        version: 1,
        fields: [
          {
            key: 'client_id',
            label: 'Client ID',
            type: 'text',
            required: true,
            inject_as: 'DINGTALK_CLIENT_ID',
            placeholder: 'dingxxxxxxxx',
            help_text: '填写钉钉开放平台应用的 Client ID。',
          },
          {
            key: 'client_secret',
            label: 'Client Secret',
            type: 'secret',
            required: true,
            inject_as: 'DINGTALK_CLIENT_SECRET',
            placeholder: '应用密钥',
            help_text: '填写钉钉开放平台应用的 Client Secret。',
          },
        ],
      },
      docsUrl: 'https://open.dingtalk.com/document/',
      homepageUrl: 'https://www.dingtalk.com/',
    },
    active: true,
  },
  {
    mcpKey: 'wecom',
    name: '企微 CLI',
    description: '企业微信消息、应用通知与组织协作数据接入。',
    transport: 'http',
    objectKey: null,
    config: {},
    metadata: {
      sourceType: 'default_seed',
      sourceLabel: 'system bootstrap',
      official: true,
      featured: true,
      tier: 'p0',
      publisher: 'WeCom / 企业微信',
      requiresApiKey: true,
      channel: 'official',
      categories: ['生产力', '团队协作'],
      tags: ['wecom', 'wechat-work', 'enterprise-wechat', 'chat', '官方精选'],
      setup_schema: {
        version: 1,
        fields: [
          {
            key: 'corp_id',
            label: 'Corp ID',
            type: 'text',
            required: true,
            inject_as: 'WECOM_CORP_ID',
            placeholder: 'wwxxxxxxxx',
            help_text: '填写企业微信管理后台中的企业 ID。',
          },
          {
            key: 'agent_id',
            label: 'Agent ID',
            type: 'text',
            required: true,
            inject_as: 'WECOM_AGENT_ID',
            placeholder: '1000002',
            help_text: '填写企业应用的 AgentId。',
          },
          {
            key: 'agent_secret',
            label: 'Agent Secret',
            type: 'secret',
            required: true,
            inject_as: 'WECOM_AGENT_SECRET',
            placeholder: '应用密钥',
            help_text: '填写企业微信应用 Secret。',
          },
        ],
      },
      docsUrl: 'https://developer.work.weixin.qq.com/document/path/90252',
      homepageUrl: 'https://work.weixin.qq.com/',
    },
    active: true,
  },
];

export function createDefaultMcpCatalogEntries(now: string): McpCatalogEntryRecord[] {
  return DEFAULT_CLOUD_MCP_SEEDS.map((entry) => ({
    mcpKey: entry.mcpKey,
    name: entry.name,
    description: entry.description,
    transport: entry.transport,
    objectKey: entry.objectKey,
    config: cloneObject(entry.config),
    metadata: cloneObject(entry.metadata),
    active: entry.active,
    createdAt: now,
    updatedAt: now,
  }));
}
