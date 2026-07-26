import { existsSync } from 'node:fs'
import path from 'node:path'
import { commandExists, execCommand } from './exec.js'

/**
 * codex exec 経由で GPT Image 2 の静止画素材を生成するアダプタ。
 *
 * codex CLI は非対話の 1 ターンをまるごと実行できる（`codex exec "<指示>"`）。
 * そこで「この絶対パスに画像を書き出せ」という指示を渡し、
 * ファイルが出来ているかで成否を判定する。
 * codex が内部で画像 API を呼ぶため、OPENAI_API_KEY か codex login の認証が要る。
 */
export interface CodexImageRequest {
  prompt: string
  /** 出力先の絶対パス（.png） */
  outPath: string
  width: number
  height: number
  /** 画風を揃えるための共通指示。企画工程の tone を渡す */
  styleGuide?: string
}

export const CODEX_IMAGE_MODEL = 'gpt-image-2'

export async function generateImage(req: CodexImageRequest): Promise<string> {
  if (!(await commandExists('codex'))) {
    throw new Error('codex CLI が見つかりません。`npm i -g @openai/codex` を実行してください。')
  }

  const workdir = path.dirname(req.outPath)
  const instruction = [
    `OpenAI の画像生成モデル ${CODEX_IMAGE_MODEL} を使って画像を 1 枚生成し、`,
    `次の絶対パスに PNG として保存してください: ${req.outPath}`,
    '',
    `サイズ: ${req.width}x${req.height}`,
    req.styleGuide ? `全体の画風: ${req.styleGuide}` : '',
    '',
    '生成する画像の内容:',
    req.prompt,
    '',
    '制約:',
    '- 保存先のパスは上記から変更しないこと',
    '- 保存が完了したら、それ以外のファイルは作らないこと',
    '- 説明文は不要。保存できたら DONE とだけ出力すること',
  ]
    .filter(Boolean)
    .join('\n')

  const result = await execCommand(
    'codex',
    [
      'exec',
      '--cd',
      workdir,
      '--sandbox',
      'workspace-write',
      '--skip-git-repo-check',
      instruction,
    ],
    { timeoutMs: 15 * 60 * 1000 },
  )

  if (!existsSync(req.outPath)) {
    throw new Error(
      `codex exec が画像を出力しませんでした (exit ${result.code})。` +
        `stderr: ${result.stderr.trim().slice(0, 500)}`,
    )
  }
  return req.outPath
}
