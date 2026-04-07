export function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value;
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function deepMerge(...items) {
  const result = {};
  for (const item of items) {
    const source = asObject(item);
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function defaultTemplateKeyForBrand(brandId) {
  return brandId === 'licaiclaw' ? 'wealth-premium' : 'classic-download';
}

export function normalizeTemplateKey(value, brandId) {
  const normalized = trimString(value);
  if (normalized) {
    return normalized;
  }
  return defaultTemplateKeyForBrand(brandId);
}

export function normalizeBaseUrl(value) {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

export function normalizePublicReleaseVersion(value) {
  return typeof value === 'string' ? value.trim().replace(/\+/g, '.') : '';
}

export function buildDownloadHref(runtimeBrand, envName, arch) {
  const baseUrl = normalizeBaseUrl(runtimeBrand.distribution.downloads?.[envName]?.publicBaseUrl);
  if (!baseUrl) {
    return '';
  }
  const publicReleaseVersion = normalizePublicReleaseVersion(runtimeBrand.release.version);
  const fileName = `${runtimeBrand.release.artifactBaseName}_${publicReleaseVersion}_${arch}_${envName}.dmg`;
  return `${baseUrl}/darwin/${arch}/${encodeURIComponent(fileName)}`;
}

export function buildDownloads(runtimeBrand, envName) {
  return [
    {
      key: 'mac-apple-silicon',
      title: envName === 'prod' ? 'Mac Apple Silicon' : 'Mac Apple Silicon (dev)',
      href: buildDownloadHref(runtimeBrand, envName, 'aarch64'),
      note: envName === 'prod' ? 'M 系列芯片 · 正式版' : 'M 系列芯片 · 开发版',
      icon: '⬢',
      tone: 'cyan',
    },
    {
      key: 'mac-intel',
      title: envName === 'prod' ? 'Mac Intel' : 'Mac Intel (dev)',
      href: buildDownloadHref(runtimeBrand, envName, 'x64'),
      note: envName === 'prod' ? 'Intel 芯片 · 正式版' : 'Intel 芯片 · 开发版',
      icon: '◆',
      tone: 'violet',
    },
    {key: 'windows', title: 'Windows', href: '', note: '敬请期待', icon: '▣', tone: 'amber'},
    {key: 'ios', title: 'iOS', href: '', note: '敬请期待', icon: '◉', tone: 'cyan'},
    {key: 'android', title: 'Android', href: '', note: '敬请期待', icon: '△', tone: 'violet'},
  ].map((item) => ({
    ...item,
    status: item.href ? 'ready' : 'soon',
  }));
}

export function getPage(runtimeBrand, pageKey = 'home') {
  return asArray(runtimeBrand.marketingSite.pages).find((item) => trimString(item.pageKey) === pageKey) || null;
}

export function getEnabledBlocks(page) {
  return asArray(page?.blocks)
    .map((item) => asObject(item))
    .filter((item) => trimString(item.blockKey) && item.enabled !== false)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}

export function findBlock(page, predicate) {
  return getEnabledBlocks(page).find(predicate) || null;
}

export function renderFooterLinks(columns) {
  return asArray(columns)
    .map((column) => {
      const title = trimString(asObject(column).title);
      const links = asArray(asObject(column).links);
      if (!title && links.length === 0) {
        return '';
      }
      return `
        <div class="site-footer__column">
          ${title ? `<h4>${escapeHtml(title)}</h4>` : ''}
          <div class="site-footer__links">
            ${links
              .map((link) => {
                const href = trimString(asObject(link).href) || '#';
                const label = trimString(asObject(link).label) || href;
                return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
              })
              .join('')}
          </div>
        </div>
      `;
    })
    .join('');
}
