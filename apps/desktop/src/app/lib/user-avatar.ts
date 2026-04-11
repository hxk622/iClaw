export type AppUserAvatarSource = {
  name?: string | null;
  username?: string | null;
  display_name?: string | null;
  nickname?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
  avatar_revision?: string | number | null;
  avatarRevision?: string | number | null;
} | null;

function resolveUserLabel(user: AppUserAvatarSource, fallback = 'i'): string {
  if (!user) {
    return fallback;
  }
  return (
    user.name ||
    user.display_name ||
    user.nickname ||
    user.username ||
    user.email ||
    fallback
  ).trim();
}

export function resolveUserInitial(user: AppUserAvatarSource, fallback = 'i'): string {
  const label = resolveUserLabel(user, fallback);
  if (!label) {
    return fallback;
  }
  return label[0]!.toUpperCase();
}

export function resolveUserAvatarUrl(user: AppUserAvatarSource): string | null {
  if (!user) {
    return null;
  }
  const rawUrl = user.avatar_url || user.avatarUrl || user.avatar || null;
  if (!rawUrl) {
    return null;
  }

  const revision = user.avatar_revision ?? user.avatarRevision;
  if (revision === null || revision === undefined || revision === '') {
    return rawUrl;
  }

  const separator = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${separator}v=${encodeURIComponent(String(revision))}`;
}

export function buildGeneratedUserAvatarDataUrl(user: AppUserAvatarSource, fallback = 'i'): string {
  const initial = resolveUserInitial(user, fallback);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2b2b2b" />
          <stop offset="100%" stop-color="#4d4d4d" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="32" fill="url(#avatarGradient)" />
      <text
        x="50%"
        y="52%"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="#ffffff"
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="28"
        font-weight="700"
      >${initial}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function resolveUserName(user: AppUserAvatarSource, fallback = '游客模式'): string {
  return resolveUserLabel(user, fallback) || fallback;
}
