import type { MarketFundData } from '@iclaw/sdk';

export function resolveFundPriceLabel(fund: Pick<MarketFundData, 'instrument_kind' | 'exchange'>): string {
  return fund.instrument_kind === 'fund' && fund.exchange === 'otc' ? '最新净值' : '场内价格';
}

export function resolveFundPrimaryPrice(fund: Pick<MarketFundData, 'current_price' | 'nav_price'>): number | null {
  if (typeof fund.current_price === 'number' && Number.isFinite(fund.current_price)) {
    return fund.current_price;
  }
  if (typeof fund.nav_price === 'number' && Number.isFinite(fund.nav_price)) {
    return fund.nav_price;
  }
  return null;
}
