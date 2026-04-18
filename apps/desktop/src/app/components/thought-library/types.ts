export type RawMaterialKind = 'source' | 'snippet' | 'upload' | 'transcript' | 'chat' | 'url';

export type RawMaterialSourceType = 'text' | 'video' | 'pdf' | 'image' | 'audio' | 'chat' | 'file';

export interface RawMaterial {
  id: string;
  kind: RawMaterialKind;
  title: string;
  excerpt: string;
  content_text: string;
  source_url: string | null;
  source_name: string;
  source_type: RawMaterialSourceType;
  source_icon: string | null;
  mime_type: string | null;
  timestamp_label: string | null;
  note: string | null;
  tags: string[];
  dedupe_key: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRawMaterialInput {
  kind: RawMaterialKind;
  title: string;
  excerpt?: string;
  content_text?: string;
  source_url?: string | null;
  source_name?: string;
  source_type?: RawMaterialSourceType;
  source_icon?: string | null;
  mime_type?: string | null;
  timestamp_label?: string | null;
  note?: string | null;
  tags?: string[];
  dedupe_key?: string;
}
