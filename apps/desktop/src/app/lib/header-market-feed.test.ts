import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDefaultHeaderOverviewUrl,
  normalizeHeaderHeadline,
  normalizeHeaderOverviewPayload,
  normalizeHeaderQuote,
} from './header-market-feed.ts';

test('buildDefaultHeaderOverviewUrl trims auth base url and appends overview path', () => {
  assert.equal(
    buildDefaultHeaderOverviewUrl('https://caiclaw.aiyuanxi.com/'),
    'https://caiclaw.aiyuanxi.com/market/overview?market_scope=cn&index_limit=6&headline_limit=8',
  );
});

test('normalizeHeaderQuote maps overview index payload into header quote', () => {
  const quote = normalizeHeaderQuote(
    {
      id: 'csi300',
      label: '沪深300',
      value: 4728.6716,
      changePercent: -0.168,
      change: -7.936,
    },
    0,
  );

  assert.deepEqual(quote, {
    id: 'csi300',
    label: '沪深300',
    value: '4,728.67',
    changePercent: '-0.17%',
    change: -7.936,
  });
});

test('normalizeHeaderHeadline prefers title and keeps source and href', () => {
  const headline = normalizeHeaderHeadline(
    {
      id: 'n1',
      title: '市场快讯',
      source: '财联社',
      href: 'https://example.com/news/1',
    },
    0,
  );

  assert.deepEqual(headline, {
    id: 'n1',
    title: '市场快讯',
    source: '财联社',
    href: 'https://example.com/news/1',
  });
});

test('normalizeHeaderOverviewPayload extracts quotes, headlines and updated timestamp', () => {
  const payload = normalizeHeaderOverviewPayload({
    data: {
      snapshot_at: '2026-04-19T03:06:35.555Z',
      indices: [
        {
          index_key: 'sh_comp',
          index_name: '上证指数',
          value: 4051.43,
          change_amount: -4.12,
          change_percent: -0.1,
        },
      ],
      headlines: [
        {
          news_id: 'x1',
          title: '热点新闻',
          source: 'eastmoney',
          content_url: 'https://example.com/x1',
        },
      ],
    },
  });

  assert.ok(payload);
  assert.equal(payload.quotes.length, 1);
  assert.equal(payload.quotes[0]?.label, '上证指数');
  assert.equal(payload.headlines.length, 1);
  assert.equal(payload.headlines[0]?.title, '热点新闻');
  assert.equal(payload.updatedAt, Date.parse('2026-04-19T03:06:35.555Z'));
});
