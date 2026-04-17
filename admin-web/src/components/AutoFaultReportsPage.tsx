import { useEffect, useMemo, useState } from 'react';
import {
  adminFilterControlStyle,
  AdminFilterStack,
  AdminSearchRow,
  AdminSelectorRow,
} from './AdminFilterLayout';
import { formatDateTime } from '../lib/adminFormat';
import { downloadDesktopDiagnosticUploadFile, loadDesktopDiagnosticUploads } from '../lib/adminApi';
import type { UserActionDiagnosticUploadRecord } from '../lib/adminTypes';

function sourceTypeLabel(value: string) {
  if (value === 'auto_error_capture') return '自动采集';
  if (value === 'approval_flow') return '审批链路';
  return value || '未记录';
}

function usernameLabel(input: { username?: string; userDisplayName?: string; userId?: string }): string {
  const displayName = String(input.userDisplayName || '').trim();
  const username = String(input.username || '').trim();
  const userId = String(input.userId || '').trim();
  if (displayName && username && displayName !== username) {
    return `${displayName} (${username})`;
  }
  if (displayName) {
    return displayName;
  }
  if (username) {
    return username;
  }
  return userId || '匿名';
}

export function AutoFaultReportsPage() {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [appName, setAppName] = useState('');
  const [sensitivityLevel, setSensitivityLevel] = useState('');
  const [items, setItems] = useState<UserActionDiagnosticUploadRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [downloadBusy, setDownloadBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void loadDesktopDiagnosticUploads({
      sourceType: 'auto_error_capture',
      limit: 500,
    })
      .then((next) => {
        if (cancelled) return;
        setItems(next);
        setSelectedId((current) => (current && next.some((item) => item.id === current) ? current : next[0]?.id || ''));
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : '自动故障上报列表加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownload = async () => {
    if (!selected) {
      return;
    }
    setDownloadBusy(true);
    setError('');
    try {
      await downloadDesktopDiagnosticUploadFile({
        id: selected.id,
        fileName: selected.fileName,
      });
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : '诊断包下载失败');
    } finally {
      setDownloadBusy(false);
    }
  };

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      if (appName && item.appName !== appName) return false;
      if (sensitivityLevel && item.sensitivityLevel !== sensitivityLevel) return false;
      if (!normalized) return true;
      return [item.id, item.userId, item.deviceId, item.appName, item.fileName, item.linkedIntentId]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [appName, items, query, sensitivityLevel]);

  const selected = filteredItems.find((item) => item.id === selectedId) || filteredItems[0] || null;
  const appOptions = Array.from(new Set(items.map((item) => item.appName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN'));

  return (
    <div className="fig-page">
      <div className="fig-page__header">
        <div className="fig-page__header-inner fig-page__header-inner--stack">
          <div>
            <h1>自动故障上报</h1>
            <p className="fig-page__description">查看桌面端自动采集的错误日志上传记录，字段结构与手工故障上报保持一致。</p>
          </div>
          <AdminFilterStack>
            <AdminSearchRow>
              <input
                className="field-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索上传 ID / userId / 设备 ID / 文件名..."
                style={adminFilterControlStyle()}
              />
            </AdminSearchRow>
            <AdminSelectorRow>
              <select
                className="field-select"
                value={appName}
                onChange={(event) => setAppName(event.target.value)}
                style={adminFilterControlStyle()}
              >
                <option value="">所有 App</option>
                {appOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                className="field-select"
                value={sensitivityLevel}
                onChange={(event) => setSensitivityLevel(event.target.value)}
                style={adminFilterControlStyle()}
              >
                <option value="">所有敏感级别</option>
                <option value="customer">customer</option>
                <option value="internal">internal</option>
                <option value="redacted">redacted</option>
              </select>
            </AdminSelectorRow>
          </AdminFilterStack>
        </div>
      </div>

      <div className="fig-page__body">
        {error ? <div className="empty-state empty-state--panel">{error}</div> : null}
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)' }}>
          <section className="fig-card fig-audit-table-card">
            <div className="fig-card__head">
              <div>
                <h3>自动采集列表</h3>
                <span>{loading ? '加载中…' : `共 ${filteredItems.length} 条记录`}</span>
              </div>
            </div>
            <div className="fig-audit-table">
              <div className="fig-audit-table__header">
                <div>时间 / 上传 ID</div>
                <div>userId</div>
                <div>userName</div>
                <div>设备</div>
                <div>App</div>
                <div>文件 / 来源</div>
              </div>
              <div className="fig-audit-table__body">
                {filteredItems.length ? (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`fig-audit-row${selected?.id === item.id ? ' is-active' : ''}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div>
                        <div className="fig-audit-row__title">{formatDateTime(item.createdAt)}</div>
                        <div className="fig-audit-row__detail">{item.id}</div>
                      </div>
                      <div>{item.userId || '匿名'}</div>
                      <div>{usernameLabel(item)}</div>
                      <div>{item.deviceId}</div>
                      <div>{item.appName || '未记录'}</div>
                      <div>{`${item.fileName} · ${sourceTypeLabel(item.sourceType)}`}</div>
                    </button>
                  ))
                ) : (
                  <div className="empty-state">暂无自动故障上报记录。</div>
                )}
              </div>
            </div>
          </section>

          <section className="fig-card">
            <div className="fig-card__head">
              <div>
                <h3>{selected?.id || '自动故障详情'}</h3>
                <span>{selected ? `${sourceTypeLabel(selected.sourceType)} · ${selected.sensitivityLevel}` : '请选择左侧记录'}</span>
              </div>
              {selected ? (
                <div className="fig-release-card__actions">
                  <button className="solid-button" type="button" disabled={downloadBusy} onClick={() => void handleDownload()}>
                    {downloadBusy ? '下载中…' : '下载诊断包'}
                  </button>
                </div>
              ) : null}
            </div>

            {selected ? (
              <div style={{ display: 'grid', gap: 18 }}>
                <div className="fig-meta-cards">
                  <div className="fig-meta-card"><span>userId</span><strong>{selected.userId || '空'}</strong></div>
                  <div className="fig-meta-card"><span>userName</span><strong>{usernameLabel(selected)}</strong></div>
                  <div className="fig-meta-card"><span>设备 ID</span><strong>{selected.deviceId}</strong></div>
                  <div className="fig-meta-card"><span>App</span><strong>{selected.appName || '未记录'}</strong></div>
                  <div className="fig-meta-card"><span>文件名</span><strong>{selected.fileName}</strong></div>
                  <div className="fig-meta-card"><span>文件大小</span><strong>{`${Math.max(1, Math.round(selected.fileSizeBytes / 1024))} KB`}</strong></div>
                  <div className="fig-meta-card"><span>敏感级别</span><strong>{selected.sensitivityLevel}</strong></div>
                </div>

                <section className="fig-card fig-card--subtle">
                  <div className="fig-card__head">
                    <h3>上传信息</h3>
                    <span>对象存储与关联 intent</span>
                  </div>
                  <div className="fig-meta-cards">
                    <div className="fig-meta-card"><span>Bucket</span><strong>{selected.uploadBucket || '未记录'}</strong></div>
                    <div className="fig-meta-card"><span>Object Key</span><strong>{selected.uploadKey || '未记录'}</strong></div>
                    <div className="fig-meta-card"><span>SHA256</span><strong>{selected.sha256 || '未记录'}</strong></div>
                    <div className="fig-meta-card"><span>Linked Intent</span><strong>{selected.linkedIntentId || '未关联'}</strong></div>
                    <div className="fig-meta-card"><span>来源</span><strong>{sourceTypeLabel(selected.sourceType)}</strong></div>
                    <div className="fig-meta-card"><span>客户日志</span><strong>{selected.containsCustomerLogs ? '包含' : '不包含'}</strong></div>
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
