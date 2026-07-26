import { Composition } from 'remotion'
import { MainVideo, mainVideoSchema, defaultProject } from './MainVideo.js'
import { buildTimeline } from '../../src/steps/07-compose.js'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainVideo"
      component={MainVideo}
      schema={mainVideoSchema}
      defaultProps={{ project: defaultProject, assetRoot: '' }}
      // 実際の解像度・尺は project.json から決まる。
      // calculateMetadata で inputProps を読んで上書きする。
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={300}
      calculateMetadata={({ props }) => {
        const timeline = buildTimeline(props.project)
        return {
          width: timeline.width,
          height: timeline.height,
          fps: timeline.fps,
          durationInFrames: Math.max(1, timeline.totalFrames),
        }
      }}
    />
  )
}
