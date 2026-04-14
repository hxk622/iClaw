import test from 'node:test';
import assert from 'node:assert/strict';

import { runPromiseWithTimeout, startSidecarWithTimeout } from './sidecar-start-timeout.ts';

test('runPromiseWithTimeout returns resolved value before deadline', async () => {
  const result = await runPromiseWithTimeout(Promise.resolve('ok'), 100, 'timeout');
  assert.equal(result, 'ok');
});

test('runPromiseWithTimeout rejects when operation does not settle before deadline', async () => {
  await assert.rejects(
    () => runPromiseWithTimeout(new Promise(() => undefined), 10, 'timed out'),
    /timed out/,
  );
});

test('startSidecarWithTimeout forwards args to sidecar launcher', async () => {
  const calls: string[][] = [];
  const result = await startSidecarWithTimeout(
    async (args) => {
      calls.push(args);
      return true;
    },
    ['--port', '2126'],
    100,
    'timeout',
  );
  assert.equal(result, true);
  assert.deepEqual(calls, [['--port', '2126']]);
});
