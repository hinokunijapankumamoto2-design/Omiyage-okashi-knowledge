import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { addAsset, ASSET_DIRS } from '../project.js'
import type { Project, Step } from '../types.js'

/**
 * 工程6: 字幕。
 *
 * マスター SRT を出力タイムライン基準で生成する script 層のステップ。
 *
 * video-use の Hard Rule 5 に従い、各字幕のタイムコードは
 * 「セグメント内の相対時刻 + そのセグメントの出力タイムライン上のオフセット」で計算する。
 * ショット単位で尺が確定しているので、ここではオフセットを積み上げるだけでよい。
 *
 * 焼き込み自体は工程7（合成）で最後に行う。字幕を先に焼くと
 * オーバーレイに隠れて消えるため、順序は入れ替えないこと。
 */
export const subtitleStep: Step = {
  name: 'subtitle',
  label: '字幕',
  layer: 'script',
  requires: ['script'],
  async run({ project, dir, log }) {
    const cues = buildCues(project)

    if (cues.length === 0) {
      return { note: '字幕テキストを持つショットが無いためスキップ' }
    }

    const relPath = path.join(ASSET_DIRS.subtitle, 'master.srt')
    const outPath = path.join(dir, relPath)
    await writeFile(outPath, toSrt(cues), 'utf8')

    addAsset(project, {
      id: 'subtitle-master',
      kind: 'subtitle',
      path: relPath,
      source: 'studio:subtitle',
      meta: { cueCount: cues.length },
    })

    log(`${cues.length} 件の字幕キューを master.srt に出力`)
    return { note: `字幕キュー ${cues.length} 件` }
  },
}

interface Cue {
  index: number
  startSec: number
  endSec: number
  text: string
}

function buildCues(project: Project): Cue[] {
  const cues: Cue[] = []
  let offsetFrames = 0

  for (const shot of [...project.shots].sort((a, b) => a.index - b.index)) {
    const text = (shot.caption || shot.narration).trim()
    if (text.length > 0) {
      cues.push({
        index: cues.length + 1,
        startSec: offsetFrames / project.spec.fps,
        endSec: (offsetFrames + shot.durationInFrames) / project.spec.fps,
        text,
      })
    }
    offsetFrames += shot.durationInFrames
  }
  return cues
}

function toSrt(cues: Cue[]): string {
  return `${cues
    .map((c) => `${c.index}\n${stamp(c.startSec)} --> ${stamp(c.endSec)}\n${c.text}\n`)
    .join('\n')}`
}

function stamp(totalSec: number): string {
  const ms = Math.round(totalSec * 1000)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const rest = ms % 1000
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(h)}:${p(m)}:${p(s)},${p(rest, 3)}`
}
