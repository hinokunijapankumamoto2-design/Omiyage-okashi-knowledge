import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { execCommand } from './exec.js'
import { envWithFfmpeg } from './ffmpeg.js'

const require = createRequire(import.meta.url)

/**
 * HyperFrames（heygen-com/hyperframes）アダプタ。
 *
 * 「HTML を書く → 決定論的に MP4 / 透過 WebM を出す」フレームワーク。
 * 本スタジオではモーション制作工程のうち、
 * テキストアニメーション・図解・ロワーサード等の
 * “再現性が要るオーバーレイ” を担当する。
 *
 * 生成系のモーション（実写風の動き）は Kling 側の担当。
 *
 * ## 合成コントラクト（実際の仕様に準拠）
 *
 * - ルート要素に `data-composition-id` / `data-width` / `data-height` / `data-duration`
 * - 尺を持つ要素は `class="clip"` と `data-start` / `data-duration` / `data-track-index`
 * - GSAP のタイムラインは `{ paused: true }` で作り `window.__timelines[id]` に登録する
 *   （HyperFrames がフレームごとに seek するため、自走するアニメーションは使えない）
 *
 * ## GSAP をローカルに同梱する理由
 *
 * 公式の雛形は GSAP を jsdelivr の CDN から読む。しかし本実行環境では
 * 送信プロキシが CDN を 403 で遮断するため、CDN 参照のままだと
 * タイムライン登録スクリプトが読み込まれず `sub_timeline_script_failure` になり、
 * **警告は出るがレンダリング自体は成功してしまう**（アニメーションだけが静止する）。
 *
 * 見逃しやすい失敗なので、node_modules の GSAP をシーンごとにコピーして
 * 相対パスで参照する。ネットワークに依存しないぶん再現性も上がる。
 */
export interface HyperframesScene {
  /** シーン名。composition-id とディレクトリ名になる */
  name: string
  /** 合成する HTML 本体 */
  html: string
  durationSec: number
  width: number
  height: number
  fps: number
  /** 透過オーバーレイとして出すなら 'webm'、単体クリップなら 'mp4' */
  format: 'mp4' | 'webm'
}

function gsapSourcePath(): string {
  return require.resolve('gsap/dist/gsap.min.js')
}

/** HyperFrames プロジェクトの実体を書き出す */
export async function scaffoldScene(sceneDir: string, scene: HyperframesScene): Promise<string> {
  await mkdir(sceneDir, { recursive: true })

  // CDN が使えないため GSAP をシーン内に同梱する
  await copyFile(gsapSourcePath(), path.join(sceneDir, 'gsap.min.js'))

  await writeFile(
    path.join(sceneDir, 'meta.json'),
    `${JSON.stringify({ id: scene.name, name: scene.name, createdAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  )

  await writeFile(
    path.join(sceneDir, 'hyperframes.json'),
    `${JSON.stringify(
      {
        $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json',
        paths: { blocks: 'compositions', components: 'compositions/components', assets: 'assets' },
        media: { autoProxy: false },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  const indexPath = path.join(sceneDir, 'index.html')
  await writeFile(indexPath, scene.html, 'utf8')
  return indexPath
}

export interface RenderSceneOptions {
  format: 'mp4' | 'webm'
  fps: number
  quality?: 'draft' | 'standard' | 'high'
}

export async function renderScene(
  sceneDir: string,
  outPath: string,
  options: RenderSceneOptions,
): Promise<string> {
  if (!existsSync(path.join(sceneDir, 'index.html'))) {
    throw new Error(`HyperFrames シーンに index.html がありません: ${sceneDir}`)
  }

  const result = await execCommand(
    'npx',
    [
      'hyperframes',
      'render',
      '--output',
      outPath,
      '--format',
      options.format,
      '--fps',
      String(options.fps),
      '--quality',
      options.quality ?? 'high',
    ],
    {
      cwd: sceneDir,
      // HyperFrames は PATH 上の ffmpeg / ffprobe を必須とする
      env: envWithFfmpeg(),
      timeoutMs: 30 * 60 * 1000,
    },
  )

  if (result.code !== 0 || !existsSync(outPath)) {
    throw new Error(
      `hyperframes render が失敗しました (exit ${result.code}): ${result.stderr.trim().slice(0, 600)}`,
    )
  }

  // レンダリングは成功扱いでも、タイムラインが読めていなければ
  // アニメーションが静止したまま出力される。見逃さないよう明示的に落とす。
  const combined = `${result.stdout}\n${result.stderr}`
  if (combined.includes('sub_timeline_script_failure')) {
    throw new Error(
      'HyperFrames のタイムラインスクリプトが読み込めませんでした。' +
        'アニメーションが適用されない出力になるため中断します。' +
        '（シーンディレクトリに gsap.min.js が同梱されているか確認してください）',
    )
  }

  return outPath
}

/**
 * ショットの見出しを載せる標準オーバーレイ。
 * これは “worked example” であって固定仕様ではない。案件ごとに差し替えてよい。
 */
export function overlayTemplate(input: {
  compositionId: string
  headline: string
  sub?: string
  width: number
  height: number
  fps: number
  durationSec: number
}): string {
  const headlineSize = Math.round(input.width * 0.075)
  const subSize = Math.round(input.width * 0.038)

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${input.width}, height=${input.height}" />
    <script src="./gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: ${input.width}px; height: ${input.height}px; overflow: hidden;
        background: transparent;
        font-family: "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
      }
      .headline, .sub {
        position: absolute; left: 6%; right: 6%;
        text-align: center;
      }
      .headline {
        bottom: ${input.sub ? '16%' : '12%'};
        font-size: ${headlineSize}px; font-weight: 800; color: #fff;
        line-height: 1.3; letter-spacing: .02em;
        text-shadow: 0 4px 24px rgba(0,0,0,.6);
      }
      .sub {
        bottom: 11%;
        font-size: ${subSize}px; color: #ffe8a3;
        text-shadow: 0 2px 12px rgba(0,0,0,.6);
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="${input.compositionId}"
      data-start="0"
      data-duration="${input.durationSec}"
      data-fps="${input.fps}"
      data-width="${input.width}"
      data-height="${input.height}"
    >
      <div class="headline clip" id="headline"
           data-start="0" data-duration="${input.durationSec}" data-track-index="0">${escapeHtml(input.headline)}</div>
      ${
        input.sub
          ? `<div class="sub clip" id="sub"
           data-start="0" data-duration="${input.durationSec}" data-track-index="1">${escapeHtml(input.sub)}</div>`
          : ''
      }
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.from("#headline", { opacity: 0, y: 28, duration: 0.6, ease: "power3.out" }, 0);
      ${input.sub ? `tl.from("#sub", { opacity: 0, y: 28, duration: 0.6, ease: "power3.out" }, 0.18);` : ''}
      window.__timelines["${input.compositionId}"] = tl;
    </script>
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
