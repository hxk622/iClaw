import {
  buildArtifactOpenActionLabel,
  extractArtifactExtension,
  resolveArtifactPreviewKind,
  type ArtifactPreviewKind,
} from './artifact-preview.ts';
import { buildArtifactWorkspaceNameCandidates } from './artifact-workspace-path.ts';

export type ArtifactPreviewSourceContext = {
  turnId: string | null;
  promptText: string | null;
  answerText: string | null;
  rawIds: string[];
  ontologyIds: string[];
};

export type ArtifactPreviewState = {
  title: string;
  path: string;
  kind: ArtifactPreviewKind;
  content: string | null;
  sizeBytes?: number | null;
  loading: boolean;
  error: string | null;
  openPath: string | null;
  actionLabel: string | null;
  actionError: string | null;
  sourceTurnId: string | null;
  sourcePromptText: string | null;
  sourceAnswerText: string | null;
  sourceRawIds: string[];
  sourceOntologyIds: string[];
};

export type ArtifactPreviewLoadInput = {
  path: string | null;
  inlineContent?: string | null;
  title?: string | null;
  source: ArtifactPreviewSourceContext;
};

export type ArtifactPreviewTextFileResult = {
  content: string;
};

export type ArtifactPreviewBinaryFileResult = {
  path: string;
  mimeType: string | null;
  base64: string;
  sizeBytes: number | null;
};

export type ArtifactPreviewResolvedPathResult = {
  path: string;
  sizeBytes: number | null;
};

export type ArtifactPreviewLoaderDeps = {
  getWorkspaceDir: () => Promise<string | null>;
  readTextFile: (name: string) => Promise<ArtifactPreviewTextFileResult | null>;
  readBinaryFile: (name: string) => Promise<ArtifactPreviewBinaryFileResult | null>;
  resolvePath: (name: string) => Promise<ArtifactPreviewResolvedPathResult | null>;
};

function createArtifactPreviewState(
  input: Omit<ArtifactPreviewState, 'actionError' | 'sourceTurnId' | 'sourcePromptText' | 'sourceAnswerText' | 'sourceRawIds' | 'sourceOntologyIds'>,
  source: ArtifactPreviewSourceContext,
): ArtifactPreviewState {
  return {
    ...input,
    actionError: null,
    sourceTurnId: source.turnId,
    sourcePromptText: source.promptText,
    sourceAnswerText: source.answerText,
    sourceRawIds: source.rawIds,
    sourceOntologyIds: source.ontologyIds,
  };
}

export function buildArtifactPreviewTitle(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  return segments.at(-1) ?? normalized;
}

function buildArtifactPathMatchCandidates(path: string | null | undefined): string[] {
  if (!path) {
    return [];
  }

  const normalized = path.replace(/\\/g, '/').trim();
  if (!normalized) {
    return [];
  }

  const candidates = new Set<string>();
  candidates.add(normalized);
  candidates.add(normalized.replace(/^\.\/+/, ''));
  candidates.add(normalized.replace(/^\/+/, ''));

  const workspaceIndex = normalized.toLowerCase().lastIndexOf('/workspace/');
  if (workspaceIndex >= 0) {
    candidates.add(normalized.slice(workspaceIndex + '/workspace/'.length));
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length > 0) {
    candidates.add(segments.at(-1) ?? normalized);
  }

  return Array.from(candidates).filter(Boolean);
}

export function areArtifactPathsEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  const aCandidates = buildArtifactPathMatchCandidates(a);
  const bCandidates = new Set(buildArtifactPathMatchCandidates(b));
  if (aCandidates.length === 0 || bCandidates.size === 0) {
    return false;
  }
  return aCandidates.some((candidate) => bCandidates.has(candidate));
}

export function buildArtifactPreviewLoadingState(input: ArtifactPreviewLoadInput): ArtifactPreviewState {
  const previewPath = input.path ?? 'artifact';
  const title = input.title?.trim() || buildArtifactPreviewTitle(previewPath);

  if (!input.path && input.inlineContent) {
    return createArtifactPreviewState(
      {
        title,
        path: previewPath,
        kind: 'text',
        content: input.inlineContent,
        sizeBytes: null,
        loading: false,
        error: null,
        openPath: null,
        actionLabel: null,
      },
      input.source,
    );
  }

  if (!input.path) {
    return createArtifactPreviewState(
      {
        title,
        path: previewPath,
        kind: 'unsupported',
        content: null,
        sizeBytes: null,
        loading: false,
        error: '未解析到制品文件路径，当前无法在右侧分屏展示真实内容。',
        openPath: null,
        actionLabel: null,
      },
      input.source,
    );
  }

  return createArtifactPreviewState(
    {
      title,
      path: input.path,
      kind: resolveArtifactPreviewKind(input.path),
      content: null,
      sizeBytes: null,
      loading: true,
      error: null,
      openPath: null,
      actionLabel: null,
    },
    input.source,
  );
}

export async function loadArtifactPreviewState(
  input: ArtifactPreviewLoadInput,
  deps: ArtifactPreviewLoaderDeps,
): Promise<ArtifactPreviewState> {
  const seed = buildArtifactPreviewLoadingState(input);
  if (!seed.loading) {
    return seed;
  }

  const workspaceDir = await deps.getWorkspaceDir();
  const path = input.path!;
  const title = seed.title;
  const previewKind = seed.kind;
  const nameCandidates = buildArtifactWorkspaceNameCandidates(path, workspaceDir);

  if (previewKind === 'pdf') {
    for (const candidateName of nameCandidates) {
      try {
        const result = await deps.readBinaryFile(candidateName);
        if (result?.base64) {
          return createArtifactPreviewState(
            {
              title,
              path: result.path || path,
              kind: previewKind,
              content: `data:${result.mimeType || 'application/pdf'};base64,${result.base64}`,
              sizeBytes: result.sizeBytes,
              loading: false,
              error: null,
              openPath: result.path || path,
              actionLabel: buildArtifactOpenActionLabel(result.path || path),
            },
            input.source,
          );
        }
      } catch {
        // Try the next candidate before surfacing a failure.
      }
    }

    return createArtifactPreviewState(
      {
        title,
        path,
        kind: previewKind,
        content: null,
        sizeBytes: null,
        loading: false,
        error: '已识别到 PDF 制品，但当前桌面端没有拿到可预览的二进制内容。',
        openPath: null,
        actionLabel: null,
      },
      input.source,
    );
  }

  if (previewKind === 'office') {
    for (const candidateName of nameCandidates) {
      try {
        const result = await deps.resolvePath(candidateName);
        if (result?.path) {
          return createArtifactPreviewState(
            {
              title,
              path: result.path,
              kind: previewKind,
              content: null,
              sizeBytes: result.sizeBytes,
              loading: false,
              error: null,
              openPath: result.path,
              actionLabel: buildArtifactOpenActionLabel(result.path),
            },
            input.source,
          );
        }
      } catch {
        // Try the next candidate before surfacing a failure.
      }
    }

    return createArtifactPreviewState(
      {
        title,
        path,
        kind: previewKind,
        content: null,
        sizeBytes: null,
        loading: false,
        error: '已识别到 Office 制品，但当前桌面端没有定位到可打开的原文件。',
        openPath: null,
        actionLabel: null,
      },
      input.source,
    );
  }

  if (previewKind === 'unsupported') {
    const extensionLabel = extractArtifactExtension(path)?.toUpperCase() ?? '该';
    for (const candidateName of nameCandidates) {
      try {
        const result = await deps.resolvePath(candidateName);
        if (result?.path) {
          return createArtifactPreviewState(
            {
              title,
              path: result.path,
              kind: previewKind,
              content: null,
              sizeBytes: null,
              loading: false,
              error: `暂不支持直接预览 ${extensionLabel} 文件。`,
              openPath: result.path,
              actionLabel: buildArtifactOpenActionLabel(result.path),
            },
            input.source,
          );
        }
      } catch {
        // Try the next candidate before surfacing a failure.
      }
    }

    return createArtifactPreviewState(
      {
        title,
        path,
        kind: previewKind,
        content: null,
        sizeBytes: null,
        loading: false,
        error: `暂不支持直接预览 ${extensionLabel} 文件。`,
        openPath: null,
        actionLabel: null,
      },
      input.source,
    );
  }

  for (const candidateName of nameCandidates) {
    try {
      const result = await deps.readTextFile(candidateName);
      if (typeof result?.content === 'string') {
        return createArtifactPreviewState(
          {
            title,
            path: candidateName,
            kind: previewKind,
            content: result.content,
            sizeBytes: null,
            loading: false,
            error: null,
            openPath: candidateName,
            actionLabel: null,
          },
          {
            ...input.source,
            answerText: input.source.answerText || result.content,
          },
        );
      }
    } catch {
      // Try the next candidate before surfacing a failure.
    }
  }

  return createArtifactPreviewState(
    {
      title,
      path,
      kind: previewKind,
      content: null,
      sizeBytes: null,
      loading: false,
      error: '已识别到制品文件，但没有从 OpenClaw workspace 读到对应文件内容。',
      openPath: null,
      actionLabel: null,
    },
    input.source,
  );
}
