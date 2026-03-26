'use strict';

const DEFAULT_USER_AGENT = 'iClawDesktop/1.0';

if (typeof globalThis.fetch === 'function') {
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async function patchedFetch(input, init) {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has('user-agent')) {
      headers.set('user-agent', DEFAULT_USER_AGENT);
    }
    return originalFetch(input, {
      ...init,
      headers,
    });
  };
}
