export type UserRole = 'user' | 'admin' | 'super_admin';

export type UserRecord = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  passwordHash: string | null;
  role: UserRole;
  status: 'active';
  createdAt: string;
  updatedAt: string;
};

export type OAuthProvider = 'wechat' | 'google';

export type CreditLedgerRecord = {
  id: string;
  userId: string;
  eventType: 'signup_grant' | 'usage_debit';
  delta: number;
  balanceAfter: number;
  createdAt: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  accessTokenHash: string;
  refreshTokenHash: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  createdAt: string;
};

export type CreateUserInput = {
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  passwordHash?: string | null;
  role?: UserRole;
  initialCreditBalance: number;
};

export type SessionTokenPair = {
  accessTokenHash: string;
  refreshTokenHash: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  deviceId: string;
  clientType: string;
};

export type CreditBalanceView = {
  balance: number;
  currency: 'credit';
  currency_display: '龙虾币';
  available_balance: number;
  status: 'active';
};

export type CreditLedgerItemView = {
  id: string;
  event_type: string;
  delta: number;
  balance_after: number;
  created_at: string;
};

export type CreditQuoteAttachmentInput = {
  type?: string;
  chars?: number;
};

export type CreditQuoteInput = {
  message?: string;
  model?: string;
  history_messages?: number;
  has_search?: boolean;
  has_tools?: boolean;
  attachments?: CreditQuoteAttachmentInput[];
};

export type CreditQuoteView = {
  currency: 'credit';
  currency_display: '龙虾币';
  estimated_credits_low: number;
  estimated_credits_high: number;
  max_charge_credits: number;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  balance_after_estimate: number;
  balance_after_max: number;
  model: string | null;
};

export type RunGrantRecord = {
  id: string;
  userId: string;
  sessionKey: string;
  client: string;
  nonce: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  creditLimit: number;
  expiresAt: string;
  signature: string;
  createdAt: string;
};

export type OAuthAccountRecord = {
  userId: string;
  provider: OAuthProvider;
  providerId: string;
  createdAt: string;
};

export type RunGrantView = {
  grant_id: string;
  nonce: string;
  expires_at: string;
  max_input_tokens: number;
  max_output_tokens: number;
  credit_limit: number;
  signature: string;
};

export type UsageEventRecord = {
  id: string;
  eventId: string;
  userId: string;
  runGrantId: string | null;
  inputTokens: number;
  outputTokens: number;
  creditCost: number;
  provider: string | null;
  model: string | null;
  createdAt: string;
};

export type UsageEventResult = {
  accepted: boolean;
  balanceAfter: number;
};

export type WorkspaceBackupRecord = {
  userId: string;
  identityMd: string;
  userMd: string;
  soulMd: string;
  agentsMd: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceBackupInput = {
  identity_md: string;
  user_md: string;
  soul_md: string;
  agents_md: string;
};

export type WorkspaceBackupView = WorkspaceBackupInput & {
  created_at: string;
  updated_at: string;
};

export type SkillDistribution = 'bundled' | 'cloud';
export type SkillSource = 'bundled' | 'cloud' | 'private';
export type UserSkillLibrarySource = 'cloud' | 'private';
export type UserPrivateSkillSourceKind = 'github' | 'local';
export type AgentCategory = 'finance' | 'content' | 'productivity' | 'commerce' | 'general';

export type SkillCatalogRecord = {
  slug: string;
  name: string;
  description: string;
  visibility: 'showcase' | 'internal';
  market: string | null;
  category: string | null;
  skillType: string | null;
  publisher: string;
  distribution: SkillDistribution;
  tags: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SkillReleaseRecord = {
  slug: string;
  version: string;
  artifactFormat: 'tar.gz' | 'zip';
  artifactUrl: string | null;
  artifactSha256: string | null;
  artifactSourcePath: string | null;
  publishedAt: string;
  createdAt: string;
};

export type SkillCatalogEntryRecord = SkillCatalogRecord & {
  latestRelease: SkillReleaseRecord | null;
};

export type UserSkillLibraryRecord = {
  userId: string;
  slug: string;
  version: string;
  source: UserSkillLibrarySource;
  enabled: boolean;
  installedAt: string;
  updatedAt: string;
};

export type SkillCatalogReleaseView = {
  version: string;
  artifact_url: string | null;
  artifact_path: string | null;
  artifact_format: 'tar.gz' | 'zip';
  artifact_sha256: string | null;
  published_at: string;
};

export type SkillCatalogEntryView = {
  slug: string;
  name: string;
  description: string;
  visibility: 'showcase' | 'internal';
  market: string | null;
  category: string | null;
  skill_type: string | null;
  publisher: string;
  distribution: SkillDistribution;
  source: SkillSource;
  tags: string[];
  latest_release: SkillCatalogReleaseView | null;
};

export type UserSkillLibraryItemView = {
  slug: string;
  version: string;
  source: UserSkillLibrarySource;
  enabled: boolean;
  installed_at: string;
  updated_at: string;
};

export type AgentCatalogRecord = {
  slug: string;
  name: string;
  description: string;
  category: AgentCategory;
  publisher: string;
  featured: boolean;
  official: boolean;
  tags: string[];
  capabilities: string[];
  useCases: string[];
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgentCatalogEntryRecord = AgentCatalogRecord;

export type AgentCatalogEntryView = {
  slug: string;
  name: string;
  description: string;
  category: AgentCategory;
  publisher: string;
  featured: boolean;
  official: boolean;
  tags: string[];
  capabilities: string[];
  use_cases: string[];
};

export type UserAgentLibraryRecord = {
  userId: string;
  slug: string;
  installedAt: string;
  updatedAt: string;
};

export type UserAgentLibraryItemView = {
  slug: string;
  installed_at: string;
  updated_at: string;
};

export type InstallAgentInput = {
  slug: string;
};

export type UserPrivateSkillRecord = {
  userId: string;
  slug: string;
  name: string;
  description: string;
  market: string | null;
  category: string | null;
  skillType: string | null;
  publisher: string;
  tags: string[];
  sourceKind: UserPrivateSkillSourceKind;
  sourceUrl: string | null;
  version: string;
  artifactFormat: 'tar.gz' | 'zip';
  artifactKey: string;
  artifactSha256: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminSkillCatalogEntryView = SkillCatalogEntryView & {
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
};

export type UpdateProfileInput = {
  name?: string;
  avatar_url?: string | null;
  avatar_data_base64?: string;
  avatar_content_type?: string;
  avatar_filename?: string;
  remove_avatar?: boolean;
};

export type ChangePasswordInput = {
  current_password?: string;
  new_password: string;
};

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
  name?: string;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export type RunAuthorizeInput = {
  session_key?: string;
  client?: string;
  estimated_input_tokens?: number;
};

export type UsageEventInput = {
  event_id?: string;
  grant_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  credit_cost?: number;
  provider?: string;
  model?: string;
};

export type InstallSkillInput = {
  slug?: string;
  version?: string;
};

export type ImportUserPrivateSkillInput = {
  slug?: string;
  name?: string;
  description?: string;
  market?: string | null;
  category?: string | null;
  skill_type?: string | null;
  publisher?: string;
  tags?: string[];
  source_kind?: UserPrivateSkillSourceKind;
  source_url?: string | null;
  version?: string;
  artifact_format?: 'tar.gz' | 'zip';
  artifact_sha256?: string | null;
  artifact_base64?: string;
};

export type UpdateSkillLibraryItemInput = {
  slug?: string;
  enabled?: boolean;
};

export type UpsertSkillCatalogEntryInput = {
  slug?: string;
  name?: string;
  description?: string;
  visibility?: 'showcase' | 'internal';
  market?: string | null;
  category?: string | null;
  skill_type?: string | null;
  publisher?: string;
  distribution?: SkillDistribution;
  tags?: string[];
  active?: boolean;
};
