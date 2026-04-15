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

function summarizeFaultReportPrepareInput(input: DesktopFaultReportPrepareInput) {
  return {
    entry: input.entry,
    failureStage: input.failureStage,
    appName: input.appName ?? null,
    brandId: input.brandId ?? null,
    installSessionIdPresent: Boolean(input.installSessionId),
    releaseChannel: input.releaseChannel ?? null,
    extraDiagnosticsKeys: input.extraDiagnostics ? Object.keys(input.extraDiagnostics) : [],
  };
}

function summarizePreparedArchive(prepared: {
  reportId: string;
  fileName: string;
  fileSizeBytes: number;
  deviceId: string;
  platform: string;
  platformVersion: string | null;
  arch: string;
}) {
  return {
    reportId: prepared.reportId,
    fileName: prepared.fileName,
    fileSizeBytes: prepared.fileSizeBytes,
    deviceId: prepared.deviceId,
    platform: prepared.platform,
    platformVersion: prepared.platformVersion,
    arch: prepared.arch,
  };
}

function normalizeFaultReportError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string' && error.trim()) {
    return new Error(error.trim());
  }
  if (typeof error === 'object' && error) {
    const message =
      'message' in error && typeof error.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'code' in error && typeof error.code === 'string' && error.code.trim()
          ? error.code.trim()
          : '';
    if (message) {
      return new Error(message);
    }
  }
  return new Error(fallback);
}

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
  console.info('[fault-report] manual submit start', {
    entry: input.entry,
    failureStage: input.failureStage,
    accountState: input.accountState,
    hasAccessToken: Boolean(input.accessToken),
    installSessionIdPresent: Boolean(input.installSessionId),
    extraDiagnosticsKeys: input.extraDiagnostics ? Object.keys(input.extraDiagnostics) : [],
  });
  input.onPhaseChange?.('collecting');
  try {
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
    console.info('[fault-report] manual prepare invoke', summarizeFaultReportPrepareInput(prepareInput));
    let prepared;
    try {
      prepared = await prepareDesktopFaultReportArchive(prepareInput);
    } catch (error) {
      console.error('[fault-report] manual prepare failed', {
        ...summarizeFaultReportPrepareInput(prepareInput),
        error,
      });
      throw error;
    }
    if (!prepared) {
      console.error('[fault-report] manual prepare unavailable', summarizeFaultReportPrepareInput(prepareInput));
      throw new Error('Desktop fault report unavailable');
    }
    console.info('[fault-report] manual prepare success', summarizePreparedArchive(prepared));

    input.onPhaseChange?.('compressing');
    const archiveBytes = decodeBase64ToBytes(prepared.archiveBase64);
    const payload = {
      ...prepared.payload,
      account_state: input.accountState,
    };
    console.info('[fault-report] manual upload start', {
      reportId: prepared.reportId,
      fileName: prepared.fileName,
      fileSizeBytes: prepared.fileSizeBytes,
      uploadEndpoint: 'desktop_fault_report',
      accountState: input.accountState,
      hasAccessToken: Boolean(input.accessToken),
    });

    input.onPhaseChange?.('uploading');
    const result = await input.client.uploadDesktopFaultReport({
      token: input.accessToken || null,
      payload,
      fileName: prepared.fileName,
      contentType: 'application/zip',
      file: archiveBytes,
      onProgress: input.onUploadProgress,
    });
    console.info('[fault-report] manual upload success', {
      reportId: result.reportId,
      fileSizeBytes: result.fileSizeBytes,
    });
    return result;
  } catch (error) {
    const normalized = normalizeFaultReportError(error, '桌面端故障上报失败');
    console.error('[fault-report] manual submit failed', normalized);
    throw normalized;
  }
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
  console.info('[fault-report] auto submit start', {
    failureStage: input.failureStage,
    hasAccessToken: Boolean(input.accessToken),
    installSessionIdPresent: Boolean(input.installSessionId),
    extraDiagnosticsKeys: input.extraDiagnostics ? Object.keys(input.extraDiagnostics) : [],
  });
  console.info('[fault-report] auto prepare invoke', summarizeFaultReportPrepareInput(prepareInput));
  let prepared;
  try {
    prepared = await prepareDesktopFaultReportArchive(prepareInput);
  } catch (error) {
    console.error('[fault-report] auto prepare failed', {
      ...summarizeFaultReportPrepareInput(prepareInput),
      error,
    });
    throw error;
  }
  if (!prepared) {
    console.error('[fault-report] auto prepare unavailable', summarizeFaultReportPrepareInput(prepareInput));
    throw new Error('Desktop diagnostic upload unavailable');
  }
  console.info('[fault-report] auto prepare success', summarizePreparedArchive(prepared));
  const archiveBytes = decodeBase64ToBytes(prepared.archiveBase64);
  console.info('[fault-report] auto upload start', {
    reportId: prepared.reportId,
    fileName: prepared.fileName,
    fileSizeBytes: prepared.fileSizeBytes,
    uploadEndpoint: 'desktop_diagnostic_upload',
    hasAccessToken: Boolean(input.accessToken),
  });
  try {
    const result = await input.client.uploadDesktopDiagnosticUpload({
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
    console.info('[fault-report] auto upload success', {
      reportId: prepared.reportId,
      fileName: prepared.fileName,
    });
    return result;
  } catch (error) {
    console.error('[fault-report] auto upload failed', {
      reportId: prepared.reportId,
      fileName: prepared.fileName,
      fileSizeBytes: prepared.fileSizeBytes,
      error,
    });
    throw error;
  }
}
