import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { execCommand } from './exec.js'

const require = createRequire(import.meta.url)

/**
 * ffmpeg のパスを解決する。
 *
 * この実行環境には apt 権限が無くシステム ffmpeg を入れられないため、
 * npm の ffmpeg-static に同梱されたバイナリを既定で使う。
 * システムに ffmpeg があればそちらを優先する。
 */
let cached: string | null = null

export function resolveFfmpeg(): string {
  if (cached) return cached

  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    cached = process.env.FFMPEG_PATH
    return cached
  }

  try {
    const staticPath = require('ffmpeg-static') as string | null
    if (staticPath && existsSync(staticPath)) {
      cached = staticPath
      return cached
    }
  } catch {
    // ffmpeg-static 未導入。システム ffmpeg にフォールバックする
  }

  cached = 'ffmpeg'
  return cached
}

export async function ffmpeg(args: string[], cwd?: string): Promise<void> {
  const bin = resolveFfmpeg()
  const result = await execCommand(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    cwd,
    timeoutMs: 30 * 60 * 1000,
  })
  if (result.code !== 0) {
    throw new Error(`ffmpeg が失敗しました (exit ${result.code}): ${result.stderr.trim()}`)
  }
}

/**
 * video-use の Python ヘルパーは PATH 上の `ffmpeg` を呼ぶ。
 * ffmpeg-static のディレクトリを PATH 前方に足した env を返す。
 */
export function envWithFfmpeg(): NodeJS.ProcessEnv {
  const bin = resolveFfmpeg()
  if (bin === 'ffmpeg') return { ...process.env }
  const dir = bin.slice(0, bin.lastIndexOf('/'))
  return { ...process.env, PATH: `${dir}:${process.env.PATH ?? ''}`, FFMPEG_PATH: bin }
}
