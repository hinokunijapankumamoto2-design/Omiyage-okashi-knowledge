# HyperFrames 実装ノート

工程4（モーション制作）で使う HyperFrames（`heygen-com/hyperframes`）の実装記録。
実装は `src/adapters/hyperframes.ts`。

## 合成コントラクト

HyperFrames はフレームごとにページを **seek** して静止画を撮る。
自走するアニメーション（CSS の `animation` や `setInterval`）は使えない。

```html
<div id="root"
     data-composition-id="s1"
     data-start="0" data-duration="3" data-fps="30"
     data-width="1080" data-height="1920">

  <div class="headline clip" id="headline"
       data-start="0" data-duration="3" data-track-index="0">熊本の銘菓</div>
</div>

<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });   // 必ず paused
  tl.from("#headline", { opacity: 0, y: 28, duration: 0.6 }, 0);
  window.__timelines["s1"] = tl;                // composition-id で登録
</script>
```

- ルート要素: `data-composition-id` / `data-width` / `data-height` / `data-duration` / `data-fps`
- 尺を持つ要素: `class="clip"` と `data-start` / `data-duration` / `data-track-index`
- タイムライン: `{ paused: true }` で作り `window.__timelines[compositionId]` に登録

## 踏んだ落とし穴（3件）

### 1. 全画面ラッパーを `.clip` にすると二重描画される

最初、`position:absolute; inset:0` の flex ラッパー `#stage` に `class="clip"` を付け、
その中に見出しを入れる構造にした。結果、**同じ文字が画面中央と下部の 2 箇所に描画された**。

HyperFrames は `.clip` 要素のレイアウトを自前で管理する。全画面ラッパーを clip にすると
その管理と CSS 側の配置が衝突する。

**正しい形**: 表示したい要素そのものを `.clip` にし、`position: absolute` で直接配置する。
ラッパーを挟まない。公式 quickstart の例もその形になっている。

### 2. GSAP を CDN から読むと、失敗しても render は成功してしまう

公式の雛形は GSAP を jsdelivr から読む。しかし本環境では送信プロキシが CDN を
**403 で遮断**するため、スクリプトが読み込まれず `window.__timelines` への登録が起きない。

このとき render は `sub_timeline_script_failure` という**警告だけを出して成功扱いで完了する**。
出力ファイルは生成されるが、アニメーションが一切適用されていない静止映像になる。
気づきにくい失敗なので、以下 2 つの対策を入れてある。

- `scaffoldScene()` が `node_modules/gsap` の実体をシーンごとにコピーし、相対パスで参照する
- `renderScene()` が出力に `sub_timeline_script_failure` が含まれていたら**明示的に例外を投げる**

### 3. ffprobe が別パッケージ

HyperFrames は素材解析に ffmpeg **と ffprobe の両方**を PATH 上に要求する。
`ffmpeg-static` には ffprobe が含まれないため `ffprobe-static` も入れ、
`envWithFfmpeg()` が 2 つのディレクトリを PATH 前方に足している。

## 出力形式

| 用途 | 指定 |
|---|---|
| 透過オーバーレイ（実写・Kling の上に重ねる） | `--format webm` |
| 単体クリップ | `--format mp4` |
| AE / Nuke へ渡す | `--format png-sequence` |

WebM の透過は VP9 のアルファプレーンとして格納される。
`ffprobe` の `pix_fmt` は `yuv420p` と出るが、コンテナのタグ `ALPHA_MODE=1` が透過の有無を示す。

fps はルートの `data-fps` から決まる（`--fps` でも上書きできる）。

## 検証済みの動作

- 1080x1920 / 30fps / 3.0秒の透過 WebM 出力（`ALPHA_MODE=1` 確認済み）
- 日本語フォントの描画（豆腐にならないことをフレーム目視で確認）
- GSAP のシーク再現性（フレーム 0 で不透明度 0、中間で遷移、終盤で完全表示）
- Remotion による合成・H.264 での最終レンダリング（180フレーム / 6.06秒）
