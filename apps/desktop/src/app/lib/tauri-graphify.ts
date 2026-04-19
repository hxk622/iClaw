import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './desktop-runtime.ts';

export type GraphifyCorpusItem = {
  id: string;
  kind: 'raw' | 'output';
  title: string;
  content: string;
  metadata?: Record<string, unknown> | null;
};

export type GraphifyCompileRequest = {
  corpusLabel: string;
  items: GraphifyCorpusItem[];
  update?: boolean;
  noViz?: boolean;
};

export type GraphifyCompileResult = {
  backend: 'graphify-v3-cli';
  available: boolean;
  executable: string | null;
  corpusDir: string;
  outputDir: string | null;
  graphJsonPath: string | null;
  graphJsonText: string | null;
  reportPath: string | null;
  reportText: string | null;
  htmlPath: string | null;
  stdout: string | null;
  stderr: string | null;
  error: string | null;
};

export type GraphifyQueryRequest = {
  graphPath: string;
  question: string;
  useDfs?: boolean;
  budget?: number;
};

export type GraphifyQueryResult = {
  backend: 'graphify-v3-cli';
  available: boolean;
  executable: string | null;
  graphPath: string;
  question: string;
  stdout: string | null;
  stderr: string | null;
  error: string | null;
};

export type GraphifySaveResultRequest = {
  graphPath: string;
  question: string;
  answer: string;
  queryType?: 'query' | 'path_query' | 'explain';
  sourceNodes?: string[];
};

export type GraphifySaveResultResult = {
  backend: 'graphify-v3-cli';
  available: boolean;
  executable: string | null;
  graphPath: string;
  savedPath: string | null;
  stdout: string | null;
  stderr: string | null;
  error: string | null;
};

export async function runGraphifyCompile(
  input: GraphifyCompileRequest,
): Promise<GraphifyCompileResult | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<GraphifyCompileResult>('run_graphify_compile', { input });
}

export async function runGraphifyQuery(
  input: GraphifyQueryRequest,
): Promise<GraphifyQueryResult | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<GraphifyQueryResult>('run_graphify_query', { input });
}

export async function runGraphifySaveResult(
  input: GraphifySaveResultRequest,
): Promise<GraphifySaveResultResult | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<GraphifySaveResultResult>('run_graphify_save_result', { input });
}
