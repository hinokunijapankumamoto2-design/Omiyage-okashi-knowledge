import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { buildTimeline } from '../timeline.js'
import type { Step } from '../types.js'

export type { Timeline, TimelineEntry } from '../timeline.js'

/**
 * 工程7: 画面合成。
 *
 * ショットごとに「どの素材を、どのレイヤーで、どの尺で重ねるか」を確定し、
 * timeline.json として書き出す。Remotion の Composition はこれと同じ
 * buildTimeline() を呼んで描画する。
 *
 * ここで素材の実在をすべて検証するので、工程8のレンダリングは
 * 環境要因以外では失敗しない前提になる。
 */
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
      if (!existsSync(path.join(dir, entry.base.path))) {
        missing.push(`${entry.shotId}: 素材が見つかりません（${entry.base.path}）`)
      }
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
