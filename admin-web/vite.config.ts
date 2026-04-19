import react from '@vitejs/plugin-react';
import {defineConfig, loadEnv} from 'vite';

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0' || normalized === '::1';
}

function validateProductionAuthBaseUrl(mode: string) {
  const env = loadEnv(mode, process.cwd(), '');
  const rawBaseUrl = String(env.VITE_AUTH_BASE_URL || '').trim();
  const allowLoopback = String(env.ICLAW_ALLOW_LOOPBACK_AUTH_BASE_URL || '').trim() === '1';

  if (!rawBaseUrl) {
    throw new Error(
      '[admin-web] VITE_AUTH_BASE_URL is required for production builds. Use `pnpm build:admin` or `node scripts/run-with-env.mjs prod pnpm --dir admin-web build`.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawBaseUrl);
  } catch {
    throw new Error(`[admin-web] VITE_AUTH_BASE_URL is not a valid URL: ${rawBaseUrl}`);
  }

  if (!allowLoopback && isLoopbackHostname(parsed.hostname)) {
    throw new Error(
      `[admin-web] Refusing to build admin-web with loopback VITE_AUTH_BASE_URL=${rawBaseUrl}. This would ship a broken login page. If you really need a local-only bundle, set ICLAW_ALLOW_LOOPBACK_AUTH_BASE_URL=1.`,
    );
  }
}

export default defineConfig(({command, mode}) => {
  if (command === 'build') {
    validateProductionAuthBaseUrl(mode);
  }

  return {
    base: './',
    plugins: [react()],
  };
});
