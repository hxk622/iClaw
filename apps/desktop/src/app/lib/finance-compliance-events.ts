import type { IClawClient } from '@iclaw/sdk';
import { BRAND } from './brand';

type FinanceComplianceQueueItem = Record<string, unknown>;

function isIgnorableFinanceComplianceError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : '';
  const normalized = message.trim().toLowerCase();
  return import.meta.env.DEV && (normalized.includes('route not found') || normalized.includes('404'));
}

export async function recordFinanceComplianceEvents(input: {
  client: IClawClient;
  accessToken?: string | null;
  items: FinanceComplianceQueueItem[];
}): Promise<void> {
  if (!input.items.length) {
    return;
  }
  try {
    await input.client.recordFinanceComplianceEvents({
      token: input.accessToken || null,
      items: input.items.map((item) => ({
        app_name: BRAND.brandId,
        ...item,
      })),
    });
  } catch (error) {
    if (!isIgnorableFinanceComplianceError(error)) {
      throw error;
    }
  }
}
