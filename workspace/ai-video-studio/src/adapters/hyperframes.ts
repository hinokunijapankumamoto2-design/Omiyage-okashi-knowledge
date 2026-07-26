import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { execCommand } from './exec.js'

/**
 * HyperFrames（heygen-com/hyperframes）アダプタ。
 *
 * 「HTML を書く → 決定論的に MP4 / 透過 WebM を出す」フレームワーク。
 * 本スタジオではモーション制作工程のうち、
 * テキストアニメーション・図解・ロワーサード等の
 * “作り込みが要るオーバーレイ” を担当する。
 *
 * 生成系のモーション（実写風の動き）は Kling 側の担当。
 *
 * CLI: `hyperframes render -c <composition.html> -o <out>`
 *      プロジェクトディレクトリ（index.html を持つ）の中で実行する。
 */
export interface HyperframesScene {
  /** シーン名。ディレクトリ名になる */
  name: string
  /** 合成する HTML 本体 */
  html: string
  durationSec: number
  width: number
  height: number
  /** 透過オーバーレイとして出すなら 'webm'、単体クリップなら 'mp4' */
  format: 'mp4' | 'webm'
}

/** HyperFrames プロジェクトの雛形を書き出す */
export async function scaffoldScene(sceneDir: string, scene: HyperframesScene): Promise<string> {
  await mkdir(sceneDir, { recursive: true })

  const indexPath = path.join(sceneDir, 'index.html')
  await writeFile(indexPath, scene.html, 'utf8')

  // HyperFrames はメタ情報を index.html の data 属性から読む構成にできるが、
  // 尺・解像度は render 時に CLI 引数で明示するのが確実なため設定を併記しておく。
  await writeFile(
    path.join(sceneDir, 'scene.json'),
    `${JSON.stringify(
      {
        name: scene.name,
        durationSec: scene.durationSec,
        width: scene.width,
        height: scene.height,
        format: scene.format,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  return indexPath
}

export async function renderScene(
  sceneDir: string,
  outPath: string,
  scene: Pick<HyperframesScene, 'format'>,
): Promise<string> {
  if (!existsSync(path.join(sceneDir, 'index.html'))) {
    throw new Error(`HyperFrames シーンに index.html がありません: ${sceneDir}`)
  }

  const args = ['hyperframes', 'render', '-o', outPath]
  if (scene.format === 'webm') {
    args.push('--format', 'webm')
  }

  const result = await execCommand('npx', args, {
    cwd: sceneDir,
    timeoutMs: 20 * 60 * 1000,
  })

  if (result.code !== 0 || !existsSync(outPath)) {
    throw new Error(
      `hyperframes render が失敗しました (exit ${result.code}): ${result.stderr.trim().slice(0, 500)}`,
    )
  }
  return outPath
}

/**
 * ショットの字幕・見出しを載せる標準オーバーレイ HTML。
 * ここは “worked example” であって固定仕様ではない。案件ごとに差し替えてよい。
 */
export function overlayTemplate(input: {
  headline: string
  sub?: string
  width: number
  height: number
  durationSec: number
}): string {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; width: ${input.width}px; height: ${input.height}px; background: transparent; }
      .stage {
        width: 100%; height: 100%;
        display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
        padding-bottom: 12%; box-sizing: border-box;
        font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
      }
      .headline {
        font-size: ${Math.round(input.width * 0.075)}px; font-weight: 800; color: #fff;
        text-shadow: 0 4px 24px rgba(0,0,0,.6); letter-spacing: .02em; text-align: center;
        animation: rise .6s cubic-bezier(.2,.8,.2,1) both;
      }
      .sub {
        margin-top: .5em; font-size: ${Math.round(input.width * 0.038)}px; color: #ffe8a3;
        text-shadow: 0 2px 12px rgba(0,0,0,.6);
        animation: rise .6s .18s cubic-bezier(.2,.8,.2,1) both;
      }
      @keyframes rise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
    </style>
  </head>
  <body data-duration="${input.durationSec}">
    <div class="stage">
      <div class="headline">${escapeHtml(input.headline)}</div>
      ${input.sub ? `<div class="sub">${escapeHtml(input.sub)}</div>` : ''}
    </div>
  </body>
</html>
`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
