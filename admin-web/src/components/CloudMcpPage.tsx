import { useEffect, useState } from 'react';

type CloudMcpItem = {
  key: string;
  name: string;
  description: string;
  transport: string;
  objectKey: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
};

export function CloudMcpPage({
  items,
  selectedKey,
  onSelectKey,
  onSave,
  onDelete,
  onTest,
  saving,
  testResult,
}: {
  items: CloudMcpItem[];
  selectedKey: string;
  onSelectKey: (key: string) => void;
  onSave: (input: {
    key: string;
    name: string;
    description: string;
    transport: string;
    objectKey: string;
    enabled: boolean;
    command: string;
    argsText: string;
    httpUrl: string;
    envText: string;
  }) => Promise<void> | void;
  onDelete: (key: string) => Promise<void> | void;
  onTest: (input: {
    key: string;
    name: string;
    description: string;
    transport: string;
    objectKey: string;
    enabled: boolean;
    command: string;
    argsText: string;
    httpUrl: string;
    envText: string;
  }) => Promise<void> | void;
  saving: boolean;
  testResult?: { ok?: boolean; message?: string } | null;
}) {
  const selected = items.find((item) => item.key === selectedKey) || null;
  const [draft, setDraft] = useState({
    key: '',
    name: '',
    description: '',
    transport: 'config',
    objectKey: '',
    enabled: true,
    command: '',
    argsText: '',
    httpUrl: '',
    envText: '',
  });

  useEffect(() => {
    setDraft(
      selected
        ? {
            key: selected.key,
            name: selected.name,
            description: selected.description,
            transport: selected.transport || 'config',
            objectKey: selected.objectKey || '',
            enabled: selected.enabled !== false,
            command: '',
            argsText: '',
            httpUrl: '',
            envText: '',
          }
        : {
            key: '',
            name: '',
            description: '',
            transport: 'config',
            objectKey: '',
            enabled: true,
            command: '',
            argsText: '',
            httpUrl: '',
            envText: '',
          },
    );
  }, [selected]);

  return (
    <div className="fig-page">
      <div className="fig-page__header">
        <div className="fig-page__header-inner">
          <div>
            <h1>云MCP</h1>
            <p className="fig-page__description">这里是 MCP 商店总库，也是 MCP 的唯一主数据来源。</p>
          </div>
          <div className="action-row">
            <button className="solid-button fig-button" type="button" onClick={() => onSelectKey('__new__')}>
              新增云MCP
            </button>
          </div>
        </div>
      </div>
      <div className="fig-layout">
        <aside className="fig-sidebar">
          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>云MCP列表</h3>
              <span>{String(items.length)} 个</span>
            </div>
            <div className="fig-capability-list">
              {items.length ? (
                items.map((item) => (
                  <button
                    key={item.key}
                    className={`capability-card${selected?.key === item.key ? ' is-active' : ''}`}
                    type="button"
                    onClick={() => onSelectKey(item.key)}
                  >
                    <strong>{item.name}</strong>
                    <span>{`${item.transport} • ${item.enabled ? '已启用' : '已关闭'}`}</span>
                  </button>
                ))
              ) : (
                <div className="empty-state">还没有云MCP。</div>
              )}
            </div>
          </section>
        </aside>
        <section className="fig-capability-detail">
          <div className="fig-detail-stack">
            <div className="fig-card">
              <div className="fig-card__head">
                <div>
                  <h2>{draft.name || '新建云MCP'}</h2>
                  <span>{draft.key || 'new-cloud-mcp'}</span>
                </div>
                <div className="metric-chips">
                  <span>{draft.enabled ? '目录可用' : '目录关闭'}</span>
                  <span>{draft.transport}</span>
                </div>
              </div>
              <p className="detail-copy">{draft.description || '维护 MCP 名称、描述、连接方式、启动参数、环境变量和扩展元数据。'}</p>
            </div>
            <section className="fig-card fig-card--subtle">
              <div className="fig-card__head">
                <h3>云MCP主数据</h3>
                <span>新增、保存、删除和测试连接都在当前页完成。</span>
              </div>
              <div className="form-grid form-grid--two">
                <label className="field">
                  <span>Key</span>
                  <input className="field-input" value={draft.key} readOnly={Boolean(selected?.key)} onChange={(event) => setDraft((current) => ({ ...current, key: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Name</span>
                  <input className="field-input" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label className="field field--wide">
                  <span>Description</span>
                  <textarea className="field-textarea" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Enabled</span>
                  <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} />
                </label>
                <label className="field">
                  <span>Transport</span>
                  <input className="field-input" value={draft.transport} onChange={(event) => setDraft((current) => ({ ...current, transport: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Command</span>
                  <input className="field-input" value={draft.command} onChange={(event) => setDraft((current) => ({ ...current, command: event.target.value }))} />
                </label>
                <label className="field field--wide">
                  <span>Args</span>
                  <textarea className="field-textarea" rows={4} value={draft.argsText} onChange={(event) => setDraft((current) => ({ ...current, argsText: event.target.value }))} />
                </label>
                <label className="field field--wide">
                  <span>HTTP URL</span>
                  <input className="field-input" value={draft.httpUrl} onChange={(event) => setDraft((current) => ({ ...current, httpUrl: event.target.value }))} />
                </label>
                <label className="field field--wide">
                  <span>Env</span>
                  <textarea className="field-textarea" rows={4} value={draft.envText} onChange={(event) => setDraft((current) => ({ ...current, envText: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Object Key</span>
                  <input className="field-input" value={draft.objectKey} onChange={(event) => setDraft((current) => ({ ...current, objectKey: event.target.value }))} />
                </label>
              </div>
              <div className="action-row">
                <button className="solid-button" type="button" disabled={saving} onClick={() => onSave(draft)}>
                  {saving ? '保存中…' : '保存云MCP'}
                </button>
                {selected?.key ? (
                  <button className="ghost-button" type="button" disabled={saving} onClick={() => onDelete(selected.key)}>
                    删除云MCP
                  </button>
                ) : null}
                <button className="ghost-button" type="button" disabled={saving} onClick={() => onTest(draft)}>
                  测试连接
                </button>
              </div>
              {testResult ? (
                <div className={`banner ${testResult.ok ? 'banner--success' : 'banner--error'}`}>
                  {`测试结果: ${testResult.message || '未返回消息'}`}
                </div>
              ) : null}
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
