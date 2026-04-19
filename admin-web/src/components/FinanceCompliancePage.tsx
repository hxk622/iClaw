import { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '../lib/adminFormat';
import { loadFinanceComplianceEvents, loadFinanceComplianceSummary } from '../lib/adminApi';
import type { FinanceComplianceEventRecord, FinanceComplianceSummaryData } from '../lib/adminTypes';
import { adminFilterControlStyle, AdminFilterStack, AdminSearchRow, AdminSelectorRow } from './AdminFilterLayout';

export function FinanceCompliancePage() {
  const [appName, setAppName] = useState('caiclaw');
  const [channel, setChannel] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [events, setEvents] = useState<FinanceComplianceEventRecord[]>([]);
  const [summary, setSummary] = useState<FinanceComplianceSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      loadFinanceComplianceEvents({
        appName,
        channel,
        riskLevel,
        limit: 200,
      }),
      loadFinanceComplianceSummary({
        appName,
        channel,
        riskLevel,
      }),
    ])
      .then(([nextEvents, nextSummary]) => {
        if (cancelled) return;
        setEvents(nextEvents);
        setSummary(nextSummary);
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

  const disclaimerCount = summary?.disclaimerCount ?? 0;
  const degradedCount = summary?.degradedCount ?? 0;
  const blockedCount = summary?.blockedCount ?? 0;
  const disclaimerRate = summary ? `${summary.disclaimerRate}%` : '—';
  const heuristicFallbackCount = summary?.heuristicFallbackCount ?? 0;
  const unknownOutputCount = summary?.unknownOutputCount ?? 0;
  const eventsByChannel = summary?.byChannel ?? [];
  const eventsByOutputClassification = summary?.byOutputClassification ?? [];
  const eventsByDecisionSource = summary?.byDecisionSource ?? [];
  const eventsByConfidence = summary?.byConfidence ?? [];
  const topReasons = summary?.topReasons ?? [];
  const topMatchedRules = summary?.topMatchedRules ?? [];
  const byDay = summary?.byDay ?? [];
  const heuristicFallbackEvents = useMemo(
    () => events.filter((item) => item.decisionSource === 'heuristic_fallback').slice(0, 50),
    [events],
  );
  const maxDailyTotal = useMemo(
    () => byDay.reduce((current, item) => Math.max(current, item.total), 0),
    [byDay],
  );
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
            <div className="fig-meta-card"><span>heuristic fallback</span><strong>{String(heuristicFallbackCount)}</strong></div>
            <div className="fig-meta-card"><span>unknown 输出</span><strong>{String(unknownOutputCount)}</strong></div>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginTop: 20 }}>
          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>按渠道分布</h3>
              <span>{String(eventsByChannel.length)} 类</span>
            </div>
            <div className="fig-list">
              {eventsByChannel.length ? (
                eventsByChannel.map((item) => (
                  <article key={item.channel} className="fig-list-item">
                    <div className="fig-list-item__body">
                      <div className="fig-list-item__title">{item.channel}</div>
                      <div className="fig-list-item__meta">{`${item.count} 条事件`}</div>
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
                eventsByOutputClassification.map((item) => (
                  <article key={item.outputClassification} className="fig-list-item">
                    <div className="fig-list-item__body">
                      <div className="fig-list-item__title">{item.outputClassification}</div>
                      <div className="fig-list-item__meta">{`${item.count} 条事件`}</div>
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
                topReasons.map((item) => (
                  <article key={item.reason} className="fig-list-item">
                    <div className="fig-list-item__body">
                      <div className="fig-list-item__title">{item.reason}</div>
                      <div className="fig-list-item__meta">{`${item.count} 次`}</div>
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
              <h3>decision source 分布</h3>
              <span>{String(eventsByDecisionSource.length)} 类</span>
            </div>
            <div className="fig-list">
              {eventsByDecisionSource.length ? (
                eventsByDecisionSource.map((item) => (
                  <article key={item.decisionSource} className="fig-list-item">
                    <div className="fig-list-item__body">
                      <div className="fig-list-item__title">{item.decisionSource}</div>
                      <div className="fig-list-item__meta">{`${item.count} 条事件`}</div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">暂无数据。</div>
              )}
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 20 }}>
          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>confidence 分布</h3>
              <span>{String(eventsByConfidence.length)} 档</span>
            </div>
            <div className="fig-list">
              {eventsByConfidence.length ? (
                eventsByConfidence.map((item) => (
                  <article key={item.confidence} className="fig-list-item">
                    <div className="fig-list-item__body">
                      <div className="fig-list-item__title">{item.confidence}</div>
                      <div className="fig-list-item__meta">{`${item.count} 条事件`}</div>
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
              <h3>Top matched rules</h3>
              <span>{String(topMatchedRules.length)} 条</span>
            </div>
            <div className="fig-list">
              {topMatchedRules.length ? (
                topMatchedRules.map((item) => (
                  <article key={item.reason} className="fig-list-item">
                    <div className="fig-list-item__body">
                      <div className="fig-list-item__title">{item.reason}</div>
                      <div className="fig-list-item__meta">{`${item.count} 次`}</div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">暂无数据。</div>
              )}
            </div>
          </section>
        </div>

        <section className="fig-card fig-card--subtle" style={{ marginTop: 20 }}>
          <div className="fig-card__head">
            <h3>按日趋势</h3>
            <span>{String(byDay.length)} 天</span>
          </div>
          <div className="fig-list">
            {byDay.length ? (
              byDay.map((item) => (
                <article key={item.date} className="fig-list-item">
                  <div className="fig-list-item__body">
                    <div className="fig-list-item__title">{item.date}</div>
                    <div
                      style={{
                        display: 'grid',
                        gap: 8,
                        gridTemplateColumns: 'minmax(0,1fr) auto',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          height: 10,
                          borderRadius: 999,
                          background: '#e2e8f0',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${maxDailyTotal > 0 ? Math.max(8, Math.round((item.total / maxDailyTotal) * 100)) : 0}%`,
                            borderRadius: 999,
                            background: 'linear-gradient(90deg, #c48a2a 0%, #b45309 100%)',
                          }}
                        />
                      </div>
                      <div className="fig-list-item__meta">{`${item.total} 条`}</div>
                    </div>
                    <div className="fig-list-item__meta">
                      {`免责声明 ${item.disclaimerCount} · 降级 ${item.degradedCount} · 拦截 ${item.blockedCount} · unknown ${item.unknownOutputCount}`}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">暂无趋势数据。</div>
            )}
          </div>
        </section>

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
                          {`input=${item.inputClassification || 'n/a'} · output=${item.outputClassification || 'n/a'} · confidence=${item.confidence} · source=${item.decisionSource}`}
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
                  <div className="fig-meta-card"><span>置信度</span><strong>{selectedEvent.confidence}</strong></div>
                  <div className="fig-meta-card"><span>来源</span><strong>{selectedEvent.decisionSource}</strong></div>
                  <div className="fig-meta-card"><span>免责声明</span><strong>{selectedEvent.showDisclaimer ? 'yes' : 'no'}</strong></div>
                  <div className="fig-meta-card"><span>降级 / 拦截</span><strong>{selectedEvent.degraded ? 'degraded' : selectedEvent.blocked ? 'blocked' : 'none'}</strong></div>
                </div>

                <div className="fig-list-item__meta">{formatDateTime(selectedEvent.createdAt)}</div>
                <div className="fig-list-item__meta">{`app=${selectedEvent.appName} · session=${selectedEvent.sessionKey}`}</div>
                <div className="fig-list-item__meta">
                  {`input=${selectedEvent.inputClassification || 'n/a'} · output=${selectedEvent.outputClassification || 'n/a'} · model=${selectedEvent.usedModel || 'n/a'} · classifier=${selectedEvent.classifierVersion || 'n/a'}`}
                </div>

                <div>
                  <div className="fig-list-item__title">命中规则</div>
                  <div className="fig-list-item__meta">
                    {selectedEvent.reasons.length ? selectedEvent.reasons.join(' | ') : '无规则命中明细'}
                  </div>
                </div>

                <div>
                  <div className="fig-list-item__title">matched rules</div>
                  <div className="fig-list-item__meta">
                    {selectedEvent.matchedRules.length ? selectedEvent.matchedRules.join(' | ') : '无 matched rule'}
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

        <section className="fig-card fig-card--subtle" style={{ marginTop: 20 }}>
          <div className="fig-card__head">
            <h3>heuristic fallback 列表</h3>
            <span>{String(heuristicFallbackEvents.length)} 条</span>
          </div>
          <div className="fig-list">
            {heuristicFallbackEvents.length ? (
              heuristicFallbackEvents.map((item) => (
                <article key={item.id} className="fig-list-item">
                  <div className="fig-list-item__body">
                    <div className="fig-list-item__title">
                      {item.channel} · {item.outputClassification || 'unknown'} · {item.confidence}
                    </div>
                    <div className="fig-list-item__meta">
                      {`${formatDateTime(item.createdAt)} · ${item.appName} · ${item.sessionKey}`}
                    </div>
                    <div className="fig-list-item__meta">
                      {item.reasons.length ? item.reasons.join(' | ') : '无 reasons'}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">暂无 heuristic fallback 事件。</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
