export type ChatSemanticTone = 'insight' | 'action' | 'warning' | 'danger' | 'note';

export type ChatSemanticDirective = {
  tone: ChatSemanticTone;
  title: string | null;
};

export type ChatSemanticLeadMatch = {
  tone: ChatSemanticTone;
  title: string;
  label: string;
  matchedPrefix: string;
  remainder: string;
  standalone: boolean;
};

type ChatSemanticRule = {
  tone: ChatSemanticTone;
  defaultTitle: string;
  labels: string[];
};

const CHAT_SEMANTIC_RULES: ChatSemanticRule[] = [
  {
    tone: 'insight',
    defaultTitle: '关键结论',
    labels: ['关键结论', '核心结论', '核心判断', '结论', '关键发现'],
  },
  {
    tone: 'action',
    defaultTitle: '建议操作',
    labels: ['建议操作', '操作建议', '下一步', '实施步骤', '建议'],
  },
  {
    tone: 'warning',
    defaultTitle: '注意事项',
    labels: ['注意事项', '注意', '限制条件', '限制'],
  },
  {
    tone: 'danger',
    defaultTitle: '风险提示',
    labels: ['关键风险', '风险提示', '失败原因', '错误原因', '风险', '错误'],
  },
  {
    tone: 'note',
    defaultTitle: '补充说明',
    labels: ['补充说明', '补充资料', '补充', '备注', '提示', '参考资料', '参考'],
  },
];

const CHAT_SEMANTIC_DIRECTIVE_PATTERN = /^:::(insight|action|warning|danger|note)(?:\s+(.+?))?\s*$/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeInput(value: string): string {
  return value.replace(/\u00a0/g, ' ').trim();
}

export function resolveChatSemanticDefaultTitle(tone: ChatSemanticTone): string {
  return CHAT_SEMANTIC_RULES.find((rule) => rule.tone === tone)?.defaultTitle ?? '补充说明';
}

export function parseChatSemanticDirective(value: string): ChatSemanticDirective | null {
  const normalized = normalizeInput(value);
  const match = normalized.match(CHAT_SEMANTIC_DIRECTIVE_PATTERN);
  if (!match) {
    return null;
  }

  const tone = match[1].toLowerCase() as ChatSemanticTone;
  const title = match[2]?.trim() || null;
  return {
    tone,
    title,
  };
}

export function isChatSemanticDirectiveClose(value: string): boolean {
  return normalizeInput(value) === ':::';
}

export function matchChatSemanticLead(value: string): ChatSemanticLeadMatch | null {
  const normalized = normalizeInput(value);
  if (!normalized) {
    return null;
  }

  for (const rule of CHAT_SEMANTIC_RULES) {
    const labels = [...rule.labels].sort((left, right) => right.length - left.length);
    for (const label of labels) {
      const standalonePattern = new RegExp(`^${escapeRegExp(label)}\\s*[：:：]?\\s*$`);
      if (standalonePattern.test(normalized)) {
        return {
          tone: rule.tone,
          title: label,
          label,
          matchedPrefix: normalized,
          remainder: '',
          standalone: true,
        };
      }

      const inlinePattern = new RegExp(`^(${escapeRegExp(label)}\\s*[：:]\\s*)([\\s\\S]+)$`);
      const inlineMatch = normalized.match(inlinePattern);
      if (inlineMatch) {
        return {
          tone: rule.tone,
          title: label,
          label,
          matchedPrefix: inlineMatch[1],
          remainder: inlineMatch[2].trim(),
          standalone: false,
        };
      }
    }
  }

  return null;
}
