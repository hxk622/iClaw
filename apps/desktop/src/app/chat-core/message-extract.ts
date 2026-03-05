function stripEnvelope(text: string): string {
  return text.replace(/^```(?:json|text)?\n?/i, '').replace(/```\s*$/i, '');
}

function stripThinkingTags(text: string): string {
  return text.replace(/<\s*think(?:ing)?\s*>[\s\S]*?<\s*\/\s*think(?:ing)?\s*>/gi, '').trim();
}

export function extractRawText(message: unknown): string | null {
  if (!message || typeof message !== 'object') {
    return null;
  }
  const m = message as Record<string, unknown>;
  const content = m.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const parts = content
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const part = item as Record<string, unknown>;
        if (typeof part.text === 'string') {
          return part.text;
        }
        return null;
      })
      .filter((value): value is string => typeof value === 'string');
    if (parts.length > 0) {
      return parts.join('\n');
    }
  }
  if (typeof m.text === 'string') {
    return m.text;
  }
  return null;
}

export function extractText(message: unknown): string | null {
  const raw = extractRawText(message);
  if (!raw) {
    return null;
  }
  const role =
    message && typeof message === 'object' && typeof (message as Record<string, unknown>).role === 'string'
      ? ((message as Record<string, unknown>).role as string).toLowerCase()
      : '';
  const cleaned = role === 'assistant' ? stripThinkingTags(raw) : raw;
  const withoutEnvelope = stripEnvelope(cleaned).trim();
  return withoutEnvelope || null;
}
