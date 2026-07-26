import { requestAgentWork, TOOL_IDS } from '../adapters/mcp-bridge.js'
import type { Step } from '../types.js'

/**
 * 工程1: 企画。
 *
 * 企画は LLM の仕事なので agent 層。Claude が brief を読んで plan を埋める。
 * Figma ファイルが指定されていれば、デザイントーンの source of truth として
 * get_design_context を引いてから plan.tone を決める。
 */
export const planStep: Step = {
  name: 'plan',
  label: '企画',
  layer: 'agent',
  requires: [],
  async run({ project }) {
    if (project.plan) {
      return { note: '企画は入力済み' }
    }

    requestAgentWork(project, {
      step: 'plan',
      tool: TOOL_IDS.figmaDesignContext,
      instruction: [
        `brief を読んで企画を固め、project.json の plan を埋めてください。`,
        '',
        `brief: ${project.brief}`,
        `尺: ${project.spec.targetDurationSec}秒 / ${project.spec.width}x${project.spec.height} / ${project.spec.fps}fps`,
        '',
        '埋める項目: concept / targetAudience / keyMessage / tone / figmaFileKey',
        'Figma ファイルが指定されている場合は get_design_context でトーンとカラーを確認し、',
        'tone にその要約を反映してください。',
        '',
        '完了したら project.json の plan を直接編集し、agentTask を null に戻してから run を再開してください。',
      ].join('\n'),
      requests: [],
    })

    return { awaitingAgent: true, note: 'Claude が企画を策定して plan を埋めるのを待っています' }
  },
}
