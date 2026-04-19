import type { KnowledgeLibraryItem, KnowledgeLibraryTab } from './model';
import { getOutputArtifactByDedupeKey } from './output-storage.ts';

function normalizeText(value: string | null | undefined, maxLength = 2400): string {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function buildKnowledgeLibraryContextPrompt(input: {
  tab: KnowledgeLibraryTab;
  item: KnowledgeLibraryItem;
}): string {
  const layerLabel =
    input.tab === 'materials' ? '素材层' : input.tab === 'graph' ? '本体图谱层' : '成果层';
  const bodyText = input.item.bodyText?.trim();
  const sourceUrl = input.item.sourceUrl?.trim();
  const sourceLabel = input.item.sourceLabel?.trim();
  const graphifyReport =
    input.item.ontologyDocument
      ? getOutputArtifactByDedupeKey(`graphify-report::${input.item.ontologyDocument.id}`)
      : null;
  const graphifySummary = normalizeText(graphifyReport?.content || graphifyReport?.summary || '', 2400);

  return `你当前正在围绕知识库中的一个${layerLabel}对象工作，请把它作为本轮对话的首要上下文。\n\n标题：${input.item.title}\n副标题：${input.item.subtitle}\n标签：${input.item.tags.join('、') || '无'}\n备注：${input.item.meta}\n摘要：${input.item.summary}${sourceLabel ? `\n来源：${sourceLabel}` : ''}${sourceUrl ? `\n来源链接：${sourceUrl}` : ''}${bodyText ? `\n正文：\n${bodyText.slice(0, 4000)}` : ''}${graphifySummary ? `\n\nGraphify 导航摘要：\n${graphifySummary}` : ''}\n\n请优先基于这个对象及其图谱摘要协作，只在证据不足时再回拉原始素材。先用 3 行以内说明你将如何继续协作，然后等待用户下一步提问。`;
}

export function buildKnowledgeLibraryGraphQueryPrompt(input: {
  tab: KnowledgeLibraryTab;
  item: KnowledgeLibraryItem;
  question: string;
  queryResult: string;
}): string {
  return `${buildKnowledgeLibraryContextPrompt({
    tab: input.tab,
    item: input.item,
  })}\n\nGraphify 查询问题：${normalizeText(input.question, 400)}\n\nGraphify 查询结果：\n${normalizeText(
    input.queryResult,
    6000,
  )}\n\n请基于这份图查询结果继续分析，优先引用图中的节点、关系、confidence 和 source location，不要脱离图结构发挥。`;
}
