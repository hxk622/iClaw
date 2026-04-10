function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/').trim();
}

function trimWorkspaceAnchor(value: string): string | null {
  const normalized = normalizeSlashes(value);
  const marker = '/workspace/';
  const index = normalized.toLowerCase().lastIndexOf(marker);
  if (index === -1) {
    return null;
  }
  return normalized.slice(index + marker.length).trim() || null;
}

export function buildArtifactWorkspaceNameCandidates(path: string, workspaceDir: string | null): string[] {
  const normalizedPath = normalizeSlashes(path);
  const normalizedWorkspace = workspaceDir ? normalizeSlashes(workspaceDir).replace(/\/+$/, '') : null;
  const candidates = new Set<string>();

  if (normalizedWorkspace && normalizedPath.startsWith(`${normalizedWorkspace}/`)) {
    candidates.add(normalizedPath.slice(normalizedWorkspace.length + 1));
  }

  const workspaceAnchoredPath = trimWorkspaceAnchor(normalizedPath);
  if (workspaceAnchoredPath) {
    candidates.add(workspaceAnchoredPath);
  }

  if (normalizedPath.startsWith('./')) {
    candidates.add(normalizedPath.slice(2));
  }
  if (normalizedPath.startsWith('~/')) {
    candidates.add(normalizedPath.slice(2));
  }

  candidates.add(normalizedPath);
  candidates.add(normalizedPath.replace(/^\/+/, ''));

  return Array.from(candidates)
    .map((candidate) => normalizeSlashes(candidate))
    .filter((candidate) => Boolean(candidate) && candidate !== '.');
}
