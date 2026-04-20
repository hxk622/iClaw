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

  return `你当前正在围绕知识库中的一个${layerLabel}对象工作，请把它作为本轮对话的首要上下文。\n\n标题：${input.item.title}\n副标题：${input.item.subtitle}\n标签：${input.item.tags.join('、') || '无'}\n备注：${input.item.meta}\n摘要：${input.item.summary}${sourceLabel ? `\n来源：${sourceLabel}` : ''}${sourceUrl ? `\n来源链接：${sourceUrl}` : ''}${bodyText ? `\n正文：\n${bodyText.slice(0, 4000)}` : ''}${graphifySummary ? `\n\n结构导航摘要：\n${graphifySummary}` : ''}\n\n请优先基于这个对象及其图谱摘要协作，只在证据不足时再回拉原始素材。先用 3 行以内说明你将如何继续协作，然后等待用户下一步提问。`;
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
  })}\n\n图谱查询问题：${normalizeText(input.question, 400)}\n\n图谱查询结果：\n${normalizeText(
    input.queryResult,
    6000,
  )}\n\n请基于这份图查询结果继续分析，优先引用图中的节点、关系和来源位置，不要脱离图结构发挥。`;
}

export function buildKnowledgeLibraryNodeFocusPrompt(input: {
  tab: KnowledgeLibraryTab;
  item: KnowledgeLibraryItem;
  nodeLabel: string;
  nodeSummary: string;
  neighbors: string[];
}): string {
  return `${buildKnowledgeLibraryContextPrompt({
    tab: input.tab,
    item: input.item,
  })}\n\n当前聚焦节点：${normalizeText(input.nodeLabel, 160)}\n节点摘要：${normalizeText(input.nodeSummary, 1200)}\n相邻节点：${input.neighbors.join('、') || '暂无'}\n\n请围绕这个节点解释它的作用、它与相邻节点的关系、以及下一步最值得继续追问的方向。`;
}

export function buildKnowledgeLibraryShortestPathPrompt(input: {
  tab: KnowledgeLibraryTab;
  item: KnowledgeLibraryItem;
  fromLabel: string;
  toLabel: string;
  pathText: string;
}): string {
  return `${buildKnowledgeLibraryContextPrompt({
    tab: input.tab,
    item: input.item,
  })}\n\n路径问题：从「${normalizeText(input.fromLabel, 160)}」到「${normalizeText(input.toLabel, 160)}」\n\n最短路径结果：\n${normalizeText(
    input.pathText,
    2400,
  )}\n\n请解释这条路径说明了什么、其中每一跳关系的含义、以及可能的证据缺口。`;
}
