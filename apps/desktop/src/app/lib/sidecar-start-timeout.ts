export async function runPromiseWithTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return operation;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function startSidecarWithTimeout(
  startSidecar: (args: string[]) => Promise<boolean>,
  args: string[],
  timeoutMs: number,
  timeoutMessage: string,
): Promise<boolean> {
  return runPromiseWithTimeout(startSidecar(args), timeoutMs, timeoutMessage);
}
