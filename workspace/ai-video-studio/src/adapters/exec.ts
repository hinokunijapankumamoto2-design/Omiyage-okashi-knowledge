import { spawn } from 'node:child_process'

export interface ExecResult {
  code: number
  stdout: string
  stderr: string
}

/**
 * 外部コマンドを実行する共通ヘルパー。
 * スタジオの script 層アダプタはすべてこれを経由する。
 */
export function execCommand(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => {
      stdout += c.toString()
    })
    child.stderr.on('data', (c: Buffer) => {
      stderr += c.toString()
    })

    const timer = options.timeoutMs
      ? setTimeout(() => {
          child.kill('SIGKILL')
          reject(new Error(`${command} がタイムアウトしました（${options.timeoutMs}ms）`))
        }, options.timeoutMs)
      : null

    child.on('error', (err) => {
      if (timer) clearTimeout(timer)
      reject(new Error(`${command} を起動できません: ${err.message}`))
    })

    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}

export async function commandExists(command: string): Promise<boolean> {
  try {
    const r = await execCommand('sh', ['-c', `command -v ${command}`])
    return r.code === 0
  } catch {
    return false
  }
}
