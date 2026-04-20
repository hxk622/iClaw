const CREDIT_BLOCK_ERROR_PATTERNS = [
  /积分余额[^。]*暂停发送/,
  /请先前往充值中心充值/,
  /单次额度限制/,
  /额度限制/,
  /CREDIT_LIMIT_EXCEEDED/i,
  /INSUFFICIENT_CREDITS/i,
] as const;

function collapseText(value: string | null | undefined): string {
  return (value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isCreditBlockedTurnError(value: string | null | undefined): boolean {
  const normalized = collapseText(value);
  if (!normalized) {
    return false;
  }
  return CREDIT_BLOCK_ERROR_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildCreditBlockedTurnMessage(value: string | null | undefined): string {
  const normalized = collapseText(value);
  if (normalized) {
    return `积分校验未通过：${normalized}`;
  }
  return '积分校验未通过，本次消息未发送。请前往充值中心后再继续。';
}
