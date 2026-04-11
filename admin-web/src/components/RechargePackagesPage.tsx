import { useEffect, useState } from 'react';
import { formatCredits, formatFen } from '../lib/adminFormat';

type RechargeItem = {
  packageId: string;
  packageName: string;
  credits: number;
  bonusCredits: number;
  amountCnyFen: number;
  sortOrder: number;
  active: boolean;
  recommended: boolean;
  default: boolean;
  description: string;
  badgeLabel: string;
  highlight: string;
  featureList: string[];
};

export function RechargePackagesPage({
  items,
  selectedPackageId,
  onSelectPackage,
  onSave,
  onDelete,
  saving,
}: {
  items: RechargeItem[];
  selectedPackageId: string;
  onSelectPackage: (packageId: string) => void;
  onSave: (input: RechargeItem) => Promise<void> | void;
  onDelete: (packageId: string) => Promise<void> | void;
  saving: boolean;
}) {
  const selected = items.find((item) => item.packageId === selectedPackageId) || items[0] || null;
  const [draft, setDraft] = useState<RechargeItem>(
    selected || {
      packageId: '',
      packageName: '',
      credits: 0,
      bonusCredits: 0,
      amountCnyFen: 0,
      sortOrder: (items.length + 1) * 10 || 10,
      active: true,
      recommended: false,
      default: false,
      description: '',
      badgeLabel: '',
      highlight: '',
      featureList: [],
    },
  );

  useEffect(() => {
    setDraft(
      selected || {
        packageId: '',
        packageName: '',
        credits: 0,
        bonusCredits: 0,
        amountCnyFen: 0,
        sortOrder: (items.length + 1) * 10 || 10,
        active: true,
        recommended: false,
        default: false,
        description: '',
        badgeLabel: '',
        highlight: '',
        featureList: [],
      },
    );
  }, [selected, items.length]);

  return (
    <div className="fig-page">
      <div className="fig-page__header">
        <div className="fig-page__header-inner">
          <div>
            <h1>充值套餐</h1>
            <p className="fig-page__description">维护平台级套餐主数据。OEM 默认继承这里，只有显式覆盖时才切到 OEM 自己的套餐集合。</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="solid-button fig-button" type="button" onClick={() => onSelectPackage('__new__')}>
              新增套餐
            </button>
          </div>
        </div>
      </div>
      <div className="fig-page__body">
        <section className="fig-card fig-audit-table-card">
          <div className="fig-card__head">
            <h3>平台套餐目录</h3>
            <span>{`${items.length} 个`}</span>
          </div>
          <div className="fig-audit-table">
            <div className="fig-audit-table__header">
              <div>套餐</div>
              <div>价格</div>
              <div>到账</div>
              <div>排序</div>
              <div>状态</div>
            </div>
            <div className="fig-audit-table__body">
              {items.length ? (
                items.map((item) => (
                  <button
                    key={item.packageId}
                    className={`fig-audit-row${selected?.packageId === item.packageId ? ' is-active' : ''}`}
                    type="button"
                    onClick={() => onSelectPackage(item.packageId)}
                  >
                    <div>
                      <div className="fig-audit-row__title">{item.packageName}</div>
                      <div className="fig-audit-row__detail">{item.packageId}</div>
                    </div>
                    <div>{formatFen(item.amountCnyFen)}</div>
                    <div>{formatCredits(item.credits + item.bonusCredits)}</div>
                    <div>{String(item.sortOrder)}</div>
                    <div>{item.active ? '已启用' : '已下架'}</div>
                  </button>
                ))
              ) : (
                <div className="empty-state">还没有平台充值套餐。</div>
              )}
            </div>
          </div>
        </section>
        <section className="fig-card">
          <div className="fig-card__head">
            <h3>{draft.packageName || '新增平台充值套餐'}</h3>
            <span>{draft.packageId || '新套餐会直接写入平台套餐目录'}</span>
          </div>
          <div className="form-grid form-grid--two">
            <label className="field">
              <span>Package ID</span>
              <input className="field-input" value={draft.packageId} readOnly={Boolean(selected)} onChange={(event) => setDraft((current) => ({ ...current, packageId: event.target.value }))} />
            </label>
            <label className="field">
              <span>套餐名称</span>
              <input className="field-input" value={draft.packageName} onChange={(event) => setDraft((current) => ({ ...current, packageName: event.target.value }))} />
            </label>
            <label className="field">
              <span>金额（分）</span>
              <input className="field-input" type="number" min="1" value={draft.amountCnyFen} onChange={(event) => setDraft((current) => ({ ...current, amountCnyFen: Number(event.target.value || 0) }))} />
            </label>
            <label className="field">
              <span>基础龙虾币</span>
              <input className="field-input" type="number" min="0" value={draft.credits} onChange={(event) => setDraft((current) => ({ ...current, credits: Number(event.target.value || 0) }))} />
            </label>
            <label className="field">
              <span>赠送龙虾币</span>
              <input className="field-input" type="number" min="0" value={draft.bonusCredits} onChange={(event) => setDraft((current) => ({ ...current, bonusCredits: Number(event.target.value || 0) }))} />
            </label>
            <label className="field">
              <span>排序</span>
              <input className="field-input" type="number" min="1" value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value || 0) }))} />
            </label>
            <label className="field field--wide">
              <span>描述文案</span>
              <textarea className="field-textarea" rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label className="field">
              <span>Badge</span>
              <input className="field-input" value={draft.badgeLabel} onChange={(event) => setDraft((current) => ({ ...current, badgeLabel: event.target.value }))} />
            </label>
            <label className="field">
              <span>Highlight</span>
              <input className="field-input" value={draft.highlight} onChange={(event) => setDraft((current) => ({ ...current, highlight: event.target.value }))} />
            </label>
            <label className="field field--wide">
              <span>特性列表</span>
              <textarea className="field-textarea" rows={4} value={draft.featureList.join('\n')} onChange={(event) => setDraft((current) => ({ ...current, featureList: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) }))} />
            </label>
          </div>
          <div className="fig-capability-columns" style={{ marginTop: 16 }}>
            <label className="toggle fig-toggle">
              <input type="checkbox" checked={draft.recommended} onChange={(event) => setDraft((current) => ({ ...current, recommended: event.target.checked }))} />
              <span>超值推荐</span>
            </label>
            <label className="toggle fig-toggle">
              <input type="checkbox" checked={draft.default} onChange={(event) => setDraft((current) => ({ ...current, default: event.target.checked }))} />
              <span>平台默认</span>
            </label>
            <label className="toggle fig-toggle">
              <input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} />
              <span>启用套餐</span>
            </label>
          </div>
          <div className="fig-form-actions">
            <button className="solid-button" type="button" disabled={saving} onClick={() => onSave(draft)}>
              {saving ? '保存中…' : '保存套餐'}
            </button>
            {selected ? (
              <button className="ghost-button" type="button" disabled={saving} onClick={() => onDelete(selected.packageId)}>
                删除套餐
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
