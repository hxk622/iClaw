import { useEffect, useMemo, useState } from 'react';
import {
  adminFilterControlStyle,
  AdminFilterStack,
  AdminSearchRow,
  AdminSelectorRow,
} from './AdminFilterLayout';
import { formatDateTime } from '../lib/adminFormat';
import { getDesktopFaultReportDetail, loadDesktopFaultReports } from '../lib/adminApi';
import type { DesktopFaultReportDetailRecord, DesktopFaultReportSummaryRecord } from '../lib/adminTypes';

function entryLabel(value: DesktopFaultReportSummaryRecord['entry']): string {
  return value === 'installer' ? '安装程序' : '异常弹窗';
}

function accountStateLabel(value: DesktopFaultReportSummaryRecord['accountState']): string {
  return value === 'authenticated' ? '已登录' : '匿名';
}

export function DesktopFaultReportsPage() {
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('');
  const [entry, setEntry] = useState('');
  const [accountState, setAccountState] = useState('');
  const [items, setItems] = useState<DesktopFaultReportSummaryRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<DesktopFaultReportDetailRecord | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void loadDesktopFaultReports({
      platform,
      entry,
      accountState,
      limit: 500,
    })
      .then((next) => {
        if (cancelled) return;
        setItems(next);
        setSelectedId((current) => (current && next.some((item) => item.id === current) ? current : next[0]?.id || ''));
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : '故障上报列表加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountState, entry, platform]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void getDesktopFaultReportDetail(selectedId)
      .then((next) => {
        if (!cancelled) {
          setDetail(next);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '故障上报详情加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) =>
      [item.reportId, item.deviceId, item.errorTitle, item.errorMessage, item.failureStage]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [items, query]);

  const selected = useMemo(
    () => filteredItems.find((item) => item.id === selectedId) || filteredItems[0] || null,
    [filteredItems, selectedId],
  );

  useEffect(() => {
    if (!selected || selected.id === selectedId) {
      return;
    }
    setSelectedId(selected.id);
  }, [selected, selectedId]);

  return (
    <div className="fig-page">
      <div className="fig-page__header">
        <div className="fig-page__header-inner fig-page__header-inner--stack">
          <div>
            <h1>手工故障上报</h1>
            <p className="fig-page__description">查看桌面端安装失败与异常弹窗产生的诊断包，支持筛选、预览与下载。</p>
          </div>
          <AdminFilterStack>
            <AdminSearchRow>
              <input
                className="field-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索上报编号 / 设备 ID / 故障摘要..."
                style={adminFilterControlStyle()}
              />
            </AdminSearchRow>
            <AdminSelectorRow>
              <select
                className="field-select"
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                style={adminFilterControlStyle()}
              >
                <option value="">所有平台</option>
                <option value="windows">Windows</option>
                <option value="macos">macOS</option>
              </select>
              <select
                className="field-select"
                value={entry}
                onChange={(event) => setEntry(event.target.value)}
                style={adminFilterControlStyle()}
              >
                <option value="">所有来源</option>
                <option value="installer">安装程序</option>
                <option value="exception-dialog">异常弹窗</option>
              </select>
              <select
                className="field-select"
                value={accountState}
                onChange={(event) => setAccountState(event.target.value)}
                style={adminFilterControlStyle()}
              >
                <option value="">所有身份</option>
                <option value="anonymous">匿名</option>
                <option value="authenticated">已登录</option>
              </select>
            </AdminSelectorRow>
          </AdminFilterStack>
        </div>
      </div>

      <div className="fig-page__body">
        {error ? <div className="empty-state empty-state--panel">{error}</div> : null}
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(420px, 1fr) minmax(420px, 1fr)' }}>
          <section className="fig-card fig-audit-table-card">
            <div className="fig-card__head">
              <div>
                <h3>上报列表</h3>
                <span>{loading ? '加载中…' : `共 ${filteredItems.length} 条记录`}</span>
              </div>
            </div>
            <div className="fig-audit-table">
              <div className="fig-audit-table__header">
                <div>时间 / 编号</div>
                <div>来源</div>
                <div>userId</div>
                <div>设备</div>
                <div>平台</div>
                <div>摘要</div>
              </div>
              <div className="fig-audit-table__body">
                {filteredItems.length ? (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`fig-audit-row${selectedId === item.id ? ' is-active' : ''}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div>
                        <div className="fig-audit-row__title">{formatDateTime(item.createdAt)}</div>
                        <div className="fig-audit-row__detail">{item.reportId}</div>
                      </div>
                      <div>{entryLabel(item.entry)}</div>
                      <div>{item.userId || '空'}</div>
                      <div>{item.deviceId}</div>
                      <div>{item.platform || '未记录'}</div>
                      <div>{item.errorMessage || item.errorTitle}</div>
                    </button>
                  ))
                ) : (
                  <div className="empty-state">暂无故障上报记录。</div>
                )}
              </div>
            </div>
          </section>

          <section className="fig-card">
            <div className="fig-card__head">
              <div>
                <h3>{selected?.reportId || '故障详情'}</h3>
                <span>{detailLoading ? '正在加载详情…' : selected ? `${entryLabel(selected.entry)} · ${accountStateLabel(selected.accountState)}` : '请选择左侧记录'}</span>
              </div>
              {detail?.downloadUrl ? (
                <div className="fig-release-card__actions">
                  <a className="solid-button" href={detail.downloadUrl} target="_blank" rel="noreferrer">
                    下载诊断包
                  </a>
                </div>
              ) : null}
            </div>

            {detail ? (
              <div style={{ display: 'grid', gap: 18 }}>
                <div className="fig-meta-cards">
                  <div className="fig-meta-card"><span>来源</span><strong>{entryLabel(detail.entry)}</strong></div>
                  <div className="fig-meta-card"><span>身份</span><strong>{accountStateLabel(detail.accountState)}</strong></div>
                  <div className="fig-meta-card"><span>设备 ID</span><strong>{detail.deviceId || '未记录'}</strong></div>
                  <div className="fig-meta-card"><span>应用版本</span><strong>{detail.appVersion || '未记录'}</strong></div>
                  <div className="fig-meta-card"><span>平台</span><strong>{detail.platformVersion || detail.platform || '未记录'}</strong></div>
                  <div className="fig-meta-card"><span>包大小</span><strong>{`${Math.max(1, Math.round(detail.fileSizeBytes / 1024))} KB`}</strong></div>
                </div>

                <section className="fig-card fig-card--subtle">
                  <div className="fig-card__head">
                    <h3>故障摘要</h3>
                    <span>{detail.failureStage || '未记录阶段'}</span>
                  </div>
                  <div className="fig-meta-cards">
                    <div className="fig-meta-card"><span>错误标题</span><strong>{detail.errorTitle || '未记录'}</strong></div>
                    <div className="fig-meta-card"><span>错误码</span><strong>{detail.errorCode || '无'}</strong></div>
                    <div className="fig-meta-card"><span>用户</span><strong>{detail.userId || '匿名'}</strong></div>
                    <div className="fig-meta-card"><span>创建时间</span><strong>{formatDateTime(detail.createdAt)}</strong></div>
                  </div>
                  <textarea className="code-input" readOnly value={detail.errorMessage || '未记录错误信息'} />
                </section>

                <section className="fig-card fig-card--subtle">
                  <div className="fig-card__head">
                    <h3>运行时诊断</h3>
                    <span>安装与启动链路关键信息</span>
                  </div>
                  <div className="fig-meta-cards">
                    <div className="fig-meta-card"><span>Runtime 发现</span><strong>{detail.runtimeFound ? '已发现' : '未发现'}</strong></div>
                    <div className="fig-meta-card"><span>可安装</span><strong>{detail.runtimeInstallable ? '是' : '否'}</strong></div>
                    <div className="fig-meta-card"><span>Runtime 版本</span><strong>{detail.runtimeVersion || '未记录'}</strong></div>
                    <div className="fig-meta-card"><span>安装进度</span><strong>{detail.installProgressPercent == null ? '未记录' : `${detail.installProgressPercent}%`}</strong></div>
                    <div className="fig-meta-card"><span>Runtime 路径</span><strong>{detail.runtimePath || '未记录'}</strong></div>
                    <div className="fig-meta-card"><span>日志目录</span><strong>{detail.logDir || '未记录'}</strong></div>
                  </div>
                </section>

                <section className="fig-card fig-card--subtle">
                  <div className="fig-card__head">
                    <h3>诊断包信息</h3>
                    <span>后台下载与校验字段</span>
                  </div>
                  <div className="fig-meta-cards">
                    <div className="fig-meta-card"><span>文件名</span><strong>{detail.fileName || '未记录'}</strong></div>
                    <div className="fig-meta-card"><span>SHA256</span><strong>{detail.fileSha256 || '未记录'}</strong></div>
                    <div className="fig-meta-card"><span>Bucket</span><strong>{detail.uploadBucket || '未记录'}</strong></div>
                    <div className="fig-meta-card"><span>Object Key</span><strong>{detail.uploadKey || '未记录'}</strong></div>
                  </div>
                </section>
              </div>
            ) : (
              <div className="empty-state">请选择左侧记录查看详情。</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
