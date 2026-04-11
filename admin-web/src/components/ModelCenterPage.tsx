import type { Dispatch, SetStateAction } from 'react';
import type { OverviewData } from '../lib/adminTypes';

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
  modelsText: string;
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
  handleRestorePlatformMemory,
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
  handleRestorePlatformMemory: () => Promise<void> | void;
}) {
  return (
    <div className="fig-page">
      <div className="fig-page__header">
        <div className="fig-page__header-inner">
          <div>
            <h1>模型中心</h1>
            <p className="fig-page__description">管理模型目录、OEM allowlist、推荐和默认模型。</p>
          </div>
          <div className="action-row">
            <button className="solid-button fig-button" type="button" onClick={() => setSelectedPlatformModelRef('__new__')}>
              新增模型
            </button>
          </div>
        </div>
      </div>
      <div className="fig-capability-screen">
        <aside className="fig-capability-sidebar">
          <div className="fig-capability-sidebar__toolbar">
            <label className="fig-search">
              <input className="field-input fig-search__input" placeholder="搜索模型..." value={capabilityQuery} onChange={(event) => setCapabilityQuery(event.target.value)} />
            </label>
          </div>
          <div className="fig-capability-list">
            {filteredPlatformModels.length ? (
              filteredPlatformModels.map((item) => (
                <button key={item.ref} className={`capability-card${selectedPlatformModel?.ref === item.ref ? ' is-active' : ''}`} type="button" onClick={() => setSelectedPlatformModelRef(item.ref)}>
                  <strong>{item.label}</strong>
                  <span>{`${item.providerId || 'provider'} • ${item.connectedBrands.length} 个品牌使用`}</span>
                </button>
              ))
            ) : (
              <div className="empty-state">没有匹配的模型。</div>
            )}
            <button className={`capability-card${selectedPlatformModelRef === '__new__' ? ' is-active' : ''}`} type="button" onClick={() => setSelectedPlatformModelRef('__new__')}>
              <strong>新建模型</strong>
              <span>新增一个模型目录项</span>
            </button>
          </div>
        </aside>
        <section className="fig-capability-detail">
          {selectedPlatformModel || selectedPlatformModelRef === '__new__' ? (
            <div className="fig-detail-stack">
              <div className="fig-card">
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
              </div>
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
              <section className="fig-card fig-card--subtle">
                <div className="fig-card__head">
                  <h3>Provider Scope</h3>
                  <span>平台 / OEM</span>
                </div>
                <div className="segmented" style={{ flexWrap: 'wrap' }}>
                  <button className={`tab-pill${selectedModelProviderTab === 'platform' ? ' is-active' : ''}`} type="button" onClick={() => setSelectedModelProviderTab('platform')}>平台</button>
                  {brands.map((brand) => (
                    <button key={brand.brandId} className={`tab-pill${selectedModelProviderTab === brand.brandId ? ' is-active' : ''}`} type="button" onClick={() => setSelectedModelProviderTab(brand.brandId)}>
                      {brand.displayName}
                    </button>
                  ))}
                </div>
                <div className="segmented" style={{ marginTop: 12 }}>
                  <button className={`tab-pill${selectedModelCenterSection === 'chat-provider' ? ' is-active' : ''}`} type="button" onClick={() => setSelectedModelCenterSection('chat-provider')}>聊天 Provider</button>
                  <button className={`tab-pill${selectedModelCenterSection === 'memory-embedding' ? ' is-active' : ''}`} type="button" onClick={() => setSelectedModelCenterSection('memory-embedding')}>记忆 Embedding</button>
                </div>
              </section>
              {selectedModelCenterSection === 'chat-provider' ? (
                <section className="fig-card fig-card--subtle">
                  <div className="fig-card__head">
                    <h3>{selectedProviderScopeType === 'platform' ? '平台 Fallback Provider' : `${selectedProviderScopeKey} Provider`}</h3>
                    <span>{selectedProviderScopeType === 'platform' ? '所有 OEM 默认继承这里' : '这里维护这个 OEM 的独立 provider 配置'}</span>
                  </div>
                  <div className="form-grid form-grid--two">
                    {selectedProviderScopeType === 'app' ? (
                      <label className="field"><span>Provider Mode</span><select className="field-select" value={providerDraft.providerMode} onChange={(event) => setProviderDraft((current) => ({ ...current, providerMode: event.target.value }))}><option value="inherit_platform">inherit_platform</option><option value="use_app_profile">use_app_profile</option></select></label>
                    ) : null}
                    <label className="field"><span>Provider Key</span><input className="field-input" value={providerDraft.providerKey} onChange={(event) => setProviderDraft((current) => ({ ...current, providerKey: event.target.value }))} /></label>
                    <label className="field field--wide"><span>Base URL</span><input className="field-input" value={providerDraft.baseUrl} onChange={(event) => setProviderDraft((current) => ({ ...current, baseUrl: event.target.value }))} /></label>
                    <label className="field field--wide"><span>API Key</span><input className="field-input" value={providerDraft.apiKey} onChange={(event) => setProviderDraft((current) => ({ ...current, apiKey: event.target.value }))} /></label>
                    <label className="field"><span>Logo Preset Key</span><input className="field-input" value={providerDraft.logoPresetKey} onChange={(event) => setProviderDraft((current) => ({ ...current, logoPresetKey: event.target.value }))} /></label>
                    <label className="field"><span>默认模型 Ref</span><input className="field-input" value={providerDraft.defaultModelRef} onChange={(event) => setProviderDraft((current) => ({ ...current, defaultModelRef: event.target.value }))} /></label>
                    <label className="field field--wide"><span>Models</span><textarea className="field-textarea" rows={6} value={providerDraft.modelsText} onChange={(event) => setProviderDraft((current) => ({ ...current, modelsText: event.target.value }))} placeholder="label|modelId|billingMultiplier|logoPresetKey" /></label>
                  </div>
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
              ) : (
                <section className="fig-card fig-card--subtle">
                  <div className="fig-card__head">
                    <h3>{selectedProviderScopeType === 'platform' ? '平台记忆 Embedding Fallback' : `${selectedProviderScopeKey} 记忆 Embedding`}</h3>
                    <span>{selectedProviderScopeType === 'platform' ? '所有 OEM 默认继承这里' : '这里维护这个 OEM 的独立记忆向量配置'}</span>
                  </div>
                  <div className="form-grid form-grid--two">
                    <label className="field"><span>Provider Key</span><input className="field-input" value={memoryDraft.providerKey} onChange={(event) => setMemoryDraft((current) => ({ ...current, providerKey: event.target.value }))} /></label>
                    <label className="field field--wide"><span>Base URL</span><input className="field-input" value={memoryDraft.baseUrl} onChange={(event) => setMemoryDraft((current) => ({ ...current, baseUrl: event.target.value }))} /></label>
                    <label className="field field--wide"><span>API Key</span><input className="field-input" value={memoryDraft.apiKey} onChange={(event) => setMemoryDraft((current) => ({ ...current, apiKey: event.target.value }))} /></label>
                    <label className="field"><span>Embedding Model</span><input className="field-input" value={memoryDraft.embeddingModel} onChange={(event) => setMemoryDraft((current) => ({ ...current, embeddingModel: event.target.value }))} /></label>
                    <label className="field"><span>Logo Preset Key</span><input className="field-input" value={memoryDraft.logoPresetKey} onChange={(event) => setMemoryDraft((current) => ({ ...current, logoPresetKey: event.target.value }))} /></label>
                    <label className="field"><span>Auto Recall</span><input type="checkbox" checked={memoryDraft.autoRecall} onChange={(event) => setMemoryDraft((current) => ({ ...current, autoRecall: event.target.checked }))} /></label>
                  </div>
                  <div className="fig-release-card__actions">
                    <button className="solid-button" type="button" disabled={savingMemoryEmbeddingProfile} onClick={handleSaveMemoryEmbedding}>
                      {savingMemoryEmbeddingProfile ? '保存中…' : '保存记忆 Embedding'}
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
          ) : (
            <div className="fig-card fig-card--detail-empty"><div className="empty-state">选择一个模型查看详情。</div></div>
          )}
        </section>
      </div>
    </div>
  );
}
