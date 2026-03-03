const ACCESS_TOKEN_KEY = 'iclaw_access_token';
const REFRESH_TOKEN_KEY = 'iclaw_refresh_token';

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
}

export function readAuth(): StoredAuth | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function writeAuth(auth: StoredAuth): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);
}

export function clearAuth(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
