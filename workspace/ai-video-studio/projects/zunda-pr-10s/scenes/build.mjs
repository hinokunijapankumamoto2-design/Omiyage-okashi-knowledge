// 4シーンの HyperFrames 合成を生成する。実行: node scenes/build.mjs（プロジェクトルートから）
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const studioRoot = path.resolve(here, '..', '..', '..')
const require = createRequire(import.meta.url)

const W = 1080
const H = 1920
const FPS = 30
const DUR = 2.5

// キャラクター正本 SVG を読み込み、inline 用に <svg> の中身を取り出す
const svgFile = readFileSync(
  path.join(studioRoot, '02_キャラクター', 'ずんちゃ丸', 'ずんちゃ丸.svg'),
  'utf8',
)
const inner = svgFile.slice(svgFile.indexOf('>') + 1, svgFile.lastIndexOf('</svg>'))
const zuncha = (cls) =>
  `<svg class="zuncha ${cls}" viewBox="0 0 400 540" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`

// 共通ヘッド。紙切りステッカー感: キャラと吹き出しにだけ淡い縁
const head = (extra) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<script src="./gsap.min.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${W}px; height:${H}px; overflow:hidden;
    font-family:"Noto Sans JP","Hiragino Sans","Yu Gothic",sans-serif; }
  .sticker { filter: drop-shadow(0 0 6px rgba(255,255,255,.9)); }
  .bubble {
    position:absolute; padding:26px 44px; background:#fff; border:7px solid #3d6b1e;
    border-radius:60px; font-size:64px; font-weight:900; color:#3d6b1e; white-space:nowrap;
  }
  ${extra}
</style>
</head>`

// 枝豆マーク（ZUNDA SARYO の白抜きさやマーク）
const edamameMark = (cls, stroke = '#ffffff', sw = 10) => `
<svg class="${cls}" viewBox="0 0 200 110" xmlns="http://www.w3.org/2000/svg" fill="none">
  <path d="M 30 72 Q 12 58 20 40 Q 30 20 56 24 Q 66 12 84 14 Q 100 16 106 30 Q 128 26 142 38 Q 158 50 152 68 Q 144 88 118 86 Q 104 96 86 92 Q 70 88 66 76 Q 44 82 30 72 Z"
        stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
</svg>`

// ずんだシェイクのカップ
const shakeCup = (cls) => `
<svg class="${cls}" viewBox="0 0 360 560" xmlns="http://www.w3.org/2000/svg">
  <g stroke-linejoin="round" stroke-linecap="round">
    <rect x="150" y="8" width="22" height="150" rx="10" fill="#8BCB59" stroke="#3d6b1e" stroke-width="6" transform="rotate(8 161 83)"/>
    <path d="M 76 120 Q 96 74 148 70 Q 186 42 226 66 Q 274 60 286 108 Q 300 132 284 150 L 76 150 Q 62 134 76 120 Z"
          fill="#eaf5da" stroke="#3d6b1e" stroke-width="7"/>
    <path d="M 96 118 Q 130 96 180 100 Q 230 104 258 122" fill="none" stroke="#8BCB59" stroke-width="14" stroke-linecap="round"/>
    <path d="M 70 150 L 290 150 L 262 530 Q 260 548 240 548 L 120 548 Q 100 548 98 530 Z"
          fill="#6FB234" stroke="#3d6b1e" stroke-width="8"/>
    <path d="M 84 240 L 276 240 L 266 380 L 94 380 Z" fill="#f6f9ef" stroke="none"/>
    <text x="180" y="322" text-anchor="middle" font-size="52" font-weight="900" fill="#3d6b1e"
          font-family="'Noto Sans JP','Hiragino Sans',sans-serif">ずんだ茶寮</text>
    <g transform="translate(130,338) scale(0.5)">${edamameMark('', '#6FB234', 12).replace('<svg class="" ', '<svg width="200" height="110" ')}</g>
  </g>
</svg>`

const scenes = {
  // ───────── s1: 暖簾オープニング ─────────
  s1: `${head(`
  body { background:#f2efe6; }
  .noren { position:absolute; top:0; width:552px; height:1250px; background:#5e9c30;
    border-bottom:26px solid #4a8324; }
  .noren.left { left:-6px; border-right:6px solid #4a8324; }
  .noren.right { right:-6px; border-left:6px solid #4a8324; }
  .mark { position:absolute; top:210px; left:50%; transform:translateX(-50%); width:340px; }
  .shopname { position:absolute; top:430px; width:100%; text-align:center;
    font-size:120px; font-weight:900; color:#fff; letter-spacing:.08em;
    text-shadow:0 3px 0 rgba(0,0,0,.08); }
  .floor { position:absolute; bottom:0; width:100%; height:420px; background:#e7e2d2; }
  .zuncha { position:absolute; bottom:120px; left:50%; width:640px; margin-left:-320px; }
  #hello { bottom:930px; left:50%; transform:translateX(-50%) scale(0); }
`)}
<body>
  <div id="root" data-composition-id="s1" data-start="0" data-duration="${DUR}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    <div id="stage" class="clip" data-start="0" data-duration="${DUR}" data-track-index="0">
      <div class="floor"></div>
      <div class="noren left" id="norenL"></div>
      <div class="noren right" id="norenR"></div>
      ${edamameMark('mark')}
      <div class="shopname">ずんだ茶寮</div>
      ${zuncha('sticker')}
      <div class="bubble" id="hello">こんにちは〜！</div>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.set(".zuncha", { y: 560 })
      .to(".zuncha", { y: 0, duration: 0.7, ease: "back.out(1.4)" }, 0.25)
      .fromTo("#leaf-l", { rotation: -26, svgOrigin: "186 72" }, { rotation: -6, duration: 0.5, ease: "back.out(3)" }, 0.75)
      .fromTo("#leaf-r", { rotation: 26, svgOrigin: "214 72" }, { rotation: 6, duration: 0.5, ease: "back.out(3)" }, 0.75)
      .to("#hello", { scale: 1, duration: 0.45, ease: "back.out(2.2)" }, 1.15)
      .to("#norenL", { rotation: 0.6, transformOrigin: "top center", duration: 1.2, yoyo: true, repeat: 1, ease: "sine.inOut" }, 0)
      .to("#norenR", { rotation: -0.6, transformOrigin: "top center", duration: 1.2, yoyo: true, repeat: 1, ease: "sine.inOut" }, 0)
      .to(".zuncha", { y: -14, duration: 0.28, yoyo: true, repeat: 1, ease: "sine.inOut" }, 1.7);
    window.__timelines["s1"] = tl;
  </script>
</body>
</html>`,

  // ───────── s2: 商品ヒーロー（久保さん実写の暫定差し替え枠） ─────────
  s2: `${head(`
  body { background:linear-gradient(180deg,#f6f3ea 0%,#f6f3ea 62%,#dcedc8 100%); }
  .mark { position:absolute; top:120px; left:50%; transform:translateX(-50%); width:260px; }
  .cup { position:absolute; bottom:210px; left:50%; width:640px; margin-left:-320px; }
  .copy1 { position:absolute; top:330px; width:100%; text-align:center;
    font-size:86px; font-weight:900; color:#3d6b1e; }
  .copy2 { position:absolute; top:452px; width:100%; text-align:center;
    font-size:74px; font-weight:900; color:#3d6b1e; line-height:1.35; }
  .copy2 em { font-style:normal; color:#5e9c30; font-size:92px; }
  .steam { position:absolute; bottom:960px; left:50%; width:14px; height:150px; border-radius:10px;
    background:rgba(255,255,255,.85); }
`)}
<body>
  <div id="root" data-composition-id="s2" data-start="0" data-duration="${DUR}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    <div id="stage" class="clip" data-start="0" data-duration="${DUR}" data-track-index="0">
      ${edamameMark('mark', '#6FB234', 10)}
      <div class="copy1" id="c1">私はいつも、</div>
      <div class="copy2" id="c2">ずんだ茶寮の<br /><em>ずんだシェイク！</em></div>
      <div class="steam" id="st1" style="margin-left:-90px"></div>
      <div class="steam" id="st2" style="margin-left:60px; height:110px"></div>
      ${shakeCup('cup')}
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.set(".cup", { y: 700, rotation: 6 })
      .to(".cup", { y: 0, rotation: 0, duration: 0.75, ease: "back.out(1.2)" }, 0.1)
      .from("#c1", { opacity: 0, y: 40, duration: 0.5, ease: "power3.out" }, 0.55)
      .from("#c2", { opacity: 0, y: 40, duration: 0.5, ease: "power3.out" }, 0.75)
      .fromTo("#st1", { opacity: 0, y: 30 }, { opacity: 1, y: -60, duration: 1.2, ease: "sine.out" }, 0.9)
      .fromTo("#st2", { opacity: 0, y: 30 }, { opacity: 0.8, y: -80, duration: 1.2, ease: "sine.out" }, 1.15)
      .to("#st1", { opacity: 0, duration: 0.4 }, 2.0)
      .to("#st2", { opacity: 0, duration: 0.35 }, 2.1);
    window.__timelines["s2"] = tl;
  </script>
</body>
</html>`,

  // ───────── s3: こっそり味見のいたずら ─────────
  s3: `${head(`
  body { background:linear-gradient(180deg,#eef5e2 0%,#dcedc8 100%); }
  .cup { position:absolute; bottom:430px; left:130px; width:540px; }
  .zuncha { position:absolute; bottom:400px; right:60px; width:560px; }
  .zuncha #expr-normal { display:none !important; }
  .zuncha #expr-sneaky { display:block !important; }
  #whisper { bottom:1310px; right:90px; transform:scale(0); transform-origin:bottom right;
    font-size:58px; }
  .straw2 { position:absolute; bottom:900px; left:560px; width:150px; height:26px;
    background:#8BCB59; border:6px solid #3d6b1e; border-radius:13px; transform:rotate(24deg); }
`)}
<body>
  <div id="root" data-composition-id="s3" data-start="0" data-duration="${DUR}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    <div id="stage" class="clip" data-start="0" data-duration="${DUR}" data-track-index="0">
      ${shakeCup('cup')}
      <div class="straw2" id="straw"></div>
      ${zuncha('sticker')}
      <div class="bubble" id="whisper">つい、ひとくち……</div>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.set(".zuncha", { rotation: -6, transformOrigin: "50% 90%" })
      .from(".zuncha", { x: 260, duration: 0.6, ease: "power3.out" }, 0.05)
      .to(".zuncha", { rotation: -11, y: 10, duration: 0.35, ease: "sine.inOut", yoyo: true, repeat: 3 }, 0.7)
      .to("#leaf-l", { rotation: -18, svgOrigin: "186 72", duration: 0.18, yoyo: true, repeat: 5, ease: "sine.inOut" }, 0.7)
      .to("#leaf-r", { rotation: 18, svgOrigin: "214 72", duration: 0.18, yoyo: true, repeat: 5, ease: "sine.inOut" }, 0.7)
      .to("#whisper", { scale: 1, duration: 0.4, ease: "back.out(2)" }, 1.05)
      .to(".cup", { rotation: -2, transformOrigin: "bottom center", duration: 0.3, yoyo: true, repeat: 1 }, 1.3);
    window.__timelines["s3"] = tl;
  </script>
</body>
</html>`,

  // ───────── s4: タグライン締め ─────────
  s4: `${head(`
  body { background:#5e9c30; }
  .mark { position:absolute; top:250px; left:50%; transform:translateX(-50%); width:300px; }
  .tag { position:absolute; top:566px; width:100%; text-align:center;
    font-size:94px; font-weight:900; color:#fff; letter-spacing:.04em; }
  .sub { position:absolute; top:730px; width:100%; text-align:center;
    font-size:56px; font-weight:700; color:#eaf5da; }
  .logo { position:absolute; bottom:150px; width:100%; text-align:center;
    font-size:64px; font-weight:900; color:#fff; letter-spacing:.14em; }
  .zuncha { position:absolute; bottom:270px; left:50%; width:520px; margin-left:-260px; }
  .zuncha #expr-normal { display:none !important; }
  .zuncha #expr-happy { display:block !important; }
`)}
<body>
  <div id="root" data-composition-id="s4" data-start="0" data-duration="${DUR}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    <div id="stage" class="clip" data-start="0" data-duration="${DUR}" data-track-index="0">
      ${edamameMark('mark')}
      <div class="tag" id="tag">ずんだで、むすぶよ！</div>
      <div class="sub" id="sub">元祖の美味しさ、そのままに。</div>
      ${zuncha('sticker')}
      <div class="logo" id="logo">ずんだ茶寮</div>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.from(".mark", { opacity: 0, scale: 0.6, transformOrigin: "center", duration: 0.5, ease: "back.out(1.6)" }, 0.05)
      .from("#tag", { opacity: 0, y: 60, duration: 0.55, ease: "power3.out" }, 0.3)
      .from("#sub", { opacity: 0, y: 40, duration: 0.5, ease: "power3.out" }, 0.55)
      .from(".zuncha", { y: 420, duration: 0.65, ease: "back.out(1.3)" }, 0.7)
      .fromTo("#leaf-l", { rotation: -24, svgOrigin: "186 72" }, { rotation: -4, duration: 0.4, ease: "back.out(3)" }, 1.3)
      .fromTo("#leaf-r", { rotation: 24, svgOrigin: "214 72" }, { rotation: 4, duration: 0.4, ease: "back.out(3)" }, 1.3)
      .from("#logo", { opacity: 0, duration: 0.45 }, 1.5)
      .to(".zuncha", { y: -18, duration: 0.3, yoyo: true, repeat: 1, ease: "sine.inOut" }, 1.75);
    window.__timelines["s4"] = tl;
  </script>
</body>
</html>`,
}

const gsapSrc = require.resolve('gsap/dist/gsap.min.js')
for (const [id, html] of Object.entries(scenes)) {
  const dir = path.join(here, id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'index.html'), html)
  copyFileSync(gsapSrc, path.join(dir, 'gsap.min.js'))
  writeFileSync(
    path.join(dir, 'meta.json'),
    JSON.stringify({ id, name: `zunda-pr-10s ${id}`, createdAt: '2026-07-26T00:00:00Z' }, null, 2),
  )
  console.log('scene:', id)
}
