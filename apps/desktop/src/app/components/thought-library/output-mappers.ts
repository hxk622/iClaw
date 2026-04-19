import { FileText, Presentation, Sparkles, StickyNote } from 'lucide-react';
import type { ThoughtLibraryItem } from './model';
import type { OutputArtifact } from './output-types';

function formatRelativeTime(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return '刚刚';
  const diffSeconds = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
  if (diffSeconds < 60) return '刚刚';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} 分钟前`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} 小时前`;
  return `${Math.floor(diffSeconds / 86400)} 天前`;
}

function resolveIcon(type: OutputArtifact['type']) {
  switch (type) {
    case 'memo':
      return StickyNote;
    case 'ppt':
      return Presentation;
    case 'expert':
      return Sparkles;
    default:
      return FileText;
  }
}

function subtitle(type: OutputArtifact['type']) {
  switch (type) {
    case 'memo':
      return 'Memo · 草稿';
    case 'wechat_post':
      return '公众号内容 · 草稿';
    case 'xhs_post':
      return '小红书内容 · 草稿';
    case 'ppt':
      return 'PPT · 草稿';
    case 'doc':
      return 'Doc · 草稿';
    default:
      return '成果件 · 草稿';
  }
}

export function mapOutputArtifactToThoughtLibraryItem(artifact: OutputArtifact): ThoughtLibraryItem {
  return {
    id: artifact.id,
    title: artifact.title,
    subtitle: subtitle(artifact.type),
    summary: artifact.summary,
    tags: [artifact.type, artifact.status, ...(artifact.publish_targets || [])].filter(Boolean).slice(0, 4),
    icon: resolveIcon(artifact.type),
    meta: `${formatRelativeTime(artifact.updated_at)}生成`,
    bodyText: artifact.content,
    outputArtifact: artifact,
  };
}
