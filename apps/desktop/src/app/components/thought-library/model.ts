import type { ComponentType } from 'react';
import {
  BookOpen,
  Brain,
  FileText,
  Globe,
  Link2,
  Mic,
  Network,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react';

export type ThoughtLibraryTab = 'materials' | 'graph' | 'artifacts';
export type GraphViewMode = 'page' | 'graph';

export type ThoughtLibraryItem = {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  tags: string[];
  icon: ComponentType<{ className?: string }>;
  meta: string;
};

export const THOUGHT_LIBRARY_TAB_CONFIG: Array<{
  id: ThoughtLibraryTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: 'materials', label: '素材', icon: FileText },
  { id: 'graph', label: '图谱', icon: Network },
  { id: 'artifacts', label: '成果', icon: Sparkles },
];

export const THOUGHT_LIBRARY_ITEMS: Record<ThoughtLibraryTab, ThoughtLibraryItem[]> = {
  materials: [
    {
      id: 'material-1',
      title: '桥水研究纪要 2026Q1',
      subtitle: '本地上传 · PDF',
      summary: '桥水关于利率、通胀与资产轮动的季度研究材料，包含多张大类资产框架图。',
      tags: ['宏观', '桥水', '资产配置'],
      icon: Upload,
      meta: '2 小时前导入',
    },
    {
      id: 'material-2',
      title: 'AI 芯片产业链 Clip',
      subtitle: '浏览器 Clip · Snippet',
      summary: '从网页中滑选保存的摘要片段，聚焦国产算力芯片供应链与资本开支节奏。',
      tags: ['Clip', '芯片', '成长'],
      icon: Globe,
      meta: '昨天 21:14',
    },
    {
      id: 'material-3',
      title: '关于霍华德·马克斯的对话沉淀',
      subtitle: 'AI 对话 · 12 条消息',
      summary: '围绕周期摆钟、第二层思维和风险定价的多轮对话，已抽取成若干候选知识卡。',
      tags: ['对话', '周期', '风险'],
      icon: Sparkles,
      meta: '今天 09:32',
    },
    {
      id: 'material-4',
      title: '播客转写：杰弗里·冈拉克',
      subtitle: '语音转写 · 38 分钟',
      summary: '来自债券与宏观访谈的全文转写，适合作为固收视角补充原料。',
      tags: ['固收', '播客', '债券'],
      icon: Mic,
      meta: '3 天前',
    },
  ],
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
  artifacts: [
    {
      id: 'output-1',
      title: '张磊',
      subtitle: '专家 · 已发布给粉丝',
      summary: '高瓴风格的长期主义与产业研究专家，已连接到图谱中的私募与产业节点。',
      tags: ['专家', '私募', '分享'],
      icon: WandSparkles,
      meta: '昨天 23:14',
    },
    {
      id: 'output-2',
      title: '债券配置研究 Memo',
      subtitle: 'Artifact · 可继续二创',
      summary: '基于固收 Raw 和 Graph 子图生成的研究备忘录，可继续对外改写或喂给专家。',
      tags: ['Memo', '债券', '成果'],
      icon: FileText,
      meta: '今天 10:08',
    },
    {
      id: 'output-3',
      title: '黄金避险卡片组',
      subtitle: '卡片 · 已分享',
      summary: '从黄金相关人物与宏观图谱中衍生出的卡片式内容，用于对外传播和粉丝教育。',
      tags: ['黄金', '卡片', '分享'],
      icon: BookOpen,
      meta: '2 天前',
    },
  ],
};

export function getThoughtLibraryItems(tab: ThoughtLibraryTab): ThoughtLibraryItem[] {
  return THOUGHT_LIBRARY_ITEMS[tab];
}

export function getThoughtLibraryPanelTitle(tab: ThoughtLibraryTab): string {
  switch (tab) {
    case 'materials':
      return '素材详情';
    case 'graph':
      return '图谱视图';
    case 'artifacts':
      return '成果详情';
  }
}

export function getThoughtLibraryPanelDescription(tab: ThoughtLibraryTab): string {
  switch (tab) {
    case 'materials':
      return '原始资料、Clip 和对话沉淀会先进入素材层，再被 AI 编译进图谱。';
    case 'graph':
      return '图谱层展示结构化关系，可切换查看页面化内容、节点关系和局部子图。';
    case 'artifacts':
      return '成果层展示人机共创的专家、Memo 和可分发内容，这些内容也会持续反哺图谱。';
  }
}
