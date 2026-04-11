import { API_BASE_URL, stringValue } from './adminApi';

export function formatRelative(value: string) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未记录';
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) {
    return `${Math.max(1, Math.round(diff / minute))} 分钟前`;
  }
  if (diff < day) {
    return `${Math.max(1, Math.round(diff / hour))} 小时前`;
  }
  return `${Math.max(1, Math.round(diff / day))} 天前`;
}

export function formatDateTime(value: string) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCredits(value: number) {
  const amount = Number(value || 0);
  return `${Number.isFinite(amount) ? amount.toLocaleString('zh-CN') : '0'} 龙虾币`;
}

export function formatFen(value: number) {
  const amount = Number(value || 0);
  const normalized = Number.isFinite(amount) ? amount : 0;
  return `¥${(normalized / 100).toFixed(2)}`;
}

export function actionLabel(action: string) {
  const normalized = stringValue(action);
  if (!normalized) return '未知动作';
  const labels: Record<string, string> = {
    create: '创建',
    update: '更新',
    publish: '发布',
    rollback: '回滚',
    delete: '删除',
  };
  return labels[normalized] || normalized;
}

export function statusLabel(status: string) {
  const normalized = stringValue(status);
  if (normalized === 'active' || normalized === 'published') return '已启用';
  if (normalized === 'disabled') return '已停用';
  return normalized || '未知状态';
}

export function getUserDisplayName(user: Record<string, unknown> | null) {
  return stringValue(user?.name || user?.username || 'admin') || 'admin';
}

export function getUserAvatarUrl(user: Record<string, unknown> | null) {
  return stringValue(user?.avatar_url || user?.avatarUrl || '');
}

export function getUserInitials(user: Record<string, unknown> | null) {
  return Array.from(getUserDisplayName(user)).slice(0, 1).join('').toUpperCase();
}

export function buildPortalAssetUrl(appName: string, assetKey: string) {
  return `${API_BASE_URL}/portal/asset/file?app_name=${encodeURIComponent(appName)}&asset_key=${encodeURIComponent(assetKey)}`;
}

export function resolveAssetUrl(item: { publicUrl: string; appName: string; brandId: string; assetKey: string }) {
  if (item.publicUrl) {
    return item.publicUrl;
  }
  return buildPortalAssetUrl(item.appName || item.brandId || '', item.assetKey || '');
}

export function isImageLike(contentType: string, url: string, objectKey: string) {
  const source = [contentType, url, objectKey].filter(Boolean).join(' ').toLowerCase();
  return ['image/', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'].some((token) => source.includes(token));
}

export function paymentStatusLabel(status: string) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'paid') return '已支付';
  if (normalized === 'pending' || normalized === 'created') return '待支付';
  if (normalized === 'failed') return '支付失败';
  if (normalized === 'expired') return '已过期';
  if (normalized === 'refunded') return '已退款';
  return normalized || '未知状态';
}

export function paymentProviderLabel(provider: string) {
  const normalized = String(provider || '').trim().toLowerCase();
  if (normalized === 'wechat_qr') return '微信扫码';
  if (normalized === 'alipay_qr') return '支付宝扫码';
  if (normalized === 'mock') return '测试支付';
  return normalized || '未知渠道';
}
