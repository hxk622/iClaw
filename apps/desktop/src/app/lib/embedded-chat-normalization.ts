export type EmbeddedChatGroupDescriptor = {
  hidden: boolean;
  user: boolean;
  assistantSide: boolean;
  hasVisibleContent: boolean;
  hasReadingIndicator: boolean;
  toolLike: boolean;
};

export function resolveOrphanReadingIndicatorIndexes(
  groups: EmbeddedChatGroupDescriptor[],
  busy: boolean,
): Set<number> {
  const hiddenIndexes = new Set<number>();
  let assistantSegment: number[] = [];

  const flushAssistantSegment = () => {
    if (assistantSegment.length === 0) {
      return;
    }

    const visibleContentIndexes = assistantSegment.filter((index) => {
      const group = groups[index];
      return group?.hasVisibleContent || group?.toolLike;
    });
    const indicatorOnlyIndexes = assistantSegment.filter((index) => {
      const group = groups[index];
      return group?.hasReadingIndicator && !group?.hasVisibleContent;
    });

    if (indicatorOnlyIndexes.length === 0) {
      assistantSegment = [];
      return;
    }

    if (visibleContentIndexes.length > 0 || !busy) {
      indicatorOnlyIndexes.forEach((index) => hiddenIndexes.add(index));
      assistantSegment = [];
      return;
    }

    indicatorOnlyIndexes.slice(0, -1).forEach((index) => hiddenIndexes.add(index));
    assistantSegment = [];
  };

  groups.forEach((group, index) => {
    if (group.hidden || group.user || !group.assistantSide) {
      flushAssistantSegment();
      return;
    }
    assistantSegment.push(index);
  });

  flushAssistantSegment();
  return hiddenIndexes;
}
