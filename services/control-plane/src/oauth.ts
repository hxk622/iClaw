import {config} from './config.ts';
import type {OAuthProvider} from './domain.ts';
import {HttpError} from './errors.ts';

type OAuthUserProfile = {
  provider: OAuthProvider;
  providerId: string;
  email?: string;
  name: string;
  avatarUrl?: string;
};

type WeChatTokenResponse = {
  access_token?: string;
  openid?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

type WeChatUserInfo = {
  openid: string;
  unionid?: string;
  nickname?: string;
  headimgurl?: string;
  errcode?: number;
  errmsg?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  error?: {message?: string};
};

async function expectJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | null;
  if (!body) {
    throw new HttpError(502, 'OAUTH_UPSTREAM_ERROR', 'oauth upstream returned empty response');
  }
  return body;
}

export async function loadOAuthUserProfile(provider: OAuthProvider, code: string): Promise<OAuthUserProfile> {
  if (provider === 'wechat') {
    return loadWeChatProfile(code);
  }
  return loadGoogleProfile(code);
}

async function loadWeChatProfile(code: string): Promise<OAuthUserProfile> {
  if (!config.wechatAppId || !config.wechatAppSecret) {
    throw new HttpError(501, 'WECHAT_NOT_CONFIGURED', 'wechat login not configured');
  }

  const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
  tokenUrl.searchParams.set('appid', config.wechatAppId);
  tokenUrl.searchParams.set('secret', config.wechatAppSecret);
  tokenUrl.searchParams.set('code', code);
  tokenUrl.searchParams.set('grant_type', 'authorization_code');

  const tokenResponse = await fetch(tokenUrl);
  const tokenData = await expectJson<WeChatTokenResponse>(tokenResponse);
  if (!tokenResponse.ok || tokenData.errcode || !tokenData.access_token || !tokenData.openid) {
    throw new HttpError(502, 'WECHAT_OAUTH_FAILED', tokenData.errmsg || 'wechat oauth exchange failed');
  }

  const userInfoUrl = new URL('https://api.weixin.qq.com/sns/userinfo');
  userInfoUrl.searchParams.set('access_token', tokenData.access_token);
  userInfoUrl.searchParams.set('openid', tokenData.openid);
  userInfoUrl.searchParams.set('lang', 'zh_CN');

  const userResponse = await fetch(userInfoUrl);
  const userData = await expectJson<WeChatUserInfo>(userResponse);
  if (!userResponse.ok || userData.errcode) {
    throw new HttpError(502, 'WECHAT_PROFILE_FAILED', userData.errmsg || 'wechat profile lookup failed');
  }

  const providerId = userData.unionid || userData.openid;
  return {
    provider: 'wechat',
    providerId,
    email: `wechat_${providerId}@oauth.local`,
    name: userData.nickname?.trim() || 'WeChat User',
    avatarUrl: userData.headimgurl,
  };
}

async function loadGoogleProfile(code: string): Promise<OAuthUserProfile> {
  if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
    throw new HttpError(501, 'GOOGLE_NOT_CONFIGURED', 'google login not configured');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = await expectJson<GoogleTokenResponse>(tokenResponse);
  if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
    throw new HttpError(502, 'GOOGLE_OAUTH_FAILED', tokenData.error_description || 'google oauth exchange failed');
  }

  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });
  const userData = await expectJson<GoogleUserInfo>(userResponse);
  if (!userResponse.ok || userData.error || !userData.id) {
    throw new HttpError(502, 'GOOGLE_PROFILE_FAILED', userData.error?.message || 'google profile lookup failed');
  }

  return {
    provider: 'google',
    providerId: userData.id,
    email: userData.email?.trim().toLowerCase() || `google_${userData.id}@oauth.local`,
    name: userData.name?.trim() || 'Google User',
    avatarUrl: userData.picture,
  };
}
