export function isLikelyInternalToolTraceText(input: {
  text: string | null | undefined;
  groupIsTool: boolean;
}): boolean {
  const normalized = String(input.text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const hasToolOutputHeading = normalized.includes('tool output');
  const hasCommandTrace = normalized.includes('command:');
  const hasToolCompletionTrace =
    normalized.includes('tool completed successfully') ||
    normalized.includes('no output') ||
    normalized.includes('no output - tool completed successfully') ||
    normalized.includes('completed');
  const hasFileActionTrace =
    normalized.includes(' with from ') ||
    normalized.includes(' with to ') ||
    normalized.includes('/users/') ||
    normalized.includes('/tmp/') ||
    normalized.includes('http://') ||
    normalized.includes('https://');

  if (hasToolOutputHeading && (hasCommandTrace || hasToolCompletionTrace || hasFileActionTrace)) {
    return true;
  }

  return input.groupIsTool && (hasCommandTrace || hasToolCompletionTrace || hasFileActionTrace);
}

export function resolveAssistantAnchorIndex(
  groups: Array<{
    assistant: boolean;
    toolLike: boolean;
    hasVisibleContent: boolean;
  }>,
): number {
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (group?.assistant && !group.toolLike && group.hasVisibleContent) {
      return index;
    }
  }

  const firstVisibleIndex = groups.findIndex((group) => group?.hasVisibleContent);
  if (firstVisibleIndex >= 0) {
    return firstVisibleIndex;
  }
  return 0;
}
