import { isStepDone, loadProject, projectDir, saveProject, setStepStatus } from './project.js'
import type { Project, Step, StepName } from './types.js'
import { STEP_NAMES } from './types.js'

import { planStep } from './steps/01-plan.js'
import { scriptStep } from './steps/02-script.js'
import { imageStep } from './steps/03-image.js'
import { motionStep } from './steps/04-motion.js'
import { captureStep } from './steps/05-capture.js'
import { subtitleStep } from './steps/06-subtitle.js'
import { composeStep } from './steps/07-compose.js'
import { renderStep } from './steps/08-render.js'

/** 8工程。配列の順序が実行順序 */
export const STEPS: Step[] = [
  planStep,
  scriptStep,
  imageStep,
  motionStep,
  captureStep,
  subtitleStep,
  composeStep,
  renderStep,
]

export function findStep(name: StepName): Step {
  const step = STEPS.find((s) => s.name === name)
  if (!step) throw new Error(`未定義のステップです: ${name}`)
  return step
}

export interface RunOptions {
  /** ここまで実行したら止める（含む）。省略時は最後まで */
  until?: StepName
  /** 指定ステップだけを実行する */
  only?: StepName
  /** done のステップも再実行する */
  force?: boolean
}

export interface RunOutcome {
  project: Project
  /** agent 層で停止した場合、そのステップ名 */
  stoppedAt: StepName | null
  executed: StepName[]
}

/**
 * パイプラインを進められるところまで進める。
 *
 * agent 層のステップ（Kling / Figma）は Node から MCP を呼べないため、
 * project.agentTask に作業指示を書き出して停止する。
 * Claude が MCP を実行して結果を writeback したのち、再度 run を呼ぶと続きから進む。
 */
export async function run(projectId: string, options: RunOptions = {}): Promise<RunOutcome> {
  const project = await loadProject(projectId)
  const dir = projectDir(projectId)
  const executed: StepName[] = []

  const targets = options.only
    ? [findStep(options.only)]
    : STEPS.slice(0, options.until ? STEP_NAMES.indexOf(options.until) + 1 : undefined)

  for (const step of targets) {
    if (!options.force && isStepDone(project, step.name)) {
      log(`⏭  ${step.name} (${step.label}) — 完了済みのためスキップ`)
      continue
    }

    const missing = step.requires.filter((r) => !isStepDone(project, r))
    if (missing.length > 0 && !options.only) {
      throw new Error(
        `${step.name} は ${missing.join(', ')} の完了が前提です。先にそちらを実行してください。`,
      )
    }

    log(`▶  ${step.name} (${step.label}) [${step.layer}層]`)
    setStepStatus(project, step.name, 'pending')

    try {
      const result = await step.run({
        project,
        dir,
        log: (m) => log(`   ${m}`),
      })

      if (result.awaitingAgent) {
        setStepStatus(project, step.name, 'awaiting-agent', result.note ?? null)
        await saveProject(project)
        log(`⏸  ${step.name} は Claude の MCP 実行待ちです`)
        log(`   ${result.note ?? ''}`)
        return { project, stoppedAt: step.name, executed }
      }

      setStepStatus(project, step.name, 'done', result.note ?? null)
      executed.push(step.name)
      await saveProject(project)
      log(`✅ ${step.name} 完了`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStepStatus(project, step.name, 'failed', message)
      await saveProject(project)
      throw new Error(`${step.name} が失敗しました: ${message}`)
    }
  }

  return { project, stoppedAt: null, executed }
}

function log(message: string): void {
  process.stdout.write(`${message}\n`)
}
