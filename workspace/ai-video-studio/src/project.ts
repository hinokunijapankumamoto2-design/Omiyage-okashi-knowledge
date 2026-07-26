import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type Asset,
  type Project,
  ProjectSchema,
  STEP_NAMES,
  type StepName,
  type VideoSpec,
} from './types.js'

const here = path.dirname(fileURLToPath(import.meta.url))
export const STUDIO_ROOT = path.resolve(here, '..')
export const PROJECTS_ROOT = path.join(STUDIO_ROOT, 'projects')

export function projectDir(id: string): string {
  return path.join(PROJECTS_ROOT, id)
}

function manifestPath(id: string): string {
  return path.join(projectDir(id), 'project.json')
}

/** 素材の置き場。工程ごとにサブディレクトリを分ける */
export const ASSET_DIRS = {
  image: 'assets/images',
  motion: 'assets/motion',
  footage: 'assets/footage',
  audio: 'assets/audio',
  subtitle: 'assets/subtitles',
  design: 'assets/design',
  video: 'out',
} as const

export async function createProject(input: {
  id: string
  title: string
  brief: string
  spec?: Partial<VideoSpec>
}): Promise<Project> {
  const dir = projectDir(input.id)
  if (existsSync(manifestPath(input.id))) {
    throw new Error(`プロジェクトが既に存在します: ${input.id}`)
  }

  for (const sub of Object.values(ASSET_DIRS)) {
    await mkdir(path.join(dir, sub), { recursive: true })
  }

  const now = new Date().toISOString()
  const project = ProjectSchema.parse({
    id: input.id,
    title: input.title,
    brief: input.brief,
    spec: {
      width: input.spec?.width ?? 1080,
      height: input.spec?.height ?? 1920,
      fps: input.spec?.fps ?? 30,
      targetDurationSec: input.spec?.targetDurationSec ?? 30,
    },
    steps: Object.fromEntries(STEP_NAMES.map((s) => [s, { status: 'pending' }])),
    createdAt: now,
    updatedAt: now,
  })

  await saveProject(project)
  return project
}

export async function loadProject(id: string): Promise<Project> {
  const file = manifestPath(id)
  if (!existsSync(file)) {
    throw new Error(`プロジェクトが見つかりません: ${id}（${file}）`)
  }
  const raw = JSON.parse(await readFile(file, 'utf8')) as unknown
  return ProjectSchema.parse(raw)
}

export async function saveProject(project: Project): Promise<void> {
  project.updatedAt = new Date().toISOString()
  const file = manifestPath(project.id)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(project, null, 2)}\n`, 'utf8')
}

export function setStepStatus(
  project: Project,
  step: StepName,
  status: 'pending' | 'awaiting-agent' | 'done' | 'failed',
  note: string | null = null,
): void {
  const now = new Date().toISOString()
  const prev = project.steps[step]
  project.steps[step] = {
    status,
    startedAt: prev?.startedAt ?? now,
    finishedAt: status === 'done' || status === 'failed' ? now : null,
    note,
  }
}

export function isStepDone(project: Project, step: StepName): boolean {
  return project.steps[step]?.status === 'done'
}

/** 素材を登録し、対応するショットに紐づける */
export function addAsset(
  project: Project,
  asset: Omit<Asset, 'createdAt' | 'externalId' | 'url' | 'meta'> &
    Partial<Pick<Asset, 'externalId' | 'url' | 'meta'>>,
  shotId?: string,
): Asset {
  const full: Asset = {
    externalId: null,
    url: null,
    meta: {},
    ...asset,
    createdAt: new Date().toISOString(),
  }

  const existing = project.assets.findIndex((a) => a.id === full.id)
  if (existing >= 0) {
    project.assets[existing] = full
  } else {
    project.assets.push(full)
  }

  if (shotId) {
    const shot = project.shots.find((s) => s.id === shotId)
    if (shot && !shot.assetIds.includes(full.id)) {
      shot.assetIds.push(full.id)
    }
  }
  return full
}

export function assetsOfShot(project: Project, shotId: string, kind?: Asset['kind']): Asset[] {
  const shot = project.shots.find((s) => s.id === shotId)
  if (!shot) return []
  return project.assets.filter(
    (a) => shot.assetIds.includes(a.id) && (kind === undefined || a.kind === kind),
  )
}

/** 動画全体の総フレーム数 */
export function totalFrames(project: Project): number {
  return project.shots.reduce((sum, s) => sum + s.durationInFrames, 0)
}
