import { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '../lib/adminFormat';
import { loadClientCrashEvents, loadClientMetricEvents, loadClientPerfSamples } from '../lib/adminApi';
import type { ClientCrashEventRecord, ClientMetricEventRecord, ClientPerfSampleRecord } from '../lib/adminTypes';
import { adminFilterControlStyle, AdminFilterStack, AdminSearchRow, AdminSelectorRow } from './AdminFilterLayout';

export function ClientMetricsPage() {
  const [platform, setPlatform] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [events, setEvents] = useState<ClientMetricEventRecord[]>([]);
  const [crashes, setCrashes] = useState<ClientCrashEventRecord[]>([]);
  const [perfSamples, setPerfSamples] = useState<ClientPerfSampleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      loadClientMetricEvents({ platform, appVersion, limit: 500 }),
      loadClientCrashEvents({ platform, appVersion, limit: 200 }),
      loadClientPerfSamples({ platform, appVersion, limit: 200 }),
    ])
      .then(([nextEvents, nextCrashes, nextPerf]) => {
        if (cancelled) return;
        setEvents(nextEvents);
        setCrashes(nextCrashes);
        setPerfSamples(nextPerf);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '客户端监控数据加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appVersion, platform]);

  const installStarts = events.filter((item) => item.eventName === 'install_start').length;
  const installSuccess = events.filter((item) => item.eventName === 'install_success').length;
  const launchStarts = events.filter((item) => item.eventName === 'app_launch_start').length;
  const launchSuccess = events.filter((item) => item.eventName === 'app_launch_success').length;

  const installSuccessRate = installStarts > 0 ? `${Math.round((installSuccess / installStarts) * 100)}%` : '—';
  const launchSuccessRate = launchStarts > 0 ? `${Math.round((launchSuccess / launchStarts) * 100)}%` : '—';
  const crashRate = launchSuccess > 0 ? `${Math.round((crashes.length / launchSuccess) * 1000) / 10}%` : '—';
  const coldStartSamples = perfSamples.filter((item) => item.metricName === 'cold_start_ms').map((item) => item.value);
  const pageLoadSamples = perfSamples.filter((item) => item.metricName === 'page_load_ms').map((item) => item.value);
  const coldStartP50 = coldStartSamples.length
    ? `${Math.round([...coldStartSamples].sort((a, b) => a - b)[Math.floor(coldStartSamples.length * 0.5)])} ms`
    : '—';
  const pageLoadP50 = pageLoadSamples.length
    ? `${Math.round([...pageLoadSamples].sort((a, b) => a - b)[Math.floor(pageLoadSamples.length * 0.5)])} ms`
    : '—';

  const recentFailures = useMemo(
    () =>
      events
        .filter((item) => item.result === 'failed' || item.eventName.endsWith('_failed'))
        .sort((left, right) => right.eventTime.localeCompare(left.eventTime))
        .slice(0, 20),
    [events],
  );

  return (
    <div className="fig-page">
      <div className="fig-page__header">
        <div className="fig-page__header-inner fig-page__header-inner--stack">
          <div>
            <h1>客户端监控</h1>
            <p className="fig-page__description">查看桌面端安装、启动和 crash 的基础健康指标。</p>
          </div>
          <AdminFilterStack>
            <AdminSearchRow>
              <input
                className="field-input"
                placeholder="筛选版本，例如 1.0.5"
                value={appVersion}
                onChange={(event) => setAppVersion(event.target.value)}
                style={adminFilterControlStyle()}
              />
            </AdminSearchRow>
            <AdminSelectorRow>
              <select className="field-select" value={platform} onChange={(event) => setPlatform(event.target.value)} style={adminFilterControlStyle()}>
                <option value="">所有平台</option>
                <option value="windows">Windows</option>
                <option value="macos">macOS</option>
              </select>
            </AdminSelectorRow>
          </AdminFilterStack>
        </div>
      </div>

      <div className="fig-page__body">
        {error ? <div className="empty-state empty-state--panel">{error}</div> : null}
        <section className="fig-card fig-card--subtle">
          <div className="fig-card__head">
            <h3>基础健康</h3>
            <span>{loading ? '加载中…' : '基于原始事件的实时概览'}</span>
          </div>
          <div className="fig-meta-cards">
            <div className="fig-meta-card"><span>安装成功率</span><strong>{installSuccessRate}</strong></div>
            <div className="fig-meta-card"><span>启动成功率</span><strong>{launchSuccessRate}</strong></div>
            <div className="fig-meta-card"><span>Crash Rate</span><strong>{crashRate}</strong></div>
            <div className="fig-meta-card"><span>故障崩溃数</span><strong>{String(crashes.length)}</strong></div>
            <div className="fig-meta-card"><span>冷启动 P50</span><strong>{coldStartP50}</strong></div>
            <div className="fig-meta-card"><span>首屏加载 P50</span><strong>{pageLoadP50}</strong></div>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(420px, 1fr) minmax(420px, 1fr)' }}>
          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>最近失败事件</h3>
              <span>{String(recentFailures.length)} 条</span>
            </div>
            <div className="fig-list">
              {recentFailures.length ? (
                recentFailures.map((item) => (
                  <article key={item.id} className="fig-list-item">
                    <div className="fig-list-item__body">
                      <div className="fig-list-item__title">{item.eventName}</div>
                      <div className="fig-list-item__meta">{`${formatDateTime(item.eventTime)} · ${item.deviceId}`}</div>
                      <div className="fig-list-item__meta">{item.errorCode || JSON.stringify(item.payload || {})}</div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">暂无失败事件。</div>
              )}
            </div>
          </section>

          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>最近 Crash</h3>
              <span>{String(crashes.length)} 条</span>
            </div>
            <div className="fig-list">
              {crashes.length ? (
                crashes.slice(0, 20).map((item) => (
                  <article key={item.id} className="fig-list-item">
                    <div className="fig-list-item__body">
                      <div className="fig-list-item__title">{item.errorTitle || item.crashType}</div>
                      <div className="fig-list-item__meta">{`${formatDateTime(item.eventTime)} · ${item.platform} · ${item.appVersion}`}</div>
                      <div className="fig-list-item__meta">{item.errorMessage || '未记录错误信息'}</div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">暂无 crash 事件。</div>
              )}
            </div>
          </section>
        </div>

        <section className="fig-card fig-card--subtle" style={{ marginTop: 20 }}>
          <div className="fig-card__head">
            <h3>最近性能样本</h3>
            <span>{String(perfSamples.length)} 条</span>
          </div>
          <div className="fig-list">
            {perfSamples.length ? (
              perfSamples.slice(0, 20).map((item) => (
                <article key={item.id} className="fig-list-item">
                  <div className="fig-list-item__body">
                    <div className="fig-list-item__title">{`${item.metricName} = ${item.value} ${item.unit}`}</div>
                    <div className="fig-list-item__meta">{`${formatDateTime(item.metricTime)} · ${item.platform} · ${item.appVersion}`}</div>
                    <div className="fig-list-item__meta">{item.deviceId}</div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">暂无性能样本。</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
