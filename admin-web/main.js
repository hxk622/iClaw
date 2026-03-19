import './styles.css';

const API_BASE_URL = ((import.meta.env.VITE_AUTH_BASE_URL || 'http://127.0.0.1:2130') + '').trim().replace(/\/+$/, '');
const TOKEN_STORAGE_KEY = 'iclaw.admin-web.tokens';

const app = document.querySelector('#app');

if (!app) {
  throw new Error('admin-web mount failed');
}

const state = {
  busy: false,
  error: '',
  notice: '',
  view: 'login',
  tokens: loadTokens(),
  user: null,
  brands: [],
  selectedBrandId: '',
  brandDetail: null,
  editorText: '',
};

function loadTokens() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistTokens(tokens) {
  state.tokens = tokens;
  if (tokens) {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.error?.message || `Request failed with status ${response.status}`);
    error.code = payload?.error?.code || 'REQUEST_FAILED';
    throw error;
  }
  return payload.data;
}

async function refreshToken() {
  if (!state.tokens?.refresh_token) {
    return false;
  }
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: state.tokens.refresh_token,
    }),
  });
  const tokens = await parseResponse(response);
  persistTokens({
    ...state.tokens,
    ...tokens,
  });
  return true;
}

async function apiFetch(path, init = {}, options = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  if (state.tokens?.access_token) {
    headers.set('Authorization', `Bearer ${state.tokens.access_token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && !options.skipRefresh && state.tokens?.refresh_token) {
    const refreshed = await refreshToken().catch(() => false);
    if (refreshed) {
      return apiFetch(path, init, {skipRefresh: true});
    }
  }

  return parseResponse(response);
}

function resetBanner() {
  state.error = '';
  state.notice = '';
}

function setError(message) {
  state.error = message;
  state.notice = '';
  render();
}

function setNotice(message) {
  state.notice = message;
  state.error = '';
  render();
}

async function authenticate(identifier, password) {
  state.busy = true;
  resetBanner();
  render();
  try {
    const data = await apiFetch(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          password,
        }),
      },
      {skipRefresh: true},
    );
    persistTokens(data.tokens);
    state.user = data.user;
    state.view = 'dashboard';
    await loadBrands();
    setNotice('Control center ready.');
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Login failed');
  } finally {
    state.busy = false;
    render();
  }
}

async function ensureSession() {
  if (!state.tokens?.access_token) {
    state.view = 'login';
    render();
    return;
  }

  try {
    state.user = await apiFetch('/auth/me', {method: 'GET'});
    state.view = 'dashboard';
    await loadBrands();
  } catch {
    persistTokens(null);
    state.user = null;
    state.view = 'login';
    render();
  }
}

async function loadBrands() {
  const data = await apiFetch('/admin/oem/brands', {method: 'GET'});
  state.brands = Array.isArray(data.items) ? data.items : [];
  if (!state.selectedBrandId && state.brands[0]) {
    state.selectedBrandId = state.brands[0].brandId;
  }
  if (state.selectedBrandId) {
    await loadBrandDetail(state.selectedBrandId);
  } else {
    state.brandDetail = null;
    state.editorText = '';
  }
  render();
}

async function loadBrandDetail(brandId) {
  if (!brandId) {
    return;
  }
  state.busy = true;
  resetBanner();
  render();
  try {
    const data = await apiFetch(`/admin/oem/brand?brand_id=${encodeURIComponent(brandId)}`, {
      method: 'GET',
    });
    state.selectedBrandId = brandId;
    state.brandDetail = data;
    state.editorText = JSON.stringify(data.brand.draftConfig, null, 2);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Failed to load brand');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveDraft() {
  const current = state.brandDetail?.brand;
  if (!current) {
    return;
  }

  let draftConfig;
  try {
    draftConfig = JSON.parse(state.editorText);
  } catch {
    setError('Draft config must be valid JSON.');
    return;
  }

  state.busy = true;
  resetBanner();
  render();
  try {
    await apiFetch('/admin/oem/brand', {
      method: 'PUT',
      body: JSON.stringify({
        brand_id: current.brandId,
        tenant_key: current.tenantKey,
        display_name: current.displayName,
        product_name: current.productName,
        status: current.status,
        draft_config: draftConfig,
      }),
    });
    await loadBrands();
    setNotice(`Draft saved for ${current.brandId}.`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Failed to save draft');
  } finally {
    state.busy = false;
    render();
  }
}

async function publishBrand() {
  const current = state.brandDetail?.brand;
  if (!current) {
    return;
  }

  state.busy = true;
  resetBanner();
  render();
  try {
    await apiFetch('/admin/oem/brand/publish', {
      method: 'POST',
      body: JSON.stringify({
        brand_id: current.brandId,
      }),
    });
    await loadBrands();
    setNotice(`Published ${current.brandId}.`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Failed to publish brand');
  } finally {
    state.busy = false;
    render();
  }
}

async function createBrand(formData) {
  const brandId = String(formData.get('brand_id') || '').trim().toLowerCase();
  const displayName = String(formData.get('display_name') || '').trim();
  const productName = String(formData.get('product_name') || '').trim();
  const tenantKey = String(formData.get('tenant_key') || brandId).trim();

  state.busy = true;
  resetBanner();
  render();
  try {
    await apiFetch('/admin/oem/brand', {
      method: 'PUT',
      body: JSON.stringify({
        brand_id: brandId,
        tenant_key: tenantKey,
        display_name: displayName,
        product_name: productName,
        status: 'draft',
      }),
    });
    await loadBrands();
    await loadBrandDetail(brandId);
    setNotice(`Created brand ${brandId}.`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Failed to create brand');
  } finally {
    state.busy = false;
    render();
  }
}

function renderBrandButtons() {
  return state.brands
    .map(
      (brand) => `
        <button class="brand-link${brand.brandId === state.selectedBrandId ? ' is-active' : ''}" data-brand-id="${escapeHtml(brand.brandId)}" type="button">
          <strong>${escapeHtml(brand.displayName)}</strong>
          <span>${escapeHtml(brand.brandId)} · v${brand.publishedVersion || 0}</span>
        </button>
      `,
    )
    .join('');
}

function renderSimpleList(items, renderer) {
  if (!items.length) {
    return '<div class="empty-state">Nothing yet.</div>';
  }
  return items.map(renderer).join('');
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-stage">
        <p class="eyebrow">OEM operations platform</p>
        <h1 class="login-title">Operate the OEM system from one place</h1>
        <p class="login-copy">
          This build uses the real control-plane auth and OEM APIs. Default bootstrap account: <strong>admin / admin</strong>.
        </p>
        <form class="login-card" id="login-form">
          <label class="field-label" for="identifier">Username</label>
          <input class="field-input" id="identifier" name="identifier" autocomplete="username" value="admin" />
          <label class="field-label" for="password">Password</label>
          <input class="field-input" id="password" name="password" type="password" autocomplete="current-password" value="admin" />
          <div class="banner banner-error"${state.error ? '' : ' hidden'}>${escapeHtml(state.error)}</div>
          <button class="login-submit" type="submit"${state.busy ? ' disabled' : ''}>
            ${state.busy ? 'Signing in...' : 'Enter control center'}
          </button>
        </form>
      </section>
    </main>
  `;

  document.querySelector('#login-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    authenticate(String(formData.get('identifier') || ''), String(formData.get('password') || ''));
  });
}

function renderDashboard() {
  const current = state.brandDetail?.brand || null;
  const publishedCount = state.brands.filter((item) => item.publishedVersion > 0).length;
  const draftCount = state.brands.length - publishedCount;

  app.innerHTML = `
    <main class="dashboard-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <span class="sidebar-brand__eyebrow">OEM</span>
          <strong>Control Center</strong>
          <p>${escapeHtml(state.user?.name || state.user?.username || 'admin')}</p>
        </div>

        <section class="sidebar-section">
          <p class="sidebar-section__title">Brands</p>
          <div class="brand-list">${renderBrandButtons()}</div>
        </section>

        <form class="create-card" id="create-brand-form">
          <p class="sidebar-section__title">New brand</p>
          <input class="field-input" name="brand_id" placeholder="brand id" />
          <input class="field-input" name="display_name" placeholder="display name" />
          <input class="field-input" name="product_name" placeholder="product name" />
          <input class="field-input" name="tenant_key" placeholder="tenant key (optional)" />
          <button class="sidebar-submit" type="submit"${state.busy ? ' disabled' : ''}>Create</button>
        </form>
      </aside>

      <section class="dashboard-content">
        <header class="dashboard-hero">
          <div>
            <p class="eyebrow">Single source of truth</p>
            <h1>OEM config is versioned and published from PostgreSQL</h1>
            <p class="hero-copy">
              Admin-web edits brand drafts, the control-plane snapshots published versions, and runtime surfaces consume the released config instead of hard-coded branches.
            </p>
          </div>
          <div class="hero-panel">
            <span class="hero-panel__label">API base</span>
            <strong>${escapeHtml(API_BASE_URL)}</strong>
            <p>Use this surface for brands, assets, skills, MCP bindings, and future release policies.</p>
          </div>
        </header>

        <section class="stats-grid">
          <article class="stat-card">
            <p>Brands</p>
            <strong>${state.brands.length}</strong>
            <span>Total OEM tenants in the registry.</span>
          </article>
          <article class="stat-card">
            <p>Published</p>
            <strong>${publishedCount}</strong>
            <span>Brands with released config snapshots.</span>
          </article>
          <article class="stat-card">
            <p>Drafting</p>
            <strong>${draftCount}</strong>
            <span>Brands still being edited in draft mode.</span>
          </article>
        </section>

        <div class="banner banner-error"${state.error ? '' : ' hidden'}>${escapeHtml(state.error)}</div>
        <div class="banner banner-success"${state.notice ? '' : ' hidden'}>${escapeHtml(state.notice)}</div>

        ${
          current
            ? `
          <section class="editor-grid">
            <article class="panel panel-meta">
              <div class="panel-head">
                <h2>${escapeHtml(current.displayName)}</h2>
                <span>${escapeHtml(current.brandId)}</span>
              </div>
              <div class="meta-grid">
                <div class="meta-row"><span>Tenant</span><strong>${escapeHtml(current.tenantKey)}</strong></div>
                <div class="meta-row"><span>Product</span><strong>${escapeHtml(current.productName)}</strong></div>
                <div class="meta-row"><span>Status</span><strong>${escapeHtml(current.status)}</strong></div>
                <div class="meta-row"><span>Published version</span><strong>v${current.publishedVersion || 0}</strong></div>
              </div>
              <div class="panel-actions">
                <button class="action-button" id="save-draft-button" type="button"${state.busy ? ' disabled' : ''}>Save draft</button>
                <button class="action-button action-button--solid" id="publish-brand-button" type="button"${state.busy ? ' disabled' : ''}>Publish</button>
              </div>
            </article>

            <article class="panel panel-editor">
              <div class="panel-head">
                <h2>Draft JSON</h2>
                <span>surfaces, skills, MCP, assets</span>
              </div>
              <textarea class="json-editor" id="json-editor">${escapeHtml(state.editorText)}</textarea>
            </article>
          </section>

          <section class="panel-grid">
            <article class="panel">
              <div class="panel-head">
                <h2>Versions</h2>
                <span>published snapshots</span>
              </div>
              <div class="list-stack">
                ${renderSimpleList(
                  state.brandDetail?.versions || [],
                  (item) => `
                    <div class="list-row">
                      <strong>v${item.version}</strong>
                      <span>${escapeHtml(new Date(item.publishedAt).toLocaleString())}</span>
                    </div>
                  `,
                )}
              </div>
            </article>

            <article class="panel">
              <div class="panel-head">
                <h2>Assets</h2>
                <span>metadata rows</span>
              </div>
              <div class="list-stack">
                ${renderSimpleList(
                  state.brandDetail?.assets || [],
                  (item) => `
                    <div class="list-row">
                      <strong>${escapeHtml(item.assetKey)}</strong>
                      <span>${escapeHtml(item.storageProvider)} · ${escapeHtml(item.objectKey)}</span>
                    </div>
                  `,
                )}
              </div>
            </article>

            <article class="panel panel-wide">
              <div class="panel-head">
                <h2>Audit</h2>
                <span>operator trace</span>
              </div>
              <div class="list-stack">
                ${renderSimpleList(
                  state.brandDetail?.audit || [],
                  (item) => `
                    <div class="list-row">
                      <strong>${escapeHtml(item.action)}</strong>
                      <span>${escapeHtml(new Date(item.createdAt).toLocaleString())}</span>
                    </div>
                  `,
                )}
              </div>
            </article>
          </section>
        `
            : `
          <section class="panel panel-empty">
            <h2>No brands yet</h2>
            <p>Create the first OEM brand from the sidebar form.</p>
          </section>
        `
        }
      </section>
    </main>
  `;

  document.querySelectorAll('[data-brand-id]').forEach((node) => {
    node.addEventListener('click', () => {
      loadBrandDetail(node.getAttribute('data-brand-id') || '');
    });
  });

  document.querySelector('#create-brand-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    createBrand(new FormData(event.currentTarget));
  });

  document.querySelector('#json-editor')?.addEventListener('input', (event) => {
    state.editorText = event.currentTarget.value;
  });

  document.querySelector('#save-draft-button')?.addEventListener('click', () => {
    saveDraft();
  });

  document.querySelector('#publish-brand-button')?.addEventListener('click', () => {
    publishBrand();
  });
}

function render() {
  if (state.view === 'dashboard') {
    renderDashboard();
    return;
  }
  renderLogin();
}

render();
ensureSession();
