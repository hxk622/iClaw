import type { KnowledgeLibraryRepository } from './repository';
import type { KnowledgeLibraryItem, KnowledgeLibraryTab } from './model';
import type { OutputArtifact } from './output-types';
import type { OntologyDocument } from './ontology-types';

export interface ExtractedChatFeedback {
  latestUserText: string | null;
  latestAssistantText: string | null;
}

function normalizeText(value: string, maxLength = 12000): string {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function extractChatFeedbackFromContainer(container: HTMLElement | null): ExtractedChatFeedback {
  if (!container) {
    return { latestUserText: null, latestAssistantText: null };
  }
  const pickLatest = (selector: string) => {
    const nodes = Array.from(container.querySelectorAll<HTMLElement>(selector))
      .map((node) => normalizeText(node.innerText || node.textContent || '', 4000))
      .filter(Boolean);
    return nodes.length > 0 ? nodes[nodes.length - 1] : null;
  };
  return {
    latestUserText: pickLatest('.chat-group.user .chat-text, .chat-group.user .chat-message'),
    latestAssistantText: pickLatest('.chat-group.assistant .chat-text, .chat-group.assistant .chat-message'),
  };
}

function currentItemSourceRawIds(item: KnowledgeLibraryItem | null): string[] {
  if (!item) return [];
  if (item.rawMaterial) return [item.rawMaterial.id];
  if (item.ontologyDocument) return item.ontologyDocument.source_raw_ids || [];
  if (item.outputArtifact) return item.outputArtifact.source_raw_ids || [];
  return [];
}

function currentItemSourceOntologyIds(item: KnowledgeLibraryItem | null): string[] {
  if (!item) return [];
  if (item.ontologyDocument) return [item.ontologyDocument.id];
  if (item.outputArtifact) return item.outputArtifact.source_ontology_ids || [];
  return [];
}

export function resolveKnowledgeLibraryItemSourceContext(item: KnowledgeLibraryItem | null): {
  rawMaterialIds: string[];
  ontologyIds: string[];
} {
  return {
    rawMaterialIds: currentItemSourceRawIds(item),
    ontologyIds: currentItemSourceOntologyIds(item),
  };
}

export function buildGraphQueryMemoryRawMaterialInput(input: {
  selectedItem: KnowledgeLibraryItem | null;
  question: string;
  answer: string;
  queryType: 'query' | 'path_query' | 'explain';
  sourceNodes?: string[];
  savedPath?: string | null;
}) {
  const titlePrefix =
    input.queryType === 'path_query'
      ? '图路径沉淀'
      : input.queryType === 'explain'
        ? '节点解释沉淀'
        : '图查询沉淀';
  const title = `${titlePrefix}：${input.selectedItem?.title || '未命名对象'}`;
  const answer = normalizeText(input.answer || '', 12000);
  const question = normalizeText(input.question || '', 1200);
  const sourceNodes = Array.isArray(input.sourceNodes) ? input.sourceNodes.filter(Boolean).slice(0, 8) : [];
  return {
    kind: 'chat' as const,
    title,
    excerpt: normalizeText(answer, 240),
    content_text: `# ${title}\n\n## Question\n${question || '未记录'}\n\n## Answer\n${answer || '未记录'}${
      sourceNodes.length > 0 ? `\n\n## Source Nodes\n${sourceNodes.map((node) => `- ${node}`).join('\n')}` : ''
    }${input.savedPath ? `\n\n## 图谱记忆\n${input.savedPath}` : ''}`,
    source_name: '图谱查询记忆',
    source_type: 'chat' as const,
    tags: ['图谱查询', '关系记忆', input.queryType === 'path_query' ? '路径' : '问答'],
    note: question || null,
    dedupe_key: `graphify-memory::${input.selectedItem?.id || 'unknown'}::${input.queryType}::${question.toLowerCase()}`,
  };
}

export async function saveChatFeedbackAsRaw(input: {
  repository: KnowledgeLibraryRepository;
  activeTab: KnowledgeLibraryTab;
  selectedItem: KnowledgeLibraryItem | null;
  feedback: ExtractedChatFeedback;
}) {
  const content = normalizeText(input.feedback.latestAssistantText || input.feedback.latestUserText || '', 8000);
  if (!content) return null;
  return input.repository.createRawMaterial({
    kind: 'chat',
    title: `对话沉淀：${input.selectedItem?.title || '未命名对象'}`,
    excerpt: normalizeText(content, 240),
    content_text: content,
    source_name: '知识库对话',
    source_type: 'chat',
    tags: ['对话沉淀', input.activeTab === 'graph' ? '本体图谱' : input.activeTab === 'artifacts' ? '成果' : '素材'],
    note: input.feedback.latestUserText || null,
  });
}

export async function saveChatFeedbackAsOntologyClaim(input: {
  repository: KnowledgeLibraryRepository;
  selectedItem: KnowledgeLibraryItem | null;
  feedback: ExtractedChatFeedback;
}): Promise<OntologyDocument | null> {
  const content = normalizeText(input.feedback.latestAssistantText || '', 8000);
  if (!content) return null;
  const raw = await input.repository.createRawMaterial({
    kind: 'chat',
    title: `Claim：${input.selectedItem?.title || '未命名对象'}`,
    excerpt: normalizeText(content, 240),
    content_text: content,
    source_name: '知识库 Claim',
    source_type: 'chat',
    tags: ['Claim', '对话沉淀', '本体图谱'],
    note: input.feedback.latestUserText || null,
  });
  const documents = await input.repository.compileRawMaterialsToOntology([raw]);
  return documents[0] || null;
}

export async function saveChatFeedbackAsMemo(input: {
  repository: KnowledgeLibraryRepository;
  selectedItem: KnowledgeLibraryItem | null;
  feedback: ExtractedChatFeedback;
}): Promise<OutputArtifact | null> {
  const content = normalizeText(input.feedback.latestAssistantText || '', 16000);
  if (!content) return null;
  return input.repository.upsertOutputArtifact({
    type: 'memo',
    title: `${input.selectedItem?.title || '未命名对象'} 对话 Memo`,
    summary: normalizeText(content, 240),
    content: `# 对话 Memo\n\n## 用户问题\n${input.feedback.latestUserText || '未记录'}\n\n## AI 结论\n${content}`,
    content_format: 'markdown',
    source_raw_ids: currentItemSourceRawIds(input.selectedItem),
    source_ontology_ids: currentItemSourceOntologyIds(input.selectedItem),
    status: 'draft',
    publish_targets: [],
    metadata: {
      generated_from: 'chat-feedback',
    },
  });
}
