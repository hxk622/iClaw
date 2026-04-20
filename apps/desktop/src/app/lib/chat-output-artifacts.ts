export type ChatTurnOutputArtifactKind =
  | 'ppt'
  | 'file'
  | 'md'
  | 'pdf'
  | 'word'
  | 'excel'
  | 'html'
  | 'code';

export interface ChatTurnOutputArtifactRecord {
  protocolVersion: 1;
  kind: ChatTurnOutputArtifactKind;
  title: string;
  path: string;
  mimeType?: string | null;
  autoOpen?: boolean;
  finalOutput: true;
}

export interface ParsedChatTurnOutputArtifacts {
  cleanedAnswer: string;
  outputArtifacts: ChatTurnOutputArtifactRecord[];
}

export interface ChatTurnOutputArtifactCarrier {
  id: string;
  source: 'chat' | 'cron';
  status: 'running' | 'completed' | 'failed';
  conversationId: string;
  outputArtifacts?: ChatTurnOutputArtifactRecord[];
}

const OUTPUT_ARTIFACTS_BLOCK_PATTERN =
  /<!--\s*OUTPUT_ARTIFACTS_V1\s*(\{[\s\S]*?\})\s*-->/gi;

function collapseText(value: string | null | undefined, maxLength = 400): string {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function isOutputArtifactKind(value: string | null | undefined): value is ChatTurnOutputArtifactKind {
  return (
    value === 'ppt' ||
    value === 'file' ||
    value === 'md' ||
    value === 'pdf' ||
    value === 'word' ||
    value === 'excel' ||
    value === 'html' ||
    value === 'code'
  );
}

function normalizeOutputArtifactRecord(value: unknown): ChatTurnOutputArtifactRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const source = value as Record<string, unknown>;
  const kind = typeof source.kind === 'string' ? source.kind.trim().toLowerCase() : '';
  const title = collapseText(typeof source.title === 'string' ? source.title : null, 160);
  const path = collapseText(typeof source.path === 'string' ? source.path : null, 400);
  if (!isOutputArtifactKind(kind) || !title || !path) {
    return null;
  }
  return {
    protocolVersion: 1,
    kind,
    title,
    path,
    mimeType: collapseText(typeof source.mimeType === 'string' ? source.mimeType : null, 120) || null,
    autoOpen: source.autoOpen === false ? false : source.autoOpen === true ? true : undefined,
    finalOutput: true,
  };
}

export function parseChatTurnOutputArtifacts(answer: string | null | undefined): ParsedChatTurnOutputArtifacts {
  const source = String(answer || '');
  const outputArtifacts: ChatTurnOutputArtifactRecord[] = [];

  const cleanedAnswer = source
    .replace(OUTPUT_ARTIFACTS_BLOCK_PATTERN, (_, rawPayload) => {
      try {
        const parsed = JSON.parse(rawPayload) as { artifacts?: unknown[] };
        const artifacts = Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
        artifacts.forEach((artifact) => {
          const normalized = normalizeOutputArtifactRecord(artifact);
          if (normalized) {
            outputArtifacts.push(normalized);
          }
        });
      } catch {
        // Ignore malformed protocol blocks and keep them stripped from the rendered answer.
      }
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    cleanedAnswer,
    outputArtifacts,
  };
}

export function buildOutputArtifactsProtocolInstruction(input: {
  selectedOutput?: string | null;
  selectedOutputLabel?: string | null;
}): string {
  const outputHint = input.selectedOutputLabel
    ? `如果你本轮最终交付物确实形成了「${input.selectedOutputLabel}」对应的文件或页面，请声明它。`
    : '如果你本轮最终交付物确实形成了文件或页面，请声明它。';

  return [
    '仅当本轮最终交付给用户的是实际成果文件/页面时，才在回答末尾追加一个不可见的 HTML 注释协议块。',
    '中间输入物（Read/Web Fetch/Memory Search/引用资料/附件读取）绝不能写进该协议。',
    outputHint,
    '协议格式如下，不要放进代码块：',
    '<!-- OUTPUT_ARTIFACTS_V1 {"artifacts":[{"kind":"md","title":"示例标题","path":"workspace/outputs/example.md","mimeType":"text/markdown","autoOpen":true,"finalOutput":true}]} -->',
    '如果没有最终成果文件或页面，就不要输出 OUTPUT_ARTIFACTS_V1。',
  ].join('\n');
}

export function selectAutoOpenOutputArtifact(
  turns: ChatTurnOutputArtifactCarrier[],
  conversationId: string | null | undefined,
): { turnId: string; artifact: ChatTurnOutputArtifactRecord } | null {
  const normalizedConversationId = String(conversationId || '').trim();
  if (!normalizedConversationId) {
    return null;
  }

  for (const turn of turns) {
    if (
      turn.source !== 'chat' ||
      turn.status !== 'completed' ||
      String(turn.conversationId || '').trim() !== normalizedConversationId
    ) {
      continue;
    }

    const artifact = (turn.outputArtifacts ?? []).find(
      (item) => item.finalOutput === true && item.autoOpen !== false,
    );
    if (artifact) {
      return {
        turnId: turn.id,
        artifact,
      };
    }
  }

  return null;
}
