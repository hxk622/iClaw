import type { KnowledgeLibraryRepository } from './repository';
import type { ThoughtLibraryItem, ThoughtLibraryTab } from './model';
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

function currentItemSourceRawIds(item: ThoughtLibraryItem | null): string[] {
  if (!item) return [];
  if (item.rawMaterial) return [item.rawMaterial.id];
  if (item.ontologyDocument) return item.ontologyDocument.source_raw_ids || [];
  if (item.outputArtifact) return item.outputArtifact.source_raw_ids || [];
  return [];
}

function currentItemSourceOntologyIds(item: ThoughtLibraryItem | null): string[] {
  if (!item) return [];
  if (item.ontologyDocument) return [item.ontologyDocument.id];
  if (item.outputArtifact) return item.outputArtifact.source_ontology_ids || [];
  return [];
}

export async function saveChatFeedbackAsRaw(input: {
  repository: KnowledgeLibraryRepository;
  activeTab: ThoughtLibraryTab;
  selectedItem: ThoughtLibraryItem | null;
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
  selectedItem: ThoughtLibraryItem | null;
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
  selectedItem: ThoughtLibraryItem | null;
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
