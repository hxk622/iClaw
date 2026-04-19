import type { ComponentType } from 'react';
import {
  Brain,
  FileText,
  Link2,
  Network,
  Sparkles,
} from 'lucide-react';
import type { RawMaterial } from './types';
import type { GraphifyDocumentViewModel, OntologyDocument } from './ontology-types';
import type { OutputArtifact } from './output-types';

export type KnowledgeLibraryTab = 'materials' | 'graph' | 'artifacts';
export type GraphViewMode = 'page' | 'graph';

export type KnowledgeLibraryItem = {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  tags: string[];
  icon: ComponentType<{ className?: string }>;
  meta: string;
  bodyText?: string;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  rawMaterial?: RawMaterial | null;
  ontologyDocument?: OntologyDocument | null;
  ontologyGraphView?: GraphifyDocumentViewModel | null;
  outputArtifact?: OutputArtifact | null;
};

export const KNOWLEDGE_LIBRARY_TAB_CONFIG: Array<{
  id: KnowledgeLibraryTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: 'materials', label: 'Raw / 素材', icon: FileText },
  { id: 'graph', label: 'Ontology / 本体图谱', icon: Network },
  { id: 'artifacts', label: 'Output / 成果', icon: Sparkles },
];

const STATIC_KNOWLEDGE_LIBRARY_ITEMS: Record<'graph', KnowledgeLibraryItem[]> = {
  graph: [
    {
      id: 'graph-1',
      title: '宏观资产轮动子图',
      subtitle: '图谱聚类 · 42 个节点',
      summary: '围绕利率、通胀、美元、黄金和债券构建的局部知识图谱，可查看关系线和证据来源。',
      tags: ['宏观', '图谱', '关系'],
      icon: Network,
      meta: 'AI 于 20 分钟前编译',
    },
    {
      id: 'graph-2',
      title: 'VC/PE 平台型项目图谱',
      subtitle: '人物 / 方法 / 案例',
      summary: '将朱啸虎、沈南鹏、彼得·蒂尔等人物方法论与平台型项目案例做关系连接。',
      tags: ['VC/PE', '人物', '平台'],
      icon: Brain,
      meta: '昨天 18:06',
    },
    {
      id: 'graph-3',
      title: '消费核心资产图谱',
      subtitle: '主题页 · 28 个关系',
      summary: '由 Raw 输入自动编译出的消费与公募基金图谱，聚焦品牌、现金流和长期持有逻辑。',
      tags: ['消费', '公募', '核心资产'],
      icon: Link2,
      meta: '今天 11:07',
    },
  ],
};

export function getStaticKnowledgeLibraryItems(tab: 'graph'): KnowledgeLibraryItem[] {
  return STATIC_KNOWLEDGE_LIBRARY_ITEMS[tab];
}

export function getKnowledgeLibraryPanelTitle(tab: KnowledgeLibraryTab): string {
  switch (tab) {
    case 'materials':
      return '素材详情';
    case 'graph':
      return '本体图谱视图';
    case 'artifacts':
      return '成果详情';
  }
}

export function getKnowledgeLibraryPanelDescription(tab: KnowledgeLibraryTab): string {
  switch (tab) {
    case 'materials':
      return '原始资料、Clip 和对话沉淀会先进入素材层，再被 AI 编译进图谱。';
    case 'graph':
      return '本体图谱层展示结构化关系，可切换查看页面化内容、节点关系和局部子图。';
    case 'artifacts':
      return '成果层展示人机共创的专家、Memo 和可分发内容，这些内容也会持续反哺图谱。';
  }
}
