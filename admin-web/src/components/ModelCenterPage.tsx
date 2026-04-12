import type { Dispatch, SetStateAction } from 'react';
import type { OverviewData } from '../lib/adminTypes';
import { adminFilterControlStyle, AdminFilterStack, AdminSearchWithObjectRow } from './AdminFilterLayout';

type BrandOption = {
  brandId: string;
  displayName: string;
};

export type PlatformModelDraft = {
  ref: string;
  label: string;
  providerId: string;
  modelId: string;
  api: string;
  baseUrl: string;
  useRuntimeOpenai: boolean;
  authHeader: boolean;
  reasoning: boolean;
  inputText: string;
  contextWindow: number;
  maxTokens: number;
  active: boolean;
};

export type ModelProviderDraft = {
  profileId: string;
  providerMode: string;
  providerKey: string;
  baseUrl: string;
  apiKey: string;
  logoPresetKey: string;
  defaultModelRef: string;
  models: Array<{
    label: string;
    modelId: string;
    billingMultiplier: number;
    logoPresetKey: string;
  }>;
};

export type MemoryEmbeddingDraft = {
  profileId: string;
  providerKey: string;
  baseUrl: string;
  apiKey: string;
  embeddingModel: string;
  logoPresetKey: string;
  autoRecall: boolean;
};

type PlatformModelItem = OverviewData['platformModels'][number];
type ProviderProfileItem = OverviewData['modelProviderProfiles'][number];

function moveItem<T>(items: T[], index: number, direction: 'up' | 'down') {
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

export function ModelCenterPage({
  brands,
  capabilityQuery,
  setCapabilityQuery,
  filteredPlatformModels,
  selectedPlatformModel,
  selectedPlatformModelRef,
  setSelectedPlatformModelRef,
  platformModelDraft,
  setPlatformModelDraft,
  savingPlatformModel,
  handleSavePlatformModel,
  handleDeletePlatformModel,
  openBrandDetail,
  overviewData,
  selectedModelProviderTab,
  setSelectedModelProviderTab,
  selectedModelCenterSection,
  setSelectedModelCenterSection,
  selectedProviderScopeType,
  selectedProviderScopeKey,
  providerDraft,
  setProviderDraft,
  savingModelProviderProfile,
  handleSaveModelProviderProfile,
  handleRestorePlatformProvider,
  memoryDraft,
  setMemoryDraft,
  savingMemoryEmbeddingProfile,
  handleSaveMemoryEmbedding,
  handleTestMemoryEmbedding,
  handleRestorePlatformMemory,
  memoryEmbeddingTestResult,
}: {
  brands: BrandOption[];
  capabilityQuery: string;
  setCapabilityQuery: (value: string) => void;
  filteredPlatformModels: PlatformModelItem[];
  selectedPlatformModel: PlatformModelItem | null;
  selectedPlatformModelRef: string;
  setSelectedPlatformModelRef: (value: string) => void;
  platformModelDraft: PlatformModelDraft;
  setPlatformModelDraft: Dispatch<SetStateAction<PlatformModelDraft>>;
  savingPlatformModel: boolean;
  handleSavePlatformModel: () => Promise<void> | void;
  handleDeletePlatformModel: (ref: string) => Promise<void> | void;
  openBrandDetail: (brandId: string) => void;
  overviewData: OverviewData | null;
  selectedModelProviderTab: string;
  setSelectedModelProviderTab: (value: string) => void;
  selectedModelCenterSection: 'chat-provider' | 'memory-embedding';
  setSelectedModelCenterSection: (value: 'chat-provider' | 'memory-embedding') => void;
  selectedProviderScopeType: 'platform' | 'app';
  selectedProviderScopeKey: string;
  providerDraft: ModelProviderDraft;
  setProviderDraft: Dispatch<SetStateAction<ModelProviderDraft>>;
  savingModelProviderProfile: boolean;
  handleSaveModelProviderProfile: () => Promise<void> | void;
  handleRestorePlatformProvider: () => Promise<void> | void;
  memoryDraft: MemoryEmbeddingDraft;
  setMemoryDraft: Dispatch<SetStateAction<MemoryEmbeddingDraft>>;
  savingMemoryEmbeddingProfile: boolean;
  handleSaveMemoryEmbedding: () => Promise<void> | void;
  handleTestMemoryEmbedding: () => Promise<void> | void;
  handleRestorePlatformMemory: () => Promise<void> | void;
  memoryEmbeddingTestResult?: { ok?: boolean; message?: string; dimensions?: number | null } | null;
}) {
  const modelLogoPresets = overviewData?.modelLogoPresets || [];
  const currentProviderProfile =
    (overviewData?.modelProviderProfiles || []).find(
      (item) => item.scopeType === selectedProviderScopeType && item.scopeKey === selectedProviderScopeKey,
    ) || null;
  const currentProviderOverride =
    selectedProviderScopeType === 'app' ? overviewData?.modelProviderOverrides?.[selectedProviderScopeKey] || null : null;
  const effectiveProviderMode =
    selectedProviderScopeType === 'platform' ? 'platform_default' : currentProviderOverride?.providerMode || 'inherit_platform';
  const effectiveProviderSourceLabel =
    selectedProviderScopeType === 'platform'
      ? '平台默认'
      : effectiveProviderMode === 'use_app_profile'
        ? `OEM Override · ${selectedProviderScopeKey}`
        : '继承平台';
  const effectiveProviderProfile: ProviderProfileItem | null =
    selectedProviderScopeType === 'app' && effectiveProviderMode !== 'use_app_profile'
      ? (overviewData?.modelProviderProfiles || []).find((item) => item.scopeType === 'platform' && item.scopeKey === 'platform') || null
      : currentProviderProfile;
  const platformProviderProfile =
    (overviewData?.modelProviderProfiles || []).find((item) => item.scopeType === 'platform' && item.scopeKey === 'platform') || null;
  const platformMemoryProfile =
    (overviewData?.memoryEmbeddingProfiles || []).find((item) => item.scopeType === 'platform' && item.scopeKey === 'platform') || null;
  const providerStatusTitle =
    selectedProviderScopeType === 'platform'
      ? `当前平台默认 Provider：${platformProviderProfile?.providerKey || providerDraft.providerKey || '未配置'}`
      : effectiveProviderMode === 'use_app_profile'
        ? `当前使用 OEM Provider：${providerDraft.providerKey || currentProviderProfile?.providerKey || '未配置'}`
        : `当前跟随平台 Provider：${platformProviderProfile?.providerKey || '未配置'}`;
  const providerStatusDescription =
    selectedProviderScopeType === 'platform'
      ? '这里是所有 OEM 的默认 provider。OEM 未单独启用时都会继承这里。'
      : effectiveProviderMode === 'use_app_profile'
        ? '当前这个 OEM 已切到自己的 provider。保存下方配置会直接更新当前生效配置。'
        : currentProviderProfile?.id
          ? '这个 OEM 已保存独立 provider，但当前仍跟随平台。再次保存下方配置会自动启用 OEM Provider。'
          : '这个 OEM 当前跟随平台。填写并保存下方配置后，会自动切到自己的 Provider。';
  const memoryStatusTitle =
    selectedProviderScopeType === 'platform'
      ? `当前平台默认记忆 Embedding：${platformMemoryProfile?.providerKey || memoryDraft.providerKey || '未配置'}`
      : memoryDraft.profileId
        ? `当前使用 OEM 记忆 Embedding：${memoryDraft.providerKey || '未配置'}`
        : `当前跟随平台记忆 Embedding：${platformMemoryProfile?.providerKey || '未配置'}`;
  const memoryStatusDescription =
    selectedProviderScopeType === 'platform'
      ? '这里是所有 OEM 的默认记忆向量配置。OEM 没有单独配置时都会继承这里。'
      : memoryDraft.profileId
        ? '当前这个 OEM 已切到自己的记忆 Embedding。保存后会直接更新当前生效配置。'
        : '这个 OEM 当前跟随平台记忆 Embedding。填写并保存下方配置后，只影响这个 OEM 的记忆索引与召回。';

  const resolveLogoPreset = (presetKey: string) => modelLogoPresets.find((item) => item.presetKey === presetKey) || null;
  const renderLogoPreview = (presetKey: string, label: string) => {
    const preset = resolveLogoPreset(presetKey);
    if (!preset) {
      return <div className="empty-state" style={{ minHeight: 40 }}>{label} 未设置</div>;
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img
          src={preset.url}
          alt={preset.label}
          style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 10, background: 'rgba(255,255,255,0.04)', padding: 6, border: '1px solid rgba(42, 40, 37, 0.12)' }}
        />
        <span>{preset.label}</span>
      </div>
    );
  };

  const providerModelOptions = providerDraft.models
    .filter((item) => item.label.trim() && item.modelId.trim())
    .map((item) => ({
      ref: providerDraft.providerKey.trim() ? `${providerDraft.providerKey.trim()}/${item.modelId.trim()}` : item.modelId.trim(),
      label: item.label.trim(),
    }));

  const updateProviderModel = (
    index: number,
    updater: (item: ModelProviderDraft['models'][number]) => ModelProviderDraft['models'][number],
  ) => {
    setProviderDraft((current) => ({
      ...current,
      models: current.models.map((item, rowIndex) => (rowIndex === index ? updater(item) : item)),
    }));
  };

  const renderProviderModelRow = (item: ModelProviderDraft['models'][number], index: number) => (
    <div key={`${item.modelId}-${index}`} className="fig-card fig-card--subtle" style={{ padding: 16 }}>
      <div className="fig-card__head">
        <h3>{`模型 ${index + 1}`}</h3>
        <div className="action-row">
          <button
            className="ghost-button"
            type="button"
            disabled={index === 0}
            onClick={() =>
              setProviderDraft((current) => ({
                ...current,
                models: moveItem(current.models, index, 'up'),
              }))
            }
          >
            上移
          </button>
          <button
            className="ghost-button"
            type="button"
            disabled={index === providerDraft.models.length - 1}
            onClick={() =>
              setProviderDraft((current) => ({
                ...current,
                models: moveItem(current.models, index, 'down'),
              }))
            }
          >
            下移
          </button>
          <button
            className="ghost-button"
            type="button"
            disabled={providerDraft.models.length === 1}
            onClick={() =>
              setProviderDraft((current) => {
                const models = current.models.filter((_, rowIndex) => rowIndex !== index);
                const nextDefaultModelRef = models.some(
                  (entry) =>
                    `${current.providerKey.trim()}/${entry.modelId.trim()}` === current.defaultModelRef ||
                    entry.modelId.trim() === current.defaultModelRef,
                )
                  ? current.defaultModelRef
                  : '';
                return {
                  ...current,
                  models: models.length ? models : [{ label: '', modelId: '', billingMultiplier: 1, logoPresetKey: '' }],
                  defaultModelRef: nextDefaultModelRef,
                };
              })
            }
          >
            删除
          </button>
        </div>
      </div>
      <div className="form-grid form-grid--two">
        <label className="field">
          <span>Label</span>
          <input className="field-input" value={item.label} onChange={(event) => updateProviderModel(index, (current) => ({ ...current, label: event.target.value }))} />
        </label>
        <label className="field">
          <span>Model ID</span>
          <input className="field-input" value={item.modelId} onChange={(event) => updateProviderModel(index, (current) => ({ ...current, modelId: event.target.value }))} />
        </label>
        <label className="field">
          <span>倍率</span>
          <input
            className="field-input"
            type="number"
            min="0.01"
            step="0.01"
            value={item.billingMultiplier}
            onChange={(event) => updateProviderModel(index, (current) => ({ ...current, billingMultiplier: Number(event.target.value || 1) || 1 }))}
          />
        </label>
        <label className="field field--wide">
          <span>Logo Preset</span>
          <select className="field-select" value={item.logoPresetKey} onChange={(event) => updateProviderModel(index, (current) => ({ ...current, logoPresetKey: event.target.value }))}>
            <option value="">不设置</option>
            {modelLogoPresets.map((preset) => (
              <option key={preset.presetKey} value={preset.presetKey}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <div className="field field--wide">
          <span>Logo Preview</span>
          {renderLogoPreview(item.logoPresetKey, '模型 Logo')}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fig-page">
      <div className="fig-page__header">
        <div className="fig-page__header-inner">
          <div>
            <h1>模型中心</h1>
            <p className="fig-page__description">顶部 tab 切平台和 OEM；每个 tab 下直接维护该作用域的 provider 与模型列表。</p>
          </div>
        </div>
      </div>
      <div className="fig-page__body">
        <div className="fig-detail-stack">
          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>作用域</h3>
              <span>平台 / OEM</span>
            </div>
            <div className="segmented" style={{ flexWrap: 'wrap' }}>
              <button className={`tab-pill${selectedModelProviderTab === 'platform' ? ' is-active' : ''}`} type="button" onClick={() => setSelectedModelProviderTab('platform')}>
                平台
              </button>
              {brands.map((brand) => (
                <button key={brand.brandId} className={`tab-pill${selectedModelProviderTab === brand.brandId ? ' is-active' : ''}`} type="button" onClick={() => setSelectedModelProviderTab(brand.brandId)}>
                  {brand.displayName}
                </button>
              ))}
            </div>
            <div className="segmented" style={{ marginTop: 12 }}>
              <button className={`tab-pill${selectedModelCenterSection === 'chat-provider' ? ' is-active' : ''}`} type="button" onClick={() => setSelectedModelCenterSection('chat-provider')}>
                聊天 Provider
              </button>
              <button className={`tab-pill${selectedModelCenterSection === 'memory-embedding' ? ' is-active' : ''}`} type="button" onClick={() => setSelectedModelCenterSection('memory-embedding')}>
                记忆 Embedding
              </button>
            </div>
          </section>

          {selectedModelCenterSection === 'chat-provider' ? (
            <>
              <section className="fig-card">
                <div className="fig-card__head">
                  <div>
                    <h2>{selectedProviderScopeType === 'platform' ? '平台 Provider' : `${selectedProviderScopeKey} Provider`}</h2>
                    <span>{selectedProviderScopeType === 'platform' ? '所有 OEM 默认继承这里' : '这里维护这个 OEM 的独立 provider 配置'}</span>
                  </div>
                  <div className="metric-chips">
                    <span>{effectiveProviderSourceLabel}</span>
                    <span>{selectedProviderScopeType === 'platform' ? 'platform_default' : effectiveProviderMode}</span>
                  </div>
                </div>
                <div className="fig-meta-cards">
                  <div className="fig-meta-card"><span>当前生效来源</span><strong>{effectiveProviderSourceLabel}</strong></div>
                  <div className="fig-meta-card"><span>Provider Key</span><strong>{effectiveProviderProfile?.providerKey || providerDraft.providerKey || '未设置'}</strong></div>
                  <div className="fig-meta-card"><span>默认模型</span><strong>{providerDraft.defaultModelRef || '未设置'}</strong></div>
                  <div className="fig-meta-card"><span>模型数</span><strong>{String(providerDraft.models.filter((item) => item.label.trim() && item.modelId.trim()).length)}</strong></div>
                </div>
                <div className="empty-state" style={{ minHeight: 'auto', alignItems: 'flex-start', textAlign: 'left', marginTop: 16 }}>
                  <strong>{providerStatusTitle}</strong>
                  <span>{providerStatusDescription}</span>
                </div>
                <div className="form-grid form-grid--two" style={{ marginTop: 16 }}>
                  {selectedProviderScopeType === 'app' ? (
                    <label className="field">
                      <span>Provider Mode</span>
                      <select className="field-select" value={providerDraft.providerMode} onChange={(event) => setProviderDraft((current) => ({ ...current, providerMode: event.target.value }))}>
                        <option value="inherit_platform">inherit_platform</option>
                        <option value="use_app_profile">use_app_profile</option>
                      </select>
                    </label>
                  ) : null}
                  <label className="field">
                    <span>Provider Key</span>
                    <input className="field-input" value={providerDraft.providerKey} onChange={(event) => setProviderDraft((current) => ({ ...current, providerKey: event.target.value }))} />
                  </label>
                  <label className="field field--wide">
                    <span>Base URL</span>
                    <input className="field-input" value={providerDraft.baseUrl} onChange={(event) => setProviderDraft((current) => ({ ...current, baseUrl: event.target.value }))} />
                  </label>
                  <label className="field field--wide">
                    <span>API Key</span>
                    <input className="field-input" value={providerDraft.apiKey} onChange={(event) => setProviderDraft((current) => ({ ...current, apiKey: event.target.value }))} />
                  </label>
                  <label className="field field--wide">
                    <span>Provider Logo Preset</span>
                    <select className="field-select" value={providerDraft.logoPresetKey} onChange={(event) => setProviderDraft((current) => ({ ...current, logoPresetKey: event.target.value }))}>
                      <option value="">不设置</option>
                      {modelLogoPresets.map((preset) => (
                        <option key={preset.presetKey} value={preset.presetKey}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="field field--wide">
                    <span>Provider Logo Preview</span>
                    {renderLogoPreview(providerDraft.logoPresetKey, 'Provider Logo')}
                  </div>
                </div>
                <section className="fig-card fig-card--subtle" style={{ marginTop: 16 }}>
                  <div className="fig-card__head">
                    <h3>模型列表</h3>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() =>
                        setProviderDraft((current) => ({
                          ...current,
                          models: [...current.models, { label: '', modelId: '', billingMultiplier: 1, logoPresetKey: '' }],
                        }))
                      }
                    >
                      新增模型
                    </button>
                  </div>
                  <div className="form-grid" style={{ marginBottom: 16 }}>
                    <label className="field field--wide">
                      <span>默认模型</span>
                      <select className="field-select" value={providerDraft.defaultModelRef} onChange={(event) => setProviderDraft((current) => ({ ...current, defaultModelRef: event.target.value }))}>
                        <option value="">请选择默认模型</option>
                        {providerModelOptions.map((item) => (
                          <option key={item.ref} value={item.ref}>
                            {item.label} · {item.ref}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="fig-detail-stack">
                    {providerDraft.models.map((item, index) => renderProviderModelRow(item, index))}
                  </div>
                </section>
                <div className="fig-release-card__actions">
                  <button className="solid-button" type="button" disabled={savingModelProviderProfile} onClick={handleSaveModelProviderProfile}>
                    {savingModelProviderProfile ? '保存中…' : '保存 Provider'}
                  </button>
                  {selectedProviderScopeType === 'app' ? (
                    <button className="ghost-button" type="button" disabled={savingModelProviderProfile} onClick={handleRestorePlatformProvider}>
                      恢复跟随平台
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="fig-card fig-card--subtle">
                <div className="fig-card__head">
                  <h3>当前生效模型列表</h3>
                  <span>运行时最终消费的是当前 tab 生效 Provider 下的模型列表。</span>
                </div>
                <div className="fig-list">
                  {effectiveProviderProfile?.models?.length ? (
                    effectiveProviderProfile.models.map((item) => (
                      <div key={`${item.modelId}-${item.label}`} className="fig-list-item fig-list-item--spread">
                        <div>
                          <div className="fig-list-item__title">{item.label}</div>
                          <div className="fig-list-item__body">{item.modelId}</div>
                        </div>
                        <div className="fig-list-item__meta">{`x${item.billingMultiplier || 1}${item.logoPresetKey ? ` · ${item.logoPresetKey}` : ''}`}</div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">当前 provider 还没有可用模型。</div>
                  )}
                </div>
              </section>

              {selectedProviderScopeType === 'platform' ? (
                <>
                  <section className="fig-card fig-card--subtle">
                    <div className="fig-card__head">
                      <div>
                        <h3>平台模型目录</h3>
                        <span>平台 tab 下集中维护模型 catalog。</span>
                      </div>
                      <button className="solid-button fig-button" type="button" onClick={() => setSelectedPlatformModelRef('__new__')}>
                        新增模型
                      </button>
                    </div>
                    <AdminFilterStack>
                      <AdminSearchWithObjectRow>
                        <label className="field">
                          <span>搜索模型目录</span>
                          <input className="field-input" placeholder="搜索 ref / label / provider / modelId..." value={capabilityQuery} onChange={(event) => setCapabilityQuery(event.target.value)} style={adminFilterControlStyle()} />
                        </label>
                        <label className="field">
                          <span>当前目录项</span>
                          <select className="field-select" style={adminFilterControlStyle()} value={selectedPlatformModelRef || filteredPlatformModels[0]?.ref || '__new__'} onChange={(event) => setSelectedPlatformModelRef(event.target.value)}>
                            {filteredPlatformModels.map((item) => (
                              <option key={item.ref} value={item.ref}>
                                {item.label} · {item.providerId}
                              </option>
                            ))}
                            <option value="__new__">新建模型</option>
                          </select>
                        </label>
                      </AdminSearchWithObjectRow>
                    </AdminFilterStack>
                  </section>
                  <section className="fig-card">
                    <div className="fig-card__head">
                      <div>
                        <h2>{platformModelDraft.label || '新建模型'}</h2>
                        <span>{`${platformModelDraft.ref || 'new-model'} · ${platformModelDraft.providerId}`}</span>
                      </div>
                      <div className="metric-chips">
                        <span>{platformModelDraft.active ? '已启用' : '已禁用'}</span>
                        {selectedPlatformModel ? <span>{`${selectedPlatformModel.connectedBrands.length} 个品牌使用`}</span> : null}
                      </div>
                    </div>
                    <div className="fig-meta-cards">
                      <div className="fig-meta-card"><span>Provider</span><strong>{platformModelDraft.providerId || '未设置'}</strong></div>
                      <div className="fig-meta-card"><span>Model ID</span><strong>{platformModelDraft.modelId || '未设置'}</strong></div>
                    </div>
                    <div className="form-grid form-grid--two" style={{ marginTop: 16 }}>
                      <label className="field"><span>Ref</span><input className="field-input" readOnly={selectedPlatformModelRef !== '__new__'} value={platformModelDraft.ref} onChange={(event) => setPlatformModelDraft((current) => ({ ...current, ref: event.target.value }))} /></label>
                      <label className="field"><span>Label</span><input className="field-input" value={platformModelDraft.label} onChange={(event) => setPlatformModelDraft((current) => ({ ...current, label: event.target.value }))} /></label>
                      <label className="field"><span>Provider ID</span><input className="field-input" value={platformModelDraft.providerId} onChange={(event) => setPlatformModelDraft((current) => ({ ...current, providerId: event.target.value }))} /></label>
                      <label className="field"><span>Model ID</span><input className="field-input" value={platformModelDraft.modelId} onChange={(event) => setPlatformModelDraft((current) => ({ ...current, modelId: event.target.value }))} /></label>
                      <label className="field"><span>API</span><input className="field-input" value={platformModelDraft.api} onChange={(event) => setPlatformModelDraft((current) => ({ ...current, api: event.target.value }))} /></label>
                      <label className="field"><span>Base URL</span><input className="field-input" value={platformModelDraft.baseUrl} onChange={(event) => setPlatformModelDraft((current) => ({ ...current, baseUrl: event.target.value }))} /></label>
                      <label className="field"><span>Context Window</span><input className="field-input" type="number" min="0" value={platformModelDraft.contextWindow} onChange={(event) => setPlatformModelDraft((current) => ({ ...current, contextWindow: Number(event.target.value || 0) }))} /></label>
                      <label className="field"><span>Max Tokens</span><input className="field-input" type="number" min="0" value={platformModelDraft.maxTokens} onChange={(event) => setPlatformModelDraft((current) => ({ ...current, maxTokens: Number(event.target.value || 0) }))} /></label>
                      <label className="field field--wide"><span>Input Modalities</span><textarea className="field-textarea" rows={3} value={platformModelDraft.inputText} onChange={(event) => setPlatformModelDraft((current) => ({ ...current, inputText: event.target.value }))} /></label>
                      <div className="fig-toolbar">
                        <label className="field"><span>Use Runtime OpenAI</span><input type="checkbox" checked={platformModelDraft.useRuntimeOpenai} onChange={(event) => setPlatformModelDraft((current) => ({ ...current, useRuntimeOpenai: event.target.checked }))} /></label>
                        <label className="field"><span>Auth Header</span><input type="checkbox" checked={platformModelDraft.authHeader} onChange={(event) => setPlatformModelDraft((current) => ({ ...current, authHeader: event.target.checked }))} /></label>
                        <label className="field"><span>Reasoning</span><input type="checkbox" checked={platformModelDraft.reasoning} onChange={(event) => setPlatformModelDraft((current) => ({ ...current, reasoning: event.target.checked }))} /></label>
                        <label className="field"><span>Active</span><input type="checkbox" checked={platformModelDraft.active} onChange={(event) => setPlatformModelDraft((current) => ({ ...current, active: event.target.checked }))} /></label>
                      </div>
                    </div>
                    <div className="fig-release-card__actions">
                      <button className="solid-button" type="button" disabled={savingPlatformModel} onClick={handleSavePlatformModel}>
                        {savingPlatformModel ? '保存中…' : '保存模型'}
                      </button>
                      {selectedPlatformModel ? (
                        <button className="ghost-button" type="button" disabled={savingPlatformModel} onClick={() => handleDeletePlatformModel(selectedPlatformModel.ref)}>
                          删除模型
                        </button>
                      ) : null}
                    </div>
                  </section>
                  {selectedPlatformModel ? (
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head">
                        <h3>品牌访问权限</h3>
                        <span>按品牌查看模型开放范围</span>
                      </div>
                      <div className="chip-grid">
                        {selectedPlatformModel.connectedBrands.length ? selectedPlatformModel.connectedBrands.map((brand) => (
                          <button key={brand.brandId} className="chip chip--interactive" type="button" onClick={() => openBrandDetail(brand.brandId)}>
                            {brand.displayName}
                          </button>
                        )) : <div className="empty-state">当前没有 OEM 绑定此模型。</div>}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <section className="fig-card fig-card--subtle">
              <div className="fig-card__head">
                <h3>{selectedProviderScopeType === 'platform' ? '平台记忆 Embedding' : `${selectedProviderScopeKey} 记忆 Embedding`}</h3>
                <span>{selectedProviderScopeType === 'platform' ? '所有 OEM 默认继承这里' : '这里维护这个 OEM 的独立记忆向量配置'}</span>
              </div>
              <div className="empty-state" style={{ minHeight: 'auto', alignItems: 'flex-start', textAlign: 'left', marginBottom: 16 }}>
                <strong>{memoryStatusTitle}</strong>
                <span>{memoryStatusDescription}</span>
              </div>
              {memoryEmbeddingTestResult ? (
                <div className={`banner ${memoryEmbeddingTestResult.ok ? 'banner--success' : 'banner--error'}`} style={{ marginBottom: 16 }}>
                  {`测试结果: ${memoryEmbeddingTestResult.message || (memoryEmbeddingTestResult.dimensions ? `${memoryEmbeddingTestResult.dimensions} 维向量返回成功` : '预检通过')}`}
                </div>
              ) : null}
              <div className="form-grid form-grid--two">
                <label className="field"><span>Provider Key</span><input className="field-input" value={memoryDraft.providerKey} onChange={(event) => setMemoryDraft((current) => ({ ...current, providerKey: event.target.value }))} /></label>
                <label className="field field--wide"><span>Base URL</span><input className="field-input" value={memoryDraft.baseUrl} onChange={(event) => setMemoryDraft((current) => ({ ...current, baseUrl: event.target.value }))} /></label>
                <label className="field field--wide"><span>API Key</span><input className="field-input" value={memoryDraft.apiKey} onChange={(event) => setMemoryDraft((current) => ({ ...current, apiKey: event.target.value }))} /></label>
                <label className="field"><span>Embedding Model</span><input className="field-input" value={memoryDraft.embeddingModel} onChange={(event) => setMemoryDraft((current) => ({ ...current, embeddingModel: event.target.value }))} /></label>
                <label className="field field--wide">
                  <span>Logo Preset</span>
                  <select className="field-select" value={memoryDraft.logoPresetKey} onChange={(event) => setMemoryDraft((current) => ({ ...current, logoPresetKey: event.target.value }))}>
                    <option value="">不设置</option>
                    {modelLogoPresets.map((preset) => (
                      <option key={preset.presetKey} value={preset.presetKey}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field field--wide">
                  <span>Logo Preview</span>
                  {renderLogoPreview(memoryDraft.logoPresetKey, 'Embedding Logo')}
                </div>
                <label className="field"><span>Auto Recall</span><input type="checkbox" checked={memoryDraft.autoRecall} onChange={(event) => setMemoryDraft((current) => ({ ...current, autoRecall: event.target.checked }))} /></label>
              </div>
              <div className="fig-release-card__actions">
                <button className="solid-button" type="button" disabled={savingMemoryEmbeddingProfile} onClick={handleSaveMemoryEmbedding}>
                  {savingMemoryEmbeddingProfile ? '保存中…' : '保存记忆 Embedding'}
                </button>
                <button className="ghost-button" type="button" disabled={savingMemoryEmbeddingProfile} onClick={handleTestMemoryEmbedding}>
                  测试连接
                </button>
                {selectedProviderScopeType === 'app' && memoryDraft.profileId ? (
                  <button className="ghost-button" type="button" disabled={savingMemoryEmbeddingProfile} onClick={handleRestorePlatformMemory}>
                    恢复跟随平台
                  </button>
                ) : null}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
