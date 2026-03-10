export type OAuthProvider = 'wechat' | 'google';

function getWindowOrigin(): string {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:1520';
  }
  return window.location.origin;
}

export function getOAuthRedirectUri(provider: OAuthProvider): string {
  const override =
    provider === 'wechat'
      ? (import.meta.env.VITE_WECHAT_OAUTH_REDIRECT_URI as string | undefined)
      : (import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI as string | undefined);
  const normalized = override?.trim();
  if (normalized) {
    return normalized;
  }
  return `${getWindowOrigin()}/oauth-callback.html`;
}

export function getWeChatOAuthUrl(): string {
  const appId = (import.meta.env.VITE_WECHAT_APP_ID as string | undefined)?.trim();
  if (!appId) {
    return '';
  }
  const redirectUri = getOAuthRedirectUri('wechat');
  return `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code&scope=snsapi_login&state=login#wechat_redirect`;
}

export function getGoogleOAuthUrl(): string {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  if (!clientId) {
    return '';
  }
  const redirectUri = getOAuthRedirectUri('google');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: 'login',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function openOAuthPopup(url: string, windowName = 'oauth'): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('oauth popup is unavailable'));
      return;
    }

    const width = 640;
    const height = 760;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      windowName,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
    );

    if (!popup) {
      reject(new Error('无法打开 OAuth 弹窗，请检查浏览器或系统权限'));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== getWindowOrigin()) {
        return;
      }
      if (event.data?.type !== 'oauth-callback') {
        return;
      }

      cleanup();
      popup.close();

      if (typeof event.data.code === 'string' && event.data.code.trim()) {
        resolve(event.data.code.trim());
        return;
      }

      reject(new Error(typeof event.data.error === 'string' ? event.data.error : 'oauth login failed'));
    };

    const checkClosed = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('授权已取消'));
      }
    }, 500);

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      window.clearInterval(checkClosed);
    };

    window.addEventListener('message', handleMessage);
  });
}
