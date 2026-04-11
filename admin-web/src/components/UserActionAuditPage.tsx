import { useMemo, useState } from 'react';
import { formatDateTime } from '../lib/adminFormat';
import type { UserActionAuditRecord, UserActionDiagnosticUploadRecord } from '../lib/adminTypes';

const RISK_LABEL: Record<UserActionAuditRecord['riskLevel'], string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

const DECISION_LABEL: Record<UserActionAuditRecord['decision'], string> = {
  allow: '已批准',
  deny: '已拒绝',
  pending: '待处理',
};

const RISK_STYLE: Record<UserActionAuditRecord['riskLevel'], { bg: string; border: string; text: string }> = {
  low: { bg: '#042f2e', border: '#0f766e', text: '#34d399' },
  medium: { bg: '#3f2305', border: '#b45309', text: '#f59e0b' },
  high: { bg: '#431407', border: '#c2410c', text: '#fb923c' },
  critical: { bg: '#450a0a', border: '#dc2626', text: '#f87171' },
};

const DECISION_STYLE: Record<UserActionAuditRecord['decision'], { bg: string; border: string; text: string }> = {
  allow: { bg: '#052e16', border: '#15803d', text: '#22c55e' },
  deny: { bg: '#450a0a', border: '#dc2626', text: '#f87171' },
  pending: { bg: '#172554', border: '#2563eb', text: '#60a5fa' },
};

const STAGE_LABEL: Record<UserActionAuditRecord['stage'], string> = {
  intent_created: '意图创建',
  policy_evaluated: '策略评估',
  approval_requested: '请求审批',
  approval_granted: '审批通过',
  approval_denied: '审批拒绝',
  plan_mismatch_denied: '计划不匹配拒绝',
  execution_started: '执行开始',
  execution_finished: '执行完成',
};

function sourceLabel(item: UserActionAuditRecord) {
  return item.skillSlug || item.workflowId || item.agentId || item.capability;
}

function linkedUpload(item: UserActionAuditRecord, uploads: UserActionDiagnosticUploadRecord[]) {
  return uploads.find((upload) => upload.linkedIntentId && upload.linkedIntentId === item.intentId) || null;
}

function badge(label: string, style: { bg: string; border: string; text: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 26,
        padding: '0 10px',
        borderRadius: 999,
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.text,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function infoRow(label: string, value: string) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#7f8ca8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 14, color: '#e5ecf6', lineHeight: 1.5, wordBreak: 'break-word' }}>{value || '未记录'}</span>
    </div>
  );
}

export function UserActionAuditPage({
  items,
  uploads,
  loading,
  onRefresh,
}: {
  items: UserActionAuditRecord[];
  uploads: UserActionDiagnosticUploadRecord[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState<'all' | UserActionAuditRecord['riskLevel']>('all');
  const [decision, setDecision] = useState<'all' | UserActionAuditRecord['decision']>('all');
  const [elevated, setElevated] = useState<'all' | 'yes' | 'no'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const filtered = useMemo(() => {
    const now = Date.now();
    return items.filter((item) => {
      const query = search.trim().toLowerCase();
      if (query) {
        const searchable = [
          item.userId,
          item.deviceId,
          item.appName,
          item.capability,
          item.summary,
          item.skillSlug,
          item.workflowId,
          item.agentId,
          item.reason,
        ].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      if (riskLevel !== 'all' && item.riskLevel !== riskLevel) return false;
      if (decision !== 'all' && item.decision !== decision) return false;
      if (elevated !== 'all' && item.requiresElevation !== (elevated === 'yes')) return false;
      if (dateRange !== 'all') {
        const timestamp = Date.parse(item.createdAt);
        if (Number.isFinite(timestamp)) {
          const diff = now - timestamp;
          if (dateRange === 'today' && diff > 24 * 60 * 60 * 1000) return false;
          if (dateRange === 'week' && diff > 7 * 24 * 60 * 60 * 1000) return false;
          if (dateRange === 'month' && diff > 30 * 24 * 60 * 60 * 1000) return false;
        }
      }
      return true;
    });
  }, [dateRange, decision, elevated, items, riskLevel, search]);

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || null;
  const upload = selected ? linkedUpload(selected, uploads) : null;

  return (
    <div
      style={{
        minHeight: '100%',
        background: '#020817',
        color: '#e2e8f0',
      }}
    >
      <div
        style={{
          padding: '28px 28px 24px',
          borderBottom: '1px solid rgba(30,41,59,0.9)',
          background: '#0f172a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>动作审计</h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: '#94a3b8' }}>实时监控桌面端 AI 发起的本地动作执行记录</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="ghost-button"
              type="button"
              disabled={loading}
              onClick={onRefresh}
              style={{
                minHeight: 40,
                padding: '0 14px',
                borderRadius: 12,
                border: '1px solid #334155',
                background: '#1e293b',
                color: '#e2e8f0',
              }}
            >
              {loading ? '刷新中…' : '刷新'}
            </button>
            <button
              className="ghost-button"
              type="button"
              style={{
                minHeight: 40,
                padding: '0 14px',
                borderRadius: 12,
                border: '1px solid #334155',
                background: '#1e293b',
                color: '#e2e8f0',
              }}
            >
              导出
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 170px 110px', gap: 14 }}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索用户、设备、应用或 Capability..."
              style={{
                width: '100%',
                height: 40,
                borderRadius: 12,
                border: '1px solid #334155',
                background: '#1e293b',
                color: '#e2e8f0',
                padding: '0 14px',
              }}
            />
            <select
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value as typeof dateRange)}
              style={{ height: 40, borderRadius: 12, border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', padding: '0 14px' }}
            >
              <option value="all">全部时间</option>
              <option value="today">今天</option>
              <option value="week">最近 7 天</option>
              <option value="month">最近 30 天</option>
            </select>
            <button
              className="ghost-button"
              type="button"
              style={{
                height: 40,
                borderRadius: 12,
                border: '1px solid #334155',
                background: '#1e293b',
                color: '#e2e8f0',
              }}
            >
              筛选
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 160px)', gap: 12 }}>
            <select
              value={riskLevel}
              onChange={(event) => setRiskLevel(event.target.value as typeof riskLevel)}
              style={{ height: 40, borderRadius: 12, border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', padding: '0 14px' }}
            >
              <option value="all">全部风险</option>
              <option value="low">低风险</option>
              <option value="medium">中风险</option>
              <option value="high">高风险</option>
              <option value="critical">严重风险</option>
            </select>
            <select
              value={decision}
              onChange={(event) => setDecision(event.target.value as typeof decision)}
              style={{ height: 40, borderRadius: 12, border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', padding: '0 14px' }}
            >
              <option value="all">全部结果</option>
              <option value="allow">已批准</option>
              <option value="deny">已拒绝</option>
              <option value="pending">待处理</option>
            </select>
            <select
              value={elevated}
              onChange={(event) => setElevated(event.target.value as typeof elevated)}
              style={{ height: 40, borderRadius: 12, border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', padding: '0 14px' }}
            >
              <option value="all">全部</option>
              <option value="yes">已提权</option>
              <option value="no">未提权</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        <div
          style={{
            overflow: 'hidden',
            borderRadius: 18,
            border: '1px solid #1e293b',
            background: '#0f172a',
            boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '170px 180px 150px 90px 150px 110px 120px 70px minmax(220px,1fr)',
              gap: 0,
              padding: '16px 18px',
              background: '#172136',
              borderBottom: '1px solid #23304a',
              fontSize: 13,
              fontWeight: 700,
              color: '#cbd5e1',
            }}
          >
            <div>时间</div>
            <div>用户</div>
            <div>设备</div>
            <div>App</div>
            <div>Capability</div>
            <div>风险等级</div>
            <div>决策结果</div>
            <div>提权</div>
            <div>来源</div>
          </div>

          <div style={{ maxHeight: 560, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>动作审计加载中…</div>
            ) : filtered.length ? (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: '170px 180px 150px 90px 150px 110px 120px 70px minmax(220px,1fr)',
                    gap: 0,
                    padding: '16px 18px',
                    border: 0,
                    borderBottom: '1px solid #1e293b',
                    background: selected?.id === item.id ? 'rgba(30,41,59,0.95)' : 'transparent',
                    color: '#e2e8f0',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#94a3b8' }}>{item.createdAt.replace('T', ' ').replace('Z', '').slice(0, 19)}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>{item.userId || '未知用户'}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>{item.traceId.slice(0, 18)}</div>
                  </div>
                  <div style={{ fontSize: 14, color: '#e2e8f0' }}>{item.deviceId}</div>
                  <div style={{ fontSize: 14, color: '#e2e8f0' }}>{item.appName}</div>
                  <div>
                    <code style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontSize: 12 }}>
                      {item.capability}
                    </code>
                  </div>
                  <div>{badge(RISK_LABEL[item.riskLevel], RISK_STYLE[item.riskLevel])}</div>
                  <div>{badge(DECISION_LABEL[item.decision], DECISION_STYLE[item.decision])}</div>
                  <div>{item.requiresElevation ? badge('是', DECISION_STYLE.deny) : badge('否', { bg: '#1e293b', border: '#334155', text: '#94a3b8' })}</div>
                  <div style={{ fontSize: 14, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sourceLabel(item)}>
                    {sourceLabel(item)}
                  </div>
                </button>
              ))
            ) : (
              <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>暂无数据</div>
            )}
          </div>
        </div>

        {selected ? (
          <>
            <div
              onClick={() => setSelectedId('')}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 6, 23, 0.72)',
                zIndex: 40,
              }}
            />
            <aside
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: 620,
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                background: '#0f172a',
                borderLeft: '1px solid #1e293b',
                boxShadow: '-24px 0 60px rgba(0,0,0,0.35)',
              }}
            >
              <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid #1e293b', background: 'rgba(15,23,42,0.96)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f8fafc' }}>审计详情</h2>
                      {badge(RISK_LABEL[selected.riskLevel], RISK_STYLE[selected.riskLevel])}
                    </div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>记录 ID: {selected.id}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId('')}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: '1px solid #334155',
                      background: '#1e293b',
                      color: '#cbd5e1',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'grid', gap: 22 }}>
                <section style={{ display: 'grid', gap: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>基本信息</h3>
                  <div style={{ display: 'grid', gap: 14 }}>
                    {infoRow('时间', formatDateTime(selected.createdAt))}
                    {infoRow('用户', selected.userId || '未知用户')}
                    {infoRow('设备', selected.deviceId)}
                    {infoRow('App', selected.appName)}
                    {infoRow('Capability', selected.capability)}
                  </div>
                </section>

                <section style={{ display: 'grid', gap: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>决策信息</h3>
                  <div style={{ display: 'grid', gap: 14 }}>
                    {infoRow('决策结果', DECISION_LABEL[selected.decision])}
                    {infoRow('是否提权', selected.requiresElevation ? '已提权' : '未提权')}
                    {infoRow('来源', sourceLabel(selected))}
                    {infoRow('阶段', STAGE_LABEL[selected.stage])}
                  </div>
                </section>

                <section style={{ display: 'grid', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>意图说明</h3>
                  <div style={{ padding: 16, borderRadius: 14, background: '#111c31', border: '1px solid #23304a', color: '#dbe5f2', lineHeight: 1.7 }}>
                    {selected.summary}
                  </div>
                </section>

                <section style={{ display: 'grid', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>原始命令摘要</h3>
                  <textarea
                    readOnly
                    value={selected.commandSnapshotRedacted || '未记录'}
                    style={{
                      minHeight: 120,
                      borderRadius: 14,
                      border: '1px solid #23304a',
                      background: '#020617',
                      color: '#cbd5e1',
                      padding: 16,
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 12,
                    }}
                  />
                </section>

                <section style={{ display: 'grid', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>资源范围</h3>
                  <textarea
                    readOnly
                    value={JSON.stringify(selected.resources || [], null, 2)}
                    style={{
                      minHeight: 120,
                      borderRadius: 14,
                      border: '1px solid #23304a',
                      background: '#020617',
                      color: '#cbd5e1',
                      padding: 16,
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 12,
                    }}
                  />
                </section>

                <section style={{ display: 'grid', gap: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>策略命中结果</h3>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ padding: 14, borderRadius: 14, background: '#111c31', border: '1px solid #23304a' }}>
                      {infoRow('命中策略', selected.matchedPolicyRuleId || '未记录')}
                    </div>
                    <div style={{ padding: 14, borderRadius: 14, background: '#111c31', border: '1px solid #23304a' }}>
                      {infoRow('Approved Plan Hash', selected.approvedPlanHash || '未记录')}
                    </div>
                    <div style={{ padding: 14, borderRadius: 14, background: '#111c31', border: '1px solid #23304a' }}>
                      {infoRow('Executed Plan Hash', selected.executedPlanHash || '未记录')}
                    </div>
                  </div>
                </section>

                <section style={{ display: 'grid', gap: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>执行结果</h3>
                  <div style={{ padding: 16, borderRadius: 14, background: '#111c31', border: '1px solid #23304a', display: 'grid', gap: 12 }}>
                    {infoRow('状态', selected.resultCode || '未记录')}
                    {infoRow('耗时', selected.durationMs !== null ? `${selected.durationMs} ms` : '未记录')}
                    {infoRow('详细信息', selected.resultSummary || selected.reason || '未记录')}
                  </div>
                </section>

                {upload ? (
                  <section style={{ display: 'grid', gap: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>关联日志上传记录</h3>
                    <div style={{ padding: 16, borderRadius: 14, background: '#111c31', border: '1px solid #23304a', display: 'grid', gap: 12 }}>
                      {infoRow('Upload ID', upload.id)}
                      {infoRow('文件名', upload.fileName)}
                      {infoRow('来源', upload.sourceType)}
                      {infoRow('敏感级别', upload.sensitivityLevel)}
                    </div>
                  </section>
                ) : null}
              </div>
            </aside>
          </>
        ) : null}
      </div>
    </div>
  );
}
