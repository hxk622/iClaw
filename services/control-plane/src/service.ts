import type {AuthTokens} from '@iclaw/shared';

import { deleteAvatarByKey, deleteOldAvatars, extractAvatarKey, uploadAvatar } from './avatar-storage.ts';
import {config} from './config.ts';
import {randomBytes} from 'node:crypto';
import {uploadPrivateSkillArtifact} from './skill-storage.ts';

import type {
  AgentCatalogEntryRecord,
  AgentCatalogEntryView,
  AdminSkillCatalogEntryView,
  ChangePasswordInput,
  CreditBalanceView,
  CreditQuoteInput,
  CreditQuoteView,
  CreditLedgerItemView,
  ImportUserPrivateSkillInput,
  InstallAgentInput,
  InstallSkillInput,
  LoginInput,
  OAuthProvider,
  PublicUser,
  RegisterInput,
  RunAuthorizeInput,
  RunGrantView,
  SkillSource,
  SkillCatalogEntryRecord,
  SkillCatalogEntryView,
  SkillCatalogReleaseView,
  SkillReleaseRecord,
  UpsertSkillCatalogEntryInput,
  UpdateSkillLibraryItemInput,
  UpdateProfileInput,
  UsageEventInput,
  UsageEventResult,
  UserAgentLibraryItemView,
  UserPrivateSkillRecord,
  UserRecord,
  UserRole,
  UserSkillLibraryItemView,
  UserSkillLibrarySource,
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
  role: UserRole;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.displayName,
    avatar_url: user.avatarUrl || null,
    role: user.role,
  };
}

function rolePriority(role: UserRole): number {
  switch (role) {
    case 'super_admin':
      return 3;
    case 'admin':
      return 2;
    default:
      return 1;
  }
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

function normalizeSkillSlug(value: string | undefined): string {
  const normalized = (value || '').trim();
  if (!normalized) {
    throw new HttpError(400, 'BAD_REQUEST', 'skill slug is required');
  }
  return normalized;
}

function normalizeOptionalSkillVersion(value: string | undefined): string | undefined {
  const normalized = (value || '').trim();
  return normalized || undefined;
}

function normalizeSkillEnabled(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new HttpError(400, 'BAD_REQUEST', 'enabled must be a boolean');
  }
  return value;
}

function normalizeSkillVisibility(value: unknown, fallback?: 'showcase' | 'internal'): 'showcase' | 'internal' {
  if (value === undefined) {
    if (fallback) return fallback;
    throw new HttpError(400, 'BAD_REQUEST', 'visibility is required');
  }
  if (value === 'showcase' || value === 'internal') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'visibility must be showcase or internal');
}

function normalizeSkillDistribution(value: unknown, fallback?: 'bundled' | 'cloud'): 'bundled' | 'cloud' {
  if (value === undefined) {
    if (fallback) return fallback;
    throw new HttpError(400, 'BAD_REQUEST', 'distribution is required');
  }
  if (value === 'bundled' || value === 'cloud') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'distribution must be bundled or cloud');
}

function normalizeOptionalCatalogString(
  value: unknown,
  field: string,
  options: {allowNull?: boolean; trimToNull?: boolean} = {},
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    if (options.allowNull) return null;
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a string`);
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return options.trimToNull ? null : '';
  }
  return normalized;
}

function normalizeSkillTags(value: unknown, fallback?: string[]): string[] {
  if (value === undefined) {
    return fallback ? [...fallback] : [];
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'tags must be an array of strings');
  }
  const deduped = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new HttpError(400, 'BAD_REQUEST', 'tags must be an array of strings');
    }
    const normalized = item.trim();
    if (!normalized) continue;
    deduped.add(normalized);
  }
  return Array.from(deduped);
}

function normalizeOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a boolean`);
  }
  return value;
}

function toSkillCatalogReleaseView(record: SkillReleaseRecord | null, baseUrl?: string): SkillCatalogReleaseView | null {
  if (!record) {
    return null;
  }

  const origin = (baseUrl || '').trim().replace(/\/$/, '');
  const artifactUrl =
    record.artifactUrl ||
    (origin
      ? `${origin}/skills/artifact?slug=${encodeURIComponent(record.slug)}&version=${encodeURIComponent(record.version)}`
      : null);

  return {
    version: record.version,
    artifact_url: artifactUrl,
    artifact_path: record.artifactSourcePath,
    artifact_format: record.artifactFormat,
    artifact_sha256: record.artifactSha256,
    published_at: record.publishedAt,
  };
}

function toSkillCatalogEntryView(
  record: SkillCatalogEntryRecord,
  baseUrl?: string,
  source: SkillSource = record.distribution,
): SkillCatalogEntryView {
  return {
    slug: record.slug,
    name: record.name,
    description: record.description,
    visibility: record.visibility,
    market: record.market,
    category: record.category,
    skill_type: record.skillType,
    publisher: record.publisher,
    distribution: record.distribution,
    source,
    tags: record.tags,
    latest_release: toSkillCatalogReleaseView(record.latestRelease, baseUrl),
  };
}

function toUserSkillLibraryItemView(record: {
  slug: string;
  version: string;
  source?: UserSkillLibrarySource;
  enabled: boolean;
  installedAt: string;
  updatedAt: string;
}): UserSkillLibraryItemView {
  return {
    slug: record.slug,
    version: record.version,
    source: record.source || 'cloud',
    enabled: record.enabled,
    installed_at: record.installedAt,
    updated_at: record.updatedAt,
  };
}

function toAdminSkillCatalogEntryView(record: SkillCatalogEntryRecord, baseUrl?: string): AdminSkillCatalogEntryView {
  return {
    ...toSkillCatalogEntryView(record, baseUrl),
    active: record.active,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function toAgentCatalogEntryView(record: AgentCatalogEntryRecord): AgentCatalogEntryView {
  return {
    slug: record.slug,
    name: record.name,
    description: record.description,
    category: record.category,
    publisher: record.publisher,
    featured: record.featured,
    official: record.official,
    tags: record.tags,
    capabilities: record.capabilities,
    use_cases: record.useCases,
  };
}

function toUserAgentLibraryItemView(record: {
  slug: string;
  installedAt: string;
  updatedAt: string;
}): UserAgentLibraryItemView {
  return {
    slug: record.slug,
    installed_at: record.installedAt,
    updated_at: record.updatedAt,
  };
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

function parseRequiredBase64(input: unknown, field: string): Buffer {
  if (typeof input !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a base64 string`);
  }
  const trimmed = input.trim();
  if (!trimmed) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} is required`);
  }
  try {
    return Buffer.from(trimmed, 'base64');
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be valid base64`);
  }
}

function normalizePrivateSkillSourceKind(value: unknown): 'github' | 'local' {
  if (value === 'github' || value === 'local') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'source_kind must be github or local');
}

function normalizeArtifactFormat(value: unknown): 'tar.gz' | 'zip' {
  if (value === 'tar.gz' || value === 'zip') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'artifact_format must be tar.gz or zip');
}

function toPrivateSkillCatalogEntryView(record: UserPrivateSkillRecord, baseUrl?: string): SkillCatalogEntryView {
  const origin = (baseUrl || '').trim().replace(/\/$/, '');
  const artifactUrl = origin
    ? `${origin}/skills/private-artifact?slug=${encodeURIComponent(record.slug)}&version=${encodeURIComponent(record.version)}`
    : null;
  return {
    slug: record.slug,
    name: record.name,
    description: record.description,
    visibility: 'showcase',
    market: record.market,
    category: record.category,
    skill_type: record.skillType,
    publisher: record.publisher,
    distribution: 'cloud',
    source: 'private',
    tags: record.tags,
    latest_release: {
      version: record.version,
      artifact_url: artifactUrl,
      artifact_path: null,
      artifact_format: record.artifactFormat,
      artifact_sha256: record.artifactSha256,
      published_at: record.updatedAt,
    },
  };
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
        role: this.resolveBootstrapRole(email) || 'user',
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
    const existingUser = await this.store.getUserByIdentifier(identifier);
    if (!existingUser || !existingUser.passwordHash || !verifyPassword(password, existingUser.passwordHash)) {
      throw new HttpError(401, 'UNAUTHORIZED', 'invalid credentials');
    }
    const user = await this.ensureBootstrapRole(existingUser);

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

    user = await this.ensureBootstrapRole(user);

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
    const balance = await this.store.getCreditBalance(user.id);
    return {
      balance,
      currency: 'credit',
      currency_display: '龙虾币',
      available_balance: balance,
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

  async creditsQuote(accessToken: string, input: CreditQuoteInput): Promise<CreditQuoteView> {
    const user = await this.getUserForAccessToken(accessToken);
    const message = (input.message || '').trim();
    const attachments = Array.isArray(input.attachments) ? input.attachments : [];
    const hasSearch = Boolean(input.has_search);
    const hasTools = Boolean(input.has_tools);
    const historyMessages = Math.max(0, Math.min(48, input.history_messages || 0));
    const normalizedModel = (input.model || '').trim() || null;
    const balance = await this.store.getCreditBalance(user.id);

    if (!message && attachments.length === 0) {
      return {
        currency: 'credit',
        currency_display: '龙虾币',
        estimated_credits_low: 0,
        estimated_credits_high: 0,
        max_charge_credits: 0,
        estimated_input_tokens: 0,
        estimated_output_tokens: 0,
        balance_after_estimate: balance,
        balance_after_max: balance,
        model: normalizedModel,
      };
    }

    const estimatedInputTokens = this.estimateQuoteInputTokens({
      message,
      historyMessages,
      attachments,
      hasSearch,
      hasTools,
    });
    const outputEstimate = this.estimateQuoteOutputTokens({
      message,
      historyMessages,
      attachmentCount: attachments.length,
      hasSearch,
      hasTools,
      model: normalizedModel,
    });
    const modelFactor = this.resolveQuoteModelFactor(normalizedModel);
    const lowCost = Math.max(
      1,
      Math.ceil(this.computeCreditCost(estimatedInputTokens, outputEstimate.low) * modelFactor),
    );
    const highCost = Math.max(
      lowCost,
      Math.ceil(this.computeCreditCost(estimatedInputTokens, outputEstimate.high) * modelFactor),
    );
    const maxChargeCredits = Math.max(
      highCost,
      Math.ceil(this.computeCreditCost(estimatedInputTokens, outputEstimate.max) * modelFactor),
    );

    return {
      currency: 'credit',
      currency_display: '龙虾币',
      estimated_credits_low: lowCost,
      estimated_credits_high: highCost,
      max_charge_credits: maxChargeCredits,
      estimated_input_tokens: estimatedInputTokens,
      estimated_output_tokens: outputEstimate.high,
      balance_after_estimate: Math.max(0, balance - highCost),
      balance_after_max: Math.max(0, balance - maxChargeCredits),
      model: normalizedModel,
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

  async listAgentCatalog(): Promise<{items: AgentCatalogEntryView[]}> {
    const items = await this.store.listAgentCatalog();
    return {
      items: items.map((item) => toAgentCatalogEntryView(item)),
    };
  }

  async listUserAgentLibrary(accessToken: string): Promise<{items: UserAgentLibraryItemView[]}> {
    const user = await this.getUserForAccessToken(accessToken);
    const items = await this.store.listUserAgentLibrary(user.id);
    return {
      items: items.map((item) => toUserAgentLibraryItemView(item)),
    };
  }

  async installAgent(accessToken: string, input: InstallAgentInput): Promise<UserAgentLibraryItemView> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(input.slug);
    const entry = await this.store.getAgentCatalogEntry(slug);
    if (!entry || !entry.active) {
      throw new HttpError(404, 'NOT_FOUND', 'agent not found');
    }
    const record = await this.store.installUserAgent(user.id, {slug});
    return toUserAgentLibraryItemView(record);
  }

  async removeAgentFromLibrary(accessToken: string, slugInput: string): Promise<{removed: boolean}> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(slugInput);
    return {
      removed: await this.store.removeUserAgent(user.id, slug),
    };
  }

  async listSkillCatalog(baseUrl?: string): Promise<{items: SkillCatalogEntryView[]}> {
    const items = await this.store.listSkillCatalog();
    return {
      items: items.map((item) => toSkillCatalogEntryView(item, baseUrl)),
    };
  }

  async listPersonalSkillCatalog(accessToken: string, baseUrl?: string): Promise<{items: SkillCatalogEntryView[]}> {
    const user = await this.getUserForAccessToken(accessToken);
    const [catalogItems, privateItems] = await Promise.all([
      this.store.listSkillCatalog(),
      this.store.listUserPrivateSkills(user.id),
    ]);

    const merged = new Map<string, SkillCatalogEntryView>();
    for (const item of catalogItems) {
      merged.set(item.slug, toSkillCatalogEntryView(item, baseUrl));
    }
    for (const item of privateItems) {
      merged.set(item.slug, toPrivateSkillCatalogEntryView(item, baseUrl));
    }

    return {
      items: Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
    };
  }

  async listAdminSkillCatalog(
    accessToken: string,
    baseUrl?: string,
  ): Promise<{items: AdminSkillCatalogEntryView[]}> {
    await this.requireAdminUser(accessToken);
    const items = await this.store.listSkillCatalogAdmin();
    return {
      items: items.map((item) => toAdminSkillCatalogEntryView(item, baseUrl)),
    };
  }

  async upsertAdminSkillCatalogEntry(
    accessToken: string,
    input: UpsertSkillCatalogEntryInput,
    baseUrl?: string,
  ): Promise<AdminSkillCatalogEntryView> {
    await this.requireAdminUser(accessToken);
    const slug = normalizeSkillSlug(input.slug);
    const existing = await this.store.getSkillCatalogEntry(slug);

    const nameCandidate = normalizeOptionalCatalogString(input.name, 'name');
    const descriptionCandidate = normalizeOptionalCatalogString(input.description, 'description');
    const publisherCandidate = normalizeOptionalCatalogString(input.publisher, 'publisher');
    const marketCandidate = normalizeOptionalCatalogString(input.market, 'market', {allowNull: true, trimToNull: true});
    const categoryCandidate = normalizeOptionalCatalogString(input.category, 'category', {
      allowNull: true,
      trimToNull: true,
    });
    const skillTypeCandidate = normalizeOptionalCatalogString(input.skill_type, 'skill_type', {
      allowNull: true,
      trimToNull: true,
    });

    const name = (nameCandidate === undefined ? (existing?.name ?? '') : (nameCandidate || '')).trim();
    const description = (
      descriptionCandidate === undefined ? (existing?.description ?? '') : (descriptionCandidate || '')
    ).trim();
    const publisher = (
      publisherCandidate === undefined ? (existing?.publisher ?? '') : (publisherCandidate || '')
    ).trim();
    const visibility = normalizeSkillVisibility(input.visibility, existing?.visibility || 'showcase');
    const distribution = normalizeSkillDistribution(input.distribution, existing?.distribution || 'cloud');
    const tags = normalizeSkillTags(input.tags, existing?.tags || []);
    const active = normalizeOptionalBoolean(input.active, 'active') ?? existing?.active ?? true;
    const market = marketCandidate === undefined ? (existing?.market ?? null) : marketCandidate;
    const category = categoryCandidate === undefined ? (existing?.category ?? null) : categoryCandidate;
    const skillType = skillTypeCandidate === undefined ? (existing?.skillType ?? null) : skillTypeCandidate;

    if (!name) {
      throw new HttpError(400, 'BAD_REQUEST', 'name is required');
    }
    if (!description) {
      throw new HttpError(400, 'BAD_REQUEST', 'description is required');
    }
    if (!publisher) {
      throw new HttpError(400, 'BAD_REQUEST', 'publisher is required');
    }

    if (existing?.distribution === 'bundled' && distribution !== 'bundled') {
      throw new HttpError(400, 'BAD_REQUEST', 'bundled skill distribution cannot be changed');
    }

    const record = await this.store.upsertSkillCatalogEntry({
      slug,
      name,
      description,
      visibility,
      market,
      category,
      skill_type: skillType,
      publisher,
      distribution,
      tags,
      active,
    });

    return toAdminSkillCatalogEntryView(record, baseUrl);
  }

  async deleteAdminSkillCatalogEntry(accessToken: string, slugInput: string): Promise<{removed: boolean}> {
    await this.requireAdminUser(accessToken);
    const slug = normalizeSkillSlug(slugInput);
    const entry = await this.store.getSkillCatalogEntry(slug);
    if (!entry) {
      return {removed: false};
    }
    if (entry.distribution === 'bundled') {
      throw new HttpError(400, 'BAD_REQUEST', 'bundled skills cannot be deleted');
    }
    return {
      removed: await this.store.deleteSkillCatalogEntry(slug),
    };
  }

  async listUserSkillLibrary(accessToken: string): Promise<{items: UserSkillLibraryItemView[]}> {
    const user = await this.getUserForAccessToken(accessToken);
    const items = await this.store.listUserSkillLibrary(user.id);
    return {
      items: items.map((item) => toUserSkillLibraryItemView(item)),
    };
  }

  async installSkill(accessToken: string, input: InstallSkillInput): Promise<UserSkillLibraryItemView> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(input.slug);
    const version = normalizeOptionalSkillVersion(input.version);
    const catalog = await this.store.listSkillCatalog();
    const entry = catalog.find((item) => item.slug === slug);
    if (!entry) {
      throw new HttpError(404, 'NOT_FOUND', 'skill not found');
    }

    const release = await this.store.getSkillRelease(slug, version);
    if (!release) {
      throw new HttpError(404, 'NOT_FOUND', 'skill release not found');
    }

    const record = await this.store.installUserSkill(user.id, {
      slug,
      version: release.version,
      source: 'cloud',
    });
    return toUserSkillLibraryItemView(record);
  }

  async importPrivateSkill(
    accessToken: string,
    input: ImportUserPrivateSkillInput,
    baseUrl?: string,
  ): Promise<SkillCatalogEntryView> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(input.slug);
    const name = (normalizeOptionalCatalogString(input.name, 'name') || '').trim();
    const description = (normalizeOptionalCatalogString(input.description, 'description') || '').trim();
    const publisher = (
      normalizeOptionalCatalogString(input.publisher, 'publisher', {trimToNull: true}) || '个人导入'
    ).trim();
    const version = normalizeOptionalSkillVersion(input.version);
    const sourceKind = normalizePrivateSkillSourceKind(input.source_kind);
    const artifactFormat = normalizeArtifactFormat(input.artifact_format);
    const artifact = parseRequiredBase64(input.artifact_base64, 'artifact_base64');
    const tags = normalizeSkillTags(input.tags);
    const market = normalizeOptionalCatalogString(input.market, 'market', {allowNull: true, trimToNull: true}) ?? null;
    const category =
      normalizeOptionalCatalogString(input.category, 'category', {allowNull: true, trimToNull: true}) ?? null;
    const skillType =
      normalizeOptionalCatalogString(input.skill_type, 'skill_type', {allowNull: true, trimToNull: true}) ?? null;
    const sourceUrl =
      normalizeOptionalCatalogString(input.source_url, 'source_url', {allowNull: true, trimToNull: true}) ?? null;
    const artifactSha256 =
      normalizeOptionalCatalogString(input.artifact_sha256, 'artifact_sha256', {allowNull: true, trimToNull: true}) ?? null;

    if (!name) {
      throw new HttpError(400, 'BAD_REQUEST', 'name is required');
    }
    if (!description) {
      throw new HttpError(400, 'BAD_REQUEST', 'description is required');
    }
    if (!version) {
      throw new HttpError(400, 'BAD_REQUEST', 'version is required');
    }

    const publicConflict = await this.store.getSkillCatalogEntry(slug);
    if (publicConflict) {
      throw new HttpError(409, 'CONFLICT', 'skill slug is already used by catalog');
    }

    const artifactUpload = await uploadPrivateSkillArtifact({
      userId: user.id,
      slug,
      version,
      artifactFormat,
      artifact,
    });
    const record = await this.store.upsertUserPrivateSkill(user.id, {
      slug,
      name,
      description,
      market,
      category,
      skill_type: skillType,
      publisher,
      tags,
      source_kind: sourceKind,
      source_url: sourceUrl,
      version,
      artifact_format: artifactFormat,
      artifact_sha256: artifactSha256,
      artifactKey: artifactUpload.key,
    });
    await this.store.installUserSkill(user.id, {
      slug,
      version,
      source: 'private',
    });
    return toPrivateSkillCatalogEntryView(record, baseUrl);
  }

  async updateSkillLibraryItem(
    accessToken: string,
    input: UpdateSkillLibraryItemInput,
  ): Promise<UserSkillLibraryItemView> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(input.slug);
    const enabled = normalizeSkillEnabled(input.enabled);
    const record = await this.store.updateUserSkill(user.id, {
      slug,
      enabled,
    });
    if (!record) {
      throw new HttpError(404, 'NOT_FOUND', 'installed skill not found');
    }
    return toUserSkillLibraryItemView(record);
  }

  async removeSkill(accessToken: string, slugInput: string): Promise<{removed: boolean}> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(slugInput);
    return {
      removed: await this.store.removeUserSkill(user.id, slug),
    };
  }

  async getSkillArtifactRelease(slugInput: string, versionInput?: string): Promise<SkillReleaseRecord> {
    const slug = normalizeSkillSlug(slugInput);
    const version = normalizeOptionalSkillVersion(versionInput);
    const catalog = await this.store.listSkillCatalog();
    const entry = catalog.find((item) => item.slug === slug);
    if (!entry) {
      throw new HttpError(404, 'NOT_FOUND', 'skill not found');
    }

    const release = await this.store.getSkillRelease(slug, version);
    if (!release) {
      throw new HttpError(404, 'NOT_FOUND', 'skill release not found');
    }

    return release;
  }

  async getPrivateSkillArtifactRecord(accessToken: string, slugInput: string, versionInput?: string): Promise<UserPrivateSkillRecord> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(slugInput);
    const version = normalizeOptionalSkillVersion(versionInput);
    const skill = await this.store.getUserPrivateSkill(user.id, slug);
    if (!skill) {
      throw new HttpError(404, 'NOT_FOUND', 'private skill not found');
    }
    if (version && skill.version !== version) {
      throw new HttpError(404, 'NOT_FOUND', 'private skill release not found');
    }
    return skill;
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
    return this.ensureBootstrapRole(user);
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

  private estimateQuoteInputTokens(input: {
    message: string;
    historyMessages: number;
    attachments: CreditQuoteInput['attachments'];
    hasSearch: boolean;
    hasTools: boolean;
  }): number {
    const basePromptTokens = 180;
    const messageTokens = this.estimateTokensFromText(input.message);
    const historyTokens = input.historyMessages * 120;
    const searchTokens = input.hasSearch ? 320 : 0;
    const toolTokens = input.hasTools ? 220 : 0;
    const attachmentTokens = (input.attachments || []).reduce((sum, item) => {
      const chars = Math.max(0, item?.chars || 0);
      const inferredTextTokens = chars > 0 ? Math.ceil(chars * 0.75) : 0;
      const type = (item?.type || '').trim().toLowerCase();
      const typeOverhead =
        type === 'pdf' ? 700 : type === 'image' ? 220 : type === 'video' ? 480 : type ? 260 : 180;
      return sum + typeOverhead + inferredTextTokens;
    }, 0);

    return Math.max(1, basePromptTokens + messageTokens + historyTokens + searchTokens + toolTokens + attachmentTokens);
  }

  private estimateQuoteOutputTokens(input: {
    message: string;
    historyMessages: number;
    attachmentCount: number;
    hasSearch: boolean;
    hasTools: boolean;
    model: string | null;
  }): {low: number; high: number; max: number} {
    const messageTokens = this.estimateTokensFromText(input.message);
    const modelBias = this.resolveQuoteModelReasoningBias(input.model);
    const base =
      180 +
      Math.round(messageTokens * 0.45) +
      input.historyMessages * 20 +
      input.attachmentCount * 90 +
      (input.hasSearch ? 220 : 0) +
      (input.hasTools ? 160 : 0) +
      modelBias;

    const low = Math.max(120, Math.round(base * 0.72));
    const high = Math.max(low, Math.round(base * 1.2));
    const max = Math.max(high, Math.round(base * 1.7));

    return {low, high, max};
  }

  private estimateTokensFromText(text: string): number {
    const normalized = text.trim();
    if (!normalized) {
      return 0;
    }

    const cjkMatches = normalized.match(/[\u3400-\u9fff]/g) || [];
    const latinWords = normalized
      .replace(/[\u3400-\u9fff]/g, ' ')
      .match(/[A-Za-z0-9_]+/g) || [];
    const punctuationChars = normalized.replace(/[\u3400-\u9fffA-Za-z0-9_\s]/g, '').length;
    const whitespaceChars = normalized.match(/\s/g)?.length || 0;

    return Math.max(
      1,
      Math.ceil(cjkMatches.length * 1.15 + latinWords.length * 1.25 + punctuationChars * 0.35 + whitespaceChars * 0.08),
    );
  }

  private resolveQuoteModelFactor(model: string | null): number {
    const normalized = (model || '').trim().toLowerCase();
    if (!normalized) return 1;
    if (normalized.includes('opus') || normalized.includes('gpt-5') || normalized.includes('o1') || normalized.includes('o3') || normalized.includes('o4')) {
      return 1.7;
    }
    if (normalized.includes('sonnet') || normalized.includes('gemini') || normalized.includes('grok')) {
      return 1.3;
    }
    if (normalized.includes('mini') || normalized.includes('flash') || normalized.includes('haiku') || normalized.includes('nano')) {
      return 0.8;
    }
    return 1;
  }

  private resolveQuoteModelReasoningBias(model: string | null): number {
    const normalized = (model || '').trim().toLowerCase();
    if (!normalized) return 0;
    if (normalized.includes('opus') || normalized.includes('o1') || normalized.includes('o3') || normalized.includes('o4')) {
      return 220;
    }
    if (normalized.includes('sonnet') || normalized.includes('gpt-5') || normalized.includes('gemini')) {
      return 120;
    }
    if (normalized.includes('mini') || normalized.includes('flash') || normalized.includes('haiku') || normalized.includes('nano')) {
      return -40;
    }
    return 0;
  }

  private resolveBootstrapRole(email: string): UserRole | null {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (config.superAdminEmails.includes(normalized)) {
      return 'super_admin';
    }
    if (config.adminEmails.includes(normalized)) {
      return 'admin';
    }
    return null;
  }

  private async ensureBootstrapRole(user: UserRecord): Promise<UserRecord> {
    const targetRole = this.resolveBootstrapRole(user.email);
    if (!targetRole || rolePriority(user.role) >= rolePriority(targetRole)) {
      return user;
    }
    const updated = await this.store.updateUserRole(user.id, targetRole);
    return updated || user;
  }

  private async requireAdminUser(accessToken: string): Promise<UserRecord> {
    const user = await this.getUserForAccessToken(accessToken);
    if (rolePriority(user.role) < rolePriority('admin')) {
      throw new HttpError(403, 'FORBIDDEN', 'admin access required');
    }
    return user;
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
          role: this.resolveBootstrapRole(email) || 'user',
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
