import path from 'node:path'
import { existsSync } from 'node:fs'
import { renderVideo } from '../adapters/remotion.js'
import { addAsset, ASSET_DIRS } from '../project.js'
import type { Step } from '../types.js'

/**
 * 工程8: 最終レンダリング。
 *
 * Remotion で timeline.json を H.264 の MP4 に焼く。
 * @remotion/renderer は ffmpeg を同梱しているので外部 ffmpeg は不要。
 */
export const renderStep: Step = {
  name: 'render',
  label: '最終レンダリング',
  layer: 'script',
  requires: ['compose'],
  async run({ project, dir, log }) {
    if (!existsSync(path.join(dir, 'timeline.json'))) {
      throw new Error('timeline.json がありません。工程7（compose）を先に実行してください。')
    }

    const relPath = path.join(ASSET_DIRS.video, 'final.mp4')
    const outPath = path.join(dir, relPath)

    let lastReported = -1
    await renderVideo({
      project,
      projectDir: dir,
      outPath,
      onProgress: (ratio) => {
        const pct = Math.floor(ratio * 100)
        if (pct >= lastReported + 10) {
          lastReported = pct
          log(`レンダリング ${pct}%`)
        }
      },
    })

    if (!existsSync(outPath)) {
      throw new Error(`レンダリング結果が見つかりません: ${outPath}`)
    }

    addAsset(project, {
      id: 'final',
      kind: 'video',
      path: relPath,
      source: 'remotion',
      meta: {
        width: project.spec.width,
        height: project.spec.height,
        fps: project.spec.fps,
      },
    })

    log(`完成: ${outPath}`)
    return { note: `final.mp4 を出力` }
  },
}
