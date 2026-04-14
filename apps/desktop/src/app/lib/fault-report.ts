import type { DesktopDiagnosticUploadData, DesktopFaultReportData, IClawClient } from '@iclaw/sdk';
import desktopPackageJson from '../../../package.json';
import { BRAND } from './brand';
import {
  prepareDesktopFaultReportArchive,
  type DesktopFaultReportPrepareInput,
} from './tauri-runtime-config';

export type FaultReportPhase = 'collecting' | 'compressing' | 'uploading';

export type SubmitDesktopFaultReportInput = {
  client: IClawClient;
  accessToken?: string | null;
  accountState: 'anonymous' | 'authenticated';
  entry: 'installer' | 'exception-dialog';
  installSessionId?: string | null;
  failureStage: string;
  errorTitle: string;
  errorMessage: string;
  errorCode?: string | null;
  installProgressPhase?: string | null;
  installProgressPercent?: number | null;
  extraDiagnostics?: Record<string, unknown> | null;
  onPhaseChange?: (phase: FaultReportPhase) => void;
  onUploadProgress?: (progress: { loaded: number; total: number | null; percent: number | null }) => void;
};

export type SubmitAutoDiagnosticUploadInput = {
  client: IClawClient;
  accessToken?: string | null;
  installSessionId?: string | null;
  failureStage: string;
  errorTitle: string;
  errorMessage: string;
  errorCode?: string | null;
  extraDiagnostics?: Record<string, unknown> | null;
  onUploadProgress?: (progress: { loaded: number; total: number | null; percent: number | null }) => void;
};

function decodeBase64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function resolveReleaseChannel(): 'dev' | 'prod' {
  return import.meta.env.DEV ? 'dev' : 'prod';
}

export async function submitDesktopFaultReport(
  input: SubmitDesktopFaultReportInput,
): Promise<DesktopFaultReportData> {
  input.onPhaseChange?.('collecting');
  const prepareInput: DesktopFaultReportPrepareInput = {
    entry: input.entry,
    installSessionId: input.installSessionId || null,
    appName: BRAND.brandId,
    brandId: BRAND.brandId,
    appVersion: desktopPackageJson.version,
    releaseChannel: resolveReleaseChannel(),
    failureStage: input.failureStage,
    errorTitle: input.errorTitle,
    errorMessage: input.errorMessage,
    errorCode: input.errorCode || null,
    installProgressPhase: input.installProgressPhase || null,
    installProgressPercent: input.installProgressPercent ?? null,
    extraDiagnostics: input.extraDiagnostics || null,
  };
  const prepared = await prepareDesktopFaultReportArchive(prepareInput);
  if (!prepared) {
    throw new Error('桌面端故障上报不可用');
  }

  input.onPhaseChange?.('compressing');
  const archiveBytes = decodeBase64ToBytes(prepared.archiveBase64);
  const payload = {
    ...prepared.payload,
    account_state: input.accountState,
  };

  input.onPhaseChange?.('uploading');
  return input.client.uploadDesktopFaultReport({
    token: input.accessToken || null,
    payload,
    fileName: prepared.fileName,
    contentType: 'application/zip',
    file: archiveBytes,
    onProgress: input.onUploadProgress,
  });
}

export async function submitAutoDiagnosticUpload(
  input: SubmitAutoDiagnosticUploadInput,
): Promise<DesktopDiagnosticUploadData> {
  const prepareInput: DesktopFaultReportPrepareInput = {
    entry: 'exception-dialog',
    installSessionId: input.installSessionId || null,
    appName: BRAND.brandId,
    brandId: BRAND.brandId,
    appVersion: desktopPackageJson.version,
    releaseChannel: resolveReleaseChannel(),
    failureStage: input.failureStage,
    errorTitle: input.errorTitle,
    errorMessage: input.errorMessage,
    errorCode: input.errorCode || null,
    extraDiagnostics: input.extraDiagnostics || null,
  };
  const prepared = await prepareDesktopFaultReportArchive(prepareInput);
  if (!prepared) {
    throw new Error('桌面端自动诊断上传不可用');
  }
  const archiveBytes = decodeBase64ToBytes(prepared.archiveBase64);
  return input.client.uploadDesktopDiagnosticUpload({
    token: input.accessToken || null,
    payload: {
      device_id: prepared.deviceId,
      app_name: BRAND.brandId,
      file_name: prepared.fileName,
      file_size_bytes: prepared.fileSizeBytes,
      sha256: prepared.fileSha256,
      source_type: 'auto_error_capture',
      contains_customer_logs: true,
      sensitivity_level: 'customer',
      created_at: new Date().toISOString(),
    },
    fileName: prepared.fileName,
    contentType: 'application/zip',
    file: archiveBytes,
    onProgress: input.onUploadProgress,
  });
}
