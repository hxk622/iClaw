import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveFundPriceLabel, resolveFundPrimaryPrice } from './fund-market-display.ts';

test('resolveFundPriceLabel uses nav wording for otc funds', () => {
  assert.equal(resolveFundPriceLabel({ instrument_kind: 'fund', exchange: 'otc' }), '最新净值');
});

test('resolveFundPriceLabel uses market price wording for etf and qdii instruments', () => {
  assert.equal(resolveFundPriceLabel({ instrument_kind: 'etf', exchange: 'sh' }), '场内价格');
  assert.equal(resolveFundPriceLabel({ instrument_kind: 'qdii', exchange: 'sz' }), '场内价格');
});

test('resolveFundPrimaryPrice prefers current price and falls back to nav price', () => {
  assert.equal(resolveFundPrimaryPrice({ current_price: 1.2345, nav_price: 1.1111 }), 1.2345);
  assert.equal(resolveFundPrimaryPrice({ current_price: null, nav_price: 0.9876 }), 0.9876);
  assert.equal(resolveFundPrimaryPrice({ current_price: null, nav_price: null }), null);
});
