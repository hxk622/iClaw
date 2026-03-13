import type {AuthTokens} from '@iclaw/shared';

import { deleteAvatarByKey, deleteOldAvatars, extractAvatarKey, uploadAvatar } from './avatar-storage.ts';
import {config} from './config.ts';
import {randomBytes} from 'node:crypto';

import type {
  ChangePasswordInput,
  CreditBalanceView,
  CreditLedgerItemView,
  LoginInput,
  OAuthProvider,
  PublicUser,
  RegisterInput,
  RunAuthorizeInput,
  RunGrantView,
  UpdateProfileInput,
  UsageEventInput,
  UsageEventResult,
  WorkspaceBackupInput,
  WorkspaceBackupView,
} from './domain.ts';
import {HttpError} from './errors.ts';
import {loadOAuthUserProfile} from './oauth.ts';
import {hashPassword, verifyPassword} from './passwords.ts';
import type {ControlPlaneStore} from './store.ts';
import {generateOpaqueToken, hashOpaqueToken} from './tokens.ts';

function normalizeIdentifier(value: string, field: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalized) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} is required`);
  }
  return normalized;
}

function normalizeUsername(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new HttpError(400, 'BAD_REQUEST', 'username is required');
  }
  return normalized;
}

function toPublicUser(user: {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.displayName,
    avatar_url: user.avatarUrl || null,
  };
}

function makeNonce(): string {
  return randomBytes(12).toString('hex');
}

function makeSignature(input: {userId: string; nonce: string; expiresAt: string}): string {
  return Buffer.from(`${input.userId}:${input.nonce}:${input.expiresAt}`, 'utf8').toString('base64url');
}

function slugifyUsername(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return base || 'user';
}

function isRealEmail(email: string): boolean {
  return !email.endsWith('@oauth.local');
}

function toWorkspaceBackupView(record: {
  identityMd: string;
  userMd: string;
  soulMd: string;
  agentsMd: string;
  createdAt: string;
  updatedAt: string;
}): WorkspaceBackupView {
  return {
    identity_md: record.identityMd,
    user_md: record.userMd,
    soul_md: record.soulMd,
    agents_md: record.agentsMd,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function requireWorkspaceMarkdown(input: unknown, field: string): string {
  if (typeof input !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a string`);
  }
  if (!input.trim()) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} is required`);
  }
  return input;
}

function parseAvatarDataBase64(input: string, contentType: string): Buffer {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new HttpError(400, 'BAD_REQUEST', 'avatar_data_base64 is required');
  }

  const dataUrlMatch = trimmed.match(/^data:([^;,]+);base64,(.+)$/);
  if (dataUrlMatch) {
    if (dataUrlMatch[1].trim().toLowerCase() !== contentType.toLowerCase()) {
      throw new HttpError(400, 'BAD_REQUEST', 'avatar content type does not match payload');
    }
    return Buffer.from(dataUrlMatch[2], 'base64');
  }

  return Buffer.from(trimmed, 'base64');
}

export class ControlPlaneService {
  private readonly store: ControlPlaneStore;

  constructor(store: ControlPlaneStore) {
    this.store = store;
  }

  async register(input: RegisterInput): Promise<{tokens: AuthTokens; user: PublicUser}> {
    const username = normalizeUsername(input.username);
    const email = normalizeIdentifier(input.email, 'email');
    const password = input.password.trim();
    const name = (input.name || input.username || '').trim();

    if (
      username.length < 3 ||
      username.length > 32 ||
      !/^[\p{L}\p{N}][\p{L}\p{N}_.-]*(?: [\p{L}\p{N}_.-]+)*$/u.test(username)
    ) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'username must be 3-32 chars and may contain letters, numbers, spaces, dot, underscore, hyphen',
      );
    }
    if (!email.includes('@')) {
      throw new HttpError(400, 'BAD_REQUEST', 'email is invalid');
    }
    if (password.length < 8) {
      throw new HttpError(400, 'BAD_REQUEST', 'password must be at least 8 characters');
    }
    if (!name) {
      throw new HttpError(400, 'BAD_REQUEST', 'name is required');
    }

    try {
      const user = await this.store.createUser({
        username,
        email,
        displayName: name,
        passwordHash: hashPassword(password),
        initialCreditBalance: config.defaultCreditBalance,
      });
      const tokens = await this.issueTokens(user.id);
      return {
        tokens: tokens.payload,
        user: toPublicUser(user),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'USERNAME_TAKEN') {
        throw new HttpError(409, 'USERNAME_TAKEN', 'username already exists');
      }
      if (error instanceof Error && error.message === 'EMAIL_TAKEN') {
        throw new HttpError(409, 'EMAIL_TAKEN', 'email already exists');
      }
      if (typeof error === 'object' && error && 'code' in error) {
        const code = String((error as {code?: string}).code);
        const detail = String((error as {detail?: string}).detail || '');
        if (code === '23505' && detail.includes('(username)')) {
          throw new HttpError(409, 'USERNAME_TAKEN', 'username already exists');
        }
        if (code === '23505' && detail.includes('(email)')) {
          throw new HttpError(409, 'EMAIL_TAKEN', 'email already exists');
        }
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<{tokens: AuthTokens; user: PublicUser}> {
    const identifier = normalizeIdentifier(input.identifier, 'identifier');
    const password = input.password.trim();
    const user = await this.store.getUserByIdentifier(identifier);
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new HttpError(401, 'UNAUTHORIZED', 'invalid credentials');
    }

    const tokens = await this.issueTokens(user.id);
    return {
      tokens: tokens.payload,
      user: toPublicUser(user),
    };
  }

  async oauthLogin(provider: OAuthProvider, code: string): Promise<{tokens: AuthTokens; user: PublicUser}> {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      throw new HttpError(400, 'BAD_REQUEST', 'oauth code is required');
    }

    const profile = await loadOAuthUserProfile(provider, normalizedCode);
    let user = await this.store.getUserByOAuthAccount(provider, profile.providerId);

    if (!user && profile.email && isRealEmail(profile.email)) {
      user = await this.store.getUserByEmail(profile.email);
    }

    if (!user) {
      user = await this.createOAuthUser(profile);
    }

    await this.store.linkOAuthAccount(user.id, provider, profile.providerId);
    const tokens = await this.issueTokens(user.id, 'oauth');
    return {
      tokens: tokens.payload,
      user: toPublicUser(user),
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const normalized = refreshToken.trim();
    if (!normalized) {
      throw new HttpError(400, 'BAD_REQUEST', 'refresh_token is required');
    }

    const session = await this.store.getSessionByRefreshToken(hashOpaqueToken(normalized));
    const now = Date.now();
    if (
      !session ||
      session.refreshTokenExpiresAt <= now ||
      this.getAbsoluteSessionExpiresAt(session.createdAt) <= now
    ) {
      throw new HttpError(401, 'UNAUTHORIZED', 'refresh token is invalid or expired');
    }

    return (await this.rotateTokens(normalized, session.createdAt)).payload;
  }

  async me(accessToken: string): Promise<PublicUser> {
    const user = await this.getUserForAccessToken(accessToken);
    return toPublicUser(user);
  }

  async updateProfile(accessToken: string, input: UpdateProfileInput): Promise<PublicUser> {
    const user = await this.getUserForAccessToken(accessToken);
    const nextName = input.name?.trim();
    const hasNameUpdate = input.name !== undefined;
    const hasAvatarUpload = Boolean(input.avatar_data_base64?.trim());
    const shouldRemoveAvatar = Boolean(input.remove_avatar);

    if (!hasNameUpdate && !hasAvatarUpload && !shouldRemoveAvatar) {
      throw new HttpError(400, 'BAD_REQUEST', 'no profile changes provided');
    }

    if (hasNameUpdate && !nextName) {
      throw new HttpError(400, 'BAD_REQUEST', 'name is required');
    }

    let nextAvatarUrl: string | null | undefined;
    let uploadedAvatarKey: string | undefined;

    if (hasAvatarUpload) {
      const contentType = (input.avatar_content_type || '').trim().toLowerCase();
      if (!contentType) {
        throw new HttpError(400, 'BAD_REQUEST', 'avatar_content_type is required');
      }
      const avatarBuffer = parseAvatarDataBase64(input.avatar_data_base64 || '', contentType);
      const upload = await uploadAvatar(user.id, avatarBuffer, contentType, input.avatar_filename);
      nextAvatarUrl = upload.url;
      uploadedAvatarKey = upload.key;
    } else if (shouldRemoveAvatar) {
      nextAvatarUrl = null;
    }

    const updated = await this.store.updateUserProfile(user.id, {
      displayName: nextName,
      avatarUrl: nextAvatarUrl,
    });
    if (!updated) {
      throw new HttpError(404, 'NOT_FOUND', 'user not found');
    }

    const oldAvatarKey = extractAvatarKey(user.avatarUrl);
    if (uploadedAvatarKey) {
      await deleteOldAvatars(user.id, uploadedAvatarKey);
    } else if (shouldRemoveAvatar && oldAvatarKey) {
      await deleteAvatarByKey(oldAvatarKey);
    }

    return toPublicUser(updated);
  }

  async changePassword(accessToken: string, input: ChangePasswordInput): Promise<{message: string}> {
    const user = await this.getUserForAccessToken(accessToken);
    const nextPassword = input.new_password.trim();
    if (nextPassword.length < 8) {
      throw new HttpError(400, 'BAD_REQUEST', 'new password must be at least 8 characters');
    }

    if (user.passwordHash) {
      const currentPassword = (input.current_password || '').trim();
      if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
        throw new HttpError(401, 'UNAUTHORIZED', 'current password is invalid');
      }
    }

    const updated = await this.store.setPasswordHash(user.id, hashPassword(nextPassword));
    if (!updated) {
      throw new HttpError(404, 'NOT_FOUND', 'user not found');
    }

    return {
      message: 'password updated',
    };
  }

  async linkedAccounts(accessToken: string): Promise<{items: Array<{provider: string; provider_id: string; created_at: string}>}> {
    const user = await this.getUserForAccessToken(accessToken);
    const accounts = await this.store.getOAuthAccountsForUser(user.id);
    return {
      items: accounts.map((item) => ({
        provider: item.provider,
        provider_id: item.providerId,
        created_at: item.createdAt,
      })),
    };
  }

  async unlinkOAuthAccount(accessToken: string, provider: OAuthProvider): Promise<{message: string}> {
    const user = await this.getUserForAccessToken(accessToken);
    const accounts = await this.store.getOAuthAccountsForUser(user.id);
    const hasPassword = Boolean(user.passwordHash);
    const otherAccounts = accounts.filter((item) => item.provider !== provider);

    if (!hasPassword && otherAccounts.length === 0) {
      throw new HttpError(400, 'LAST_LOGIN_METHOD', 'at least one login method must remain');
    }

    const removed = await this.store.unlinkOAuthAccount(user.id, provider);
    if (!removed) {
      throw new HttpError(404, 'NOT_FOUND', 'linked account not found');
    }

    return {
      message: `${provider} account unlinked`,
    };
  }

  async creditsMe(accessToken: string): Promise<CreditBalanceView> {
    const user = await this.getUserForAccessToken(accessToken);
    return {
      balance: await this.store.getCreditBalance(user.id),
      currency: 'credit',
      status: 'active',
    };
  }

  async creditsLedger(accessToken: string): Promise<{items: CreditLedgerItemView[]}> {
    const user = await this.getUserForAccessToken(accessToken);
    return {
      items: (await this.store.getCreditLedger(user.id)).map((item) => ({
        id: item.id,
        event_type: item.eventType,
        delta: item.delta,
        balance_after: item.balanceAfter,
        created_at: item.createdAt,
      })),
    };
  }

  async getWorkspaceBackup(accessToken: string): Promise<WorkspaceBackupView | null> {
    const user = await this.getUserForAccessToken(accessToken);
    const backup = await this.store.getWorkspaceBackup(user.id);
    return backup ? toWorkspaceBackupView(backup) : null;
  }

  async saveWorkspaceBackup(accessToken: string, input: WorkspaceBackupInput): Promise<WorkspaceBackupView> {
    const user = await this.getUserForAccessToken(accessToken);
    const backup = await this.store.saveWorkspaceBackup(user.id, {
      identity_md: requireWorkspaceMarkdown(input.identity_md, 'identity_md'),
      user_md: requireWorkspaceMarkdown(input.user_md, 'user_md'),
      soul_md: requireWorkspaceMarkdown(input.soul_md, 'soul_md'),
      agents_md: requireWorkspaceMarkdown(input.agents_md, 'agents_md'),
    });
    return toWorkspaceBackupView(backup);
  }

  async authorizeRun(accessToken: string, input: RunAuthorizeInput): Promise<RunGrantView> {
    const user = await this.getUserForAccessToken(accessToken);
    const sessionKey = (input.session_key || 'main').trim() || 'main';
    const client = (input.client || 'desktop').trim() || 'desktop';
    const estimatedInputTokens = Math.max(0, input.estimated_input_tokens || 0);
    const currentBalance = await this.store.getCreditBalance(user.id);
    const nonce = makeNonce();
    const expiresAt = new Date(Date.now() + config.runGrantTtlSeconds * 1000).toISOString();
    const creditLimit = Math.min(currentBalance, config.runGrantCreditLimit);
    const maxInputTokens = Math.max(config.runGrantMaxInputTokens, estimatedInputTokens);
    const signature = makeSignature({userId: user.id, nonce, expiresAt});

    const grant = await this.store.createRunGrant({
      userId: user.id,
      sessionKey,
      client,
      nonce,
      maxInputTokens,
      maxOutputTokens: config.runGrantMaxOutputTokens,
      creditLimit,
      expiresAt,
      signature,
    });

    return {
      grant_id: grant.id,
      nonce: grant.nonce,
      expires_at: grant.expiresAt,
      max_input_tokens: grant.maxInputTokens,
      max_output_tokens: grant.maxOutputTokens,
      credit_limit: grant.creditLimit,
      signature: grant.signature,
    };
  }

  async recordUsageEvent(accessToken: string, input: UsageEventInput): Promise<{accepted: boolean; balance_after: number}> {
    const user = await this.getUserForAccessToken(accessToken);
    const eventId = (input.event_id || '').trim();
    if (!eventId) {
      throw new HttpError(400, 'BAD_REQUEST', 'event_id is required');
    }
    const grantId = (input.grant_id || '').trim();
    if (!grantId) {
      throw new HttpError(400, 'BAD_REQUEST', 'grant_id is required');
    }

    const grant = await this.store.getRunGrantById(grantId);
    if (!grant || grant.userId !== user.id) {
      throw new HttpError(403, 'FORBIDDEN', 'run grant is invalid');
    }
    if (new Date(grant.expiresAt).getTime() <= Date.now()) {
      throw new HttpError(400, 'GRANT_EXPIRED', 'run grant is expired');
    }

    const inputTokens = Math.max(0, input.input_tokens || 0);
    const outputTokens = Math.max(0, input.output_tokens || 0);
    if (grant.maxInputTokens > 0 && inputTokens > grant.maxInputTokens) {
      throw new HttpError(400, 'INPUT_LIMIT_EXCEEDED', 'input token usage exceeded run grant limit');
    }
    if (grant.maxOutputTokens > 0 && outputTokens > grant.maxOutputTokens) {
      throw new HttpError(400, 'OUTPUT_LIMIT_EXCEEDED', 'output token usage exceeded run grant limit');
    }

    const creditCost = this.computeCreditCost(inputTokens, outputTokens);
    if (grant.creditLimit > 0 && creditCost > grant.creditLimit) {
      throw new HttpError(402, 'CREDIT_LIMIT_EXCEEDED', 'usage exceeded run grant credit limit');
    }

    const usageInput = {
      event_id: eventId,
      grant_id: grantId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      credit_cost: creditCost,
      provider: (input.provider || '').trim(),
      model: (input.model || '').trim(),
    };

    const result: UsageEventResult = await this.store.recordUsageEvent(user.id, usageInput);
    return {
      accepted: result.accepted,
      balance_after: result.balanceAfter,
    };
  }

  private async getUserForAccessToken(accessToken: string) {
    const token = accessToken.trim();
    if (!token) {
      throw new HttpError(401, 'UNAUTHORIZED', 'missing access token');
    }

    const session = await this.store.getSessionByAccessToken(hashOpaqueToken(token));
    const now = Date.now();
    const absoluteSessionExpiresAt = session ? this.getAbsoluteSessionExpiresAt(session.createdAt) : 0;
    if (!session || session.accessTokenExpiresAt <= now || absoluteSessionExpiresAt <= now) {
      throw new HttpError(401, 'UNAUTHORIZED', 'access token is invalid or expired');
    }

    const expiresAt = this.getSlidingSessionExpiresAt(session.createdAt, now);
    const renewedSession = await this.store.touchSession(session.id, expiresAt);
    if (!renewedSession) {
      throw new HttpError(401, 'UNAUTHORIZED', 'access token is invalid or expired');
    }

    const user = await this.store.getUserById(renewedSession.userId);
    if (!user) {
      throw new HttpError(401, 'UNAUTHORIZED', 'user not found');
    }
    return user;
  }

  private async issueTokens(userId: string, clientType = 'desktop'): Promise<{payload: AuthTokens; refreshToken: string}> {
    const accessToken = generateOpaqueToken('at');
    const refreshToken = generateOpaqueToken('rt');
    const now = Date.now();
    const accessTokenExpiresAt = now + config.accessTokenTtlSeconds * 1000;
    const refreshTokenExpiresAt = now + config.refreshTokenTtlSeconds * 1000;

    await this.store.createSession(userId, {
      accessTokenHash: hashOpaqueToken(accessToken),
      refreshTokenHash: hashOpaqueToken(refreshToken),
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      deviceId: 'unknown',
      clientType,
    });

    return {
      payload: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: config.accessTokenTtlSeconds,
      },
      refreshToken,
    };
  }

  private async rotateTokens(
    refreshToken: string,
    sessionCreatedAt: string,
  ): Promise<{payload: AuthTokens; refreshToken: string}> {
    const accessToken = generateOpaqueToken('at');
    const nextRefreshToken = generateOpaqueToken('rt');
    const now = Date.now();
    const expiresAt = this.getSlidingSessionExpiresAt(sessionCreatedAt, now);

    const session = await this.store.replaceSession(hashOpaqueToken(refreshToken), {
      accessTokenHash: hashOpaqueToken(accessToken),
      refreshTokenHash: hashOpaqueToken(nextRefreshToken),
      accessTokenExpiresAt: expiresAt.accessTokenExpiresAt,
      refreshTokenExpiresAt: expiresAt.refreshTokenExpiresAt,
      deviceId: 'unknown',
      clientType: 'desktop',
    });
    if (!session) {
      throw new HttpError(401, 'UNAUTHORIZED', 'refresh token is invalid or expired');
    }

    return {
      payload: {
        access_token: accessToken,
        refresh_token: nextRefreshToken,
        expires_in: Math.max(1, Math.ceil((expiresAt.accessTokenExpiresAt - now) / 1000)),
      },
      refreshToken: nextRefreshToken,
    };
  }

  private getAbsoluteSessionExpiresAt(sessionCreatedAt: string): number {
    return new Date(sessionCreatedAt).getTime() + config.sessionAbsoluteTtlSeconds * 1000;
  }

  private getSlidingSessionExpiresAt(
    sessionCreatedAt: string,
    now: number,
  ): {
    accessTokenExpiresAt: number;
    refreshTokenExpiresAt: number;
  } {
    const absoluteSessionExpiresAt = this.getAbsoluteSessionExpiresAt(sessionCreatedAt);
    return {
      accessTokenExpiresAt: Math.min(absoluteSessionExpiresAt, now + config.accessTokenTtlSeconds * 1000),
      refreshTokenExpiresAt: Math.min(absoluteSessionExpiresAt, now + config.refreshTokenTtlSeconds * 1000),
    };
  }

  private computeCreditCost(inputTokens: number, outputTokens: number): number {
    const inputCost = Math.ceil((Math.max(0, inputTokens) / 1000) * config.creditCostInputPer1k);
    const outputCost = Math.ceil((Math.max(0, outputTokens) / 1000) * config.creditCostOutputPer1k);
    return Math.max(0, inputCost + outputCost);
  }

  private async createOAuthUser(profile: {
    email?: string;
    name: string;
    providerId: string;
    provider: OAuthProvider;
    avatarUrl?: string;
  }) {
    const email = normalizeIdentifier(
      profile.email || `${profile.provider}_${profile.providerId}@oauth.local`,
      'email',
    );
    const displayName = profile.name.trim() || `${profile.provider} user`;
    const seed = isRealEmail(email) ? email.split('@')[0] : `${profile.provider}_${profile.providerId.slice(0, 8)}`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = attempt === 0 ? '' : `_${profile.providerId.slice(attempt, attempt + 4)}`;
      const username = slugifyUsername(`${seed}${suffix}`).slice(0, 32);
      try {
        return await this.store.createUser({
          username,
          email,
          displayName,
          avatarUrl: profile.avatarUrl,
          passwordHash: null,
          initialCreditBalance: config.defaultCreditBalance,
        });
      } catch (error) {
        const code =
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error && 'code' in error
              ? String((error as {code?: string}).code)
              : '';
        if (code === 'USERNAME_TAKEN' || code === '23505') {
          continue;
        }
        throw error;
      }
    }

    throw new HttpError(500, 'USERNAME_GENERATION_FAILED', 'failed to generate username for oauth user');
  }
}
