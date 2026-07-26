import path from 'node:path'
import { STUDIO_ROOT } from '../project.js'
import type { Project } from '../types.js'

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
  })

  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
  })

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: options.outPath,
    inputProps,
    onProgress: ({ progress }) => options.onProgress?.(progress),
  })

  return options.outPath
}
