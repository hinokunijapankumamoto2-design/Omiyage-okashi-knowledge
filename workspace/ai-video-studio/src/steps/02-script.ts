import { requestAgentWork, TOOL_IDS } from '../adapters/mcp-bridge.js'
import type { Step } from '../types.js'

/**
 * 工程2: 台本。
 *
 * 企画をショット列に割る。ここで決まる shots[] が
 * 以降すべての工程（素材生成・モーション・実写・字幕・合成）の作業単位になる。
 * durationInFrames の合計が目標尺に一致していることを検証する。
 */
export const scriptStep: Step = {
  name: 'script',
  label: '台本',
  layer: 'agent',
  requires: ['plan'],
  async run({ project, log }) {
    if (project.shots.length > 0) {
      const total = project.shots.reduce((s, x) => s + x.durationInFrames, 0)
      const targetFrames = Math.round(project.spec.targetDurationSec * project.spec.fps)
      const driftSec = Math.abs(total - targetFrames) / project.spec.fps

      if (driftSec > 1.5) {
        throw new Error(
          `ショット尺の合計が目標尺から ${driftSec.toFixed(1)}秒ずれています` +
            `（合計 ${total}f / 目標 ${targetFrames}f）。台本を調整してください。`,
        )
      }
      log(`${project.shots.length} ショット / 合計 ${total}フレーム`)
      return { note: `${project.shots.length} ショット` }
    }

    requestAgentWork(project, {
      step: 'script',
      tool: TOOL_IDS.videoUseSkill,
      instruction: [
        '企画（plan）をもとに台本を書き、project.json の shots[] を埋めてください。',
        '',
        `目標尺: ${project.spec.targetDurationSec}秒 = ${Math.round(
          project.spec.targetDurationSec * project.spec.fps,
        )}フレーム（${project.spec.fps}fps）`,
        '各ショットに必要な項目:',
        '  id / index / description / narration / caption / durationInFrames',
        '  imagePrompt   … 工程3（codex + GPT Image 2）に渡す静止画プロンプト',
        '  motionPrompt  … 工程4（Kling / HyperFrames）に渡すモーション指示',
        '  captureSpec   … 実写・画面収録が要るショットのみ。不要なら null',
        '',
        '制約: durationInFrames の合計を目標フレーム数に一致させること（誤差 1.5 秒以内）。',
      ].join('\n'),
      requests: [],
    })

    return { awaitingAgent: true, note: 'Claude が台本を書いて shots[] を埋めるのを待っています' }
  },
}
