import type { AgentTask, Project, StepName } from '../types.js'

/**
 * MCP ブリッジ。
 *
 * Kling / Figma / video-use は MCP ないし Claude Code スキルとして提供されており、
 * Node プロセスからは呼べない。呼べるのは Claude 本体だけである。
 *
 * そこで agent 層のステップは「Claude への作業指示」を project.agentTask に書き出して停止する。
 * Claude はそれを読んで MCP を実行し、結果を writeback（`studio writeback`）してから run を再開する。
 *
 * この往復を明示的な成果物にしておくことで、
 * 「どこまで進んで、次に誰が何をするのか」がプロジェクト単位で常に追跡できる。
 */
export function requestAgentWork(
  project: Project,
  input: {
    step: StepName
    tool: string
    instruction: string
    requests: Array<{ shotId: string; params: Record<string, unknown> }>
  },
): AgentTask {
  const task: AgentTask = {
    step: input.step,
    tool: input.tool,
    instruction: input.instruction,
    requests: input.requests,
    createdAt: new Date().toISOString(),
  }
  project.agentTask = task
  return task
}

/** Claude が MCP 実行を終えたら、このヘルパーで依頼を閉じる */
export function clearAgentWork(project: Project): void {
  project.agentTask = null
}

export const TOOL_IDS = {
  // Kling のツール名・モデル・ペイロード構築は adapters/kling.ts（KLING_TOOLS / KLING_MODELS）が持つ
  figmaDesignContext: 'mcp__Figma__get_design_context',
  figmaExportVideo: 'mcp__Figma__export_video',
  figmaDownloadAssets: 'mcp__Figma__download_assets',
  /** video-use は MCP ではなく Claude Code スキル。Claude が直接駆動する */
  videoUseSkill: 'skill:video-use',
} as const
