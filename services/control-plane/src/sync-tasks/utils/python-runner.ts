import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function resolvePythonCommand(): string {
  const explicit = process.env.PYTHON_BIN?.trim();
  if (explicit) {
    return explicit;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

export async function runPythonScript<T = unknown>(
  scriptPath: string,
  args: string[] = [],
  timeoutMs = 60_000,
): Promise<T> {
  const command = resolvePythonCommand();
  const { stdout, stderr } = await execFileAsync(command, [scriptPath, ...args], {
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });

  const output = String(stdout || '').trim();
  const errorOutput = String(stderr || '').trim();
  if (!output) {
    if (errorOutput) {
      throw new Error(errorOutput);
    }
    throw new Error(`python script returned no output: ${scriptPath}`);
  }

  try {
    return JSON.parse(output) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to parse python output for ${scriptPath}: ${message}\n${output}`);
  }
}
