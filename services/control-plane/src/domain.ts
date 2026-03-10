export type UserRecord = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  passwordHash: string | null;
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
  status: 'active';
};

export type CreditLedgerItemView = {
  id: string;
  event_type: string;
  delta: number;
  balance_after: number;
  created_at: string;
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

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar_url: string | null;
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
