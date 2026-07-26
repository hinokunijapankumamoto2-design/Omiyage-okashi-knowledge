import path from 'node:path'
import { existsSync } from 'node:fs'
import { generateImage, CODEX_IMAGE_MODEL } from '../adapters/codex-image.js'
import { addAsset, ASSET_DIRS, assetsOfShot } from '../project.js'
import type { Step } from '../types.js'

/**
 * 工程3: 素材生成（静止画）。
 *
 * codex exec 経由で GPT Image 2 を回す script 層のステップ。
 * imagePrompt を持つショットだけを対象にし、既に画像がある場合はスキップする（冪等）。
 */
export const imageStep: Step = {
  name: 'image',
  label: '素材生成',
  layer: 'script',
  requires: ['script'],
  async run({ project, dir, log }) {
    const targets = project.shots.filter((s) => s.imagePrompt.trim().length > 0)

    if (targets.length === 0) {
      return { note: 'imagePrompt を持つショットがないためスキップ' }
    }

    const styleGuide = project.plan?.tone ?? ''
    let generated = 0

    for (const shot of targets) {
      const outPath = path.join(dir, ASSET_DIRS.image, `${shot.id}.png`)

      if (assetsOfShot(project, shot.id, 'image').length > 0 && existsSync(outPath)) {
        log(`${shot.id}: 生成済みのためスキップ`)
        continue
      }

      log(`${shot.id}: ${CODEX_IMAGE_MODEL} で生成中…`)
      await generateImage({
        prompt: shot.imagePrompt,
        outPath,
        width: project.spec.width,
        height: project.spec.height,
        styleGuide,
      })

      addAsset(
        project,
        {
          id: `img-${shot.id}`,
          kind: 'image',
          path: path.join(ASSET_DIRS.image, `${shot.id}.png`),
          source: `codex:${CODEX_IMAGE_MODEL}`,
        },
        shot.id,
      )
      generated += 1
    }

    return { note: `${generated} 枚を新規生成（対象 ${targets.length} ショット）` }
  },
}
