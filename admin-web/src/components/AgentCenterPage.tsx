import { useEffect, useMemo, useState } from 'react';
import type { OverviewData } from '../lib/adminTypes';
import {
  adminFilterControlStyle,
  AdminFilterStack,
  AdminSearchWithObjectRow,
  AdminSelectorRow,
} from './AdminFilterLayout';

type AgentItem = OverviewData['agentCatalog'][number];

type AgentDraft = {
  slug: string;
  name: string;
  description: string;
  category: string;
  publisher: string;
  featured: boolean;
  official: boolean;
  active: boolean;
  sortOrder: number;
  tagsText: string;
  capabilitiesText: string;
  useCasesText: string;
  surface: string;
  sourceRepo: string;
  primarySkillSlug: string;
  avatarUrl: string;
  metadataJson: string;
};

function getAgentSurface(agent: AgentItem | null) {
  return String(agent?.metadata.surface || '').trim() || 'general';
}

function getAgentSourceRepo(agent: AgentItem | null) {
  return String(agent?.metadata.source_repo || '').trim() || 'manual';
}

function getAgentSourceLabel(sourceRepo: string) {
  if (!sourceRepo || sourceRepo === 'manual') return '手动维护';
  if (sourceRepo === 'msitarzewski/agency-agents') return 'Agency Agents';
  return sourceRepo;
}

function buildDraft(agent: AgentItem | null): AgentDraft {
  const metadata = agent?.metadata || {};
  const metadataCopy = JSON.parse(JSON.stringify(metadata));
  delete metadataCopy.surface;
  delete metadataCopy.source_repo;
  delete metadataCopy.primary_skill_slug;
  delete metadataCopy.avatar_url;
  return {
    slug: agent?.slug || '',
    name: agent?.name || '',
    description: agent?.description || '',
    category: agent?.category || 'general',
    publisher: agent?.publisher || 'iClaw',
    featured: agent?.featured === true,
    official: agent?.official !== false,
    active: agent?.active !== false,
    sortOrder: agent?.sortOrder || 9999,
    tagsText: (agent?.tags || []).join('\n'),
    capabilitiesText: (agent?.capabilities || []).join('\n'),
    useCasesText: (agent?.useCases || []).join('\n'),
    surface: String(metadata.surface || '').trim() || 'general',
    sourceRepo: String(metadata.source_repo || '').trim() || 'manual',
    primarySkillSlug: String(metadata.primary_skill_slug || '').trim(),
    avatarUrl: String(metadata.avatar_url || '').trim(),
    metadataJson: JSON.stringify(metadataCopy, null, 2),
  };
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AgentCenterPage({
  items,
  saving,
  onSave,
  onDelete,
}: {
  items: AgentItem[];
  saving: boolean;
  onSave: (input: Omit<AgentDraft, 'tagsText' | 'capabilitiesText' | 'useCasesText' | 'metadataJson'> & {
    tags: string[];
    capabilities: string[];
    useCases: string[];
    metadata: Record<string, unknown>;
  }) => Promise<void> | void;
  onDelete: (slug: string) => Promise<void> | void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [surface, setSurface] = useState('all');
  const [sourceRepo, setSourceRepo] = useState('all');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [draft, setDraft] = useState<AgentDraft>(() => buildDraft(null));
  const [formError, setFormError] = useState('');

  const surfaces = useMemo(
    () => Array.from(new Set(items.map((item) => getAgentSurface(item)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [items],
  );
  const sourceRepos = useMemo(
    () => Array.from(new Set(items.map((item) => getAgentSourceRepo(item)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...items]
      .filter((item) => {
        if (status === 'active' && item.active === false) return false;
        if (status === 'disabled' && item.active !== false) return false;
        if (surface !== 'all' && getAgentSurface(item) !== surface) return false;
        if (sourceRepo !== 'all' && getAgentSourceRepo(item) !== sourceRepo) return false;
        if (!normalizedQuery) return true;
        return [
          item.slug,
          item.name,
          item.description,
          item.category,
          item.publisher,
          getAgentSurface(item),
          getAgentSourceRepo(item),
          ...item.tags,
        ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'zh-CN'));
  }, [items, query, sourceRepo, status, surface]);

  const selectedItem = selectedSlug === '__new__' ? null : items.find((item) => item.slug === selectedSlug) || filteredItems[0] || items[0] || null;

  useEffect(() => {
    if (selectedSlug === '__new__') return;
    if (selectedItem) {
      setSelectedSlug(selectedItem.slug);
      setDraft(buildDraft(selectedItem));
      return;
    }
    setSelectedSlug('__new__');
    setDraft(buildDraft(null));
  }, [selectedItem, selectedSlug]);

  const resetForNew = () => {
    setSelectedSlug('__new__');
    setFormError('');
    setDraft(buildDraft(null));
  };

  const handleSelect = (item: AgentItem) => {
    setSelectedSlug(item.slug);
    setFormError('');
    setDraft(buildDraft(item));
  };

  const handleSubmit = () => {
    setFormError('');
    let metadata: Record<string, unknown> = {};
    try {
      metadata = draft.metadataJson.trim() ? JSON.parse(draft.metadataJson) : {};
    } catch {
      setFormError('Metadata JSON 解析失败');
      return;
    }
    metadata.surface = draft.surface.trim() || 'general';
    metadata.source_repo = draft.sourceRepo.trim() || 'manual';
    if (draft.primarySkillSlug.trim()) {
      metadata.primary_skill_slug = draft.primarySkillSlug.trim();
    } else {
      delete metadata.primary_skill_slug;
    }
    if (draft.avatarUrl.trim()) {
      metadata.avatar_url = draft.avatarUrl.trim();
    } else {
      delete metadata.avatar_url;
    }
    void onSave({
      slug: draft.slug,
      name: draft.name,
      description: draft.description,
      category: draft.category,
      publisher: draft.publisher,
      featured: draft.featured,
      official: draft.official,
      active: draft.active,
      sortOrder: draft.sortOrder,
      tags: splitLines(draft.tagsText),
      capabilities: splitLines(draft.capabilitiesText),
      useCases: splitLines(draft.useCasesText),
      surface: draft.surface,
      sourceRepo: draft.sourceRepo,
      primarySkillSlug: draft.primarySkillSlug,
      avatarUrl: draft.avatarUrl,
      metadata,
    });
  };

  return (
    <div className="fig-page">
      <div className="fig-page__header">
        <div className="fig-page__header-inner">
          <div>
            <h1>Agent中心</h1>
            <p className="fig-page__description">统一维护前台可投放 agent catalog 主数据。</p>
          </div>
          <button className="solid-button fig-button" type="button" onClick={resetForNew}>
            新建 Agent
          </button>
        </div>
      </div>
      <div className="fig-page__body">
        <section className="fig-guide">
          <div className="fig-guide__head">
            <span className="fig-guide__eyebrow">操作指南</span>
            <h3>Agent 中心怎么用</h3>
          </div>
          <div className="fig-guide__grid">
            {[
              '这里维护 agent catalog 主数据，前台直接读取这里。',
              'metadata 内保存 surface、source_repo、primary_skill_slug、avatar_url 等扩展字段。',
              '保存后会直接写数据库；维护动作都留在当前控制台。',
            ].map((item, index) => (
              <article key={item} className="fig-guide__item">
                <span className="fig-guide__index">{index + 1}</span>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </section>
        <div className="fig-detail-stack">
          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>筛选与当前对象</h3>
              <span>筛选后直接在当前页编辑 Agent。</span>
            </div>
            <AdminFilterStack>
              <AdminSearchWithObjectRow>
                <label className="field">
                  <span>搜索 Agent</span>
                  <input className="field-input" placeholder="搜索 agent..." value={query} onChange={(event) => setQuery(event.target.value)} style={adminFilterControlStyle()} />
                </label>
                <label className="field">
                  <span>当前对象</span>
                  <select className="field-select" style={adminFilterControlStyle()} value={selectedSlug || filteredItems[0]?.slug || '__new__'} onChange={(event) => {
                    if (event.target.value === '__new__') {
                      resetForNew();
                      return;
                    }
                    const target = filteredItems.find((item) => item.slug === event.target.value);
                    if (target) handleSelect(target);
                  }}>
                    {filteredItems.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {item.name} · {getAgentSurface(item)}
                      </option>
                    ))}
                    <option value="__new__">新建 Agent</option>
                  </select>
                </label>
              </AdminSearchWithObjectRow>
              <AdminSelectorRow>
                <label className="field">
                  <span>状态</span>
                  <select className="field-select" style={adminFilterControlStyle()} value={status} onChange={(event) => setStatus(event.target.value as 'all' | 'active' | 'disabled')}>
                    <option value="all">全部状态</option>
                    <option value="active">仅启用</option>
                    <option value="disabled">仅禁用</option>
                  </select>
                </label>
                <label className="field">
                  <span>Surface</span>
                  <select className="field-select" style={adminFilterControlStyle()} value={surface} onChange={(event) => setSurface(event.target.value)}>
                    <option value="all">全部 Surface</option>
                    {surfaces.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>来源仓库</span>
                  <select className="field-select" style={adminFilterControlStyle()} value={sourceRepo} onChange={(event) => setSourceRepo(event.target.value)}>
                    <option value="all">全部来源仓库</option>
                    {sourceRepos.map((item) => (
                      <option key={item} value={item}>
                        {getAgentSourceLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
              </AdminSelectorRow>
            </AdminFilterStack>
            <div className="fig-release-card__actions">
              <span>{`${filteredItems.length} 个 Agent`}</span>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setQuery('');
                  setStatus('all');
                  setSurface('all');
                  setSourceRepo('all');
                }}
              >
                重置筛选
              </button>
            </div>
          </section>
          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>统计区域</h3>
              <span>帮助运营快速判断当前 Agent 目录状态</span>
            </div>
            <div className="fig-meta-cards">
              <div className="fig-meta-card"><span>Agent 总数</span><strong>{String(filteredItems.length)}</strong></div>
              <div className="fig-meta-card"><span>已启用</span><strong>{String(filteredItems.filter((item) => item.active !== false).length)}</strong></div>
              <div className="fig-meta-card"><span>当前选中</span><strong>{selectedItem?.name || '新建 Agent'}</strong></div>
              <div className="fig-meta-card"><span>当前 Surface</span><strong>{selectedItem ? getAgentSurface(selectedItem) : draft.surface || 'general'}</strong></div>
            </div>
          </section>
          <div className="fig-workspace fig-workspace--drawer">
            <section className="fig-workspace__list">
              <div className="fig-card fig-card--subtle">
                <div className="fig-card__head">
                  <h3>Agent 列表</h3>
                  <span>列表卡片用于选择当前 Agent</span>
                </div>
                <div className="fig-capability-list">
                  {filteredItems.length ? (
                    filteredItems.map((item) => (
                      <button key={item.slug} className={`capability-card${selectedItem?.slug === item.slug ? ' is-active' : ''}`} type="button" onClick={() => handleSelect(item)}>
                        <strong>{item.name}</strong>
                        <span>{`${getAgentSurface(item)} • ${item.active !== false ? 'active' : 'disabled'} • ${getAgentSourceLabel(getAgentSourceRepo(item))}`}</span>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state">没有匹配的 Agent。</div>
                  )}
                  <button className={`capability-card${selectedSlug === '__new__' ? ' is-active' : ''}`} type="button" onClick={resetForNew}>
                    <strong>新建 Agent</strong>
                    <span>新增一个可投放到前台的 agent</span>
                  </button>
                </div>
              </div>
            </section>
            <aside className="fig-workspace__drawer">
              {selectedItem ? (
                <div className="fig-card">
                  <div className="fig-card__head">
                    <div>
                      <h2>{selectedItem.name}</h2>
                      <span>{`${selectedItem.slug} · ${selectedItem.publisher || 'iClaw'}`}</span>
                    </div>
                    <div className="metric-chips">
                      <span>{selectedItem.active !== false ? '已启用' : '已禁用'}</span>
                      <span>{getAgentSurface(selectedItem)}</span>
                    </div>
                  </div>
                  <p className="detail-copy">{selectedItem.description || '暂无描述。'}</p>
                  <div className="fig-meta-cards">
                    <div className="fig-meta-card"><span>来源仓库</span><strong>{getAgentSourceLabel(getAgentSourceRepo(selectedItem))}</strong></div>
                    <div className="fig-meta-card"><span>Primary Skill</span><strong>{String(selectedItem.metadata.primary_skill_slug || '未设置')}</strong></div>
                    <div className="fig-meta-card"><span>Sort Order</span><strong>{selectedItem.sortOrder}</strong></div>
                  </div>
                  <div className="chip-grid">
                    {selectedItem.tags.length ? selectedItem.tags.map((tag) => <span key={tag} className="chip">{tag}</span>) : <div className="empty-state">暂无标签。</div>}
                  </div>
                  <div className="action-row">
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void onSave({
                          slug: selectedItem.slug,
                          name: selectedItem.name,
                          description: selectedItem.description,
                          category: selectedItem.category,
                          publisher: selectedItem.publisher,
                          featured: selectedItem.featured,
                          official: selectedItem.official,
                          surface: getAgentSurface(selectedItem),
                          sourceRepo: getAgentSourceRepo(selectedItem),
                          primarySkillSlug: String(selectedItem.metadata.primary_skill_slug || ''),
                          avatarUrl: String(selectedItem.metadata.avatar_url || ''),
                          metadata: selectedItem.metadata,
                          sortOrder: selectedItem.sortOrder,
                          active: selectedItem.active === false,
                          tags: selectedItem.tags,
                          capabilities: selectedItem.capabilities,
                          useCases: selectedItem.useCases,
                        })
                      }
                    >
                      {selectedItem.active !== false ? '停用' : '启用'}
                    </button>
                    <button className="ghost-button" type="button" disabled={saving} onClick={() => void onDelete(selectedItem.slug)}>
                      删除 Agent
                    </button>
                  </div>
                </div>
              ) : null}
              <section className="fig-card fig-card--subtle">
                <div className="fig-card__head">
                  <h3>{selectedSlug === '__new__' ? '新增 Agent Catalog' : '编辑 Agent Catalog'}</h3>
                  <span>直接维护数据库中的 agent catalog 主数据。</span>
                </div>
                <div className="form-grid form-grid--two">
                  <label className="field">
                    <span>Slug</span>
                    <input className="field-input" value={draft.slug} readOnly={selectedSlug !== '__new__'} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Name</span>
                    <input className="field-input" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label className="field field--wide">
                    <span>Description</span>
                    <textarea className="field-textarea" rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Category</span>
                    <select className="field-select" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>
                      {['finance', 'content', 'productivity', 'commerce', 'general'].map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Publisher</span>
                    <input className="field-input" value={draft.publisher} onChange={(event) => setDraft((current) => ({ ...current, publisher: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Surface</span>
                    <input className="field-input" value={draft.surface} onChange={(event) => setDraft((current) => ({ ...current, surface: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Source Repo</span>
                    <input className="field-input" value={draft.sourceRepo} onChange={(event) => setDraft((current) => ({ ...current, sourceRepo: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Primary Skill</span>
                    <input className="field-input" value={draft.primarySkillSlug} onChange={(event) => setDraft((current) => ({ ...current, primarySkillSlug: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Avatar URL</span>
                    <input className="field-input" value={draft.avatarUrl} onChange={(event) => setDraft((current) => ({ ...current, avatarUrl: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Sort Order</span>
                    <input className="field-input" type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value || 0) }))} />
                  </label>
                  <div className="field">
                    <span>Flags</span>
                    <div className="fig-toolbar">
                      <label className="toggle fig-toggle"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} /><span>active</span></label>
                      <label className="toggle fig-toggle"><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft((current) => ({ ...current, featured: event.target.checked }))} /><span>featured</span></label>
                      <label className="toggle fig-toggle"><input type="checkbox" checked={draft.official} onChange={(event) => setDraft((current) => ({ ...current, official: event.target.checked }))} /><span>official</span></label>
                    </div>
                  </div>
                  <label className="field field--wide">
                    <span>Tags</span>
                    <textarea className="field-textarea" rows={4} value={draft.tagsText} onChange={(event) => setDraft((current) => ({ ...current, tagsText: event.target.value }))} />
                  </label>
                  <label className="field field--wide">
                    <span>Capabilities</span>
                    <textarea className="field-textarea" rows={4} value={draft.capabilitiesText} onChange={(event) => setDraft((current) => ({ ...current, capabilitiesText: event.target.value }))} />
                  </label>
                  <label className="field field--wide">
                    <span>Use Cases</span>
                    <textarea className="field-textarea" rows={4} value={draft.useCasesText} onChange={(event) => setDraft((current) => ({ ...current, useCasesText: event.target.value }))} />
                  </label>
                  <label className="field field--wide">
                    <span>Metadata JSON</span>
                    <textarea className="code-input code-input--tall" value={draft.metadataJson} onChange={(event) => setDraft((current) => ({ ...current, metadataJson: event.target.value }))} />
                  </label>
                </div>
                {formError ? <div className="banner banner--error">{formError}</div> : null}
                <div className="fig-release-card__actions">
                  <button className="solid-button" type="button" disabled={saving} onClick={handleSubmit}>
                    {saving ? '保存中…' : '保存 Agent'}
                  </button>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
