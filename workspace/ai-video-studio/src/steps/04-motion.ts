import path from 'node:path'
import { existsSync } from 'node:fs'
import { overlayTemplate, renderScene, scaffoldScene } from '../adapters/hyperframes.js'
import { buildImageToVideoRequest, KLING_TOOLS } from '../adapters/kling.js'
import { requestAgentWork } from '../adapters/mcp-bridge.js'
import { addAsset, ASSET_DIRS, assetsOfShot } from '../project.js'
import type { Shot, Step } from '../types.js'

/**
 * 工程4: モーション制作。
 *
 * 2 系統をショット単位で使い分けるハイブリッドステップ。
 *
 *  - HyperFrames（script 層）: HTML で作り込むテキストアニメ・図解・ロワーサード。
 *    決定論的に出るので、同じ入力なら毎回同じ絵になる。
 *  - Kling（agent 層）: 静止画を動かす生成モーション。MCP 経由なので Claude が実行する。
 *
 * 判定は motionPrompt の中身ではなく、ショットが静止画素材を持つかどうかで行う。
 * 静止画がある = その絵を動かしたい → Kling。無い = ゼロから作る → HyperFrames。
 */
function usesKling(shot: Shot, hasImage: boolean): boolean {
  return hasImage && shot.motionPrompt.trim().length > 0
}

export const motionStep: Step = {
  name: 'motion',
  label: 'モーション制作',
  layer: 'script',
  requires: ['script'],
  async run({ project, dir, log }) {
    const klingRequests: Array<{ shotId: string; params: Record<string, unknown> }> = []
    let hyperframesCount = 0

    for (const shot of project.shots) {
      if (shot.motionPrompt.trim().length === 0) continue
      if (assetsOfShot(project, shot.id, 'motion').length > 0) {
        log(`${shot.id}: モーション作成済みのためスキップ`)
        continue
      }

      const image = assetsOfShot(project, shot.id, 'image')[0]

      if (usesKling(shot, Boolean(image)) && image?.path) {
        klingRequests.push({
          shotId: shot.id,
          params: { ...buildImageToVideoRequest(shot, project.spec, image.path) },
        })
        continue
      }

      // HyperFrames 側: HTML を組んで決定論レンダリング
      const sceneDir = path.join(dir, ASSET_DIRS.motion, shot.id)
      const outRel = path.join(ASSET_DIRS.motion, `${shot.id}.webm`)
      const outPath = path.join(dir, outRel)

      const durationSec = shot.durationInFrames / project.spec.fps
      await scaffoldScene(sceneDir, {
        name: shot.id,
        html: overlayTemplate({
          compositionId: shot.id,
          headline: shot.caption || shot.description,
          sub: shot.narration ? undefined : project.plan?.keyMessage,
          width: project.spec.width,
          height: project.spec.height,
          fps: project.spec.fps,
          durationSec,
        }),
        durationSec,
        width: project.spec.width,
        height: project.spec.height,
        fps: project.spec.fps,
        // 実写・画像の上に重ねるので透過 WebM で出す
        format: 'webm',
      })

      log(`${shot.id}: HyperFrames でオーバーレイをレンダリング中…`)
      await renderScene(sceneDir, outPath, { format: 'webm', fps: project.spec.fps })

      if (!existsSync(outPath)) {
        throw new Error(`HyperFrames の出力が見つかりません: ${outPath}`)
      }

      addAsset(
        project,
        { id: `motion-${shot.id}`, kind: 'motion', path: outRel, source: 'hyperframes' },
        shot.id,
      )
      hyperframesCount += 1
    }

    if (klingRequests.length > 0) {
      requestAgentWork(project, {
        step: 'motion',
        tool: KLING_TOOLS.imageToVideo,
        instruction: [
          `${klingRequests.length} 件のショットを Kling でモーション化してください。`,
          '生成は課金されます。実行前にユーザーの承認と',
          `${KLING_TOOLS.credits} でのクレジット残高確認を必ず行うこと。`,
          '',
          '各リクエストの params は image_to_video にそのまま渡せる形になっています。手順:',
          `1. params.localImagePath（projects/<id>/ からの相対パス）を ${KLING_TOOLS.fileUpload} で`,
          '   アップロードする（チケット取得 → upload_url へ multipart POST: ticket + file）',
          '2. 返った URL を params.inputs[0].url に差し替えて',
          `   ${KLING_TOOLS.imageToVideo} を呼ぶ（model / arguments はそのまま使う）`,
          `3. 返った generationId を ${KLING_TOOLS.queryTasks} でポーリングする`,
          '4. 完了したら works[].url を assets/motion/<shotId>.mp4 に即ダウンロードする',
          '   （URL は 24 時間で失効する）',
          '5. project.json の assets[] に kind=motion / source=kling:<model> で登録し、',
          '   対応ショットの assetIds に追加、agentTask を null に戻して run を再開する',
        ].join('\n'),
        requests: klingRequests,
      })

      return {
        awaitingAgent: true,
        note: `HyperFrames ${hyperframesCount} 件完了。Kling 待ち ${klingRequests.length} 件`,
      }
    }

    return { note: `HyperFrames で ${hyperframesCount} 件のモーションを生成` }
  },
}
