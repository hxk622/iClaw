import {randomUUID} from 'node:crypto';

import {Pool, type PoolClient} from 'pg';

import type {
  OemAssetRecord,
  OemAssetListRecord,
  OemAuditEventRecord,
  OemBrandRecord,
  OemBrandSummaryRecord,
  OemBrandVersionRecord,
  OemJsonObject,
  SeedOemBrandInput,
  UpsertOemAssetInput,
  UpsertOemBrandDraftInput,
} from './oem-domain.ts';

type OemBrandRow = {
  brand_id: string;
  tenant_key: string;
  display_name: string;
  product_name: string;
  status: 'draft' | 'published' | 'archived';
  draft_config: Record<string, unknown> | null;
  published_config: Record<string, unknown> | null;
  published_version: number;
  created_at: Date;
  updated_at: Date;
};

type OemBrandVersionRow = {
  id: string;
  brand_id: string;
  display_name: string | null;
  version_no: number;
  config: Record<string, unknown> | null;
  created_by: string | null;
  created_by_name: string | null;
  created_by_username: string | null;
  created_at: Date;
  published_at: Date;
};

type OemAssetRow = {
  id: string;
  brand_id: string;
  brand_display_name: string | null;
  brand_product_name: string | null;
  asset_key: string;
  kind: string;
  storage_provider: string;
  object_key: string;
  public_url: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

type OemAuditRow = {
  id: string;
  brand_id: string;
  brand_display_name: string | null;
  brand_product_name: string | null;
  action: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_username: string | null;
  payload: Record<string, unknown> | null;
  created_at: Date;
};

type OemBrandSummaryRow = {
  brand_id: string;
  tenant_key: string;
  display_name: string;
  product_name: string;
  status: 'draft' | 'published' | 'archived';
  published_version: number;
  created_at: Date;
  updated_at: Date;
  last_published_at: Date | null;
  asset_count: string | number;
};

function asJsonObject(value: unknown): OemJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as OemJsonObject;
}

function mapBrandRow(row: OemBrandRow): OemBrandRecord {
  return {
    brandId: row.brand_id,
    tenantKey: row.tenant_key,
    displayName: row.display_name,
    productName: row.product_name,
    status: row.status,
    draftConfig: asJsonObject(row.draft_config),
    publishedConfig: row.published_config ? asJsonObject(row.published_config) : null,
    publishedVersion: row.published_version || 0,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapVersionRow(row: OemBrandVersionRow): OemBrandVersionRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    brandDisplayName: row.display_name,
    version: row.version_no,
    config: asJsonObject(row.config),
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdByUsername: row.created_by_username,
    createdAt: row.created_at.toISOString(),
    publishedAt: row.published_at.toISOString(),
  };
}

function mapAssetRow(row: OemAssetRow): OemAssetListRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    brandDisplayName: row.brand_display_name,
    brandProductName: row.brand_product_name,
    assetKey: row.asset_key,
    kind: row.kind,
    storageProvider: row.storage_provider,
    objectKey: row.object_key,
    publicUrl: row.public_url,
    metadata: asJsonObject(row.metadata),
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapAuditRow(row: OemAuditRow): OemAuditEventRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    brandDisplayName: row.brand_display_name,
    brandProductName: row.brand_product_name,
    action: row.action,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    actorUsername: row.actor_username,
    payload: asJsonObject(row.payload),
    createdAt: row.created_at.toISOString(),
  };
}

function mapBrandSummaryRow(row: OemBrandSummaryRow): OemBrandSummaryRecord {
  return {
    brandId: row.brand_id,
    tenantKey: row.tenant_key,
    displayName: row.display_name,
    productName: row.product_name,
    status: row.status,
    publishedVersion: row.published_version || 0,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastPublishedAt: row.last_published_at ? row.last_published_at.toISOString() : null,
    assetCount: Number(row.asset_count || 0),
  };
}

export class PgOemStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({connectionString: databaseUrl});
  }

  async seedBrand(input: SeedOemBrandInput): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profileInsert = await client.query<{brand_id: string}>(
        `
          insert into oem_brand_profiles (
            brand_id,
            tenant_key,
            display_name,
            product_name,
            status,
            draft_config,
            published_config,
            published_version,
            created_at,
            updated_at
          )
          values ($1, $2, $3, $4, 'published', $5::jsonb, $5::jsonb, 1, now(), now())
          on conflict (brand_id) do nothing
          returning brand_id
        `,
        [input.brandId, input.tenantKey, input.displayName, input.productName, JSON.stringify(input.config)],
      );

      if ((profileInsert.rowCount || 0) > 0) {
        await client.query(
          `
            insert into oem_brand_versions (
              id,
              brand_id,
              version_no,
              config,
              created_by,
              created_at,
              published_at
            )
            values ($1, $2, 1, $3::jsonb, null, now(), now())
            on conflict (brand_id, version_no) do nothing
          `,
          [randomUUID(), input.brandId, JSON.stringify(input.config)],
        );
      }

      for (const asset of input.assets) {
        await client.query(
          `
            insert into oem_asset_registry (
              id,
              brand_id,
              asset_key,
              kind,
              storage_provider,
              object_key,
              public_url,
              metadata,
              created_by,
              created_at,
              updated_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, null, now(), now())
            on conflict (brand_id, asset_key) do update
            set kind = excluded.kind,
                storage_provider = excluded.storage_provider,
                object_key = excluded.object_key,
                public_url = excluded.public_url,
                metadata = excluded.metadata,
                updated_at = now()
          `,
          [
            randomUUID(),
            input.brandId,
            asset.assetKey,
            asset.kind,
            asset.storageProvider,
            asset.objectKey,
            asset.publicUrl || null,
            JSON.stringify(asset.metadata || {}),
          ],
        );
      }

      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async listBrands(options: {query?: string | null; status?: string | null; limit?: number} = {}): Promise<OemBrandRecord[]> {
    const query = options.query?.trim() || null;
    const status = options.status?.trim() || null;
    const limit = Math.max(1, Math.min(500, options.limit || 200));
    const result = await this.pool.query<OemBrandRow>(
      `
        select
          brand_id,
          tenant_key,
          display_name,
          product_name,
          status,
          draft_config,
          published_config,
          published_version,
          created_at,
          updated_at
        from oem_brand_profiles
        where (
          $1::text is null
          or brand_id ilike '%' || $1 || '%'
          or display_name ilike '%' || $1 || '%'
          or product_name ilike '%' || $1 || '%'
          or tenant_key ilike '%' || $1 || '%'
        )
          and ($2::text is null or status = $2)
        order by updated_at desc, brand_id asc
        limit $3
      `,
      [query, status, limit],
    );
    return result.rows.map(mapBrandRow);
  }

  async listBrandSummaries(options: {query?: string | null; status?: string | null; limit?: number} = {}): Promise<OemBrandSummaryRecord[]> {
    const query = options.query?.trim() || null;
    const status = options.status?.trim() || null;
    const limit = Math.max(1, Math.min(500, options.limit || 200));
    const result = await this.pool.query<OemBrandSummaryRow>(
      `
        select
          p.brand_id,
          p.tenant_key,
          p.display_name,
          p.product_name,
          p.status,
          p.published_version,
          p.created_at,
          p.updated_at,
          max(v.published_at) as last_published_at,
          count(a.id) as asset_count
        from oem_brand_profiles p
        left join oem_brand_versions v on v.brand_id = p.brand_id
        left join oem_asset_registry a on a.brand_id = p.brand_id
        where (
          $1::text is null
          or p.brand_id ilike '%' || $1 || '%'
          or p.display_name ilike '%' || $1 || '%'
          or p.product_name ilike '%' || $1 || '%'
          or p.tenant_key ilike '%' || $1 || '%'
        )
          and ($2::text is null or p.status = $2)
        group by
          p.brand_id,
          p.tenant_key,
          p.display_name,
          p.product_name,
          p.status,
          p.published_version,
          p.created_at,
          p.updated_at
        order by p.updated_at desc, p.brand_id asc
        limit $3
      `,
      [query, status, limit],
    );
    return result.rows.map(mapBrandSummaryRow);
  }

  async getBrand(brandId: string): Promise<OemBrandRecord | null> {
    const result = await this.pool.query<OemBrandRow>(
      `
        select
          brand_id,
          tenant_key,
          display_name,
          product_name,
          status,
          draft_config,
          published_config,
          published_version,
          created_at,
          updated_at
        from oem_brand_profiles
        where brand_id = $1
        limit 1
      `,
      [brandId],
    );
    return result.rows[0] ? mapBrandRow(result.rows[0]) : null;
  }

  async getPublishedBrand(brandId: string): Promise<OemBrandRecord | null> {
    const result = await this.pool.query<OemBrandRow>(
      `
        select
          brand_id,
          tenant_key,
          display_name,
          product_name,
          status,
          draft_config,
          published_config,
          published_version,
          created_at,
          updated_at
        from oem_brand_profiles
        where brand_id = $1
          and published_config is not null
        limit 1
      `,
      [brandId],
    );
    return result.rows[0] ? mapBrandRow(result.rows[0]) : null;
  }

  async listBrandVersions(brandId: string): Promise<OemBrandVersionRecord[]> {
    const result = await this.pool.query<OemBrandVersionRow>(
      `
        select
          v.id,
          v.brand_id,
          p.display_name,
          v.version_no,
          v.config,
          v.created_by,
          u.display_name as created_by_name,
          u.username as created_by_username,
          v.created_at,
          v.published_at
        from oem_brand_versions v
        join oem_brand_profiles p on p.brand_id = v.brand_id
        left join users u on u.id = v.created_by
        where v.brand_id = $1
        order by version_no desc
      `,
      [brandId],
    );
    return result.rows.map(mapVersionRow);
  }

  async listReleases(options: {brandId?: string | null; limit?: number} = {}): Promise<OemBrandVersionRecord[]> {
    const brandId = options.brandId?.trim() || null;
    const limit = Math.max(1, Math.min(200, options.limit || 50));
    const result = await this.pool.query<OemBrandVersionRow>(
      `
        select
          v.id,
          v.brand_id,
          p.display_name,
          v.version_no,
          v.config,
          v.created_by,
          u.display_name as created_by_name,
          u.username as created_by_username,
          v.created_at,
          v.published_at
        from oem_brand_versions v
        join oem_brand_profiles p on p.brand_id = v.brand_id
        left join users u on u.id = v.created_by
        where ($1::text is null or v.brand_id = $1)
        order by v.published_at desc, v.version_no desc
        limit $2
      `,
      [brandId, limit],
    );
    return result.rows.map(mapVersionRow);
  }

  async listBrandAssets(brandId: string): Promise<OemAssetListRecord[]> {
    const result = await this.pool.query<OemAssetRow>(
      `
        select
          a.id,
          a.brand_id,
          p.display_name as brand_display_name,
          p.product_name as brand_product_name,
          a.asset_key,
          a.kind,
          a.storage_provider,
          a.object_key,
          a.public_url,
          a.metadata,
          a.created_by,
          a.created_at,
          a.updated_at
        from oem_asset_registry a
        join oem_brand_profiles p on p.brand_id = a.brand_id
        where a.brand_id = $1
        order by asset_key asc
      `,
      [brandId],
    );
    return result.rows.map(mapAssetRow);
  }

  async getBrandAsset(brandId: string, assetKey: string): Promise<OemAssetListRecord | null> {
    const result = await this.pool.query<OemAssetRow>(
      `
        select
          a.id,
          a.brand_id,
          p.display_name as brand_display_name,
          p.product_name as brand_product_name,
          a.asset_key,
          a.kind,
          a.storage_provider,
          a.object_key,
          a.public_url,
          a.metadata,
          a.created_by,
          a.created_at,
          a.updated_at
        from oem_asset_registry a
        join oem_brand_profiles p on p.brand_id = a.brand_id
        where a.brand_id = $1 and a.asset_key = $2
        limit 1
      `,
      [brandId, assetKey],
    );
    return result.rows[0] ? mapAssetRow(result.rows[0]) : null;
  }

  async listAssets(options: {brandId?: string | null; kind?: string | null; limit?: number} = {}): Promise<OemAssetListRecord[]> {
    const brandId = options.brandId?.trim() || null;
    const kind = options.kind?.trim() || null;
    const limit = Math.max(1, Math.min(500, options.limit || 200));
    const result = await this.pool.query<OemAssetRow>(
      `
        select
          a.id,
          a.brand_id,
          p.display_name as brand_display_name,
          p.product_name as brand_product_name,
          a.asset_key,
          a.kind,
          a.storage_provider,
          a.object_key,
          a.public_url,
          a.metadata,
          a.created_by,
          a.created_at,
          a.updated_at
        from oem_asset_registry a
        join oem_brand_profiles p on p.brand_id = a.brand_id
        where ($1::text is null or a.brand_id = $1)
          and ($2::text is null or a.kind = $2)
        order by a.updated_at desc, a.asset_key asc
        limit $3
      `,
      [brandId, kind, limit],
    );
    return result.rows.map(mapAssetRow);
  }

  async listAuditEvents(brandId: string, limit = 20): Promise<OemAuditEventRecord[]> {
    const result = await this.pool.query<OemAuditRow>(
      `
        select
          e.id,
          e.brand_id,
          p.display_name as brand_display_name,
          p.product_name as brand_product_name,
          e.action,
          e.actor_user_id,
          u.display_name as actor_name,
          u.username as actor_username,
          e.payload,
          e.created_at
        from oem_audit_events e
        join oem_brand_profiles p on p.brand_id = e.brand_id
        left join users u on u.id = e.actor_user_id
        where e.brand_id = $1
        order by e.created_at desc
        limit $2
      `,
      [brandId, limit],
    );
    return result.rows.map(mapAuditRow);
  }

  async listAuditFeed(options: {
    brandId?: string | null;
    action?: string | null;
    limit?: number;
  } = {}): Promise<OemAuditEventRecord[]> {
    const brandId = options.brandId?.trim() || null;
    const action = options.action?.trim() || null;
    const limit = Math.max(1, Math.min(500, options.limit || 200));
    const result = await this.pool.query<OemAuditRow>(
      `
        select
          e.id,
          e.brand_id,
          p.display_name as brand_display_name,
          p.product_name as brand_product_name,
          e.action,
          e.actor_user_id,
          u.display_name as actor_name,
          u.username as actor_username,
          e.payload,
          e.created_at
        from oem_audit_events e
        join oem_brand_profiles p on p.brand_id = e.brand_id
        left join users u on u.id = e.actor_user_id
        where ($1::text is null or e.brand_id = $1)
          and ($2::text is null or e.action = $2)
        order by e.created_at desc
        limit $3
      `,
      [brandId, action, limit],
    );
    return result.rows.map(mapAuditRow);
  }

  async upsertDraft(input: UpsertOemBrandDraftInput): Promise<OemBrandRecord> {
    const result = await this.pool.query<OemBrandRow>(
      `
        insert into oem_brand_profiles (
          brand_id,
          tenant_key,
          display_name,
          product_name,
          status,
          draft_config,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6::jsonb, now(), now())
        on conflict (brand_id) do update
        set tenant_key = excluded.tenant_key,
            display_name = excluded.display_name,
            product_name = excluded.product_name,
            status = excluded.status,
            draft_config = excluded.draft_config,
            updated_at = now()
        returning
          brand_id,
          tenant_key,
          display_name,
          product_name,
          status,
          draft_config,
          published_config,
          published_version,
          created_at,
          updated_at
      `,
      [
        input.brandId,
        input.tenantKey,
        input.displayName,
        input.productName,
        input.status,
        JSON.stringify(input.draftConfig),
      ],
    );

    await this.insertAuditEvent(this.pool, {
      brandId: input.brandId,
      action: 'draft_saved',
      actorUserId: input.actorUserId,
      payload: {
        tenantKey: input.tenantKey,
        displayName: input.displayName,
        productName: input.productName,
        status: input.status,
        environment: 'draft',
      },
    });

    return mapBrandRow(result.rows[0]);
  }

  async upsertAsset(input: UpsertOemAssetInput): Promise<OemAssetListRecord> {
    const result = await this.pool.query<OemAssetRow>(
      `
        insert into oem_asset_registry (
          id,
          brand_id,
          asset_key,
          kind,
          storage_provider,
          object_key,
          public_url,
          metadata,
          created_by,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, now(), now())
        on conflict (brand_id, asset_key) do update
        set kind = excluded.kind,
            storage_provider = excluded.storage_provider,
            object_key = excluded.object_key,
            public_url = excluded.public_url,
            metadata = excluded.metadata,
            updated_at = now()
        returning
          id,
          brand_id,
          $10::text as brand_display_name,
          $11::text as brand_product_name,
          asset_key,
          kind,
          storage_provider,
          object_key,
          public_url,
          metadata,
          created_by,
          created_at,
          updated_at
      `,
      [
        randomUUID(),
        input.brandId,
        input.assetKey,
        input.kind,
        input.storageProvider,
        input.objectKey,
        input.publicUrl,
        JSON.stringify(input.metadata),
        input.actorUserId,
        null,
        null,
      ],
    );

    const brand = await this.getBrand(input.brandId);
    const asset = result.rows[0];
    asset.brand_display_name = brand?.displayName || null;
    asset.brand_product_name = brand?.productName || null;

    await this.insertAuditEvent(this.pool, {
      brandId: input.brandId,
      action: 'asset_upserted',
      actorUserId: input.actorUserId,
      payload: {
        assetKey: input.assetKey,
        kind: input.kind,
        storageProvider: input.storageProvider,
      },
    });

    return mapAssetRow(asset);
  }

  async publishBrand(brandId: string, actorUserId: string | null): Promise<OemBrandRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = await this.getBrandForUpdate(client, brandId);
      if (!current) {
        throw new Error('OEM_BRAND_NOT_FOUND');
      }

      const nextVersion = (current.publishedVersion || 0) + 1;
      const draftJson = JSON.stringify(current.draftConfig);
      await client.query(
        `
          insert into oem_brand_versions (
            id,
            brand_id,
            version_no,
            config,
            created_by,
            created_at,
            published_at
          )
          values ($1, $2, $3, $4::jsonb, $5, now(), now())
        `,
        [randomUUID(), brandId, nextVersion, draftJson, actorUserId],
      );

      const result = await client.query<OemBrandRow>(
        `
          update oem_brand_profiles
          set published_config = draft_config,
              published_version = $2,
              status = 'published',
              updated_at = now()
          where brand_id = $1
          returning
            brand_id,
            tenant_key,
            display_name,
            product_name,
            status,
            draft_config,
            published_config,
            published_version,
            created_at,
            updated_at
        `,
        [brandId, nextVersion],
      );

      await this.insertAuditEvent(client, {
        brandId,
        action: 'published',
        actorUserId,
        payload: {
          version: nextVersion,
          environment: 'published',
        },
      });

      await client.query('commit');
      return mapBrandRow(result.rows[0]);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async restoreBrandVersion(brandId: string, version: number, actorUserId: string | null): Promise<OemBrandRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = await this.getBrandForUpdate(client, brandId);
      if (!current) {
        throw new Error('OEM_BRAND_NOT_FOUND');
      }

      const versionResult = await client.query<{config: Record<string, unknown> | null}>(
        `
          select config
          from oem_brand_versions
          where brand_id = $1 and version_no = $2
          limit 1
        `,
        [brandId, version],
      );
      const versionConfig = versionResult.rows[0]?.config;
      if (!versionConfig) {
        throw new Error('OEM_VERSION_NOT_FOUND');
      }

      const result = await client.query<OemBrandRow>(
        `
          update oem_brand_profiles
          set draft_config = $3::jsonb,
              status = 'draft',
              updated_at = now()
          where brand_id = $1
          returning
            brand_id,
            tenant_key,
            display_name,
            product_name,
            status,
            draft_config,
            published_config,
            published_version,
            created_at,
            updated_at
        `,
        [brandId, version, JSON.stringify(versionConfig)],
      );

      await this.insertAuditEvent(client, {
        brandId,
        action: 'rollback_prepared',
        actorUserId,
        payload: {
          version,
          environment: 'draft',
        },
      });

      await client.query('commit');
      return mapBrandRow(result.rows[0]);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async getBrandForUpdate(client: PoolClient, brandId: string): Promise<OemBrandRecord | null> {
    const result = await client.query<OemBrandRow>(
      `
        select
          brand_id,
          tenant_key,
          display_name,
          product_name,
          status,
          draft_config,
          published_config,
          published_version,
          created_at,
          updated_at
        from oem_brand_profiles
        where brand_id = $1
        for update
      `,
      [brandId],
    );
    return result.rows[0] ? mapBrandRow(result.rows[0]) : null;
  }

  private async insertAuditEvent(
    db: Pool | PoolClient,
    input: {
      brandId: string;
      action: string;
      actorUserId: string | null;
      payload: OemJsonObject;
    },
  ): Promise<void> {
    await db.query(
      `
        insert into oem_audit_events (
          id,
          brand_id,
          action,
          actor_user_id,
          payload,
          created_at
        )
        values ($1, $2, $3, $4, $5::jsonb, now())
      `,
      [randomUUID(), input.brandId, input.action, input.actorUserId, JSON.stringify(input.payload)],
    );
  }
}
