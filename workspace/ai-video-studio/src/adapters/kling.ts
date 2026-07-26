import type { Shot, VideoSpec } from '../types.js'

/**
 * Kling MCP アダプタ。
 *
 * Kling は agent 層（MCP コネクタ経由で Claude が呼ぶ）なので、
 * このモジュールの役割は「正しい呼び出しペイロードを組み立てること」。
 * 実際のツール実行は Claude が agentTask を読んで行う。
 *
 * 仕様は who_am_i の実測値（2026-07-26 取得、Free プラン）に基づく。
 * モデル追加・引数変更はサーバー側で起きるため、疑わしいときは
 * who_am_i を再実行して照合すること。
 *
 * ## 呼び出しの流れ（Claude が実行する）
 *
 * 1. ローカル画像がある場合: mcp__kling__file_upload でチケットを取得し、
 *    upload_url に multipart/form-data（ticket, file）を POST → 返った URL を使う
 * 2. mcp__kling__image_to_video / text_to_image を呼ぶ → generationId が返る
 * 3. mcp__kling__query_tasks で完了までポーリング → works[].url を取得
 * 4. URL は 24 時間で失効するため、即座に assets/ にダウンロードして保存する
 */

export const KLING_TOOLS = {
  whoAmI: 'mcp__kling__who_am_i',
  credits: 'mcp__kling__query_membership_and_credits',
  fileUpload: 'mcp__kling__file_upload',
  imageToVideo: 'mcp__kling__image_to_video',
  textToVideo: 'mcp__kling__text_to_video',
  textToImage: 'mcp__kling__text_to_image',
  imageToImage: 'mcp__kling__image_to_image',
  queryTasks: 'mcp__kling__query_tasks',
} as const

export const KLING_MODELS = {
  /** 工程4の既定。静止画1枚を動かす最速モデル。尺 3〜15 秒 / 720p / 音声なし */
  imageToVideo: 'kling-video-v3_0_turbo',
  /** 音声つきが必要なとき（1080p 必須のため有償プラン限定になりがち） */
  imageToVideoWithAudio: 'kling-video-v2_6',
  /**
   * 工程3のフォールバック。codex exec が使えない環境でも
   * Kling MCP 経由で同じ GPT Image 2 に到達できる。
   */
  textToImage: 'gpt-image-2',
} as const

/** kling-video-v3_0_turbo が受け付ける尺（秒）。この範囲外は丸める */
const KLING_DURATION_MIN = 3
const KLING_DURATION_MAX = 15

/**
 * ショットの尺を Kling の許容値に丸める。
 * Kling の出力がショット尺より長い分には、合成時に Remotion が尻を切るだけなので
 * 常に切り上げ側に倒す（足りないと map: 尺が埋まらず黒が出る）。
 */
export function klingDurationForShot(shot: Shot, spec: VideoSpec): string {
  const sec = Math.ceil(shot.durationInFrames / spec.fps)
  return String(Math.min(KLING_DURATION_MAX, Math.max(KLING_DURATION_MIN, sec)))
}

/** gpt-image-2 が受ける aspect_ratio に最も近いものを選ぶ */
export function klingAspectRatio(spec: VideoSpec): string {
  const allowed: Array<[string, number]> = [
    ['1:1', 1],
    ['2:3', 2 / 3],
    ['3:2', 3 / 2],
    ['3:4', 3 / 4],
    ['4:3', 4 / 3],
    ['4:5', 4 / 5],
    ['5:4', 5 / 4],
    ['9:16', 9 / 16],
    ['16:9', 16 / 9],
    ['21:9', 21 / 9],
  ]
  const target = spec.width / spec.height
  let best = allowed[0]!
  for (const cand of allowed) {
    if (Math.abs(cand[1] - target) < Math.abs(best[1] - target)) best = cand
  }
  return best[0]
}

interface KlingArgument {
  name: string
  value: string
}

interface KlingInput {
  name: string
  inputType: 'URL'
  url: string
}

export interface KlingImageToVideoRequest {
  tool: typeof KLING_TOOLS.imageToVideo
  model: string
  arguments: KlingArgument[]
  inputs: KlingInput[]
  /** アップロード前のローカル画像。Claude が file_upload してから inputs に差し替える */
  localImagePath: string
}

/**
 * image_to_video の呼び出しペイロードを組み立てる。
 * localImagePath は projects/<id>/ からの相対パス。
 * Claude は file_upload で URL 化してから inputs[0].url を埋めること。
 */
export function buildImageToVideoRequest(
  shot: Shot,
  spec: VideoSpec,
  localImagePath: string,
): KlingImageToVideoRequest {
  return {
    tool: KLING_TOOLS.imageToVideo,
    model: KLING_MODELS.imageToVideo,
    arguments: [
      { name: 'prompt', value: shot.motionPrompt },
      { name: 'duration', value: klingDurationForShot(shot, spec) },
      { name: 'resolution', value: '720p' },
      { name: 'imageCount', value: '1' },
    ],
    inputs: [{ name: 'first_image', inputType: 'URL', url: '<file_upload の結果で置換>' }],
    localImagePath,
  }
}

export interface KlingTextToImageRequest {
  tool: typeof KLING_TOOLS.textToImage
  model: string
  arguments: KlingArgument[]
}

/** text_to_image（gpt-image-2）の呼び出しペイロードを組み立てる */
export function buildTextToImageRequest(
  prompt: string,
  spec: VideoSpec,
  styleGuide?: string,
): KlingTextToImageRequest {
  const fullPrompt = styleGuide ? `${prompt}\n\n全体の画風: ${styleGuide}` : prompt
  return {
    tool: KLING_TOOLS.textToImage,
    model: KLING_MODELS.textToImage,
    arguments: [
      { name: 'prompt', value: fullPrompt },
      { name: 'aspect_ratio', value: klingAspectRatio(spec) },
      { name: 'img_resolution', value: '2k' },
      { name: 'quality', value: 'medium' },
      { name: 'imageCount', value: '1' },
    ],
  }
}
