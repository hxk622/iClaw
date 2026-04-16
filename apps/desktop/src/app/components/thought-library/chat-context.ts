import type { ThoughtLibraryItem, ThoughtLibraryTab } from './model';

export function buildThoughtLibraryContextPrompt(input: {
  tab: ThoughtLibraryTab;
  item: ThoughtLibraryItem;
}): string {
  const layerLabel =
    input.tab === 'materials' ? '素材层' : input.tab === 'graph' ? '图谱层' : '成果层';

  return `你当前正在围绕思维库中的一个${layerLabel}对象工作，请把它作为本轮对话的首要上下文。\n\n标题：${input.item.title}\n副标题：${input.item.subtitle}\n标签：${input.item.tags.join('、') || '无'}\n备注：${input.item.meta}\n摘要：${input.item.summary}\n\n请先用 3 行以内说明你将如何基于这个对象继续协作，然后等待用户下一步提问。`;
}
