#!/usr/bin/env node
import process from 'node:process';
import { loadBrandProfile, resolveBrandId } from './lib/brand-profile.mjs';

function readPath(root, pathExpression) {
  return pathExpression
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), root);
}

async function main() {
  const args = process.argv.slice(2);
  let brandId = resolveBrandId();
  const paths = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--brand') {
      brandId = resolveBrandId(args[index + 1] || '');
      index += 1;
      continue;
    }
    paths.push(arg);
  }

  const { profile } = await loadBrandProfile({ brandId });
  const queries = paths.length > 0 ? paths : ['brandId'];

  for (const query of queries) {
    const value = readPath(profile, query);
    if (typeof value === 'string') {
      process.stdout.write(`${value}\n`);
      continue;
    }
    process.stdout.write(`${JSON.stringify(value ?? null)}\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
