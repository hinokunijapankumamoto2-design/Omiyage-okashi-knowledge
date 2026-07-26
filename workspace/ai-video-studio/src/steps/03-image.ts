import path from 'node:path'
import { existsSync } from 'node:fs'
import { generateImage, CODEX_IMAGE_MODEL } from '../adapters/codex-image.js'
import { commandExists } from '../adapters/exec.js'
import { buildTextToImageRequest, KLING_TOOLS } from '../adapters/kling.js'
import { requestAgentWork } from '../adapters/mcp-bridge.js'
import { addAsset, ASSET_DIRS, assetsOfShot } from '../project.js'
import type { Step } from '../types.js'

/**
 * 工程3: 素材生成（静止画）。モデルはどちらの経路でも GPT Image 2。
 *
 * 経路1（script 層・既定）: codex exec で生成する。ローカルマシン向け。
 * 経路2（agent 層・フォールバック）: codex が無い / OpenAI 認証が無い環境では、
 *   Kling MCP の text_to_image が同じ gpt-image-2 を提供しているので、
 *   Claude への作業依頼に切り替える。リモートセッションはこちらになる。
 *
 * どちらで生成しても、成果物の置き場と登録方法は同一。
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
    const pending = targets.filter((shot) => {
      const outPath = path.join(dir, ASSET_DIRS.image, `${shot.id}.png`)
      return !(assetsOfShot(project, shot.id, 'image').length > 0 && existsSync(outPath))
    })

    if (pending.length === 0) {
      log(`${targets.length} ショットすべて生成済み`)
      return { note: `生成済み ${targets.length} 枚を確認` }
    }

    // 経路の選択: codex が使えるかどうか
    const codexAvailable = await commandExists('codex')
    const openaiAuthLikely =
      Boolean(process.env.OPENAI_API_KEY) || existsSync(`${process.env.HOME}/.codex/auth.json`)

    if (codexAvailable && openaiAuthLikely) {
      let generated = 0
      for (const shot of pending) {
        const outPath = path.join(dir, ASSET_DIRS.image, `${shot.id}.png`)
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
      return { note: `codex 経由で ${generated} 枚を生成` }
    }

    // フォールバック: Kling MCP の gpt-image-2 に依頼する
    log(
      codexAvailable
        ? 'OpenAI 認証が無いため Kling MCP（gpt-image-2）に切り替えます'
        : 'codex CLI が無いため Kling MCP（gpt-image-2）に切り替えます',
    )

    requestAgentWork(project, {
      step: 'image',
      tool: KLING_TOOLS.textToImage,
      instruction: [
        `${pending.length} 件のショットの静止画を Kling MCP の gpt-image-2 で生成してください。`,
        '生成は課金されます。実行前にユーザーの承認と',
        `${KLING_TOOLS.credits} でのクレジット残高確認を必ず行うこと。`,
        '',
        '各リクエストの params は text_to_image にそのまま渡せる形になっています。手順:',
        `1. ${KLING_TOOLS.textToImage} を params の model / arguments で呼ぶ`,
        `2. 返った generationId を ${KLING_TOOLS.queryTasks} でポーリングする`,
        '3. 完了したら works[].url を assets/images/<shotId>.png に即ダウンロードする',
        '   （URL は 24 時間で失効する）',
        '4. project.json の assets[] に kind=image / source=kling:gpt-image-2 で登録し、',
        '   対応ショットの assetIds に追加、agentTask を null に戻して run を再開する',
      ].join('\n'),
      requests: pending.map((shot) => ({
        shotId: shot.id,
        params: { ...buildTextToImageRequest(shot.imagePrompt, project.spec, styleGuide) },
      })),
    })

    return {
      awaitingAgent: true,
      note: `Kling MCP（gpt-image-2）による静止画生成待ち ${pending.length} 件`,
    }
  },
}
