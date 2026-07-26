import type { Asset, Project } from './types.js'

/**
 * タイムライン組み立ての純粋ロジック。
 *
 * このモジュールは Node の API を一切使わない。
 * 工程7（Node 上で検証）と Remotion の Composition（ブラウザ上で描画）の
 * 両方から同じ関数を呼ぶ必要があり、後者は webpack でバンドルされるため
 * `node:fs` などが混ざると解決できなくなる。
 *
 * 検証側と描画側で組み立てロジックを共有しているので、
 * 工程7 が OK を出した内容とレンダリング結果が食い違うことはない。
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

export function assetsOfShot(project: Project, shotId: string, kind?: Asset['kind']): Asset[] {
  const shot = project.shots.find((s) => s.id === shotId)
  if (!shot) return []
  return project.assets.filter(
    (a) => shot.assetIds.includes(a.id) && (kind === undefined || a.kind === kind),
  )
}

/**
 * レイヤー順序は下から base → overlay → 字幕。
 *
 * base は footage > motion > image の優先順で 1 つだけ選ぶ。実写があれば必ず実写が勝つ。
 * base に選ばれなかった HyperFrames 由来のモーションは overlay に回る。
 */
export function buildTimeline(project: Project): Timeline {
  const entries: TimelineEntry[] = []
  let cursor = 0

  for (const shot of [...project.shots].sort((a, b) => a.index - b.index)) {
    const footage = assetsOfShot(project, shot.id, 'footage')[0]
    const motions = assetsOfShot(project, shot.id, 'motion')
    const image = assetsOfShot(project, shot.id, 'image')[0]

    // base に使うモーションは生成系（Kling 等）を優先する。
    // HyperFrames 由来は透過オーバーレイとして上に重ねる前提のため、
    // 生成クリップが同じショットにあるときは base を譲る。
    const generated = motions.find((m) => m.source !== 'hyperframes')
    const motion = generated ?? motions[0]

    const baseAsset = footage ?? motion ?? image
    const baseKind = footage ? 'footage' : motion ? 'motion' : image ? 'image' : null

    const overlayAsset =
      motions.find((m) => m.source === 'hyperframes' && m !== baseAsset) ?? null

    // HyperFrames のシーンは見出しを HTML 側で焼き込んでいる。
    // ここで caption を渡すと Remotion が同じ文字をもう一度描いて二重になるため、
    // HyperFrames 由来の素材を使うショットでは caption を空にする。
    const captionBakedIn =
      (baseAsset?.source === 'hyperframes') || (overlayAsset?.source === 'hyperframes')

    entries.push({
      shotId: shot.id,
      index: shot.index,
      fromFrame: cursor,
      durationInFrames: shot.durationInFrames,
      base: baseAsset?.path && baseKind ? { kind: baseKind, path: baseAsset.path } : null,
      overlay: overlayAsset?.path ? { path: overlayAsset.path } : null,
      caption: captionBakedIn ? '' : shot.caption || shot.narration,
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
