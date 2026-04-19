import { normalizeMessage } from '@openclaw-ui/ui/chat/message-normalizer.ts';

export type FinanceDecoratableMessageGroup = {
  messages: unknown[];
} | null;

export function extractMessageFinanceCompliance(message: unknown): Record<string, unknown> | null {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return null;
  }
  const raw = message as Record<string, unknown>;
  const metadata =
    raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : null;
  const financeCompliance =
    metadata?.financeCompliance && typeof metadata.financeCompliance === 'object' && !Array.isArray(metadata.financeCompliance)
      ? (metadata.financeCompliance as Record<string, unknown>)
      : null;
  if (!financeCompliance || financeCompliance.domain !== 'finance') {
    return null;
  }
  return financeCompliance;
}

export function extractChatMessageGroupFinanceCompliance(
  group: FinanceDecoratableMessageGroup,
): Record<string, unknown> | null {
  if (!group) {
    return null;
  }
  for (let index = group.messages.length - 1; index >= 0; index -= 1) {
    const candidate = extractMessageFinanceCompliance(group.messages[index]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

export function extractMessageText(message: unknown): string {
  const normalized = normalizeMessage(message);
  return normalized.content
    .map((item) => (typeof item.text === 'string' ? item.text.replace(/\u00a0/g, ' ').trim() : ''))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function syncAssistantFinanceOriginalVisibility(group: HTMLElement, expanded: boolean) {
  const messages = group.querySelector('.chat-group-messages') as HTMLElement | null;
  if (!messages) {
    return;
  }
  const textBlocks = Array.from(messages.querySelectorAll(':scope > .chat-text')).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
  textBlocks.forEach((node) => {
    if (expanded) {
      node.removeAttribute('hidden');
      return;
    }
    node.setAttribute('hidden', 'true');
  });
  group.dataset.iclawFinanceExpanded = expanded ? 'true' : 'false';
}

export function clearAssistantFinanceCard(group: HTMLElement) {
  const card = group.querySelector(
    '.chat-group-messages > .iclaw-chat-finance-card',
  ) as HTMLDivElement | null;
  if (card) {
    card.remove();
  }
  const messages = group.querySelector('.chat-group-messages') as HTMLElement | null;
  if (!messages) {
    return;
  }
  const textBlocks = Array.from(messages.querySelectorAll(':scope > .chat-text')).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
  textBlocks.forEach((node) => {
    node.removeAttribute('hidden');
  });
  delete group.dataset.iclawFinanceExpanded;
}

export function ensureAssistantFinanceCard(
  group: HTMLElement,
  financeCompliance: Record<string, unknown>,
  assistantText: string,
) {
  const messages = group.querySelector('.chat-group-messages') as HTMLElement | null;
  if (!messages || !assistantText.trim()) {
    return;
  }

  const shouldShowCard =
    financeCompliance.degraded === true &&
    financeCompliance.outputClassification === 'actionable_advice';
  if (!shouldShowCard) {
    clearAssistantFinanceCard(group);
    return;
  }

  let card = messages.querySelector(':scope > .iclaw-chat-finance-card') as HTMLDivElement | null;
  if (!card) {
    card = document.createElement('div');
    card.className = 'iclaw-chat-finance-card';
    card.innerHTML = `
      <div class="iclaw-chat-finance-card__header">
        <div class="iclaw-chat-finance-card__badge">研究参考</div>
        <button type="button" class="iclaw-chat-finance-card__toggle" data-action="toggle-details" aria-label="展开详情">
          <span class="iclaw-chat-finance-card__toggle-label">展开详情</span>
        </button>
      </div>
      <div class="iclaw-chat-finance-card__body">
        <p class="iclaw-chat-finance-card__title">当前回答已按研究参考口径展示</p>
        <p class="iclaw-chat-finance-card__description">这段内容包含较强的行动性建议表达，界面已按研究参考口径呈现。请结合前提、风险与失效条件自行判断，不应直接视为投资建议。</p>
      </div>
      <div class="iclaw-chat-finance-card__details" hidden>
        <p>· 本回答基于公开信息与历史数据，不构成投资建议</p>
        <p>· 市场环境变化可能导致分析结论失效</p>
        <p>· 投资决策应咨询持牌专业人士并自行承担风险</p>
      </div>
      <div class="iclaw-chat-finance-card__actions">
        <button type="button" class="iclaw-chat-finance-card__primary" data-action="toggle-original">查看原文</button>
      </div>
    `;

    card.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-action]');
      if (!target) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const action = target.dataset.action;
      if (action === 'toggle-details') {
        const details = card?.querySelector('.iclaw-chat-finance-card__details') as HTMLDivElement | null;
        const label = target.querySelector('.iclaw-chat-finance-card__toggle-label') as HTMLSpanElement | null;
        const expanded = details?.hasAttribute('hidden') === false;
        if (details) {
          if (expanded) {
            details.setAttribute('hidden', 'true');
          } else {
            details.removeAttribute('hidden');
          }
        }
        if (label) {
          label.textContent = expanded ? '展开详情' : '收起详情';
        }
        target.setAttribute('aria-label', expanded ? '展开详情' : '收起详情');
        return;
      }
      if (action === 'toggle-original') {
        const expanded = group.dataset.iclawFinanceExpanded === 'true';
        syncAssistantFinanceOriginalVisibility(group, !expanded);
        target.textContent = expanded ? '查看原文' : '收起原文';
      }
    });

    messages.prepend(card);
  }

  const disclaimerText =
    typeof financeCompliance.disclaimerText === 'string' && financeCompliance.disclaimerText.trim()
      ? financeCompliance.disclaimerText.trim()
      : '本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。';
  const descriptionNode = card.querySelector('.iclaw-chat-finance-card__description') as HTMLParagraphElement | null;
  if (descriptionNode) {
    descriptionNode.textContent = `${descriptionNode.textContent?.split('。')[0] || '这段内容包含较强的行动性建议表达'}。${disclaimerText}`;
  }

  const expanded = group.dataset.iclawFinanceExpanded === 'true';
  syncAssistantFinanceOriginalVisibility(group, expanded);
  const primaryButton = card.querySelector('[data-action="toggle-original"]') as HTMLButtonElement | null;
  if (primaryButton) {
    primaryButton.textContent = expanded ? '收起原文' : '查看原文';
  }
}
