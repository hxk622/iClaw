import { formatRelative, statusLabel } from '../lib/adminFormat';
import { useState } from 'react';
import { adminFilterControlStyle, AdminFilterStack, AdminSearchRow, AdminSelectorRow } from './AdminFilterLayout';

export function BrandsPage({
  brands,
  brandQuery,
  brandStatus,
  setBrandQuery,
  setBrandStatus,
  onOpenBrand,
  onCreateBrand,
  savingCreateBrand,
}: {
  brands: Array<{
    brandId: string;
    displayName: string;
    productName: string;
    tenantKey: string;
    status: string;
    updatedAt: string;
    surfaceCount: number;
    skillCount: number;
    mcpCount: number;
  }>;
  brandQuery: string;
  brandStatus: string;
  setBrandQuery: (value: string) => void;
  setBrandStatus: (value: string) => void;
  onOpenBrand: (brandId: string) => void;
  onCreateBrand: (input: {
    brandId: string;
    displayName: string;
    productName: string;
    tenantKey: string;
  }) => Promise<void> | void;
  savingCreateBrand: boolean;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [draft, setDraft] = useState({
    brandId: '',
    displayName: '',
    productName: '',
    tenantKey: '',
  });

  return (
    <div className="fig-page">
      <div className="fig-page__header">
        <div className="fig-page__header-inner fig-page__header-inner--stack">
          <div className="fig-page__header-row">
            <div>
              <h1>品牌管理</h1>
              <p className="fig-page__description">管理 OEM 应用配置、Skill 绑定、MCP 绑定和菜单显隐</p>
            </div>
            <button className="solid-button fig-button" type="button" onClick={() => setShowCreateForm((current) => !current)}>
              {showCreateForm ? '收起' : '创建品牌'}
            </button>
          </div>
          <AdminFilterStack>
            <AdminSearchRow>
              <input
                className="field-input"
                placeholder="搜索品牌..."
                value={brandQuery}
                onChange={(event) => setBrandQuery(event.target.value)}
                style={adminFilterControlStyle()}
              />
            </AdminSearchRow>
            <AdminSelectorRow>
              <select
                className="field-select"
                value={brandStatus}
                onChange={(event) => setBrandStatus(event.target.value)}
                style={adminFilterControlStyle()}
              >
                <option value="all">所有状态</option>
                <option value="active">已启用</option>
                <option value="disabled">已停用</option>
              </select>
            </AdminSelectorRow>
          </AdminFilterStack>
        </div>
      </div>
      <div className="fig-page__body">
        <section className="fig-guide fig-guide--brands">
          <div className="fig-guide__head">
            <span className="fig-guide__eyebrow">操作指南</span>
            <h3>品牌管理怎么用</h3>
          </div>
          <div className="fig-guide__grid">
            {[
              '一个品牌就是一个 OEM app，这里负责创建、搜索和进入每个品牌的配置空间。',
              '进入品牌详情后，分别维护 shell 区域、能力绑定、业务模块、资源和主题。',
              '改完先保存配置，再发布快照；不发布，客户端不会切到新配置。',
            ].map((item, index) => (
              <article key={item} className="fig-guide__item">
                <span className="fig-guide__index">{index + 1}</span>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </section>
        {showCreateForm ? (
          <section className="fig-card fig-create-panel">
            <div className="fig-card__head">
              <h3>创建新品牌</h3>
            </div>
            <div className="form-grid form-grid--two">
              <label className="field">
                <span>App Name</span>
                <input className="field-input" value={draft.brandId} onChange={(event) => setDraft((current) => ({ ...current, brandId: event.target.value }))} />
              </label>
              <label className="field">
                <span>显示名称</span>
                <input className="field-input" value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} />
              </label>
              <label className="field">
                <span>产品名称</span>
                <input className="field-input" value={draft.productName} onChange={(event) => setDraft((current) => ({ ...current, productName: event.target.value }))} />
              </label>
              <label className="field">
                <span>Tenant Key</span>
                <input className="field-input" value={draft.tenantKey} onChange={(event) => setDraft((current) => ({ ...current, tenantKey: event.target.value }))} />
              </label>
            </div>
            <div className="fig-form-actions">
              <button
                className="solid-button"
                type="button"
                disabled={savingCreateBrand}
                onClick={() => void onCreateBrand(draft)}
              >
                {savingCreateBrand ? '创建中…' : '创建品牌'}
              </button>
            </div>
          </section>
        ) : null}
        <section className="fig-brand-grid">
          {brands.length ? (
            brands.map((brand) => (
              <button
                key={brand.brandId}
                className="fig-brand-card"
                type="button"
                onClick={() => onOpenBrand(brand.brandId)}
              >
                <div className="fig-brand-card__head">
                  <div>
                    <h3>{brand.displayName}</h3>
                    <p>{brand.productName}</p>
                  </div>
                  <span className={`status-chip ${brand.status === 'disabled' ? 'status-chip--muted' : 'status-chip--published'}`}>
                    {statusLabel(brand.status)}
                  </span>
                </div>
                <div className="fig-brand-card__meta">
                  <div>
                    <span>租户密钥:</span>
                    <code>{brand.tenantKey}</code>
                  </div>
                  <div>
                    <span>App:</span>
                    <code>{brand.brandId}</code>
                  </div>
                </div>
                <div className="fig-brand-card__footer">
                  <span>{`${brand.surfaceCount} 个 Surface / ${brand.skillCount} 个 Skill / ${brand.mcpCount} 个 MCP`}</span>
                  <span>{formatRelative(brand.updatedAt)}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="empty-state empty-state--panel">没有匹配的品牌。</div>
          )}
        </section>
      </div>
    </div>
  );
}
