export interface GraphQueryIntentInput {
  question: string;
  selectedNodeLabel?: string | null;
}

export interface GraphQueryIntent {
  shouldUseGraph: boolean;
  useDfs: boolean;
  budget: number;
  rewrittenQuestion: string;
  reason: 'path' | 'flow' | 'node_focus' | 'graph_terms' | 'fallback_text';
}

function normalizeText(value: string | null | undefined, maxLength = 1000): string {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function buildNodeFocusedQuestion(question: string, selectedNodeLabel: string | null): string {
  const normalizedQuestion = normalizeText(question, 600);
  const normalizedNode = normalizeText(selectedNodeLabel, 160);
  if (!normalizedNode) {
    return normalizedQuestion;
  }
  if (normalizedQuestion.includes(normalizedNode)) {
    return normalizedQuestion;
  }
  return `围绕节点「${normalizedNode}」回答：${normalizedQuestion}`;
}

export function classifyGraphQueryIntent(input: GraphQueryIntentInput): GraphQueryIntent {
  const question = normalizeText(input.question, 600);
  const selectedNodeLabel = normalizeText(input.selectedNodeLabel, 160);
  const normalized = question.toLowerCase();

  const pathLike =
    /(connect|path|relation|related|dependency|dependencies|what connects|how connected|shortest)/i.test(question) ||
    /(连接|路径|关系|关联|依赖|链路|相互作用|怎么连|怎么关联|什么连接)/.test(question);
  if (pathLike) {
    return {
      shouldUseGraph: true,
      useDfs: true,
      budget: 1800,
      rewrittenQuestion: buildNodeFocusedQuestion(question, selectedNodeLabel),
      reason: 'path',
    };
  }

  const flowLike =
    /(flow|process|pipeline|journey|auth flow|call flow|call chain)/i.test(question) ||
    /(流程|过程|管线|调用链|调用流程|链条|路径图)/.test(question);
  if (flowLike) {
    return {
      shouldUseGraph: true,
      useDfs: false,
      budget: 1800,
      rewrittenQuestion: buildNodeFocusedQuestion(question, selectedNodeLabel),
      reason: 'flow',
    };
  }

  const graphTerms =
    /(graph|node|edge|community|evidence|neighbor|neighbour|cluster)/i.test(question) ||
    /(图谱|节点|边|社区|证据|邻居|子图|聚类)/.test(question);
  if (graphTerms) {
    return {
      shouldUseGraph: true,
      useDfs: false,
      budget: 1400,
      rewrittenQuestion: buildNodeFocusedQuestion(question, selectedNodeLabel),
      reason: 'graph_terms',
    };
  }

  if (selectedNodeLabel) {
    return {
      shouldUseGraph: true,
      useDfs: false,
      budget: 1200,
      rewrittenQuestion: buildNodeFocusedQuestion(question, selectedNodeLabel),
      reason: 'node_focus',
    };
  }

  return {
    shouldUseGraph: false,
    useDfs: false,
    budget: 1200,
    rewrittenQuestion: question,
    reason: 'fallback_text',
  };
}
