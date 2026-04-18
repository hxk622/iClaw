export type ArtifactPreviewKind = 'html' | 'markdown' | 'text' | 'pdf' | 'office' | 'unsupported';

const ARTIFACT_PREVIEW_HTML_EXTENSIONS = new Set(['html', 'htm']);
const ARTIFACT_PREVIEW_MARKDOWN_EXTENSIONS = new Set(['md', 'markdown']);
const ARTIFACT_PREVIEW_TEXT_EXTENSIONS = new Set([
  'txt',
  'text',
  'json',
  'js',
  'jsx',
  'ts',
  'tsx',
  'css',
  'scss',
  'less',
  'xml',
  'yml',
  'yaml',
  'csv',
  'tsv',
  'sql',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'sh',
  'bash',
  'zsh',
  'c',
  'cc',
  'cpp',
  'h',
  'hpp',
  'vue',
  'svelte',
  'mdx',
]);
const ARTIFACT_PREVIEW_OFFICE_EXTENSIONS = new Set([
  'ppt',
  'pptx',
  'key',
  'doc',
  'docx',
  'xls',
  'xlsx',
]);

export function extractArtifactExtension(path: string | null): string | null {
  if (!path) {
    return null;
  }
  const match = /\.([a-z0-9]+)$/i.exec(path.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

export function resolveArtifactPreviewKind(path: string | null): ArtifactPreviewKind {
  const extension = extractArtifactExtension(path);
  if (!extension) {
    return 'text';
  }
  if (extension === 'pdf') {
    return 'pdf';
  }
  if (ARTIFACT_PREVIEW_HTML_EXTENSIONS.has(extension)) {
    return 'html';
  }
  if (ARTIFACT_PREVIEW_MARKDOWN_EXTENSIONS.has(extension)) {
    return 'markdown';
  }
  if (ARTIFACT_PREVIEW_TEXT_EXTENSIONS.has(extension)) {
    return 'text';
  }
  if (ARTIFACT_PREVIEW_OFFICE_EXTENSIONS.has(extension)) {
    return 'office';
  }
  return 'unsupported';
}

export function buildArtifactOpenActionLabel(path: string | null): string {
  const extension = extractArtifactExtension(path);
  switch (extension) {
    case 'pdf':
      return '打开 PDF 原文件';
    case 'ppt':
    case 'pptx':
    case 'key':
      return '打开演示文件';
    case 'xls':
    case 'xlsx':
      return '打开表格文件';
    case 'doc':
    case 'docx':
      return '打开文档文件';
    default:
      return '打开原文件';
  }
}
