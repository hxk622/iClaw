import type { SkillSyncSourceRecord } from './domain.ts';

export const DEFAULT_CLAWHUB_SYNC_SOURCE_ID = 'clawhub-top';
export const DEFAULT_CLAWHUB_PUBLIC_BASE_URL = 'https://clawhub.ai';
export const DEFAULT_CLAWHUB_CONVEX_URL = 'https://wry-manatee-359.convex.cloud';
export const DEFAULT_CLAWHUB_DETAIL_API_BASE = 'https://wry-manatee-359.convex.site/api/v1';
export const DEFAULT_CLAWHUB_CLIENT_VERSION = 'npm-1.34.0';

export const DEFAULT_CLAWHUB_SYNC_SOURCE: Required<{
  id: string;
  source_type: SkillSyncSourceRecord['sourceType'];
  source_key: string;
  display_name: string;
  source_url: string;
  config: Record<string, unknown>;
  active: boolean;
}> = {
  id: DEFAULT_CLAWHUB_SYNC_SOURCE_ID,
  source_type: 'clawhub',
  source_key: 'clawhub:catalog',
  display_name: 'ClawHub 全量技能',
  source_url: DEFAULT_CLAWHUB_PUBLIC_BASE_URL,
  config: {
    sort: 'downloads',
    limit: 0,
    page_size: 100,
    detail_concurrency: 8,
    include_detail: false,
    convex_url: DEFAULT_CLAWHUB_CONVEX_URL,
    detail_api_base: DEFAULT_CLAWHUB_DETAIL_API_BASE,
    client_version: DEFAULT_CLAWHUB_CLIENT_VERSION,
  },
  active: true,
};
