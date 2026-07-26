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

let cachedProbe: string | null = null

/**
 * ffprobe のパスを解決する。
 *
 * HyperFrames は素材の尺・解像度を調べるのに ffprobe を必須とする。
 * ffmpeg-static には ffprobe が含まれないため、ffprobe-static を別途使う。
 */
export function resolveFfprobe(): string {
  if (cachedProbe) return cachedProbe

  if (process.env.FFPROBE_PATH && existsSync(process.env.FFPROBE_PATH)) {
    cachedProbe = process.env.FFPROBE_PATH
    return cachedProbe
  }

  try {
    const mod = require('ffprobe-static') as { path?: string } | string
    const p = typeof mod === 'string' ? mod : mod.path
    if (p && existsSync(p)) {
      cachedProbe = p
      return cachedProbe
    }
  } catch {
    // ffprobe-static 未導入。システム ffprobe にフォールバックする
  }

  cachedProbe = 'ffprobe'
  return cachedProbe
}

/**
 * PATH 上の `ffmpeg` / `ffprobe` を呼ぶ外部ツール向けの env を返す。
 *
 * HyperFrames（レンダリング）と video-use の Python ヘルパー（実写編集）は
 * どちらも PATH 経由でバイナリを探すため、静的バイナリのディレクトリを前方に足す。
 * ffmpeg と ffprobe は別パッケージなので、2 つのディレクトリを追加する。
 */
export function envWithFfmpeg(): NodeJS.ProcessEnv {
  const ffmpegBin = resolveFfmpeg()
  const ffprobeBin = resolveFfprobe()

  const dirs = [ffmpegBin, ffprobeBin]
    .filter((b) => b.includes('/'))
    .map((b) => b.slice(0, b.lastIndexOf('/')))

  const uniqueDirs = [...new Set(dirs)]
  const prefix = uniqueDirs.length > 0 ? `${uniqueDirs.join(':')}:` : ''

  return {
    ...process.env,
    PATH: `${prefix}${process.env.PATH ?? ''}`,
    FFMPEG_PATH: ffmpegBin,
    FFPROBE_PATH: ffprobeBin,
  }
}
