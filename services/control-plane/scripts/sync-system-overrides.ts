import {config} from '../src/config.ts';
import {decryptInstallSecretPayloadWithKey, encryptInstallSecretPayloadWithKey} from '../src/install-config-secrets.ts';
import {PgControlPlaneStore} from '../src/pg-store.ts';

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function readMultiArg(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name) {
      const value = process.argv[index + 1] || '';
      if (value.trim()) {
        values.push(value.trim());
      }
    }
  }
  return values;
}

async function main() {
  const sourceDatabaseUrl =
    readArg('--source-database-url') ||
    process.env.ICLAW_PACKAGE_SOURCE_DATABASE_URL ||
    '';
  const targetDatabaseUrl =
    readArg('--target-database-url') ||
    config.databaseUrl ||
    '';
  const stateKeys = readMultiArg('--state-key');
  const resolvedStateKeys = stateKeys.length ? stateKeys : ['payment_gateway:epay'];
  const sourceInstallSecretKey =
    readArg('--source-install-secret-key') ||
    process.env.ICLAW_PACKAGE_SOURCE_INSTALL_SECRET_KEY ||
    process.env.ICLAW_PACKAGE_SOURCE_S3_SECRET_KEY ||
    '';

  if (!sourceDatabaseUrl.trim()) {
    throw new Error('source database url is required via --source-database-url or ICLAW_PACKAGE_SOURCE_DATABASE_URL');
  }
  if (!targetDatabaseUrl.trim()) {
    throw new Error('target database url is required via --target-database-url or DATABASE_URL');
  }

  const sourceStore = new PgControlPlaneStore(sourceDatabaseUrl);
  const targetStore = new PgControlPlaneStore(targetDatabaseUrl);
  const synced: string[] = [];
  try {
    for (const stateKey of resolvedStateKeys) {
      const stateValue = await sourceStore.getSystemState(stateKey);
      if (!stateValue) {
        throw new Error(`source system state not found: ${stateKey}`);
      }
      let nextStateValue = stateValue;
      if (stateKey === 'payment_gateway:epay') {
        if (!sourceInstallSecretKey.trim()) {
          throw new Error(
            'source install secret key is required for payment_gateway:epay via --source-install-secret-key or ICLAW_PACKAGE_SOURCE_INSTALL_SECRET_KEY / ICLAW_PACKAGE_SOURCE_S3_SECRET_KEY',
          );
        }
        const sourceObject = stateValue as Record<string, unknown>;
        const decryptedSecrets = decryptInstallSecretPayloadWithKey(
          typeof sourceObject.secret_payload_encrypted === 'string' ? sourceObject.secret_payload_encrypted : null,
          sourceInstallSecretKey,
        );
        nextStateValue = {
          ...sourceObject,
          secret_payload_encrypted: encryptInstallSecretPayloadWithKey(
            decryptedSecrets,
            config.installSecretKey,
          ),
        };
      }
      await targetStore.setSystemState(stateKey, nextStateValue);
      synced.push(stateKey);
    }
  } finally {
    await sourceStore.close();
    await targetStore.close();
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        sourceDatabaseUrl: '[redacted]',
        targetDatabaseUrl: '[redacted]',
        synced,
      },
      null,
      2,
    ),
  );
}

await main();
