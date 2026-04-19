import { useEffect, useMemo, useState } from 'react';

import { formatDateTime } from '../lib/adminFormat';
import { loadSyncTaskRuns, triggerSyncTask } from '../lib/adminApi';
import type { SyncTaskRunRecord } from '../lib/adminTypes';
import { adminFilterControlStyle, AdminFilterStack, AdminSearchRow, AdminSelectorRow } from './AdminFilterLayout';

const TASK_OPTIONS = [
  'stock-basics',
  'stock-quotes',
  'market-overview',
  'market-news',
  'industry-concept',
  'finance-data',
];

function statusTone(status: SyncTaskRunRecord['status']) {
  switch (status) {
    case 'success':
      return '#15803d';
    case 'failed':
      return '#b91c1c';
    case 'skipped':
      return '#92400e';
    default:
      return '#475569';
  }
}

export function SyncTaskRunsPage() {
  const [taskId, setTaskId] = useState('');
  const [status, setStatus] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [runs, setRuns] = useState<SyncTaskRunRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [runningTaskId, setRunningTaskId] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState('');

  const loadRuns = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await loadSyncTaskRuns({
        taskId,
        status,
        triggerType,
        limit: 100,
      });
      setRuns(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '同步任务执行记录加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRuns();
  }, [taskId, status, triggerType]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadRuns();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, taskId, status, triggerType]);

  const runningCount = useMemo(() => runs.filter((item) => item.status === 'running').length, [runs]);
  const failedCount = useMemo(() => runs.filter((item) => item.status === 'failed').length, [runs]);

  const handleRunTask = async (nextTaskId: string) => {
    if (!nextTaskId) return;
    setRunningTaskId(nextTaskId);
    setError('');
    try {
      await triggerSyncTask(nextTaskId);
      await loadRuns();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : '触发同步任务失败');
    } finally {
      setRunningTaskId('');
    }
  };

  return (
    <div className="fig-page">
      <div className="fig-page__header">
        <div className="fig-page__header-inner fig-page__header-inner--stack">
          <div>
            <h1>同步任务</h1>
            <p className="fig-page__description">
              查看金融数据调度器执行记录，并手工触发指定任务。当前手工执行已经复用统一 runner、sync_task_runs 和 lease。
            </p>
          </div>
          <AdminFilterStack>
            <AdminSearchRow>
              <select
                className="field-select"
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
                style={adminFilterControlStyle()}
              >
                <option value="">所有任务</option>
                {TASK_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </AdminSearchRow>
            <AdminSelectorRow>
              <select className="field-select" value={status} onChange={(event) => setStatus(event.target.value)} style={adminFilterControlStyle()}>
                <option value="">所有状态</option>
                <option value="running">running</option>
                <option value="success">success</option>
                <option value="failed">failed</option>
                <option value="skipped">skipped</option>
              </select>
              <select className="field-select" value={triggerType} onChange={(event) => setTriggerType(event.target.value)} style={adminFilterControlStyle()}>
                <option value="">所有触发方式</option>
                <option value="schedule">schedule</option>
                <option value="warmup">warmup</option>
                <option value="manual">manual</option>
              </select>
              <button className="ghost-button" type="button" onClick={() => void loadRuns()} disabled={loading}>
                刷新
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setAutoRefresh((current) => !current)}
              >
                {autoRefresh ? '自动刷新中' : '开启自动刷新'}
              </button>
            </AdminSelectorRow>
          </AdminFilterStack>
        </div>
      </div>

      <div className="fig-page__body">
        {error ? <div className="empty-state empty-state--panel">{error}</div> : null}

        <section className="fig-card fig-card--subtle">
          <div className="fig-card__head">
            <h3>执行概览</h3>
            <span>{loading ? '加载中…' : `${runs.length} 条`}</span>
          </div>
          <div className="fig-meta-cards">
            <div className="fig-meta-card"><span>总记录</span><strong>{String(runs.length)}</strong></div>
            <div className="fig-meta-card"><span>运行中</span><strong>{String(runningCount)}</strong></div>
            <div className="fig-meta-card"><span>失败</span><strong>{String(failedCount)}</strong></div>
          </div>
        </section>

        <section className="fig-card fig-card--subtle" style={{ marginTop: 20 }}>
          <div className="fig-card__head">
            <h3>手工触发</h3>
            <span>统一 runner</span>
          </div>
          <div className="fig-list">
            {TASK_OPTIONS.map((item) => (
              <article key={item} className="fig-list-item fig-list-item--spread">
                <div className="fig-list-item__body">
                  <div className="fig-list-item__title">{item}</div>
                  <div className="fig-list-item__meta">通过 `/admin/sync-tasks/run` 手工触发</div>
                </div>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => void handleRunTask(item)}
                  disabled={runningTaskId === item}
                >
                  {runningTaskId === item ? '触发中…' : '立即执行'}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="fig-card fig-card--subtle" style={{ marginTop: 20 }}>
          <div className="fig-card__head">
            <h3>执行记录</h3>
            <span>{String(runs.length)} 条</span>
          </div>
          <div className="fig-list">
            {runs.length ? (
              runs.map((item) => (
                <article
                  key={item.runId}
                  className="fig-list-item"
                  style={{
                    borderLeft:
                      item.status === 'failed'
                        ? '3px solid #b91c1c'
                        : item.status === 'skipped'
                          ? '3px solid #92400e'
                          : item.status === 'success'
                            ? '3px solid #15803d'
                            : '3px solid transparent',
                    paddingLeft: 12,
                  }}
                >
                  <div className="fig-list-item__body">
                    <div className="fig-list-item__title" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span>{item.taskLabel || item.taskId}</span>
                      <span
                        style={{
                          color: statusTone(item.status),
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="fig-list-item__meta">
                      {`${item.taskId} · ${item.triggerType} · ${formatDateTime(item.startedAt)}`}
                    </div>
                    <div className="fig-list-item__meta">
                      {`同步量 ${item.syncCount ?? '—'} · 数据源 ${item.dataSource || '—'} · 耗时 ${item.durationMs ?? '—'}ms`}
                    </div>
                    {item.errorMessage ? <div className="fig-list-item__meta" style={{ color: '#b91c1c' }}>{item.errorMessage}</div> : null}
                    <div style={{ marginTop: 8 }}>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setExpandedRunId((current) => (current === item.runId ? '' : item.runId))}
                      >
                        {expandedRunId === item.runId ? '收起详情' : '展开详情'}
                      </button>
                    </div>
                    {expandedRunId === item.runId ? (
                      <div
                        style={{
                          marginTop: 12,
                          borderRadius: 12,
                          background: '#f8fafc',
                          padding: 12,
                          fontSize: 12,
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {JSON.stringify(
                          {
                            run_id: item.runId,
                            task_id: item.taskId,
                            task_label: item.taskLabel,
                            category: item.category,
                            trigger_type: item.triggerType,
                            schedule: item.schedule,
                            status: item.status,
                            started_at: item.startedAt,
                            finished_at: item.finishedAt,
                            duration_ms: item.durationMs,
                            sync_count: item.syncCount,
                            data_source: item.dataSource,
                            error_message: item.errorMessage,
                            metadata: item.metadata,
                          },
                          null,
                          2,
                        )}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">暂无同步任务执行记录。</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
