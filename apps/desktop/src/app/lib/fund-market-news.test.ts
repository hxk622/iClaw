import test from 'node:test';
import assert from 'node:assert/strict';

import type { MarketNewsItemData } from '@iclaw/sdk';
import { filterRelevantFundNews, resolveFundNewsKeywords } from './fund-market-news.ts';

test('resolveFundNewsKeywords prefers company, tracking target, theme and non-generic tags', () => {
  const keywords = resolveFundNewsKeywords({
    companyName: '华夏沪深300ETF',
    trackingTarget: '沪深300指数',
    themeKey: 'core-beta',
    strategyTags: ['ETF', '宽基核心', '红利'],
  });

  assert.deepEqual(keywords, ['华夏沪深300ETF', '沪深300指数', 'core-beta', '红利']);
});

test('filterRelevantFundNews ranks matching news ahead of generic items', () => {
  const items: MarketNewsItemData[] = [
    {
      news_id: '1',
      source: 'cls',
      source_item_id: null,
      title: '沪深300指数震荡回升',
      summary: '宽基ETF成交活跃',
      content_url: null,
      published_at: '2026-04-19T00:00:00.000Z',
      occurred_at: null,
      language: 'zh-CN',
      market_scope: 'cn',
      importance_score: null,
      sentiment_label: null,
      related_symbols: [],
      related_tags: ['宽基核心'],
      metadata: {},
      created_at: '2026-04-19T00:00:00.000Z',
      updated_at: '2026-04-19T00:00:00.000Z',
    },
    {
      news_id: '2',
      source: 'sina',
      source_item_id: null,
      title: '全球市场最新快讯',
      summary: '普通市场新闻',
      content_url: null,
      published_at: '2026-04-19T00:01:00.000Z',
      occurred_at: null,
      language: 'zh-CN',
      market_scope: 'cn',
      importance_score: null,
      sentiment_label: null,
      related_symbols: [],
      related_tags: ['财经快讯'],
      metadata: {},
      created_at: '2026-04-19T00:01:00.000Z',
      updated_at: '2026-04-19T00:01:00.000Z',
    },
  ];

  const result = filterRelevantFundNews(items, ['沪深300指数'], 2);
  assert.equal(result[0]?.news_id, '1');
  assert.equal(result.length, 1);
});

test('filterRelevantFundNews falls back to latest items when no keyword matches', () => {
  const items: MarketNewsItemData[] = [
    {
      news_id: '1',
      source: 'cls',
      source_item_id: null,
      title: 'A',
      summary: null,
      content_url: null,
      published_at: '2026-04-19T00:00:00.000Z',
      occurred_at: null,
      language: 'zh-CN',
      market_scope: 'cn',
      importance_score: null,
      sentiment_label: null,
      related_symbols: [],
      related_tags: [],
      metadata: {},
      created_at: '2026-04-19T00:00:00.000Z',
      updated_at: '2026-04-19T00:00:00.000Z',
    },
  ];

  const result = filterRelevantFundNews(items, ['不存在'], 3);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.news_id, '1');
});
