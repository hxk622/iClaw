import type { KnowledgeLibraryItem, KnowledgeLibraryTab } from './model';

export function buildKnowledgeLibraryContextPrompt(input: {
  tab: KnowledgeLibraryTab;
  item: KnowledgeLibraryItem;
}): string {
  const layerLabel =
    input.tab === 'materials' ? '素材层' : input.tab === 'graph' ? '本体图谱层' : '成果层';
  const bodyText = input.item.bodyText?.trim();
  const sourceUrl = input.item.sourceUrl?.trim();
  const sourceLabel = input.item.sourceLabel?.trim();

  return `你当前正在围绕知识库中的一个${layerLabel}对象工作，请把它作为本轮对话的首要上下文。\n\n标题：${input.item.title}\n副标题：${input.item.subtitle}\n标签：${input.item.tags.join('、') || '无'}\n备注：${input.item.meta}\n摘要：${input.item.summary}${sourceLabel ? `\n来源：${sourceLabel}` : ''}${sourceUrl ? `\n来源链接：${sourceUrl}` : ''}${bodyText ? `\n正文：\n${bodyText.slice(0, 4000)}` : ''}\n\n请先用 3 行以内说明你将如何基于这个对象继续协作，然后等待用户下一步提问。`;
}
