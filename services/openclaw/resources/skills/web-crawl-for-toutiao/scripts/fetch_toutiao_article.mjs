#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const DEFAULT_WAIT_MS = Number.parseInt(process.env.TOUTIAO_VIRTUAL_TIME_BUDGET_MS || '12000', 10);
const MAX_BUFFER = 20 * 1024 * 1024;

function printUsage() {
  console.error('Usage: node fetch_toutiao_article.mjs <toutiao-url> [--json]');
}

function resolveChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    if (result.status === 0) {
      return candidate;
    }
  }
  return null;
}

function isToutiaoArticleUrl(raw) {
  try {
    const url = new URL(raw);
    return (
      /(^|\.)toutiao\.com$/i.test(url.hostname) &&
      /^\/article\/\d+\/?/.test(url.pathname)
    ) || (
      /^m\.toutiao\.com$/i.test(url.hostname) &&
      /^\/article\/\d+\/?/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function dumpDom(chromeBinary, url) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--window-size=1440,2200',
    `--virtual-time-budget=${DEFAULT_WAIT_MS}`,
    '--dump-dom',
    url,
  ];
  const result = spawnSync(chromeBinary, args, {
    encoding: 'utf8',
    timeout: DEFAULT_WAIT_MS + 15_000,
    maxBuffer: MAX_BUFFER,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Chrome headless failed').trim());
  }
  return (result.stdout || '').trim();
}

function extractRenderData(dom) {
  const match = dom.match(/<script id="RENDER_DATA" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match) {
    throw new Error('RENDER_DATA not found in rendered DOM');
  }
  const encoded = match[1].trim();
  try {
    return JSON.parse(decodeURIComponent(encoded));
  } catch (error) {
    throw new Error(`Failed to decode RENDER_DATA: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function decodeHtmlEntities(input) {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([\da-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCodePoint(Number.parseInt(hex, 16));
      } catch {
        return _;
      }
    })
    .replace(/&#(\d+);/g, (_, num) => {
      try {
        return String.fromCodePoint(Number.parseInt(num, 10));
      } catch {
        return _;
      }
    });
}

function htmlToText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/blockquote>/gi, '\n\n')
      .replace(/<\/h\d>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  );
}

function summarizeText(text, maxChars = 220) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars).trim()}…`;
}

function buildResult(url, dom) {
  const parsed = extractRenderData(dom);
  const data = parsed?.data;
  if (!data || typeof data !== 'object') {
    throw new Error('Article payload missing in RENDER_DATA');
  }
  const contentHtml = typeof data.content === 'string' ? data.content : '';
  if (!contentHtml.trim()) {
    throw new Error('Article content HTML missing in RENDER_DATA');
  }
  const contentText = htmlToText(contentHtml);
  return {
    ok: true,
    url,
    title: data.title || '',
    abstract: data.abstract || '',
    author: data.source || '',
    publishTime: data.publishTime || '',
    articleType: data.articleType || '',
    itemId: data.itemId || data.groupId || '',
    summary: summarizeText(contentText || data.abstract || ''),
    contentHtml,
    contentText,
  };
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const url = args.find((arg) => !arg.startsWith('--'));

  if (!url) {
    printUsage();
    process.exit(1);
  }
  if (!isToutiaoArticleUrl(url)) {
    console.error('Error: only Toutiao article URLs are supported.');
    process.exit(1);
  }

  const chromeBinary = resolveChromeBinary();
  if (!chromeBinary) {
    console.error('Error: Chrome/Chromium not found. Set CHROME_BIN if needed.');
    process.exit(1);
  }

  try {
    const dom = dumpDom(chromeBinary, url);
    const result = buildResult(url, dom);
    if (asJson) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    process.stdout.write(
      [
        `标题：${result.title}`,
        `作者：${result.author}`,
        `发布时间：${result.publishTime}`,
        `摘要：${result.abstract}`,
        '',
        '正文：',
        result.contentText,
      ].join('\n'),
    );
    process.stdout.write('\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ ok: false, url, error: message }, null, 2)}\n`);
      process.exit(1);
    }
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
