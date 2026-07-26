import { z } from 'zod'

/**
 * 8工程の定義。この順序がパイプラインの実行順序そのものになる。
 */
export const STEP_NAMES = [
  'plan', // 企画
  'script', // 台本
  'image', // 素材生成（静止画）
  'motion', // モーション制作
  'capture', // 実写・画面収録
  'subtitle', // 字幕
  'compose', // 画面合成
  'render', // 最終レンダリング
] as const

export type StepName = (typeof STEP_NAMES)[number]

/**
 * 実行層。この区別がスタジオ設計の中心にある。
 *
 * - script: Node プロセスから直接実行できる（codex exec / video-use / Remotion / ffmpeg）
 * - agent:  MCP 経由でしか呼べず、Claude 本体が実行する（Kling / Figma）
 *
 * agent 層のステップに到達するとオーケストレータは停止し、
 * project.json に「Claude が何をすべきか」を agentTask として書き出す。
 * Claude が MCP を呼び、結果を writeback してから run を再開する。
 */
export type ExecutionLayer = 'script' | 'agent'

export const AssetKindSchema = z.enum([
  'image', // 静止画素材
  'motion', // モーションクリップ
  'footage', // 実写・画面収録フッテージ
  'audio', // ナレーション・BGM
  'subtitle', // 字幕ファイル（SRT）
  'design', // Figma 由来のデザイン素材
  'video', // 合成済み・最終出力
])
export type AssetKind = z.infer<typeof AssetKindSchema>

export const AssetSchema = z.object({
  id: z.string(),
  kind: AssetKindSchema,
  /** projects/<id>/ からの相対パス。外部ホスト上にしか無い場合は null */
  path: z.string().nullable(),
  /** 生成元。例: 'codex:gpt-image-2' / 'kling:kling3_0' / 'video-use' / 'figma' */
  source: z.string(),
  /** 外部サービス上の識別子（Kling の job_id、Figma の nodeId など） */
  externalId: z.string().nullable().default(null),
  /** 参照元 URL。ダウンロード前の一時 URL を保持する用途 */
  url: z.string().nullable().default(null),
  createdAt: z.string(),
  meta: z.record(z.unknown()).default({}),
})
export type Asset = z.infer<typeof AssetSchema>

/**
 * ショット = 動画を構成する最小単位。
 * 台本工程で生成され、以降のすべての工程がこの配列を埋めていく。
 */
export const ShotSchema = z.object({
  id: z.string(),
  index: z.number().int().nonnegative(),
  /** ショットの内容説明（人間可読） */
  description: z.string(),
  /** ナレーション原稿。無音ショットなら空文字 */
  narration: z.string().default(''),
  /** 画面に焼き込む字幕。省略時は narration から生成する */
  caption: z.string().default(''),
  durationInFrames: z.number().int().positive(),
  /** 素材生成工程に渡すプロンプト */
  imagePrompt: z.string().default(''),
  /** モーション工程に渡すプロンプト */
  motionPrompt: z.string().default(''),
  /** このショットが実写フッテージを使う場合の取得指示 */
  captureSpec: z
    .object({
      /** video-use に渡すブラウザ操作の自然言語タスク */
      task: z.string(),
      url: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
  /** 工程が進むごとに紐づく素材が増えていく */
  assetIds: z.array(z.string()).default([]),
})
export type Shot = z.infer<typeof ShotSchema>

export const StepStateSchema = z.object({
  status: z.enum(['pending', 'awaiting-agent', 'done', 'failed']).default('pending'),
  startedAt: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
  /** 失敗時の理由、または agent 層の待ち理由 */
  note: z.string().nullable().default(null),
})
export type StepState = z.infer<typeof StepStateSchema>

/**
 * agent 層のステップが Claude に依頼する作業指示。
 * Claude はこれを読んで MCP を呼び、results を埋めて run を再開する。
 */
export const AgentTaskSchema = z.object({
  step: z.enum(STEP_NAMES),
  /** 呼ぶべき MCP ツール名。例: 'mcp__kling__generate_video' */
  tool: z.string(),
  /** 人間・Claude 双方が読む作業指示 */
  instruction: z.string(),
  /** ツールに渡すパラメータの雛形。ショットごとに 1 件 */
  requests: z.array(
    z.object({
      shotId: z.string(),
      params: z.record(z.unknown()),
    }),
  ),
  createdAt: z.string(),
})
export type AgentTask = z.infer<typeof AgentTaskSchema>

export const VideoSpecSchema = z.object({
  width: z.number().int().positive().default(1080),
  height: z.number().int().positive().default(1920),
  fps: z.number().int().positive().default(30),
  /** 目標尺（秒）。台本工程がショット尺を割り付ける基準になる */
  targetDurationSec: z.number().positive().default(30),
})
export type VideoSpec = z.infer<typeof VideoSpecSchema>

export const ProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** 企画の入力。ユーザーの一次指示 */
  brief: z.string(),
  spec: VideoSpecSchema,
  /** 企画工程の出力 */
  plan: z
    .object({
      concept: z.string(),
      targetAudience: z.string(),
      keyMessage: z.string(),
      tone: z.string(),
      /** 参照する Figma ファイルキー。デザイントーンの source of truth */
      figmaFileKey: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
  shots: z.array(ShotSchema).default([]),
  assets: z.array(AssetSchema).default([]),
  steps: z.record(z.enum(STEP_NAMES), StepStateSchema).default({}),
  /** 未処理の agent 依頼。null なら script 層だけで先へ進める */
  agentTask: AgentTaskSchema.nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Project = z.infer<typeof ProjectSchema>

/** 各ステップの実装が受け取る実行コンテキスト */
export interface StepContext {
  project: Project
  /** projects/<id> の絶対パス */
  dir: string
  log: (message: string) => void
}

/** ステップが返す結果。orchestrator がこれを project に反映する */
export interface StepResult {
  /** agent 層が Claude の作業待ちに入るとき true */
  awaitingAgent?: boolean
  note?: string
}

export interface Step {
  name: StepName
  label: string
  layer: ExecutionLayer
  /** このステップを実行する前に done になっている必要があるステップ */
  requires: StepName[]
  run: (ctx: StepContext) => Promise<StepResult>
}
