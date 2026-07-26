import path from 'node:path'
import { existsSync, readdirSync } from 'node:fs'
import { STUDIO_ROOT } from '../project.js'
import type { Project } from '../types.js'

/**
 * Remotion に使わせる Chromium を解決する。
 *
 * Remotion は既定で remotion.media から専用ビルドを取ってくるが、
 * この実行環境では送信先の allowlist に無く 403 になる。
 * すでにローカルにある headless shell を使い回すことで、
 * ネットワークに依存せずレンダリングできるようにする。
 *
 * 優先順:
 *   1. REMOTION_BROWSER_EXECUTABLE（明示指定）
 *   2. HyperFrames が入れた chrome-headless-shell（工程4 で必ず入る）
 *   3. Playwright の headless shell（この環境に同梱）
 *   4. 見つからなければ null を返し、Remotion の既定動作に任せる
 */
export function resolveBrowserExecutable(): string | null {
  const explicit = process.env.REMOTION_BROWSER_EXECUTABLE
  if (explicit && existsSync(explicit)) return explicit

  const hyperframesCache = '/root/.cache/hyperframes/chrome/chrome-headless-shell'
  if (existsSync(hyperframesCache)) {
    for (const version of readdirSync(hyperframesCache)) {
      const candidate = path.join(
        hyperframesCache,
        version,
        'chrome-headless-shell-linux64',
        'chrome-headless-shell',
      )
      if (existsSync(candidate)) return candidate
    }
  }

  const playwrightRoot = '/opt/pw-browsers'
  if (existsSync(playwrightRoot)) {
    for (const dir of readdirSync(playwrightRoot)) {
      if (!dir.startsWith('chromium')) continue
      for (const rel of [
        'chrome-linux/headless_shell',
        'chrome-linux/chrome',
        'chrome-linux/chrome-headless-shell',
      ]) {
        const candidate = path.join(playwrightRoot, dir, rel)
        if (existsSync(candidate)) return candidate
      }
    }
  }

  return null
}

/**
 * Remotion アダプタ。画面合成と最終レンダリングを担当する。
 *
 * 合成の入力はプロジェクトの project.json そのもの。
 * Remotion 側の Composition は inputProps として project を受け取り、
 * shots[] と assets[] を読んでタイムラインを組み立てる。
 *
 * @remotion/renderer は ffmpeg を同梱しているため、
 * ここでは ffmpeg-static のパス解決は不要。
 */
export const REMOTION_ENTRY = path.join(STUDIO_ROOT, 'remotion', 'src', 'index.ts')
export const COMPOSITION_ID = 'MainVideo'

export interface RenderOptions {
  project: Project
  /** projects/<id> の絶対パス。素材の相対パス解決の基準になる */
  projectDir: string
  outPath: string
  onProgress?: (ratio: number) => void
}

export async function renderVideo(options: RenderOptions): Promise<string> {
  // Remotion は重いので、レンダリング時にだけ読み込む
  const { bundle } = await import('@remotion/bundler')
  const { renderMedia, selectComposition } = await import('@remotion/renderer')

  const inputProps = {
    project: options.project,
    /** Remotion の staticFile 解決用。projects/<id> を publicDir に割り当てる */
    assetRoot: options.projectDir,
  }

  const serveUrl = await bundle({
    entryPoint: REMOTION_ENTRY,
    publicDir: options.projectDir,
    // スタジオのソースは Node ESM 規約で `./foo.js` と書く（tsx がそう要求する）。
    // webpack はそのままでは .js を .ts / .tsx に解決できないため、
    // extensionAlias を足して両方の流儀を同居させる。
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        extensionAlias: {
          '.js': ['.ts', '.tsx', '.js'],
          '.jsx': ['.tsx', '.jsx'],
        },
      },
    }),
  })

  const browserExecutable = resolveBrowserExecutable()

  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
    browserExecutable,
  })

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: options.outPath,
    inputProps,
    browserExecutable,
    onProgress: ({ progress }) => options.onProgress?.(progress),
  })

  return options.outPath
}
