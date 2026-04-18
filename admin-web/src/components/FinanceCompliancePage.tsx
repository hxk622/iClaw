import { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '../lib/adminFormat';
import { loadFinanceComplianceEvents } from '../lib/adminApi';
import type { FinanceComplianceEventRecord } from '../lib/adminTypes';
import { adminFilterControlStyle, AdminFilterStack, AdminSearchRow, AdminSelectorRow } from './AdminFilterLayout';

export function FinanceCompliancePage() {
  const [appName, setAppName] = useState('caiclaw');
  const [channel, setChannel] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [events, setEvents] = useState<FinanceComplianceEventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    loadFinanceComplianceEvents({
      appName,
      channel,
      riskLevel,
      limit: 200,
    })
      .then((nextEvents) => {
        if (cancelled) return;
        setEvents(nextEvents);
        setSelectedId((current) => (current && nextEvents.some((item) => item.id === current) ? current : nextEvents[0]?.id || ''));
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '金融合规审计事件加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appName, channel, riskLevel]);

  const disclaimerCount = useMemo(
    () => events.filter((item) => item.showDisclaimer).length,
    [events],
  );
  const degradedCount = useMemo(() => events.filter((item) => item.degraded).length, [events]);
  const blockedCount = useMemo(() => events.filter((item) => item.blocked).length, [events]);
  const disclaimerRate = useMemo(() => {
    if (events.length === 0) {
      return '—';
    }
    return `${Math.round((disclaimerCount / events.length) * 100)}%`;
  }, [disclaimerCount, events.length]);
  const eventsByChannel = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((item) => {
      counts.set(item.channel, (counts.get(item.channel) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }, [events]);
  const eventsByOutputClassification = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((item) => {
      const key = item.outputClassification || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }, [events]);
  const topReasons = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((item) => {
      item.reasons.forEach((reason) => {
        counts.set(reason, (counts.get(reason) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10);
  }, [events]);
  const selectedEvent = useMemo(
    () => events.find((item) => item.id === selectedId) || events[0] || null,
    [events, selectedId],
  );

  return (
    <div className="fig-page">
      <div className="fig-page__header">
        <div className="fig-page__header-inner fig-page__header-inner--stack">
          <div>
            <h1>金融合规审计</h1>
            <p className="fig-page__description">
              查看金融回答的输入分类、输出分类、免责声明展示与降级/拦截决策。
            </p>
          </div>
          <AdminFilterStack>
            <AdminSearchRow>
              <input
                className="field-input"
                placeholder="筛选 app，例如 caiclaw"
                value={appName}
                onChange={(event) => setAppName(event.target.value)}
                style={adminFilterControlStyle()}
              />
            </AdminSearchRow>
            <AdminSelectorRow>
              <select className="field-select" value={channel} onChange={(event) => setChannel(event.target.value)} style={adminFilterControlStyle()}>
                <option value="">所有渠道</option>
                <option value="chat">chat</option>
                <option value="cron">cron</option>
                <option value="notification">notification</option>
                <option value="report">report</option>
              </select>
              <select className="field-select" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)} style={adminFilterControlStyle()}>
                <option value="">所有风险等级</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </AdminSelectorRow>
          </AdminFilterStack>
        </div>
      </div>

      <div className="fig-page__body">
        {error ? <div className="empty-state empty-state--panel">{error}</div> : null}

        <section className="fig-card fig-card--subtle">
          <div className="fig-card__head">
            <h3>事件概览</h3>
            <span>{loading ? '加载中…' : `${events.length} 条`}</span>
          </div>
          <div className="fig-meta-cards">
            <div className="fig-meta-card"><span>总事件数</span><strong>{String(events.length)}</strong></div>
            <div className="fig-meta-card"><span>显示免责声明</span><strong>{String(disclaimerCount)}</strong></div>
            <div className="fig-meta-card"><span>免责声明命中率</span><strong>{disclaimerRate}</strong></div>
            <div className="fig-meta-card"><span>降级</span><strong>{String(degradedCount)}</strong></div>
            <div className="fig-meta-card"><span>拦截</span><strong>{String(blockedCount)}</strong></div>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: 20 }}>
          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>按渠道分布</h3>
              <span>{String(eventsByChannel.length)} 类</span>
            </div>
            <div className="fig-list">
              {eventsByChannel.length ? (
                eventsByChannel.map(([entryChannel, count]) => (
                  <article key={entryChannel} className="fig-list-item">
                    <div className="fig-list-item__body">
                      <div className="fig-list-item__title">{entryChannel}</div>
                      <div className="fig-list-item__meta">{`${count} 条事件`}</div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">暂无数据。</div>
              )}
            </div>
          </section>

          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>按输出分类分布</h3>
              <span>{String(eventsByOutputClassification.length)} 类</span>
            </div>
            <div className="fig-list">
              {eventsByOutputClassification.length ? (
                eventsByOutputClassification.map(([classification, count]) => (
                  <article key={classification} className="fig-list-item">
                    <div className="fig-list-item__body">
                      <div className="fig-list-item__title">{classification}</div>
                      <div className="fig-list-item__meta">{`${count} 条事件`}</div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">暂无数据。</div>
              )}
            </div>
          </section>

          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>Top 命中规则</h3>
              <span>{String(topReasons.length)} 条</span>
            </div>
            <div className="fig-list">
              {topReasons.length ? (
                topReasons.map(([reason, count]) => (
                  <article key={reason} className="fig-list-item">
                    <div className="fig-list-item__body">
                      <div className="fig-list-item__title">{reason}</div>
                      <div className="fig-list-item__meta">{`${count} 次`}</div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">暂无数据。</div>
              )}
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1.2fr) minmax(340px, 0.8fr)', marginTop: 20 }}>
          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>最近事件</h3>
              <span>用于回放“为什么这次有/没有小字”</span>
            </div>
            <div className="fig-list">
              {events.length ? (
                events.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`fig-audit-row${selectedId === item.id ? ' is-active' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: selectedId === item.id ? '#eef2ff' : 'transparent',
                      borderRadius: 14,
                      padding: 0,
                    }}
                  >
                    <article className="fig-list-item">
                      <div className="fig-list-item__body">
                        <div className="fig-list-item__title">
                          {item.channel} · {item.riskLevel} · {item.outputClassification || 'unknown'}
                        </div>
                        <div className="fig-list-item__meta">
                          {`${formatDateTime(item.createdAt)} · ${item.appName} · ${item.sessionKey}`}
                        </div>
                        <div className="fig-list-item__meta">
                          {`input=${item.inputClassification || 'n/a'} · output=${item.outputClassification || 'n/a'} · disclaimer=${item.showDisclaimer ? 'yes' : 'no'} · degraded=${item.degraded ? 'yes' : 'no'} · blocked=${item.blocked ? 'yes' : 'no'}`}
                        </div>
                      </div>
                    </article>
                  </button>
                ))
              ) : (
                <div className="empty-state">暂无金融合规审计事件。</div>
              )}
            </div>
          </section>

          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>事件详情</h3>
              <span>{selectedEvent ? '规则回放' : '未选择事件'}</span>
            </div>
            {selectedEvent ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <div className="fig-meta-cards">
                  <div className="fig-meta-card"><span>渠道</span><strong>{selectedEvent.channel}</strong></div>
                  <div className="fig-meta-card"><span>风险等级</span><strong>{selectedEvent.riskLevel}</strong></div>
                  <div className="fig-meta-card"><span>免责声明</span><strong>{selectedEvent.showDisclaimer ? 'yes' : 'no'}</strong></div>
                  <div className="fig-meta-card"><span>降级 / 拦截</span><strong>{selectedEvent.degraded ? 'degraded' : selectedEvent.blocked ? 'blocked' : 'none'}</strong></div>
                </div>

                <div className="fig-list-item__meta">{formatDateTime(selectedEvent.createdAt)}</div>
                <div className="fig-list-item__meta">{`app=${selectedEvent.appName} · session=${selectedEvent.sessionKey}`}</div>
                <div className="fig-list-item__meta">
                  {`input=${selectedEvent.inputClassification || 'n/a'} · output=${selectedEvent.outputClassification || 'n/a'} · model=${selectedEvent.usedModel || 'n/a'}`}
                </div>

                <div>
                  <div className="fig-list-item__title">命中规则</div>
                  <div className="fig-list-item__meta">
                    {selectedEvent.reasons.length ? selectedEvent.reasons.join(' | ') : '无规则命中明细'}
                  </div>
                </div>

                <div>
                  <div className="fig-list-item__title">能力列表</div>
                  <div className="fig-list-item__meta">
                    {selectedEvent.usedCapabilities.length ? selectedEvent.usedCapabilities.join(', ') : '未记录'}
                  </div>
                </div>

                {selectedEvent.disclaimerText ? (
                  <div>
                    <div className="fig-list-item__title">免责声明</div>
                    <div className="fig-list-item__meta" style={{ color: '#8b6a21' }}>
                      {selectedEvent.disclaimerText}
                    </div>
                  </div>
                ) : null}

                <div>
                  <div className="fig-list-item__title">Metadata</div>
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      borderRadius: 12,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      color: '#334155',
                      fontSize: 12,
                      lineHeight: 1.6,
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="empty-state">选择一条金融合规事件查看详情。</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
