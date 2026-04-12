import { useEffect, useMemo, useState } from 'react';
import type { OverviewData } from '../lib/adminTypes';

const DEFAULT_RECHARGE_PAYMENT_METHODS = [
  { provider: 'wechat_qr', label: '微信支付', enabled: true, default: true, sortOrder: 10 },
  { provider: 'alipay_qr', label: '支付宝', enabled: true, default: false, sortOrder: 20 },
] as const;

type GatewayDraft = {
  provider: string;
  mode: 'inherit_platform' | 'use_app_config';
  partnerId: string;
  gateway: string;
  key: string;
};

type ProviderDraft = {
  provider: string;
  mode: 'inherit_platform' | 'use_app_profile';
  profileId: string;
  displayName: string;
  enabled: boolean;
  spMchid: string;
  spAppid: string;
  subMchid: string;
  notifyUrl: string;
  serialNo: string;
  apiV3Key: string;
  privateKeyPem: string;
  usePaymentMethodsOverride: boolean;
  paymentMethods: Array<{
    provider: string;
    label: string;
    enabled: boolean;
    default: boolean;
    sortOrder: number;
  }>;
};

function getRechargePaymentMethodOptionLabel(provider: string, fallbackLabel = '') {
  if (fallbackLabel.trim()) return fallbackLabel.trim();
  if (provider === 'wechat_qr') return '微信支付';
  if (provider === 'alipay_qr') return '支付宝';
  return provider;
}

function getPaymentGatewaySourceLabel(source: string) {
  if (source === 'admin') return 'admin-web';
  if (source === 'platform_inherited') return '继承平台';
  if (source === 'env_fallback') return 'env fallback';
  return '未配置';
}

function getRawRechargePaymentMethodEntries(config: Record<string, unknown>) {
  const surfaces = (config.surfaces && typeof config.surfaces === 'object' ? config.surfaces : {}) as Record<string, unknown>;
  const rechargeSurface = (surfaces.recharge && typeof surfaces.recharge === 'object' ? surfaces.recharge : {}) as Record<string, unknown>;
  const rechargeConfig = (rechargeSurface.config && typeof rechargeSurface.config === 'object' ? rechargeSurface.config : {}) as Record<string, unknown>;
  return Array.isArray(rechargeConfig.payment_methods)
    ? rechargeConfig.payment_methods
    : Array.isArray(rechargeConfig.paymentMethods)
      ? rechargeConfig.paymentMethods
      : null;
}

function normalizeRechargePaymentMethodConfig(config: Record<string, unknown>) {
  const rawEntries = getRawRechargePaymentMethodEntries(config);
  const sourceEntries = Array.isArray(rawEntries) ? rawEntries : DEFAULT_RECHARGE_PAYMENT_METHODS;
  const seen = new Set<string>();
  const items = sourceEntries
    .map((item, index) => {
      const entry = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const provider = String(entry.provider || '').trim().toLowerCase();
      if (!['wechat_qr', 'alipay_qr'].includes(provider) || seen.has(provider)) return null;
      seen.add(provider);
      const metadata = (entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {}) as Record<string, unknown>;
      return {
        provider,
        label: String(entry.label || metadata.label || '').trim() || getRechargePaymentMethodOptionLabel(provider),
        enabled: entry.enabled !== false,
        default: entry.is_default === true || entry.default === true,
        sortOrder: Number(entry.sort_order ?? entry.sortOrder ?? (index + 1) * 10) || (index + 1) * 10,
      };
    })
    .filter(Boolean) as ProviderDraft['paymentMethods'];

  if (!items.length && !Array.isArray(rawEntries)) {
    return DEFAULT_RECHARGE_PAYMENT_METHODS.map((item) => ({ ...item }));
  }

  const enabledItems = items.filter((item) => item.enabled);
  const defaultProvider = enabledItems.find((item) => item.default)?.provider || enabledItems[0]?.provider || '';
  return items
    .sort((left, right) => left.sortOrder - right.sortOrder || left.provider.localeCompare(right.provider, 'zh-CN'))
    .map((item) => ({
      ...item,
      default: item.enabled && item.provider === defaultProvider,
    }));
}

function buildGatewayDraft(
  gatewayConfig: OverviewData['paymentGatewayConfigs'][string] | null | undefined,
  isBrandScope: boolean,
): GatewayDraft {
  const config = gatewayConfig?.config || {};
  return {
    provider: gatewayConfig?.provider || 'epay',
    mode: isBrandScope ? (gatewayConfig?.source === 'admin' ? 'use_app_config' : 'inherit_platform') : 'use_app_config',
    partnerId: String(config.partner_id || ''),
    gateway: String(config.gateway || ''),
    key: String(gatewayConfig?.secretValues.key || ''),
  };
}

function buildProviderDraft(args: {
  profile: OverviewData['paymentProviderProfiles'][number] | null;
  mode: 'inherit_platform' | 'use_app_profile';
  isBrandScope: boolean;
  brandConfig: Record<string, unknown>;
  brandLabel: string;
}) {
  const { profile, mode, isBrandScope, brandConfig, brandLabel } = args;
  const config = profile?.config || {};
  return {
    provider: profile?.provider || 'wechat_qr',
    mode,
    profileId: profile?.id || '',
    displayName: profile?.displayName || (isBrandScope ? `${brandLabel} 微信支付` : '平台默认微信支付'),
    enabled: profile?.enabled !== false,
    spMchid: String(config.sp_mchid || ''),
    spAppid: String(config.sp_appid || ''),
    subMchid: String(config.sub_mchid || ''),
    notifyUrl: String(config.notify_url || ''),
    serialNo: String(config.serial_no || ''),
    apiV3Key: '',
    privateKeyPem: '',
    usePaymentMethodsOverride: Array.isArray(getRawRechargePaymentMethodEntries(brandConfig)),
    paymentMethods: normalizeRechargePaymentMethodConfig(brandConfig),
  };
}

export function PaymentConfigPage({
  overviewData,
  saving,
  onSaveGateway,
  onSaveProvider,
}: {
  overviewData: OverviewData;
  saving: boolean;
  onSaveGateway: (input: {
    provider: string;
    scopeType: 'platform' | 'app';
    scopeKey: string;
    mode: 'inherit_platform' | 'use_app_config';
    configValues: Record<string, string>;
    secretValues: Record<string, string>;
  }) => Promise<void> | void;
  onSaveProvider: (input: {
    scopeType: 'platform' | 'app';
    scopeKey: string;
    provider?: string;
    mode: 'inherit_platform' | 'use_app_profile';
    profileId?: string;
    displayName: string;
    enabled: boolean;
    configValues: Record<string, string>;
    secretValues: Record<string, string>;
    usePaymentMethodsOverride?: boolean;
    paymentMethodItems?: Array<{
      provider: string;
      label: string;
      enabled: boolean;
      default: boolean;
      sortOrder: number;
      metadata?: Record<string, unknown>;
    }>;
  }) => Promise<void> | void;
}) {
  const [selectedTab, setSelectedTab] = useState('platform');
  const brands = overviewData.brands || [];

  useEffect(() => {
    if (selectedTab !== 'platform' && !brands.some((item) => item.brandId === selectedTab)) {
      setSelectedTab('platform');
    }
  }, [brands, selectedTab]);

  const selectedBrand = selectedTab === 'platform' ? null : brands.find((item) => item.brandId === selectedTab) || null;
  const scopeType = selectedBrand ? 'app' : 'platform';
  const scopeKey = selectedBrand?.brandId || 'platform';
  const gatewayConfig = overviewData.paymentGatewayConfigs[scopeKey] || null;
  const providerProfile =
    overviewData.paymentProviderProfiles.find((item) => item.scopeType === scopeType && item.scopeKey === scopeKey && item.provider === 'wechat_qr') || null;
  const providerBinding =
    selectedBrand
      ? overviewData.paymentProviderBindings.find((item) => item.provider === 'wechat_qr' && item.appName === selectedBrand.brandId) || null
      : null;
  const brandConfig = selectedBrand ? overviewData.brandConfigs[selectedBrand.brandId] || {} : {};

  const [gatewayDraft, setGatewayDraft] = useState<GatewayDraft>(() => buildGatewayDraft(gatewayConfig, Boolean(selectedBrand)));
  const [providerDraft, setProviderDraft] = useState<ProviderDraft>(() =>
    buildProviderDraft({
      profile: providerProfile,
      mode: providerBinding?.mode === 'use_app_profile' ? 'use_app_profile' : 'inherit_platform',
      isBrandScope: Boolean(selectedBrand),
      brandConfig,
      brandLabel: selectedBrand?.displayName || '平台',
    }),
  );

  useEffect(() => {
    setGatewayDraft(buildGatewayDraft(gatewayConfig, Boolean(selectedBrand)));
  }, [gatewayConfig, selectedBrand]);

  useEffect(() => {
    setProviderDraft(
      buildProviderDraft({
        profile: providerProfile,
        mode: providerBinding?.mode === 'use_app_profile' ? 'use_app_profile' : 'inherit_platform',
        isBrandScope: Boolean(selectedBrand),
        brandConfig,
        brandLabel: selectedBrand?.displayName || '平台',
      }),
    );
  }, [brandConfig, providerBinding, providerProfile, selectedBrand]);

  const gatewayFieldsDisabled = Boolean(selectedBrand && gatewayDraft.mode === 'inherit_platform');
  const enabledPaymentMethods = providerDraft.paymentMethods.filter((item) => item.enabled);
  const gatewayMissingFields = gatewayConfig?.missingFields || [];
  const providerMissingFields = providerProfile?.missingFields || [];
  const gatewaySourceLabel = getPaymentGatewaySourceLabel(gatewayConfig?.source || 'unset');

  return (
    <div className="fig-page">
      <div className="fig-page__header">
        <div className="fig-page__header-inner">
          <div>
            <h1>支付账户配置</h1>
            <p className="fig-page__description">管理平台默认支付配置，以及 OEM 独立支付网关和服务商资料。</p>
          </div>
        </div>
      </div>
      <div className="fig-page__body">
        <section className="fig-guide">
          <div className="fig-guide__head">
            <span className="fig-guide__eyebrow">操作指南</span>
            <h3>支付中心怎么用</h3>
          </div>
          <div className="fig-guide__grid">
            {[
              '平台 tab 维护默认支付网关和微信服务商资料。',
              'OEM tab 可以切到独立网关 / 服务商，也可以恢复继承平台。',
              'OEM tab 还能单独控制前台可见支付方式，不再依赖 legacy 页面。',
            ].map((item, index) => (
              <article key={item} className="fig-guide__item">
                <span className="fig-guide__index">{index + 1}</span>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="fig-card fig-card--subtle">
          <div className="fig-card__head">
            <h3>Scope</h3>
            <span>平台默认 + OEM 覆盖</span>
          </div>
          <div className="segmented" style={{ flexWrap: 'wrap' }}>
            <button className={`tab-pill${selectedTab === 'platform' ? ' is-active' : ''}`} type="button" onClick={() => setSelectedTab('platform')}>
              平台
            </button>
            {brands.map((brand) => (
              <button key={brand.brandId} className={`tab-pill${selectedTab === brand.brandId ? ' is-active' : ''}`} type="button" onClick={() => setSelectedTab(brand.brandId)}>
                {brand.displayName}
              </button>
            ))}
          </div>
        </section>
        <div className="fig-detail-stack">
          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <div>
                <h3>{selectedBrand ? `${selectedBrand.displayName} 支付网关` : '平台支付网关'}</h3>
                <span>{selectedBrand ? 'OEM 可选择继承平台或使用独立网关' : '所有 OEM 默认继承这里'}</span>
              </div>
              {selectedBrand ? (
                <label className="field" style={{ minWidth: 220 }}>
                  <span>Gateway Mode</span>
                  <select className="field-select" value={gatewayDraft.mode} onChange={(event) => setGatewayDraft((current) => ({ ...current, mode: event.target.value as 'inherit_platform' | 'use_app_config' }))}>
                    <option value="inherit_platform">继承平台</option>
                    <option value="use_app_config">使用 OEM 独立网关</option>
                  </select>
                </label>
              ) : null}
            </div>
            <div className="payment-provider-summary">
              <div className="payment-provider-summary__item"><span>当前来源</span><strong>{gatewaySourceLabel}</strong></div>
              <div className="payment-provider-summary__item"><span>完整度</span><strong>{gatewayConfig?.completenessStatus === 'configured' ? '已配置完整' : '配置缺失'}</strong></div>
              <div className="payment-provider-summary__item"><span>已录入密钥</span><strong>{(gatewayConfig?.configuredSecretKeys || []).join(' / ') || '无'}</strong></div>
              <div className="payment-provider-summary__item"><span>更新时间</span><strong>{gatewayConfig?.updatedAt || '未保存'}</strong></div>
            </div>
            <div className="fig-card fig-card--subtle" style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.78 }}>
                {selectedBrand
                  ? gatewayDraft.mode === 'inherit_platform'
                    ? `当前已选择继承平台。来源：${gatewaySourceLabel}；保存后会继续跟随平台支付网关。`
                    : `缺失字段：${gatewayMissingFields.join(' / ') || '无'}。当前来源是 ${gatewaySourceLabel}；保存后只更新当前 OEM 的独立网关。`
                  : `缺失字段：${gatewayMissingFields.join(' / ') || '无'}。平台网关保存后将成为 OEM 默认来源。`}
              </div>
            </div>
            <div className="form-grid form-grid--two">
              <label className="field">
                <span>partner_id</span>
                <input className="field-input" disabled={gatewayFieldsDisabled} value={gatewayDraft.partnerId} onChange={(event) => setGatewayDraft((current) => ({ ...current, partnerId: event.target.value }))} />
              </label>
              <label className="field">
                <span>gateway</span>
                <input className="field-input" disabled={gatewayFieldsDisabled} value={gatewayDraft.gateway} onChange={(event) => setGatewayDraft((current) => ({ ...current, gateway: event.target.value }))} />
              </label>
              <label className="field field--wide">
                <span>key</span>
                <input className="field-input" disabled={gatewayFieldsDisabled} value={gatewayDraft.key} onChange={(event) => setGatewayDraft((current) => ({ ...current, key: event.target.value }))} />
              </label>
            </div>
            <div className="fig-release-card__actions">
              <button
                className="solid-button"
                type="button"
                disabled={saving}
                onClick={() =>
                  void onSaveGateway({
                    provider: gatewayDraft.provider,
                    scopeType,
                    scopeKey,
                    mode: gatewayDraft.mode,
                    configValues: {
                      partner_id: gatewayDraft.partnerId,
                      gateway: gatewayDraft.gateway,
                    },
                    secretValues: {
                      key: gatewayDraft.key,
                    },
                  })
                }
              >
                {saving ? '保存中…' : selectedBrand && gatewayDraft.mode === 'inherit_platform' ? '保存并继承平台' : '保存支付网关'}
              </button>
            </div>
          </section>
          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <div>
                <h3>{selectedBrand ? `${selectedBrand.displayName} 微信服务商` : '平台默认微信服务商'}</h3>
                <span>{selectedBrand ? 'OEM 可继承平台，或切到自己的服务商配置' : '所有 OEM 默认回落到这里'}</span>
              </div>
              {selectedBrand ? (
                <label className="field" style={{ minWidth: 220 }}>
                  <span>Provider Mode</span>
                  <select className="field-select" value={providerDraft.mode} onChange={(event) => setProviderDraft((current) => ({ ...current, mode: event.target.value as 'inherit_platform' | 'use_app_profile' }))}>
                    <option value="inherit_platform">继承平台</option>
                    <option value="use_app_profile">使用 OEM 服务商</option>
                  </select>
                </label>
              ) : null}
            </div>
            <div className="payment-provider-summary">
              <div className="payment-provider-summary__item"><span>当前状态</span><strong>{providerProfile?.completenessStatus === 'configured' ? '已配置完整' : '配置缺失'}</strong></div>
              <div className="payment-provider-summary__item"><span>启用状态</span><strong>{providerDraft.enabled ? '已启用' : '已禁用'}</strong></div>
              <div className="payment-provider-summary__item"><span>已录入密钥</span><strong>{(providerProfile?.configuredSecretKeys || []).join(' / ') || '无'}</strong></div>
              <div className="payment-provider-summary__item"><span>缺失字段</span><strong>{providerMissingFields.join(' / ') || '无'}</strong></div>
            </div>
            <div className="fig-card fig-card--subtle" style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.78 }}>
                {selectedBrand
                  ? providerDraft.mode === 'use_app_profile'
                    ? `当前这个 OEM 已切到自己的服务商配置。缺失字段：${providerMissingFields.join(' / ') || '无'}。`
                    : `当前这个 OEM 跟随平台服务商。填写并保存下方配置后，会切到 OEM 自己的服务商。`
                  : `平台服务商是所有 OEM 的默认回落配置。缺失字段：${providerMissingFields.join(' / ') || '无'}。`}
              </div>
            </div>
            <div className="form-grid form-grid--two">
              <label className="field">
                <span>显示名称</span>
                <input className="field-input" value={providerDraft.displayName} onChange={(event) => setProviderDraft((current) => ({ ...current, displayName: event.target.value }))} />
              </label>
              <label className="field">
                <span>通道类型</span>
                <input className="field-input" readOnly value="wechat_service_provider" />
              </label>
              <label className="field">
                <span>SP_MCHID</span>
                <input className="field-input" value={providerDraft.spMchid} onChange={(event) => setProviderDraft((current) => ({ ...current, spMchid: event.target.value }))} />
              </label>
              <label className="field">
                <span>SP_APPID</span>
                <input className="field-input" value={providerDraft.spAppid} onChange={(event) => setProviderDraft((current) => ({ ...current, spAppid: event.target.value }))} />
              </label>
              <label className="field">
                <span>SUB_MCHID</span>
                <input className="field-input" value={providerDraft.subMchid} onChange={(event) => setProviderDraft((current) => ({ ...current, subMchid: event.target.value }))} />
              </label>
              <label className="field">
                <span>SERIAL_NO</span>
                <input className="field-input" value={providerDraft.serialNo} onChange={(event) => setProviderDraft((current) => ({ ...current, serialNo: event.target.value }))} />
              </label>
              <label className="field field--wide">
                <span>NOTIFY_URL</span>
                <input className="field-input" value={providerDraft.notifyUrl} onChange={(event) => setProviderDraft((current) => ({ ...current, notifyUrl: event.target.value }))} />
              </label>
              <label className="field field--wide">
                <span>API V3 Key</span>
                <input className="field-input" value={providerDraft.apiV3Key} placeholder={providerProfile?.configuredSecretKeys.includes('api_v3_key') ? '已配置，留空表示保持不变' : '32 位 APIv3 Key'} onChange={(event) => setProviderDraft((current) => ({ ...current, apiV3Key: event.target.value }))} />
              </label>
              <label className="field field--wide">
                <span>商户私钥 PEM</span>
                <textarea className="field-textarea" rows={8} placeholder={providerProfile?.configuredSecretKeys.includes('private_key_pem') ? '已配置，留空表示保持不变' : '-----BEGIN PRIVATE KEY-----'} value={providerDraft.privateKeyPem} onChange={(event) => setProviderDraft((current) => ({ ...current, privateKeyPem: event.target.value }))} />
              </label>
            </div>
            <div className="fig-card fig-card--subtle" style={{ marginTop: 16 }}>
              <label className="toggle fig-toggle">
                <input type="checkbox" checked={providerDraft.enabled} onChange={(event) => setProviderDraft((current) => ({ ...current, enabled: event.target.checked }))} />
                <span>启用该支付资料</span>
              </label>
            </div>
            <div className="fig-card fig-card--subtle" style={{ marginTop: 16 }}>
              <div className="fig-card__head">
                <h3>支付方式可见性</h3>
                <span>{selectedBrand ? '控制该 OEM 前台可看到哪些支付方式，以及默认选中哪一个' : '平台默认固定为 微信支付 + 支付宝'}</span>
              </div>
              {selectedBrand ? (
                <>
                  <label className="toggle fig-toggle" style={{ marginBottom: 16 }}>
                    <input type="checkbox" checked={providerDraft.usePaymentMethodsOverride} onChange={(event) => setProviderDraft((current) => ({ ...current, usePaymentMethodsOverride: event.target.checked }))} />
                    <span>启用 OEM 支付方式覆盖</span>
                  </label>
                  <div className="space-y-3">
                    {providerDraft.paymentMethods.map((item, index) => (
                      <div key={item.provider} className="fig-card fig-card--subtle" style={{ padding: 14, opacity: providerDraft.usePaymentMethodsOverride ? 1 : 0.78 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{getRechargePaymentMethodOptionLabel(item.provider, item.label)}</div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>{item.provider === 'wechat_qr' ? '微信原生扫码链路' : '支付宝扫码链路'}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                            <label className="toggle fig-toggle">
                              <input
                                type="checkbox"
                                checked={item.enabled}
                                onChange={(event) =>
                                  setProviderDraft((current) => ({
                                    ...current,
                                    paymentMethods: current.paymentMethods.map((entry) =>
                                      entry.provider === item.provider ? { ...entry, enabled: event.target.checked } : entry,
                                    ),
                                  }))
                                }
                              />
                              <span>启用</span>
                            </label>
                            <label className="field" style={{ minWidth: 140 }}>
                              <span>设为默认</span>
                              <input
                                type="radio"
                                name="default-payment-method"
                                checked={item.default}
                                onChange={() =>
                                  setProviderDraft((current) => ({
                                    ...current,
                                    paymentMethods: current.paymentMethods.map((entry) => ({
                                      ...entry,
                                      default: entry.provider === item.provider,
                                    })),
                                  }))
                                }
                              />
                            </label>
                          </div>
                        </div>
                        <div className="form-grid form-grid--two" style={{ marginTop: 12 }}>
                          <label className="field">
                            <span>Label</span>
                            <input
                              className="field-input"
                              value={item.label}
                              onChange={(event) =>
                                setProviderDraft((current) => ({
                                  ...current,
                                  paymentMethods: current.paymentMethods.map((entry) =>
                                    entry.provider === item.provider ? { ...entry, label: event.target.value } : entry,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Sort Order</span>
                            <input
                              className="field-input"
                              type="number"
                              min="1"
                              value={item.sortOrder}
                              onChange={(event) =>
                                setProviderDraft((current) => ({
                                  ...current,
                                  paymentMethods: current.paymentMethods.map((entry) =>
                                    entry.provider === item.provider ? { ...entry, sortOrder: Number(event.target.value || (index + 1) * 10) } : entry,
                                  ),
                                }))
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="payment-provider-summary">
                  {DEFAULT_RECHARGE_PAYMENT_METHODS.map((item) => (
                    <div key={item.provider} className="payment-provider-summary__item">
                      <span>{item.label}</span>
                      <strong>{item.default ? '默认启用' : '已启用'}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="fig-release-card__actions">
              <button
                className="solid-button"
                type="button"
                disabled={saving}
                onClick={() =>
                  void onSaveProvider({
                    scopeType,
                    scopeKey,
                    provider: providerDraft.provider,
                    mode: providerDraft.mode,
                    profileId: providerDraft.profileId,
                    displayName: providerDraft.displayName,
                    enabled: providerDraft.enabled,
                    configValues: {
                      sp_mchid: providerDraft.spMchid,
                      sp_appid: providerDraft.spAppid,
                      sub_mchid: providerDraft.subMchid,
                      notify_url: providerDraft.notifyUrl,
                      serial_no: providerDraft.serialNo,
                    },
                    secretValues: {
                      api_v3_key: providerDraft.apiV3Key,
                      private_key_pem: providerDraft.privateKeyPem,
                    },
                    usePaymentMethodsOverride: selectedBrand ? providerDraft.usePaymentMethodsOverride : undefined,
                    paymentMethodItems: selectedBrand
                      ? providerDraft.paymentMethods
                          .sort((left, right) => left.sortOrder - right.sortOrder || left.provider.localeCompare(right.provider, 'zh-CN'))
                          .map((item) => ({
                            provider: item.provider,
                            label: item.label,
                            enabled: item.enabled,
                            default: item.enabled && item.provider === (enabledPaymentMethods.find((entry) => entry.default)?.provider || enabledPaymentMethods[0]?.provider || ''),
                            sortOrder: item.sortOrder,
                            metadata: {},
                          }))
                      : undefined,
                  })
                }
              >
                {saving ? '保存中…' : '保存支付配置'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
