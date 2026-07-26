import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { assetsOfShot } from '../project.js'
import type { Project, Step } from '../types.js'

/**
 * 工程7: 画面合成。
 *
 * ショットごとに「どの素材を、どのレイヤーで、どの尺で重ねるか」を確定し、
 * timeline.json として書き出す。Remotion の Composition はこれを読んで描画する。
 *
 * レイヤー順序（下から上）:
 *   1. base    … 実写フッテージ > モーションクリップ > 静止画 の優先順で 1 つ選ぶ
 *   2. overlay … HyperFrames の透過 WebM（base が実写/Kling の場合に重なる）
 *   3. subtitle… 最後。これより上に何も置かない（video-use Hard Rule 1）
 *
 * ここで素材の実在をすべて検証するので、工程8のレンダリングは失敗しない前提になる。
 */
export interface TimelineEntry {
  shotId: string
  index: number
  fromFrame: number
  durationInFrames: number
  base: { kind: 'footage' | 'motion' | 'image'; path: string } | null
  overlay: { path: string } | null
  caption: string
}

export interface Timeline {
  width: number
  height: number
  fps: number
  totalFrames: number
  subtitlePath: string | null
  entries: TimelineEntry[]
}

export const composeStep: Step = {
  name: 'compose',
  label: '画面合成',
  layer: 'script',
  requires: ['script', 'subtitle'],
  async run({ project, dir, log }) {
    const timeline = buildTimeline(project)

    const missing: string[] = []
    for (const entry of timeline.entries) {
      if (!entry.base) {
        missing.push(`${entry.shotId}: 表示できる素材がありません`)
        continue
      }
      const abs = path.join(dir, entry.base.path)
      if (!existsSync(abs)) missing.push(`${entry.shotId}: 素材が見つかりません（${entry.base.path}）`)
      if (entry.overlay && !existsSync(path.join(dir, entry.overlay.path))) {
        missing.push(`${entry.shotId}: オーバーレイが見つかりません（${entry.overlay.path}）`)
      }
    }

    if (missing.length > 0) {
      throw new Error(`合成に必要な素材が揃っていません:\n  - ${missing.join('\n  - ')}`)
    }

    await writeFile(
      path.join(dir, 'timeline.json'),
      `${JSON.stringify(timeline, null, 2)}\n`,
      'utf8',
    )

    log(`${timeline.entries.length} ショット / 合計 ${timeline.totalFrames}フレームの合成計画を確定`)
    return { note: `timeline.json を出力（${timeline.entries.length} ショット）` }
  },
}

export function buildTimeline(project: Project): Timeline {
  const entries: TimelineEntry[] = []
  let cursor = 0

  for (const shot of [...project.shots].sort((a, b) => a.index - b.index)) {
    const footage = assetsOfShot(project, shot.id, 'footage')[0]
    const motion = assetsOfShot(project, shot.id, 'motion')[0]
    const image = assetsOfShot(project, shot.id, 'image')[0]

    // 実写があれば実写を base に。無ければモーション、それも無ければ静止画。
    const baseAsset = footage ?? motion ?? image
    const baseKind = footage ? 'footage' : motion ? 'motion' : image ? 'image' : null

    // base が実写または Kling 生成の場合、HyperFrames の透過素材は overlay に回る
    const overlayAsset =
      motion && motion.source === 'hyperframes' && baseAsset !== motion ? motion : null

    entries.push({
      shotId: shot.id,
      index: shot.index,
      fromFrame: cursor,
      durationInFrames: shot.durationInFrames,
      base: baseAsset?.path && baseKind ? { kind: baseKind, path: baseAsset.path } : null,
      overlay: overlayAsset?.path ? { path: overlayAsset.path } : null,
      caption: shot.caption || shot.narration,
    })
    cursor += shot.durationInFrames
  }

  const subtitle = project.assets.find((a) => a.kind === 'subtitle')

  return {
    width: project.spec.width,
    height: project.spec.height,
    fps: project.spec.fps,
    totalFrames: cursor,
    subtitlePath: subtitle?.path ?? null,
    entries,
  }
}
