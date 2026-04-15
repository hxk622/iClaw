import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from '../../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 执行Python脚本，返回JSON解析后的结果
 * @param scriptPath Python脚本路径
 * @param args 脚本参数
 * @param timeout 超时时间（毫秒），默认60秒
 * @returns 解析后的JSON对象
 */
export async function runPythonScript<T>(
  scriptPath: string,
  args: string[] = [],
  timeout: number = 60000
): Promise<T> {
  return new Promise((resolve, reject) => {
    logInfo(`Running Python script: ${scriptPath}`);

    // 确定Python解释器路径，优先使用虚拟环境，其次全局python3
    const pythonPath = process.env.PYTHON_PATH || 'python3';

    // 执行脚本，设置工作目录为项目根目录，确保模块导入正确
    const pythonProcess = spawn(pythonPath, [scriptPath, ...args], {
      cwd: path.resolve(__dirname, '../../../../../'), // 项目根目录
      env: {
        ...process.env,
        // 清除代理环境变量，确保数据源访问正常
        HTTP_PROXY: '',
        HTTPS_PROXY: '',
        http_proxy: '',
        https_proxy: '',
        NO_PROXY: '*',
        no_proxy: '*',
        // 设置Python路径，优先使用项目内的模块
        PYTHONPATH: `${path.resolve(__dirname, '../../../../../')}:${path.resolve(__dirname, '../../../../../daily_stock_analysis')}`
      }
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // 设置超时
    const timeoutId = setTimeout(() => {
      timedOut = true;
      pythonProcess.kill('SIGTERM');
      reject(new Error(`Python script execution timed out after ${timeout}ms: ${scriptPath}`));
    }, timeout);

    // 收集标准输出
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // 收集错误输出
    pythonProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      stderr += dataStr;
      // 实时打印Python脚本的日志到控制台
      if (dataStr.trim()) {
        logInfo(`[Python] ${dataStr.trim()}`);
      }
    });

    // 进程结束处理
    pythonProcess.on('close', (code) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        return;
      }

      if (code !== 0) {
        logError(`Python script exited with code ${code}: ${scriptPath}`, { stderr });
        reject(new Error(`Python script failed with code ${code}: ${stderr || 'Unknown error'}`));
        return;
      }

      try {
        // 尝试解析JSON输出
        const result = JSON.parse(stdout.trim()) as T;
        resolve(result);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        logError('Failed to parse Python script output as JSON:', { error: errorMessage, stdout, stderr });
        reject(new Error(`Invalid JSON output from Python script: ${errorMessage}`));
      }
    });

    // 进程错误处理
    pythonProcess.on('error', (err) => {
      clearTimeout(timeoutId);
      logError(`Failed to start Python script: ${scriptPath}`, { error: err.message });
      reject(new Error(`Failed to start Python script: ${err.message}`));
    });
  });
}
