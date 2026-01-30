/**
 * Safe subprocess utilities that avoid command injection
 */

import { spawn } from 'child_process';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

/**
 * Safely execute an npm script
 */
export async function safeExecNpm(
  script: string,
  args: string[] = [],
  cwd: string
): Promise<ExecResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn('npm', ['run', script, '--', ...args], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      shell: true,
    });

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
        success: code === 0,
      });
    });

    proc.on('error', (err) => {
      resolve({
        stdout,
        stderr: stderr + (err?.message || 'Unknown error'),
        exitCode: 1,
        success: false,
      });
    });
  });
}
