import {spawn} from 'node:child_process';

import {harvestTmpTests} from './harvest-tmp-tests.mjs';

const [, , command, ...args] = process.argv;

if (!command) {
  console.error('usage: node scripts/run-with-tmp-harvest.mjs <command> [...args]');
  process.exit(1);
}

const exitCode = await new Promise((resolve) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      resolve(1);
      return;
    }
    resolve(code ?? 0);
  });
  child.on('error', () => resolve(1));
});

try {
  await harvestTmpTests();
} catch (error) {
  console.error('[tmp-tests] harvest failed:', error);
  if (exitCode === 0) {
    process.exit(1);
  }
}

process.exit(Number(exitCode || 0));
