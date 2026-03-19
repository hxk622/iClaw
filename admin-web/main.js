import './styles.css';

const DEFAULT_CREDENTIALS = {
  username: 'admin',
  password: 'admin',
};

const modules = [
  {
    name: 'Brand Matrix',
    value: '12 live',
    note: 'Each brand can bind its own logo, app shell, skill bundle, store shelf, and release channel.',
  },
  {
    name: 'Skill + MCP',
    value: '84 routable',
    note: 'Operator-facing routing layer for enabling, pricing, whitelisting, and capability exposure.',
  },
  {
    name: 'Release Control',
    value: '3 rings',
    note: 'Draft, staged, and published configs with version snapshots and rollback points.',
  },
];

const brands = [
  {
    brand: 'LicaiClaw',
    product: 'Desktop wealth assistant',
    surface: 'Desktop, home-web, skill store',
    status: 'Published',
  },
  {
    brand: 'Hexun OEM',
    product: 'Media channel assistant',
    surface: 'Desktop, header slot, sidebar slot',
    status: 'Draft',
  },
  {
    brand: 'Partner Sandbox',
    product: 'Testing tenant',
    surface: 'Skill shelf, MCP whitelist',
    status: 'Staging',
  },
];

const workstreams = [
  {
    title: 'Tenant and Auth',
    body: 'Move from bootstrap login to tenant-aware SSO, RBAC, environment scopes, and operation audit logs.',
  },
  {
    title: 'Config Publish',
    body: 'Store draft and published snapshots in PostgreSQL, then deliver immutable asset files from MinIO.',
  },
  {
    title: 'Capability Graph',
    body: 'Map brands to skills, MCP servers, surfaces, quotas, menus, and release channels without code edits.',
  },
  {
    title: 'Release Runtime',
    body: 'Desktop and web read a published config package, not scattered env flags or hard-coded brand branches.',
  },
];

const sidebarItems = ['Overview', 'Brands', 'Skills & MCP', 'Assets', 'Releases', 'Audit'];

const app = document.querySelector('#app');

if (!app) {
  throw new Error('admin-web mount failed');
}

let authState = {
  username: '',
  password: '',
  error: '',
  authenticated: false,
};

function create(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (typeof text === 'string') {
    node.textContent = text;
  }
  return node;
}

function renderLogin() {
  const root = create('main', 'login-shell');
  const stage = create('section', 'login-stage');
  const badge = create('div', 'eyebrow', 'OEM operations platform');
  const title = create('h1', 'login-title', 'Control the brand system from one surface');
  const body = create(
    'p',
    'login-copy',
    'This bootstrap version is frontend-only. Use admin / admin to enter the control center and validate the information architecture.',
  );
  const form = create('form', 'login-card');
  const meta = create('div', 'login-meta');
  meta.innerHTML = '<span>Default user: <strong>admin</strong></span><span>Default password: <strong>admin</strong></span>';

  const usernameLabel = create('label', 'field-label', 'Username');
  const username = create('input', 'field-input');
  username.name = 'username';
  username.autocomplete = 'username';
  username.value = authState.username;

  const passwordLabel = create('label', 'field-label', 'Password');
  const password = create('input', 'field-input');
  password.name = 'password';
  password.type = 'password';
  password.autocomplete = 'current-password';
  password.value = authState.password;

  const error = create('div', 'login-error', authState.error);
  if (!authState.error) {
    error.hidden = true;
  }

  const submit = create('button', 'login-submit', 'Enter control center');
  submit.type = 'submit';

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    authState.username = username.value.trim();
    authState.password = password.value;

    if (
      authState.username === DEFAULT_CREDENTIALS.username &&
      authState.password === DEFAULT_CREDENTIALS.password
    ) {
      authState.error = '';
      authState.authenticated = true;
      render();
      return;
    }

    authState.error = 'Invalid credentials. Use admin / admin for the bootstrap environment.';
    render();
  });

  form.append(usernameLabel, username, passwordLabel, password, error, submit);
  stage.append(badge, title, body, meta, form);
  root.append(stage);
  app.replaceChildren(root);
}

function renderDashboard() {
  const root = create('main', 'dashboard-shell');
  const sidebar = create('aside', 'sidebar');
  const brand = create('div', 'sidebar-brand');
  brand.innerHTML = '<span class="sidebar-brand__eyebrow">OEM</span><strong>Control Center</strong>';
  sidebar.append(brand);

  const nav = create('nav', 'sidebar-nav');
  sidebarItems.forEach((item, index) => {
    const link = create('button', `sidebar-link${index === 0 ? ' is-active' : ''}`, item);
    link.type = 'button';
    nav.append(link);
  });
  sidebar.append(nav);

  const content = create('section', 'dashboard-content');
  const hero = create('header', 'dashboard-hero');
  hero.innerHTML = `
    <div>
      <p class="eyebrow">Single source of truth</p>
      <h1>OEM brands, skills, assets, and release policies</h1>
      <p class="hero-copy">
        PostgreSQL should own metadata and publish snapshots. MinIO should own binary assets and branded media. Clients should only consume published config bundles.
      </p>
    </div>
    <div class="hero-panel">
      <span class="hero-panel__label">Bootstrap auth</span>
      <strong>admin</strong>
      <p>Replace with RBAC and environment-bound identities before production.</p>
    </div>
  `;

  const stats = create('section', 'stats-grid');
  modules.forEach((item) => {
    const card = create('article', 'stat-card');
    card.innerHTML = `<p>${item.name}</p><strong>${item.value}</strong><span>${item.note}</span>`;
    stats.append(card);
  });

  const matrix = create('section', 'panel-grid');
  const brandPanel = create('article', 'panel');
  brandPanel.innerHTML = `
    <div class="panel-head">
      <h2>Brand rollout matrix</h2>
      <span>Surface aware</span>
    </div>
    <div class="table table-brands"></div>
  `;

  const brandTable = brandPanel.querySelector('.table-brands');
  brands.forEach((row) => {
    const item = create('div', 'table-row');
    item.innerHTML = `
      <div>
        <strong>${row.brand}</strong>
        <span>${row.product}</span>
      </div>
      <div>${row.surface}</div>
      <div><span class="status-pill status-${row.status.toLowerCase()}">${row.status}</span></div>
    `;
    brandTable?.append(item);
  });

  const streamPanel = create('article', 'panel');
  streamPanel.innerHTML = `
    <div class="panel-head">
      <h2>Architecture focus</h2>
      <span>Next buildout</span>
    </div>
    <div class="stream-list"></div>
  `;

  const streamList = streamPanel.querySelector('.stream-list');
  workstreams.forEach((item) => {
    const block = create('div', 'stream-item');
    block.innerHTML = `<strong>${item.title}</strong><p>${item.body}</p>`;
    streamList?.append(block);
  });

  const publishPanel = create('article', 'panel panel-wide');
  publishPanel.innerHTML = `
    <div class="panel-head">
      <h2>Suggested data flow</h2>
      <span>Metadata in PG, files in MinIO</span>
    </div>
    <ol class="flow-list">
      <li>Operator edits draft brand, surface, skill, and MCP bindings in admin-web.</li>
      <li>Control plane writes normalized config rows and version snapshots into PostgreSQL.</li>
      <li>Generated assets and export bundles are stored in MinIO with immutable object keys.</li>
      <li>Desktop, home-web, and future surfaces fetch only the published version for their brand and channel.</li>
    </ol>
  `;

  matrix.append(brandPanel, streamPanel, publishPanel);
  content.append(hero, stats, matrix);
  root.append(sidebar, content);
  app.replaceChildren(root);
}

function render() {
  if (authState.authenticated) {
    renderDashboard();
    return;
  }
  renderLogin();
}

render();
