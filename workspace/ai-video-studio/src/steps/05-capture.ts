import { requestAgentWork, TOOL_IDS } from '../adapters/mcp-bridge.js'
import { ASSET_DIRS, assetsOfShot } from '../project.js'
import type { Step } from '../types.js'

/**
 * 工程5: 実写編集。
 *
 * video-use（browser-use/video-use）が担当する。
 * これは MCP ではなく Claude Code スキルなので、Claude 本体が駆動する agent 層。
 *
 * video-use の役割:
 *  - フィラー語（えー・あの）と無音の除去
 *  - セグメント単位のカラーグレード
 *  - カット境界の 30ms オーディオフェード（ポップノイズ防止）
 *  - 単語レベル ASR（ElevenLabs Scribe）に基づく正確なカット位置
 *
 * captureSpec を持つショットが対象。無ければスキップして次工程へ進む。
 */
export const captureStep: Step = {
  name: 'capture',
  label: '実写編集',
  layer: 'agent',
  requires: ['script'],
  async run({ project, log }) {
    const targets = project.shots.filter((s) => s.captureSpec !== null)

    if (targets.length === 0) {
      return { note: '実写を使うショットが無いためスキップ' }
    }

    const pending = targets.filter((s) => assetsOfShot(project, s.id, 'footage').length === 0)

    if (pending.length === 0) {
      log(`${targets.length} ショットすべてにフッテージが登録済み`)
      return { note: `フッテージ ${targets.length} 件を確認` }
    }

    requestAgentWork(project, {
      step: 'capture',
      tool: TOOL_IDS.videoUseSkill,
      instruction: [
        `${pending.length} 件のショットについて実写フッテージを用意し、video-use で編集してください。`,
        '',
        '手順:',
        `1. 素材を projects/${project.id}/${ASSET_DIRS.footage}/ に置く`,
        '2. video-use スキルを起動し、そのディレクトリを対象に編集を依頼する',
        '3. video-use の Hard Rules を厳守すること。特に:',
        '   - カットは必ず単語境界にスナップさせる（単語の途中で切らない）',
        '   - 全カット境界に 30ms のオーディオフェードを入れる',
        '   - セグメント抽出 → ロスレス concat（単一 filtergraph で通さない）',
        '   - 字幕は工程6で最後に焼くので、ここでは焼き込まない',
        '',
        `4. 完成したクリップを ${ASSET_DIRS.footage}/<shotId>.mp4 として保存`,
        '5. project.json の assets[] に kind=footage / source=video-use で登録し、',
        '   対応ショットの assetIds に追加してから run を再開',
        '',
        '前提: ffmpeg と ELEVENLABS_API_KEY が必要です（doctor コマンドで確認できます）。',
      ].join('\n'),
      requests: pending.map((s) => ({
        shotId: s.id,
        params: {
          task: s.captureSpec?.task ?? '',
          url: s.captureSpec?.url ?? null,
          durationSec: s.durationInFrames / project.spec.fps,
        },
      })),
    })

    return {
      awaitingAgent: true,
      note: `video-use による実写編集待ち ${pending.length} 件`,
    }
  },
}
