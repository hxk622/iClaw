import test from 'node:test';
import assert from 'node:assert/strict';

import { createCoalescedDomTask } from './coalesced-dom-task.ts';

test('createCoalescedDomTask coalesces repeated schedule calls into one visible-frame flush', () => {
  const calls: string[] = [];
  const frameCallbacks: Array<() => void> = [];
  const task = createCoalescedDomTask(
    () => {
      calls.push('run');
    },
    {
      isDocumentVisible: () => true,
      requestAnimationFrame: (callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      },
      cancelAnimationFrame: () => {},
      setTimeout: () => {
        throw new Error('timeout fallback should not run while visible');
      },
      clearTimeout: () => {},
    },
  );

  task.schedule();
  task.schedule();
  task.schedule();

  assert.equal(frameCallbacks.length, 1);
  assert.equal(task.isScheduled(), true);

  frameCallbacks[0]();

  assert.deepEqual(calls, ['run']);
  assert.equal(task.isScheduled(), false);
});

test('createCoalescedDomTask falls back to timeout while document is hidden', () => {
  const calls: string[] = [];
  const timeoutCallbacks: Array<() => void> = [];
  const task = createCoalescedDomTask(
    () => {
      calls.push('run');
    },
    {
      isDocumentVisible: () => false,
      requestAnimationFrame: () => {
        throw new Error('requestAnimationFrame should not be used while hidden');
      },
      cancelAnimationFrame: () => {},
      setTimeout: (callback, _delay) => {
        timeoutCallbacks.push(callback);
        const handle = globalThis.setTimeout(() => {}, 0);
        clearTimeout(handle);
        return handle;
      },
      clearTimeout: () => {},
    },
  );

  task.schedule();
  task.schedule();

  assert.equal(timeoutCallbacks.length, 1);
  assert.equal(task.isScheduled(), true);

  timeoutCallbacks[0]();

  assert.deepEqual(calls, ['run']);
  assert.equal(task.isScheduled(), false);
});

test('createCoalescedDomTask cancel clears pending work before it runs', () => {
  const calls: string[] = [];
  const frameCallbacks: Array<() => void> = [];
  const cancelledHandles: number[] = [];
  const task = createCoalescedDomTask(
    () => {
      calls.push('run');
    },
    {
      isDocumentVisible: () => true,
      requestAnimationFrame: (callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      },
      cancelAnimationFrame: (handle) => {
        cancelledHandles.push(handle);
      },
      setTimeout: () => {
        throw new Error('timeout fallback should not run while visible');
      },
      clearTimeout: () => {},
    },
  );

  task.schedule();
  task.cancel();

  assert.deepEqual(cancelledHandles, [1]);
  assert.equal(task.isScheduled(), false);

  frameCallbacks[0]();

  assert.deepEqual(calls, []);
});
