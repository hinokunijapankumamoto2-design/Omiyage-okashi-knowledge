// v2: 12秒全体を1本の HyperFrames composition として生成する
// 実行: node scenes/build_v2.mjs → v2/ に index.html + media 一式
// 構造: track0=ベース動画 / 1=ストロー / 2=ずんちゃ丸+ミニカップ / 3=テロップ / 4=コピーカード / audio=BGM+SE
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const studioRoot = path.resolve(root, '..', '..')
const require = createRequire(import.meta.url)
const W = 1080, H = 1920, FPS = 30, DUR = 12

const v2 = path.join(root, 'v2')
const media = path.join(v2, 'media')
mkdirSync(media, { recursive: true })

// メディアを v2/ 配下へ集約（相対参照を単純に保つ）
for (const b of ['b1', 'b2', 'b3', 'b4', 'b5']) {
  copyFileSync(path.join(root, 'assets', 'photo', `${b}_base.mp4`), path.join(media, `${b}_base.mp4`))
}
copyFileSync(path.join(root, 'assets', 'audio', 'mix.wav'), path.join(media, 'mix.wav'))
copyFileSync(require.resolve('gsap/dist/gsap.min.js'), path.join(v2, 'gsap.min.js'))

const svgFile = readFileSync(path.join(studioRoot, '02_キャラクター', 'ずんちゃ丸', 'ずんちゃ丸.svg'), 'utf8')
const zunchaInner = svgFile.slice(svgFile.indexOf('>') + 1, svgFile.lastIndexOf('</svg>'))

// ビート境界（秒）: b1 0-1.5 / b2 1.5-4 / b3 4-7 / b4 7-9.5 / b5 9.5-12
const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<script src="./gsap.min.js"></script>
<style>
  @font-face { font-family: 'Hiragino Sans'; src: local('Hiragino Sans'); }
  @font-face { font-family: 'Yu Gothic'; src: local('Yu Gothic'); }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${W}px; height:${H}px; overflow:hidden;
    font-family:"Noto Sans JP","Hiragino Sans","Yu Gothic",sans-serif; }
  .bg { position:absolute; inset:0; background:#efe9db; }
  .base { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .straw { position:absolute; height:30px; background:#7ec14f; border:7px solid #3d6b1e;
    border-radius:18px; transform-origin:left center; }
  .sub { position:absolute; bottom:170px; width:100%; text-align:center;
    font-size:58px; font-weight:900; color:#fff; -webkit-text-stroke:10px rgba(40,60,20,.85);
    paint-order:stroke; letter-spacing:.02em; }
  .bubble { position:absolute; padding:22px 40px; background:#fff; border:7px solid #3d6b1e;
    border-radius:56px; font-size:56px; font-weight:900; color:#3d6b1e; white-space:nowrap; }
  #hook { position:absolute; top:340px; width:100%; text-align:center; font-size:76px;
    font-weight:900; color:#fff; -webkit-text-stroke:12px rgba(40,60,20,.9); paint-order:stroke;
    line-height:1.35; }
  #zuncha-wrap { position:absolute; bottom:430px; left:50%; width:600px; margin-left:-300px;
    transform-origin:50% 88%; }
  #zuncha-wrap svg { width:100%; }
  #straw1 { top:1300px; left:300px; width:520px; }
  #straw2 { top:1010px; left:120px; width:460px; }
  #straw3 { top:1000px; left:-40px; width:560px; }
  #straw4a { top:1260px; left:150px; width:330px; }
  #straw4b { top:1420px; left:330px; width:300px; }
  #bang { position:absolute; top:1080px; left:720px; font-size:130px; font-weight:900; color:#e0524a;
    -webkit-text-stroke:10px #fff; paint-order:stroke; }
  #line-z { bottom:1460px; left:50%; }
  #wai { bottom:1260px; left:150px; transform-origin:bottom center; }
  #mini { position:absolute; bottom:330px; right:150px; width:250px; }
  #card { position:absolute; inset:0; background:rgba(94,156,48,.96); opacity:0;
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:36px; }
  .copy-main { font-size:96px; font-weight:900; color:#fff; letter-spacing:.04em; }
  .copy-sub { font-size:54px; font-weight:700; color:#eaf5da; }
</style>
</head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-fps="${FPS}" data-width="${W}" data-height="${H}" style="position:relative; width:${W}px; height:${H}px;">
    <div class="bg"></div>

    <!-- track0: ベース動画（フォトステージング。実写が届いたら src 差し替えのみ） -->
    <video class="base clip" id="v-b1" data-start="0"   data-duration="1.5" data-track-index="0" src="media/b1_base.mp4" muted></video>
    <video class="base clip" id="v-b2" data-start="1.5" data-duration="2.5" data-track-index="0" src="media/b2_base.mp4" muted></video>
    <video class="base clip" id="v-b3" data-start="4"   data-duration="3"   data-track-index="0" src="media/b3_base.mp4" muted></video>
    <video class="base clip" id="v-b4" data-start="7"   data-duration="2.5" data-track-index="0" src="media/b4_base.mp4" muted></video>
    <video class="base clip" id="v-b5" data-start="9.5" data-duration="2.5" data-track-index="0" src="media/b5_base.mp4" muted></video>

    <!-- track1: ストロー -->
    <div class="straw clip" id="straw1"  data-start="0"   data-duration="1.5" data-track-index="1"></div>
    <div class="straw clip" id="straw2"  data-start="1.5" data-duration="2.5" data-track-index="1"></div>
    <div class="straw clip" id="straw3"  data-start="4"   data-duration="3"   data-track-index="1"></div>
    <div class="straw clip" id="straw4a" data-start="7"   data-duration="2.5" data-track-index="1"></div>
    <div class="straw clip" id="straw4b" data-start="7"   data-duration="2.5" data-track-index="7"></div>

    <!-- track2: ずんちゃ丸（1体を b3→b4→b5 で使い回す）とミニカップ -->
    <div class="clip" id="zuncha-wrap" data-start="4" data-duration="8" data-track-index="2">
      <svg viewBox="0 0 400 540" xmlns="http://www.w3.org/2000/svg">${zunchaInner}</svg>
    </div>
    <svg class="clip" id="mini" data-start="9.5" data-duration="2.5" data-track-index="8" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
      <rect x="76" y="8" width="14" height="70" rx="7" fill="#8BCB59" stroke="#3d6b1e" stroke-width="5" transform="rotate(8 83 43)"/>
      <path d="M 40 80 L 160 80 L 146 280 Q 145 292 132 292 L 68 292 Q 55 292 54 280 Z" fill="#6FB234" stroke="#3d6b1e" stroke-width="7"/>
      <rect x="52" y="130" width="96" height="60" fill="#f6f9ef"/>
      <text x="100" y="172" text-anchor="middle" font-size="30" font-weight="900" fill="#3d6b1e">ずんだ茶寮</text>
    </svg>

    <!-- track3: テロップ・吹き出し -->
    <div class="clip" id="hook" data-start="0" data-duration="1.5" data-track-index="3">
      <div>まだ飲んでないのに、</div><div>減ってる。</div>
    </div>
    <div class="sub clip" id="q" data-start="1.5" data-duration="2.5" data-track-index="3" style="opacity:0">……ん？</div>
    <div class="sub clip" id="line-k" data-start="4" data-duration="3" data-track-index="3" style="opacity:0">「ずんちゃ丸、飲んだでしょ？」</div>
    <div class="bubble clip" id="line-z" data-start="4" data-duration="3" data-track-index="4">飲んでないよ〜</div>
    <div class="clip" id="bang" data-start="7" data-duration="2.5" data-track-index="5">！</div>
    <div class="sub clip" id="line-k4" data-start="7" data-duration="2.5" data-track-index="3" style="opacity:0">「全部つながってるよ」</div>
    <div class="sub clip" id="line-k5" data-start="9.5" data-duration="2.5" data-track-index="3" style="opacity:0">「次は一緒に飲もうね」</div>
    <div class="bubble clip" id="wai" data-start="9.5" data-duration="2.5" data-track-index="4">わーい！</div>

    <!-- track4: 最終コピーカード -->
    <div class="clip" id="card" data-start="9.5" data-duration="2.5" data-track-index="6">
      <div class="copy-main">隠せない、おいしさ。</div>
      <div class="copy-sub">ずんだ茶寮　ずんだシェイク</div>
    </div>

    <!-- 音声: BGM+SE（gen_audio.py の合成 wav） -->
    <audio class="clip" id="bgm" data-start="0" data-duration="${DUR}" data-track-index="9" src="media/mix.wav"></audio>
  </div>

  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });

    // ── 初期状態（各クリップ窓の開始時に境界 set） ──
    tl.set("#straw1", { rotation: 20, scaleX: 0 }, 0)
      .set("#straw2", { rotation: 16 }, 1.5)
      .set("#straw3", { rotation: 12 }, 4)
      .set("#line-z", { xPercent: -50, scale: 0 }, 4)
      .set("#straw4a", { rotation: 38 }, 7)
      .set("#straw4b", { rotation: -24 }, 7)
      .set("#bang", { scale: 0 }, 7)
      .set("#wai", { scale: 0 }, 9.5)

    // ── b1 (0–1.5): フック＋伸びるストロー ──
      .from("#hook", { autoAlpha: 0, y: -30, duration: 0.35, ease: "power2.out" }, 0.05)
      .to("#straw1", { scaleX: 1, duration: 0.65, ease: "power3.out" }, 0.45)
      .to("#straw1", { rotation: 21.5, duration: 0.12, yoyo: true, repeat: 3, ease: "sine.inOut" }, 1.1)

    // ── b2 (1.5–4.0): 吸うストロー＋「……ん？」 ──
      .to("#straw2", { rotation: 17.5, duration: 0.1, yoyo: true, repeat: 5, ease: "sine.inOut" }, 1.7)
      .to("#straw2", { rotation: 17.5, duration: 0.1, yoyo: true, repeat: 5, ease: "sine.inOut" }, 2.5)
      .to("#q", { opacity: 1, duration: 0.3 }, 3.3)

    // ── b3 (4.0–7.0): 犯人発覚 ──
      .set("#expr-normal", { display: "none" }, 4)
      .set("#expr-puffed", { display: "block" }, 4)
      .set("#zuncha-wrap", { x: -80, rotation: -4 }, 4)
      .to("#zuncha-wrap", { x: 0, duration: 0.55, ease: "back.out(1.5)" }, 4.15)
      .to("#line-k", { opacity: 1, duration: 0.3 }, 4.5)
      .to("#zuncha-wrap", { rotation: 4, duration: 0.5, yoyo: true, repeat: 2, ease: "sine.inOut" }, 4.8)
      .to("#line-z", { scale: 1, duration: 0.4, ease: "back.out(2)" }, 5.7)

    // ── b4 (7.0–9.5): 転倒→固まる（境界で位置ジャンプ） ──
      .set("#zuncha-wrap", { y: 150, scale: 0.933, rotation: 0, x: 0 }, 7)
      .to("#zuncha-wrap", { x: -60, duration: 0.4, ease: "power1.in" }, 7.1)
      .to("#zuncha-wrap", { rotation: -74, y: 270, duration: 0.45, ease: "bounce.out" }, 7.5)
      .to("#bang", { scale: 1, duration: 0.25, ease: "back.out(2.5)" }, 7.55)
      .set("#expr-puffed", { display: "none" }, 8.05)
      .set("#expr-x", { display: "block" }, 8.05)
      .to("#line-k4", { opacity: 1, duration: 0.3 }, 8.15)
      .to("#bang", { autoAlpha: 0, duration: 0.3 }, 8.6)

    // ── b5 (9.5–12.0): 承認→わーい→コピー ──
      .set("#expr-x", { display: "none" }, 9.5)
      .set("#expr-happy", { display: "block" }, 9.5)
      .set("#zuncha-wrap", { x: -70, y: 100, scale: 0.767, rotation: 0 }, 9.5)
      .to("#line-k5", { opacity: 1, duration: 0.25 }, 9.6)
      .from("#mini", { y: 200, autoAlpha: 0, duration: 0.4, ease: "back.out(1.4)" }, 9.65)
      .to("#wai", { scale: 1, duration: 0.35, ease: "back.out(2.2)" }, 10.1)
      .to("#zuncha-wrap", { y: 70, duration: 0.25, yoyo: true, repeat: 3, ease: "sine.inOut" }, 10.1)
      .to("#card", { opacity: 1, duration: 0.45 }, 11.1);

    window.__timelines["main"] = tl;
  </script>
</body>
</html>
`
writeFileSync(path.join(v2, 'index.html'), html)
writeFileSync(path.join(v2, 'meta.json'), JSON.stringify({ id: 'shake-jiken-v2', name: '暖簾の向こうの犯人 v2', createdAt: '2026-07-26T00:00:00Z' }, null, 2))
writeFileSync(path.join(v2, 'hyperframes.json'), JSON.stringify({
  $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json',
  paths: { blocks: 'compositions', components: 'compositions/components', assets: 'media' },
  media: { autoProxy: false },
}, null, 2))
console.log('v2 生成完了: projects/shake-jiken-12s/v2/')
