import {randomUUID} from 'node:crypto';

import {Pool, type PoolClient} from 'pg';

import type {
  OemAssetRecord,
  OemAuditEventRecord,
  OemBrandRecord,
  OemBrandVersionRecord,
  OemJsonObject,
  SeedOemBrandInput,
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
  version_no: number;
  config: Record<string, unknown> | null;
  created_by: string | null;
  created_at: Date;
  published_at: Date;
};

type OemAssetRow = {
  id: string;
  brand_id: string;
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
  action: string;
  actor_user_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: Date;
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
    version: row.version_no,
    config: asJsonObject(row.config),
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    publishedAt: row.published_at.toISOString(),
  };
}

function mapAssetRow(row: OemAssetRow): OemAssetRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
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
    action: row.action,
    actorUserId: row.actor_user_id,
    payload: asJsonObject(row.payload),
    createdAt: row.created_at.toISOString(),
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

  async listBrands(): Promise<OemBrandRecord[]> {
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
        order by updated_at desc, brand_id asc
      `,
    );
    return result.rows.map(mapBrandRow);
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
        select id, brand_id, version_no, config, created_by, created_at, published_at
        from oem_brand_versions
        where brand_id = $1
        order by version_no desc
      `,
      [brandId],
    );
    return result.rows.map(mapVersionRow);
  }

  async listBrandAssets(brandId: string): Promise<OemAssetRecord[]> {
    const result = await this.pool.query<OemAssetRow>(
      `
        select
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
        from oem_asset_registry
        where brand_id = $1
        order by asset_key asc
      `,
      [brandId],
    );
    return result.rows.map(mapAssetRow);
  }

  async listAuditEvents(brandId: string, limit = 20): Promise<OemAuditEventRecord[]> {
    const result = await this.pool.query<OemAuditRow>(
      `
        select id, brand_id, action, actor_user_id, payload, created_at
        from oem_audit_events
        where brand_id = $1
        order by created_at desc
        limit $2
      `,
      [brandId, limit],
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
      },
    });

    return mapBrandRow(result.rows[0]);
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
