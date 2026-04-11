type TimeoutHandle = ReturnType<typeof setTimeout>;

export type CoalescedDomTaskEnv = {
  isDocumentVisible?: () => boolean;
  requestAnimationFrame?: ((callback: () => void) => number) | null;
  cancelAnimationFrame?: ((handle: number) => void) | null;
  setTimeout?: ((callback: () => void, delay: number) => TimeoutHandle) | null;
  clearTimeout?: ((handle: TimeoutHandle) => void) | null;
};

type CoalescedDomTaskHandle = {
  schedule: () => void;
  flush: () => void;
  cancel: () => void;
  isScheduled: () => boolean;
};

function createDefaultEnv(): Required<CoalescedDomTaskEnv> {
  return {
    isDocumentVisible: () => typeof document === 'undefined' || document.visibilityState === 'visible',
    requestAnimationFrame:
      typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : null,
    cancelAnimationFrame:
      typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
        ? window.cancelAnimationFrame.bind(window)
        : null,
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };
}

export function createCoalescedDomTask(
  task: () => void,
  envOverrides: CoalescedDomTaskEnv = {},
): CoalescedDomTaskHandle {
  const env = {
    ...createDefaultEnv(),
    ...envOverrides,
  };

  let scheduled = false;
  let frameHandle: number | null = null;
  let timeoutHandle: TimeoutHandle | null = null;

  const clearScheduledHandle = () => {
    if (frameHandle != null && env.cancelAnimationFrame) {
      env.cancelAnimationFrame(frameHandle);
    }
    if (timeoutHandle != null && env.clearTimeout) {
      env.clearTimeout(timeoutHandle);
    }
    frameHandle = null;
    timeoutHandle = null;
  };

  const flush = () => {
    clearScheduledHandle();
    if (!scheduled) {
      return;
    }
    scheduled = false;
    task();
  };

  const schedule = () => {
    if (scheduled) {
      return;
    }
    scheduled = true;

    if (env.isDocumentVisible() && env.requestAnimationFrame) {
      frameHandle = env.requestAnimationFrame(() => {
        flush();
      });
      return;
    }

    if (env.setTimeout) {
      timeoutHandle = env.setTimeout(() => {
        flush();
      }, 16);
      return;
    }

    flush();
  };

  const cancel = () => {
    clearScheduledHandle();
    scheduled = false;
  };

  return {
    schedule,
    flush,
    cancel,
    isScheduled: () => scheduled,
  };
}
