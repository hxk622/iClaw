import {Buffer} from 'node:buffer';

import type {PaymentProvider} from './domain.ts';

const PROVIDER_THEME: Record<PaymentProvider, {label: string; primary: string; accent: string}> = {
  mock: {
    label: '测试支付',
    primary: '#8b5cf6',
    accent: '#f4f0ff',
  },
  wechat_qr: {
    label: '微信扫码',
    primary: '#07c160',
    accent: '#ebfff2',
  },
  alipay_qr: {
    label: '支付宝扫码',
    primary: '#1677ff',
    accent: '#edf5ff',
  },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildQrPattern(primary: string): string {
  const cells = [
    [0, 0], [1, 0], [2, 0], [4, 0], [6, 0], [7, 0],
    [0, 1], [2, 1], [3, 1], [5, 1], [7, 1],
    [0, 2], [1, 2], [2, 2], [4, 2], [5, 2], [7, 2],
    [1, 3], [3, 3], [4, 3], [6, 3],
    [0, 4], [2, 4], [3, 4], [5, 4], [7, 4],
    [0, 5], [1, 5], [3, 5], [4, 5], [6, 5], [7, 5],
    [2, 6], [4, 6], [5, 6], [7, 6],
    [0, 7], [1, 7], [3, 7], [5, 7], [6, 7], [7, 7],
  ];
  return cells
    .map(([x, y]) => `<rect x="${26 + x * 16}" y="${26 + y * 16}" width="12" height="12" rx="3" fill="${primary}" />`)
    .join('');
}

export function buildPlaceholderPaymentUrl(input: {
  provider: PaymentProvider;
  orderId: string;
  packageName: string;
  amountCnyFen: number;
  expiresAt: string;
}): string {
  const theme = PROVIDER_THEME[input.provider];
  const amount = (input.amountCnyFen / 100).toFixed(2);
  const orderCode = input.orderId.slice(0, 8).toUpperCase();
  const expiresAt = new Date(input.expiresAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  });
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" fill="none">
      <rect width="320" height="320" rx="32" fill="#fffdf8"/>
      <rect x="18" y="18" width="284" height="284" rx="26" fill="${theme.accent}" stroke="${theme.primary}" stroke-width="2"/>
      <rect x="40" y="40" width="152" height="152" rx="22" fill="#ffffff"/>
      <rect x="40" y="40" width="152" height="152" rx="22" stroke="${theme.primary}" stroke-opacity="0.18"/>
      <rect x="58" y="58" width="38" height="38" rx="10" fill="${theme.primary}"/>
      <rect x="136" y="58" width="38" height="38" rx="10" fill="${theme.primary}"/>
      <rect x="58" y="136" width="38" height="38" rx="10" fill="${theme.primary}"/>
      <rect x="68" y="68" width="18" height="18" rx="5" fill="#ffffff"/>
      <rect x="146" y="68" width="18" height="18" rx="5" fill="#ffffff"/>
      <rect x="68" y="146" width="18" height="18" rx="5" fill="#ffffff"/>
      ${buildQrPattern(theme.primary)}
      <text x="214" y="76" fill="#111827" font-size="24" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-weight="700">${escapeXml(theme.label)}</text>
      <text x="214" y="108" fill="#475569" font-size="15" font-family="PingFang SC, Microsoft YaHei, sans-serif">占位二维码</text>
      <text x="214" y="156" fill="#111827" font-size="28" font-family="Avenir Next, PingFang SC, sans-serif" font-weight="700">￥${escapeXml(amount)}</text>
      <text x="214" y="186" fill="#475569" font-size="14" font-family="PingFang SC, Microsoft YaHei, sans-serif">${escapeXml(input.packageName)}</text>
      <text x="40" y="234" fill="#111827" font-size="16" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-weight="700">订单 ${escapeXml(orderCode)}</text>
      <text x="40" y="260" fill="#64748b" font-size="14" font-family="PingFang SC, Microsoft YaHei, sans-serif">有效期至 ${escapeXml(expiresAt)}</text>
      <text x="40" y="286" fill="#64748b" font-size="13" font-family="PingFang SC, Microsoft YaHei, sans-serif">当前用于本地联调，后续可替换为真实渠道二维码。</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
