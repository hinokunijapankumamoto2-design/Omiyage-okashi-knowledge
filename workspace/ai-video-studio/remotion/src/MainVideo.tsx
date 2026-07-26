import { z } from 'zod'
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile } from 'remotion'
import { ProjectSchema, type Project } from '../../src/types.js'
import { buildTimeline, type TimelineEntry } from '../../src/steps/07-compose.js'

export const mainVideoSchema = z.object({
  project: ProjectSchema,
  /** projects/<id> の絶対パス。Remotion の publicDir と一致する */
  assetRoot: z.string(),
})

export const defaultProject: Project = ProjectSchema.parse({
  id: 'sample',
  title: 'サンプル',
  brief: '',
  spec: { width: 1080, height: 1920, fps: 30, targetDurationSec: 10 },
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
})

/**
 * 合成の本体。
 *
 * timeline.json と同じ組み立てロジック（buildTimeline）を共有しているので、
 * 工程7 が検証した内容とレンダリング結果が食い違わない。
 *
 * レイヤー順序は下から base → overlay → 字幕。
 * 字幕を最上位に置くのは video-use の Hard Rule 1 と同じ理由で、
 * オーバーレイに隠れるのを防ぐため。
 */
export const MainVideo: React.FC<z.infer<typeof mainVideoSchema>> = ({ project }) => {
  const timeline = buildTimeline(project)

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {timeline.entries.map((entry) => (
        <Sequence
          key={entry.shotId}
          from={entry.fromFrame}
          durationInFrames={entry.durationInFrames}
          name={`${entry.index}: ${entry.shotId}`}
        >
          <ShotLayer entry={entry} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}

const ShotLayer: React.FC<{ entry: TimelineEntry }> = ({ entry }) => {
  return (
    <AbsoluteFill>
      {entry.base ? (
        entry.base.kind === 'image' ? (
          <Img src={staticFile(entry.base.path)} style={fill} />
        ) : (
          <OffthreadVideo src={staticFile(entry.base.path)} style={fill} muted={false} />
        )
      ) : null}

      {entry.overlay ? (
        <OffthreadVideo src={staticFile(entry.overlay.path)} style={fill} muted />
      ) : null}

      {entry.caption ? <Caption text={entry.caption} /> : null}
    </AbsoluteFill>
  )
}

const Caption: React.FC<{ text: string }> = ({ text }) => (
  <AbsoluteFill
    style={{
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingBottom: '10%',
      paddingLeft: '6%',
      paddingRight: '6%',
    }}
  >
    <span
      style={{
        fontFamily: '"Hiragino Sans", "Noto Sans JP", sans-serif',
        fontSize: 56,
        fontWeight: 800,
        color: '#fff',
        textAlign: 'center',
        lineHeight: 1.35,
        textShadow: '0 4px 24px rgba(0,0,0,.75)',
      }}
    >
      {text}
    </span>
  </AbsoluteFill>
)

const fill: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}
