#!/usr/bin/env node
import { commandExists, execCommand } from './adapters/exec.js'
import { resolveFfmpeg } from './adapters/ffmpeg.js'
import { run, STEPS } from './orchestrator.js'
import { createProject, loadProject } from './project.js'
import { STEP_NAMES, type StepName } from './types.js'

const [, , command, ...rest] = process.argv

function out(s = ''): void {
  process.stdout.write(`${s}\n`)
}

function flag(name: string): string | undefined {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : undefined
}

async function main(): Promise<void> {
  switch (command) {
    case 'new': {
      const id = rest[0]
      if (!id) throw new Error('使い方: studio new <projectId> --title <題名> --brief <企画の入力>')
      const project = await createProject({
        id,
        title: flag('title') ?? id,
        brief: flag('brief') ?? '',
        spec: {
          width: Number(flag('width') ?? 1080),
          height: Number(flag('height') ?? 1920),
          fps: Number(flag('fps') ?? 30),
          targetDurationSec: Number(flag('duration') ?? 30),
        },
      })
      out(`プロジェクトを作成しました: projects/${project.id}`)
      out(`次: npm run studio -- run ${project.id}`)
      break
    }

    case 'run': {
      const id = rest[0]
      if (!id) throw new Error('使い方: studio run <projectId> [--only <step>] [--until <step>] [--force]')
      const only = flag('only') as StepName | undefined
      const until = flag('until') as StepName | undefined
      for (const s of [only, until]) {
        if (s && !STEP_NAMES.includes(s)) {
          throw new Error(`不正なステップ名です: ${s}（有効: ${STEP_NAMES.join(', ')}）`)
        }
      }

      const outcome = await run(id, { only, until, force: rest.includes('--force') })

      if (outcome.stoppedAt) {
        const task = outcome.project.agentTask
        out('')
        out('─'.repeat(60))
        out(`Claude への作業依頼（工程: ${outcome.stoppedAt}）`)
        out(`使用ツール: ${task?.tool ?? '-'}`)
        out('─'.repeat(60))
        out(task?.instruction ?? '')
        if (task && task.requests.length > 0) {
          out('')
          out(`対象ショット ${task.requests.length} 件:`)
          for (const r of task.requests) out(`  - ${r.shotId}`)
        }
        out('─'.repeat(60))
        process.exitCode = 2
      } else {
        out('')
        out(`パイプライン完了。実行したステップ: ${outcome.executed.join(' → ') || 'なし'}`)
      }
      break
    }

    case 'status': {
      const id = rest[0]
      if (!id) throw new Error('使い方: studio status <projectId>')
      const project = await loadProject(id)
      out(`${project.title}（${project.id}）`)
      out(`  ${project.spec.width}x${project.spec.height} / ${project.spec.fps}fps / 目標 ${project.spec.targetDurationSec}秒`)
      out(`  ショット ${project.shots.length} 件 / 素材 ${project.assets.length} 件`)
      out('')
      for (const step of STEPS) {
        const state = project.steps[step.name]
        const mark =
          state?.status === 'done'
            ? '✅'
            : state?.status === 'awaiting-agent'
              ? '⏸ '
              : state?.status === 'failed'
                ? '❌'
                : '  '
        out(`  ${mark} ${step.name.padEnd(9)} ${step.label.padEnd(12)} [${step.layer}層] ${state?.note ?? ''}`)
      }
      if (project.agentTask) {
        out('')
        out(`未処理の Claude 依頼あり（工程: ${project.agentTask.step} / ${project.agentTask.tool}）`)
      }
      break
    }

    case 'doctor': {
      out('=== AI 動画制作スタジオ 依存チェック ===')
      out('')

      const codex = await commandExists('codex')
      out(`${codex ? '✅' : '❌'} codex CLI            工程3（GPT Image 2 素材生成）`)
      if (!codex) out('     → npm i -g @openai/codex')

      const ffmpegPath = resolveFfmpeg()
      const ffmpegOk = (await execCommand(ffmpegPath, ['-version'])).code === 0
      out(`${ffmpegOk ? '✅' : '❌'} ffmpeg               工程5（video-use の実写編集）`)
      out(`     → ${ffmpegPath}`)

      const hf = await execCommand('npx', ['--no-install', 'hyperframes', '--version'])
      out(`${hf.code === 0 ? '✅' : '⚠️ '} hyperframes          工程4（HTML→動画のオーバーレイ）`)
      if (hf.code !== 0) out('     → npm install（package.json に含まれています）')

      out(`${process.env.OPENAI_API_KEY ? '✅' : '⚠️ '} OPENAI_API_KEY       codex の画像生成に必要`)
      if (!process.env.OPENAI_API_KEY) out('     → 未設定の場合は codex login で認証してください')

      out(`${process.env.ELEVENLABS_API_KEY ? '✅' : '⚠️ '} ELEVENLABS_API_KEY   video-use の単語レベル ASR に必要`)

      out('')
      out('MCP / スキル（Claude 本体が実行するため、この CLI からは検証できません）:')
      out('  - Kling MCP        工程4。未接続なら higgsfield の kling3_0 系で代替')
      out('  - Figma MCP        工程1。デザイントーンの参照元')
      out('  - video-use skill  工程5。~/.claude/skills/video-use に登録が必要')
      break
    }

    default:
      out('AI 動画制作スタジオ')
      out('')
      out('  studio new <id> --title <題名> --brief <企画> [--width --height --fps --duration]')
      out('  studio run <id> [--only <step>] [--until <step>] [--force]')
      out('  studio status <id>')
      out('  studio doctor')
      out('')
      out(`  工程: ${STEP_NAMES.join(' → ')}`)
      break
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
