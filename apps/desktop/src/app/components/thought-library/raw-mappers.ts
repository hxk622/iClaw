import { FileAudio, FileText, Globe, Image as ImageIcon, Link2, Mic, Sparkles, Upload, Video } from 'lucide-react';
import type { ComponentType } from 'react';
import type { ThoughtLibraryItem } from './model';
import type { RawMaterial } from './types';

function formatRelativeTime(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return '刚刚';
  const diffSeconds = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
  if (diffSeconds < 60) return '刚刚';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} 分钟前`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} 小时前`;
  return `${Math.floor(diffSeconds / 86400)} 天前`;
}

function resolveIcon(raw: RawMaterial): ComponentType<{ className?: string }> {
  if (raw.kind === 'source' || raw.kind === 'url') return raw.source_type === 'video' ? Video : Globe;
  if (raw.kind === 'snippet') return raw.source_type === 'video' ? Video : Link2;
  if (raw.kind === 'transcript') return Mic;
  if (raw.kind === 'chat') return Sparkles;
  if (raw.source_type === 'pdf') return FileText;
  if (raw.source_type === 'image') return ImageIcon;
  if (raw.source_type === 'audio') return FileAudio;
  return Upload;
}

function buildSubtitle(raw: RawMaterial): string {
  if (raw.kind === 'source' || raw.kind === 'url') {
    return `页面保存 · ${raw.source_name}`;
  }
  if (raw.kind === 'snippet') {
    return raw.timestamp_label ? `划词摘录 · ${raw.source_name} · ${raw.timestamp_label}` : `划词摘录 · ${raw.source_name}`;
  }
  if (raw.kind === 'transcript') {
    return `转写素材 · ${raw.source_name}`;
  }
  if (raw.kind === 'chat') {
    return `对话沉淀 · ${raw.source_name}`;
  }
  if (raw.kind === 'upload') {
    return `本地上传 · ${raw.mime_type || raw.source_type || '文件'}`;
  }
  return `${raw.source_name} · ${raw.source_type}`;
}

function buildSummary(raw: RawMaterial): string {
  return raw.excerpt || raw.content_text.replace(/\s+/g, ' ').trim().slice(0, 180) || '暂无摘要';
}

function buildTags(raw: RawMaterial): string[] {
  const tags = [...(raw.tags || [])];
  if (raw.kind === 'upload' && !tags.includes('上传')) tags.unshift('上传');
  if (raw.kind === 'snippet' && !tags.includes('摘录')) tags.unshift('摘录');
  if (raw.kind === 'source' && !tags.includes('网页')) tags.unshift('网页');
  if (raw.source_type === 'pdf' && !tags.includes('PDF')) tags.push('PDF');
  if (raw.source_type === 'video' && !tags.includes('视频')) tags.push('视频');
  return Array.from(new Set(tags)).slice(0, 4);
}

export function mapRawMaterialToThoughtLibraryItem(raw: RawMaterial): ThoughtLibraryItem {
  return {
    id: raw.id,
    title: raw.title,
    subtitle: buildSubtitle(raw),
    summary: buildSummary(raw),
    tags: buildTags(raw),
    icon: resolveIcon(raw),
    meta: `${formatRelativeTime(raw.updated_at)}导入`,
    bodyText: raw.content_text,
    sourceUrl: raw.source_url,
    sourceLabel: raw.source_name,
    rawMaterial: raw,
  };
}
