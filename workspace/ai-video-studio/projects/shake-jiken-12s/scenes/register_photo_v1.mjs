// フォトベース(b*_base.mp4) + 透過オーバーレイ(b*o.webm) を project.json に登録する
// 実行: node scenes/register_photo_v1.mjs → npm run studio -- run shake-jiken-12s --only compose --force → --only render --force
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const p = path.join(root, 'project.json')
const j = JSON.parse(readFileSync(p, 'utf8'))
const now = new Date().toISOString()

const beats = ['b1', 'b2', 'b3', 'b4', 'b5']
for (const b of beats) {
  const base = `assets/photo/${b}_base.mp4`
  const overlay = `assets/overlays/${b}o.webm`
  for (const f of [base, overlay]) {
    if (!existsSync(path.join(root, f))) throw new Error(`素材がありません: ${f}`)
  }
}

// 差し替え: 各ショットの素材を「フォトベース(footage) + オーバーレイ(hyperframes motion)」の2層にする
j.assets = beats.flatMap((b) => [
  {
    id: `photo-${b}`, kind: 'footage', path: `assets/photo/${b}_base.mp4`,
    source: 'photo-staging', externalId: null, url: null, createdAt: now,
    meta: { origin: 'photos/poster.png', note: '静止画のズーム演出。実写動画が届いたら差し替え' },
  },
  {
    id: `overlay-${b}`, kind: 'motion', path: `assets/overlays/${b}o.webm`,
    source: 'hyperframes', externalId: null, url: null, createdAt: now, meta: { alpha: true },
  },
])
for (const shot of j.shots) {
  shot.assetIds = [`photo-${shot.id}`, `overlay-${shot.id}`]
}
j.steps.capture = { status: 'done', startedAt: null, finishedAt: now, note: 'フォトステージング版（ポスター静止画）' }
j.agentTask = null
writeFileSync(p, JSON.stringify(j, null, 2))
console.log('登録完了: 5ビート × (photo base + overlay)。compose/render を --force で再実行してください')
