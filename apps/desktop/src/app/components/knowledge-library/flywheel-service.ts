import type { KnowledgeLibraryRepository } from './repository';
import type { BrowserCaptureBatchPayload, BrowserCapturePayload } from './browser-capture';
import { importBrowserCaptureBatch, importBrowserCapturePayload } from './browser-capture';
import type { RawMaterial } from './types';
import type { OntologyDocument } from './ontology-types';
import type { OutputArtifact } from './output-types';

export interface KnowledgeFlywheelImportResult {
  rawMaterials: RawMaterial[];
  ontologyDocuments: OntologyDocument[];
  outputArtifacts: OutputArtifact[];
}

async function runCascade(
  repository: KnowledgeLibraryRepository,
  rawMaterials: RawMaterial[],
): Promise<KnowledgeFlywheelImportResult> {
  if (rawMaterials.length === 0) {
    return {
      rawMaterials: [],
      ontologyDocuments: [],
      outputArtifacts: [],
    };
  }
  const ontologyDocuments = await repository.compileRawMaterialsToOntology(rawMaterials);
  const outputArtifacts = await repository.generateOutputArtifactsFromOntology(ontologyDocuments);
  return {
    rawMaterials,
    ontologyDocuments,
    outputArtifacts,
  };
}

export async function importBrowserCaptureIntoKnowledgeFlywheel(
  repository: KnowledgeLibraryRepository,
  payload: BrowserCapturePayload,
): Promise<KnowledgeFlywheelImportResult> {
  const rawMaterial = await importBrowserCapturePayload(repository, payload);
  return runCascade(repository, rawMaterial ? [rawMaterial] : []);
}

export async function importBrowserCaptureBatchIntoKnowledgeFlywheel(
  repository: KnowledgeLibraryRepository,
  payload: BrowserCaptureBatchPayload,
): Promise<KnowledgeFlywheelImportResult> {
  const rawMaterials = await importBrowserCaptureBatch(repository, payload);
  return runCascade(repository, rawMaterials);
}
