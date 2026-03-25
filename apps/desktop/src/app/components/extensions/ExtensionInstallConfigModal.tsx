import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, Settings2, X } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { cn } from '@/app/lib/cn';
import type { ExtensionInstallConfigSnapshot, ExtensionSetupField, ExtensionSetupSchema } from '@/app/lib/extension-setup';

const INPUT_CLASS =
  'min-h-[42px] w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgba(201,169,97,0.16)]';

export function ExtensionInstallConfigModal({
  open,
  title,
  description,
  schema,
  initialConfig,
  saving,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description?: string;
  schema: ExtensionSetupSchema | null;
  initialConfig?: ExtensionInstallConfigSnapshot | null;
  saving?: boolean;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (payload: {setupValues: Record<string, unknown>; secretValues: Record<string, string>}) => Promise<void> | void;
}) {
  const [setupValues, setSetupValues] = useState<Record<string, unknown>>({});
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [visibleSecretKeys, setVisibleSecretKeys] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !schema) {
      return;
    }
    setSetupValues(initialConfig?.setupValues || {});
    setSecretValues({});
    setVisibleSecretKeys({});
    setError(null);
  }, [initialConfig, open, schema]);

  const configuredSecretKeys = useMemo(
    () => new Set(initialConfig?.configuredSecretKeys || []),
    [initialConfig?.configuredSecretKeys],
  );

  if (!open || !schema) {
    return null;
  }

  const validateField = (field: ExtensionSetupField): boolean => {
    if (!field.required) {
      return true;
    }
    if (field.type === 'secret') {
      return Boolean(secretValues[field.key]?.trim() || configuredSecretKeys.has(field.key));
    }
    const value = setupValues[field.key];
    if (typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    return typeof value === 'string' ? value.trim().length > 0 : value != null;
  };

  const handleSubmit = async () => {
    const missing = schema.fields.filter((field) => !validateField(field));
    if (missing.length > 0) {
      setError(`请补充：${missing.map((field) => field.label).join('、')}`);
      return;
    }
    setError(null);
    const nextSetupValues: Record<string, unknown> = {};
    for (const field of schema.fields) {
      if (field.type === 'secret') continue;
      if (field.key in setupValues) {
        nextSetupValues[field.key] = setupValues[field.key];
      }
    }
    const nextSecretValues: Record<string, string> = {};
    for (const [key, value] of Object.entries(secretValues)) {
      if (value.trim()) {
        nextSecretValues[key] = value.trim();
      }
    }
    await onSubmit({
      setupValues: nextSetupValues,
      secretValues: nextSecretValues,
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(8,12,20,0.38)] px-4 py-4 backdrop-blur-[4px]">
      <div className="w-full max-w-[760px] overflow-hidden rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-page)] shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              <Settings2 className="h-4 w-4" />
              安装配置
            </div>
            <div className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{title}</div>
            {description ? <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{description}</p> : null}
          </div>
          <button
            type="button"
            className="rounded-full border border-[var(--border-default)] p-2 text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-[18px] border border-[rgba(201,169,97,0.22)] bg-[rgba(201,169,97,0.08)] px-4 py-3 text-[13px] leading-6 text-[var(--text-secondary)]">
            安装前先把所需配置补齐。密钥类字段只会在你输入新值时更新，留空不会覆盖已保存的密钥。
          </div>

          {schema.fields.map((field) => {
            const showSecret = visibleSecretKeys[field.key] === true;
            const hasConfiguredSecret = configuredSecretKeys.has(field.key);
            return (
              <div key={field.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-[14px] font-medium text-[var(--text-primary)]">{field.label}</label>
                  {field.required ? (
                    <span className="rounded-full bg-[rgba(239,68,68,0.08)] px-2 py-0.5 text-[11px] text-[rgb(185,28,28)]">
                      必填
                    </span>
                  ) : null}
                  {field.type === 'secret' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(59,130,246,0.08)] px-2 py-0.5 text-[11px] text-[rgb(37,99,235)]">
                      <KeyRound className="h-3 w-3" />
                      密钥
                    </span>
                  ) : null}
                  {field.type === 'secret' && hasConfiguredSecret ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(34,197,94,0.10)] px-2 py-0.5 text-[11px] text-[rgb(21,128,61)]">
                      <CheckCircle2 className="h-3 w-3" />
                      已保存
                    </span>
                  ) : null}
                </div>

                {field.type === 'textarea' ? (
                  <textarea
                    value={String(setupValues[field.key] || '')}
                    placeholder={field.placeholder || ''}
                    className={cn(INPUT_CLASS, 'min-h-[112px] py-3')}
                    onChange={(event) => setSetupValues((current) => ({...current, [field.key]: event.target.value}))}
                  />
                ) : field.type === 'boolean' ? (
                  <label className="flex min-h-[42px] items-center gap-3 rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4">
                    <input
                      type="checkbox"
                      checked={Boolean(setupValues[field.key])}
                      onChange={(event) => setSetupValues((current) => ({...current, [field.key]: event.target.checked}))}
                    />
                    <span className="text-[14px] text-[var(--text-primary)]">启用</span>
                  </label>
                ) : field.type === 'select' ? (
                  <select
                    value={String(setupValues[field.key] || '')}
                    className={INPUT_CLASS}
                    onChange={(event) => setSetupValues((current) => ({...current, [field.key]: event.target.value}))}
                  >
                    <option value="">请选择</option>
                    {(field.options || []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="relative">
                    <input
                      type={field.type === 'secret' ? (showSecret ? 'text' : 'password') : field.type === 'number' ? 'number' : 'text'}
                      value={
                        field.type === 'secret'
                          ? secretValues[field.key] || ''
                          : String(setupValues[field.key] ?? '')
                      }
                      placeholder={field.type === 'secret' && hasConfiguredSecret ? '已保存，留空表示不修改' : field.placeholder || ''}
                      className={cn(INPUT_CLASS, field.type === 'secret' ? 'pr-11' : '')}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (field.type === 'secret') {
                          setSecretValues((current) => ({...current, [field.key]: value}));
                          return;
                        }
                        setSetupValues((current) => ({
                          ...current,
                          [field.key]: field.type === 'number' ? (value.trim() ? Number(value) : '') : value,
                        }));
                      }}
                    />
                    {field.type === 'secret' ? (
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                        onClick={() =>
                          setVisibleSecretKeys((current) => ({...current, [field.key]: !current[field.key]}))
                        }
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    ) : null}
                  </div>
                )}

                {field.helpText ? (
                  <div className="text-[12px] leading-5 text-[var(--text-secondary)]">{field.helpText}</div>
                ) : null}
              </div>
            );
          })}

          {error ? (
            <div className="flex items-center gap-2 rounded-[16px] border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-[13px] text-[rgb(185,28,28)]">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border-default)] px-6 py-4">
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" size="md" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : submitLabel || '保存并继续'}
          </Button>
        </div>
      </div>
    </div>
  );
}
