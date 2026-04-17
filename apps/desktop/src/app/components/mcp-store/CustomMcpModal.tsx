import { useEffect, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, Plus, X } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { SegmentedTabs } from '@/app/components/ui/SegmentedTabs';

const INPUT_CLASS =
  'min-h-[42px] w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgba(201,169,97,0.16)]';

type CustomMcpTransport = 'stdio' | 'http' | 'sse';
type CustomMcpMode = 'json' | 'manual';

export type CustomMcpDraft = {
  mcpKey: string;
  name: string;
  description: string;
  transport: CustomMcpTransport;
  command: string;
  argsText: string;
  url: string;
  headersText: string;
  envText: string;
  apiKey: string;
};

export type CustomMcpSubmitPayload = {
  mcpKey: string;
  name: string;
  description: string;
  transport: CustomMcpTransport;
  config: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  secretValues: Record<string, string>;
};

export const DEFAULT_CUSTOM_MCP_DRAFT: CustomMcpDraft = {
  mcpKey: '',
  name: '',
  description: '',
  transport: 'stdio',
  command: '',
  argsText: '',
  url: '',
  headersText: '',
  envText: '',
  apiKey: '',
};

const CUSTOM_MCP_MODE_TABS = [
  { id: 'json', label: 'JSON 粘贴' },
  { id: 'manual', label: '手动填写' },
] as const;

const CUSTOM_MCP_JSON_PLACEHOLDER = `{
  "mcpServers": {
    "market-data": {
      "command": "npx",
      "args": ["-y", "@acme/market-data-mcp"],
      "env": {
        "FINNHUB_API_KEY": "YOUR_FINNHUB_API_KEY",
        "FMP_API_KEY": "\${FMP_API_KEY}"
      }
    }
  }
}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonObjectInput(raw: string, field: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${field} 必须是 JSON 对象`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : `${field} 不是合法 JSON`);
  }
}

function parseArgsText(raw: string): string[] {
  return raw
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function humanizeMcpName(value: string): string {
  const words = value
    .trim()
    .split(/[-_\s]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (words.length === 0) {
    return value.trim();
  }
  return words
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function normalizeTransportValue(value: unknown): CustomMcpTransport | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'stdio' || normalized === 'http' || normalized === 'sse') {
    return normalized;
  }
  return null;
}

function resolveJsonTransport(config: Record<string, unknown>): CustomMcpTransport {
  const explicitTransport = normalizeTransportValue(config.transport) || normalizeTransportValue(config.type);
  if (explicitTransport) {
    return explicitTransport;
  }
  if (typeof config.command === 'string' && config.command.trim()) {
    return 'stdio';
  }
  if (typeof config.url === 'string' && config.url.trim()) {
    return 'http';
  }
  throw new Error('无法从 JSON 推断 transport，请补充 transport / type / command / url');
}

function parseCustomMcpJson(raw: string): CustomMcpSubmitPayload {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('请先粘贴 MCP JSON');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'JSON 解析失败');
  }

  if (!isRecord(parsed)) {
    throw new Error('JSON 顶层必须是对象');
  }

  let mcpKey = '';
  let serverConfig: Record<string, unknown> | null = null;

  if ('mcpServers' in parsed) {
    const mcpServers = parsed.mcpServers;
    if (!isRecord(mcpServers)) {
      throw new Error('mcpServers 必须是对象');
    }
    const keys = Object.keys(mcpServers);
    if (keys.length !== 1) {
      throw new Error('一次只支持粘贴 1 个 MCP，请在 mcpServers 中只保留一个 key');
    }
    mcpKey = keys[0]?.trim() || '';
    const candidate = mcpServers[mcpKey];
    if (!isRecord(candidate)) {
      throw new Error('mcpServers 下的 MCP 配置必须是对象');
    }
    serverConfig = candidate;
  } else {
    mcpKey = typeof parsed.mcpKey === 'string' ? parsed.mcpKey.trim() : '';
    if (!mcpKey) {
      throw new Error('未找到 MCP Key；请使用 mcpServers 格式，或在 JSON 顶层提供 mcpKey');
    }
    serverConfig = parsed;
  }

  if (!mcpKey) {
    throw new Error('请填写合法的 MCP Key');
  }

  const metadata = isRecord(serverConfig.metadata) ? serverConfig.metadata : undefined;
  const name =
    typeof serverConfig.name === 'string' && serverConfig.name.trim()
      ? serverConfig.name.trim()
      : humanizeMcpName(mcpKey);
  const description = typeof serverConfig.description === 'string' ? serverConfig.description.trim() : '';
  const transport = resolveJsonTransport(serverConfig);
  const config: Record<string, unknown> = {
    ...serverConfig,
    transport,
  };

  delete config.metadata;
  delete config.name;
  delete config.description;
  delete config.mcpKey;

  if (transport === 'stdio') {
    if (typeof config.command !== 'string' || !config.command.trim()) {
      throw new Error('STDIO MCP 需要 command');
    }
  } else if (typeof config.url !== 'string' || !config.url.trim()) {
    throw new Error('HTTP / SSE MCP 需要 url');
  }

  return {
    mcpKey,
    name,
    description,
    transport,
    config,
    metadata,
    secretValues: {},
  };
}

export function CustomMcpModal({
  open,
  title = '添加MCP',
  draft = DEFAULT_CUSTOM_MCP_DRAFT,
  saving = false,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title?: string;
  draft?: CustomMcpDraft;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (payload: CustomMcpSubmitPayload) => Promise<void> | void;
}) {
  const [form, setForm] = useState<CustomMcpDraft>(draft);
  const [mode, setMode] = useState<CustomMcpMode>('json');
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    setForm(draft);
    setMode('json');
    setJsonText('');
    setError(null);
    setShowApiKey(false);
  }, [draft, open]);

  if (!open) {
    return null;
  }

  const handleSubmit = async () => {
    if (mode === 'json') {
      try {
        setError(null);
        await onSubmit(parseCustomMcpJson(jsonText));
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : '保存失败');
      }
      return;
    }

    const mcpKey = form.mcpKey.trim();
    const name = form.name.trim();
    if (!mcpKey) {
      setError('请填写 MCP Key');
      return;
    }
    if (!name) {
      setError('请填写 MCP 名称');
      return;
    }
    if ((form.transport === 'http' || form.transport === 'sse') && !form.url.trim()) {
      setError('HTTP / SSE MCP 需要填写 URL');
      return;
    }
    if (form.transport === 'stdio' && !form.command.trim()) {
      setError('STDIO MCP 需要填写命令');
      return;
    }

    try {
      const headers = parseJsonObjectInput(form.headersText, 'Headers');
      const env = parseJsonObjectInput(form.envText, '环境变量');
      const config: Record<string, unknown> = {
        transport: form.transport,
      };
      if (form.transport === 'stdio') {
        config.command = form.command.trim();
        const args = parseArgsText(form.argsText);
        if (args.length > 0) {
          config.args = args;
        }
        if (Object.keys(env).length > 0) {
          config.env = env;
        }
      } else {
        config.url = form.url.trim();
        if (Object.keys(headers).length > 0) {
          config.headers = headers;
        }
      }

      setError(null);
      await onSubmit({
        mcpKey,
        name,
        description: form.description.trim(),
        transport: form.transport,
        config,
        metadata: undefined,
        secretValues: form.apiKey.trim() ? { api_key: form.apiKey.trim() } : {},
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(8,12,20,0.38)] px-4 py-4 backdrop-blur-[4px]">
      <div className="w-full max-w-[760px] overflow-hidden rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-page)] shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              <Plus className="h-4 w-4" />
              自定义 MCP
            </div>
            <div className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{title}</div>
            <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
              保存后会写入云端后台并用于恢复本地 mcp.json，不再依赖手工改本地文件。
            </p>
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
          <SegmentedTabs items={CUSTOM_MCP_MODE_TABS} activeId={mode} onChange={setMode} />

          {mode === 'json' ? (
            <>
              <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-4">
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">直接粘贴现成 JSON</div>
                <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
                  支持标准 <code className="rounded bg-black/5 px-1.5 py-0.5 text-[12px]">mcpServers</code> 格式。
                  可以保留 <code className="rounded bg-black/5 px-1.5 py-0.5 text-[12px]">YOUR_API_KEY</code> 或 <code className="rounded bg-black/5 px-1.5 py-0.5 text-[12px]">${'{API_KEY}'}</code> 这类占位符；一次只支持一个 MCP。
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-[14px] font-medium text-[var(--text-primary)]">JSON 配置</label>
                <textarea
                  className={`${INPUT_CLASS} min-h-[320px] py-3 font-mono text-[12px] leading-6`}
                  value={jsonText}
                  onChange={(event) => setJsonText(event.target.value)}
                  placeholder={CUSTOM_MCP_JSON_PLACEHOLDER}
                  spellCheck={false}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[14px] font-medium text-[var(--text-primary)]">MCP Key</label>
                  <input className={INPUT_CLASS} value={form.mcpKey} onChange={(event) => setForm((current) => ({ ...current, mcpKey: event.target.value }))} placeholder="例如 finance-custom-http" />
                </div>
                <div className="space-y-2">
                  <label className="text-[14px] font-medium text-[var(--text-primary)]">名称</label>
                  <input className={INPUT_CLASS} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="例如 我的行情接口" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[14px] font-medium text-[var(--text-primary)]">描述</label>
                <textarea className={`${INPUT_CLASS} min-h-[96px] py-3`} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="简单描述这个 MCP 提供什么能力" />
              </div>

              <div className="space-y-2">
                <label className="text-[14px] font-medium text-[var(--text-primary)]">Transport</label>
                <select className={INPUT_CLASS} value={form.transport} onChange={(event) => setForm((current) => ({ ...current, transport: event.target.value as CustomMcpTransport }))}>
                  <option value="stdio">STDIO</option>
                  <option value="http">HTTP</option>
                  <option value="sse">SSE</option>
                </select>
              </div>

              {form.transport === 'stdio' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[14px] font-medium text-[var(--text-primary)]">命令</label>
                    <input className={INPUT_CLASS} value={form.command} onChange={(event) => setForm((current) => ({ ...current, command: event.target.value }))} placeholder="例如 npx -y @modelcontextprotocol/server-filesystem" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[14px] font-medium text-[var(--text-primary)]">Args</label>
                    <textarea className={`${INPUT_CLASS} min-h-[96px] py-3`} value={form.argsText} onChange={(event) => setForm((current) => ({ ...current, argsText: event.target.value }))} placeholder="每行一个参数，或用逗号分隔" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[14px] font-medium text-[var(--text-primary)]">环境变量 JSON</label>
                    <textarea className={`${INPUT_CLASS} min-h-[120px] py-3 font-mono text-[12px]`} value={form.envText} onChange={(event) => setForm((current) => ({ ...current, envText: event.target.value }))} placeholder='例如 {"API_BASE":"https://example.com"}' />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[14px] font-medium text-[var(--text-primary)]">URL</label>
                    <input className={INPUT_CLASS} value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} placeholder="例如 https://mcp.example.com" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[14px] font-medium text-[var(--text-primary)]">Headers JSON</label>
                    <textarea className={`${INPUT_CLASS} min-h-[120px] py-3 font-mono text-[12px]`} value={form.headersText} onChange={(event) => setForm((current) => ({ ...current, headersText: event.target.value }))} placeholder='例如 {"Authorization":"Bearer ${API_KEY}"}' />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-[14px] font-medium text-[var(--text-primary)]">API Key / Token</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className={`${INPUT_CLASS} pr-11`}
                    value={form.apiKey}
                    onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
                    placeholder="可选，保存后会加密存储"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                    onClick={() => setShowApiKey((current) => !current)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {error ? <div className="rounded-[16px] border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-[13px] text-[rgb(185,28,28)]">{error}</div> : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border-default)] px-6 py-4">
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" size="md" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : '保存并启用'}
          </Button>
        </div>
      </div>
    </div>
  );
}
