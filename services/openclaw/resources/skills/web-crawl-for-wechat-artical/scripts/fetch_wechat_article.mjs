#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const DEFAULT_WAIT_MS = Number.parseInt(process.env.WECHAT_VIRTUAL_TIME_BUDGET_MS || '12000', 10);
const MAX_BUFFER = 30 * 1024 * 1024;

function printUsage() {
  console.error('Usage: node fetch_wechat_article.mjs <wechat-article-url> [--json]');
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
    if (result.status === 0) return candidate;
  }
  return null;
}

function isWeChatArticleUrl(raw) {
  try {
    const url = new URL(raw);
    return /^mp\.weixin\.qq\.com$/i.test(url.hostname) && /^\/s(\/|$|\?)/.test(url.pathname);
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
    '--window-size=1440,2600',
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

function extractElementInnerHtml(html, id) {
  const marker = `id="${id}"`;
  const idIndex = html.indexOf(marker);
  if (idIndex === -1) {
    return null;
  }
  const openStart = html.lastIndexOf('<', idIndex);
  if (openStart === -1) {
    return null;
  }
  const openTagMatch = html.slice(openStart).match(/^<([a-zA-Z0-9:-]+)\b[^>]*>/);
  if (!openTagMatch) {
    return null;
  }
  const tagName = openTagMatch[1].toLowerCase();
  const openTag = openTagMatch[0];
  let cursor = openStart + openTag.length;
  let depth = 1;
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tagPattern.lastIndex = cursor;
  while (depth > 0) {
    const match = tagPattern.exec(html);
    if (!match) {
      return null;
    }
    const token = match[0];
    if (token.startsWith(`</${tagName}`)) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(cursor, match.index);
      }
    } else if (!token.endsWith('/>')) {
      depth += 1;
    }
  }
  return null;
}

function extractTextByRegex(html, regex) {
  const match = html.match(regex);
  return match ? decodeHtmlEntities(match[1].trim().replace(/\s+/g, ' ')) : '';
}

function htmlToText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/section>/gi, '\n\n')
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
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trim()}…`;
}

function buildResult(url, dom) {
  const title =
    extractTextByRegex(dom, /<h1[^>]*id="activity-name"[^>]*>[\s\S]*?<span[^>]*class="js_title_inner"[^>]*>([\s\S]*?)<\/span>/i) ||
    extractTextByRegex(dom, /<meta property="og:title" content="([\s\S]*?)"/i);
  const author =
    extractTextByRegex(dom, /<span[^>]*id="js_author_name_text"[^>]*>([\s\S]*?)<\/span>/i) ||
    extractTextByRegex(dom, /<meta property="og:article:author" content="([\s\S]*?)"/i);
  const accountName =
    extractTextByRegex(dom, /<a[^>]*id="js_name"[^>]*>([\s\S]*?)<\/a>/i) ||
    extractTextByRegex(dom, /<span class="nickNameSpan">([\s\S]*?)<\/span>/i);
  const publishTime = extractTextByRegex(dom, /<em[^>]*id="publish_time"[^>]*>([\s\S]*?)<\/em>/i);
  const contentHtml = extractElementInnerHtml(dom, 'js_content');
  if (!contentHtml || !contentHtml.trim()) {
    throw new Error('Article content #js_content not found in rendered DOM');
  }
  const contentText = htmlToText(contentHtml);
  return {
    ok: true,
    url,
    title,
    author,
    accountName,
    publishTime,
    summary: summarizeText(contentText),
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
  if (!isWeChatArticleUrl(url)) {
    console.error('Error: only mp.weixin.qq.com article URLs are supported.');
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
        `公众号：${result.accountName}`,
        `发布时间：${result.publishTime}`,
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
