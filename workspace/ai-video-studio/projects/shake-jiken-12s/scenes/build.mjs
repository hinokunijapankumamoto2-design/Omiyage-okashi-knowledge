// 「暖簾の向こうの犯人」12秒 アニマティック生成
// 実行: node scenes/build.mjs（プロジェクトルートから）
// 久保さんパートはシルエット+「実写」ラベルのプレースホルダ。2Dレイヤーは本番仕様
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const studioRoot = path.resolve(here, '..', '..', '..')
const require = createRequire(import.meta.url)
const W = 1080, H = 1920, FPS = 30

const svgFile = readFileSync(path.join(studioRoot, '02_キャラクター', 'ずんちゃ丸', 'ずんちゃ丸.svg'), 'utf8')
const inner = svgFile.slice(svgFile.indexOf('>') + 1, svgFile.lastIndexOf('</svg>'))
const zuncha = (cls) => `<svg class="zuncha ${cls}" viewBox="0 0 400 540" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`

const head = (dur, extra) => `<!doctype html>
<html lang="ja"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<script src="./gsap.min.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${W}px; height:${H}px; overflow:hidden;
    font-family:"Noto Sans JP","Hiragino Sans","Yu Gothic",sans-serif; }
  .sub { position:absolute; bottom:170px; width:100%; text-align:center;
    font-size:58px; font-weight:900; color:#fff; -webkit-text-stroke:10px rgba(40,60,20,.85);
    paint-order:stroke; letter-spacing:.02em; }
  .bubble { position:absolute; padding:22px 40px; background:#fff; border:7px solid #3d6b1e;
    border-radius:56px; font-size:56px; font-weight:900; color:#3d6b1e; white-space:nowrap; }
  .hook { position:absolute; top:180px; width:100%; text-align:center; font-size:76px;
    font-weight:900; color:#fff; -webkit-text-stroke:12px rgba(40,60,20,.9); paint-order:stroke; }
  .tag-live { position:absolute; top:40px; right:40px; padding:12px 28px; background:rgba(60,60,60,.75);
    color:#fff; font-size:36px; font-weight:700; border-radius:14px; }
  .noren { position:absolute; top:0; height:1400px; background:#5e9c30; border-bottom:24px solid #4a8324; }
  .straw { position:absolute; height:30px; background:#7ec14f; border:7px solid #3d6b1e;
    border-radius:18px; transform-origin:left center; }
  ${extra}
</style></head>`

// 久保さんのシルエット（実写プレースホルダ。カップを持つ）
const silhouette = (cls) => `
<svg class="${cls}" viewBox="0 0 420 640" xmlns="http://www.w3.org/2000/svg">
  <g fill="#b9b3a6">
    <circle cx="210" cy="120" r="86"/>
    <path d="M 210 214 Q 320 224 348 330 L 360 640 L 60 640 L 72 330 Q 100 224 210 214 Z"/>
  </g>
  <g>
    <path d="M 116 400 Q 150 350 196 372 L 186 420 Q 150 430 128 428 Z" fill="#a8a294"/>
    <rect x="168" y="330" width="120" height="160" rx="18" fill="#6FB234" stroke="#3d6b1e" stroke-width="7"/>
    <rect x="176" y="380" width="104" height="52" fill="#f6f9ef"/>
    <text x="228" y="418" text-anchor="middle" font-size="30" font-weight="900" fill="#3d6b1e">ずんだ茶寮</text>
    <rect x="216" y="268" width="16" height="70" rx="8" fill="#8BCB59" stroke="#3d6b1e" stroke-width="5" transform="rotate(9 224 303)"/>
  </g>
</svg>`

const miniCup = (cls) => `
<svg class="${cls}" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="76" y="8" width="14" height="70" rx="7" fill="#8BCB59" stroke="#3d6b1e" stroke-width="5" transform="rotate(8 83 43)"/>
  <path d="M 40 80 L 160 80 L 146 280 Q 145 292 132 292 L 68 292 Q 55 292 54 280 Z" fill="#6FB234" stroke="#3d6b1e" stroke-width="7"/>
  <rect x="52" y="130" width="96" height="60" fill="#f6f9ef"/>
  <text x="100" y="172" text-anchor="middle" font-size="30" font-weight="900" fill="#3d6b1e">ずんだ茶寮</text>
</svg>`

const scenes = {
  // b1 1.5s: 飲もうとした瞬間、暖簾からストローが伸びる
  b1: { dur: 1.5, html: (D) => `${head(D, `
  body { background:#efe9db; }
  .noren.l { left:0; width:340px; }
  .kubo { position:absolute; bottom:0; right:40px; width:660px; }
  #straw1 { top:1300px; left:300px; width:520px; transform:rotate(20deg) scaleX(0); }
`)}
<body>
  <div id="root" data-composition-id="b1" data-start="0" data-duration="${D}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    <div id="stage" class="clip" data-start="0" data-duration="${D}" data-track-index="0">
      <div class="noren l"></div>
      ${silhouette('kubo')}
      <div class="straw" id="straw1"></div>
      <div class="hook" id="hook">まだ飲んでないのに、<br/>減ってる。</div>
      <div class="tag-live">実写：久保さん</div>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.from("#hook", { opacity: 0, y: -30, duration: 0.35, ease: "power2.out" }, 0.05)
      .to("#straw1", { scaleX: 1, duration: 0.65, ease: "power3.out" }, 0.45)
      .to("#straw1", { rotation: 21.5, duration: 0.12, yoyo: true, repeat: 3, ease: "sine.inOut" }, 1.1);
    window.__timelines["b1"] = tl;
  </script>
</body></html>` },

  // b2 2.5s: 中身が減る→視線移動「……ん？」
  b2: { dur: 2.5, html: (D) => `${head(D, `
  body { background:#efe9db; }
  .noren.l { left:0; width:280px; }
  .bigcup { position:absolute; bottom:260px; left:50%; margin-left:-240px; width:480px; height:900px; }
  .cupbody { position:absolute; bottom:0; width:100%; height:760px; background:#6FB234;
    border:10px solid #3d6b1e; border-radius:20px 20px 40px 40px; overflow:hidden; }
  #level { position:absolute; bottom:0; width:100%; height:640px; background:#8BCB59; }
  .band { position:absolute; top:300px; left:6%; width:88%; height:150px; background:#f6f9ef;
    display:flex; align-items:center; justify-content:center; font-size:60px; font-weight:900; color:#3d6b1e; }
  #straw2 { top:1010px; left:120px; width:460px; transform:rotate(16deg); }
  .tag-live { top:auto; bottom:60px; }
`)}
<body>
  <div id="root" data-composition-id="b2" data-start="0" data-duration="${D}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    <div id="stage" class="clip" data-start="0" data-duration="${D}" data-track-index="0">
      <div class="noren l"></div>
      <div class="bigcup"><div class="cupbody"><div id="level"></div></div>
        <div class="band">ずんだ茶寮</div></div>
      <div class="straw" id="straw2"></div>
      <div class="sub" id="q" style="opacity:0">……ん？</div>
      <div class="tag-live">実写：カップ→暖簾へ視線</div>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.to("#level", { height: 560, duration: 0.5, ease: "steps(2)" }, 0.2)
      .to("#straw2", { rotation: 17.5, duration: 0.1, yoyo: true, repeat: 5, ease: "sine.inOut" }, 0.2)
      .to("#level", { height: 470, duration: 0.5, ease: "steps(2)" }, 1.0)
      .to("#straw2", { rotation: 17.5, duration: 0.1, yoyo: true, repeat: 5, ease: "sine.inOut" }, 1.0)
      .to("#q", { opacity: 1, duration: 0.3 }, 1.8);
    window.__timelines["b2"] = tl;
  </script>
</body></html>` },

  // b3 3s: 犯人発覚。頬パンパン・口笛・「飲んでないよ〜」
  b3: { dur: 3, html: (D) => `${head(D, `
  body { background:#efe9db; }
  .noren.l { left:0; width:480px; height:1560px; }
  .noren.r { right:0; width:480px; height:1560px; }
  .zuncha { position:absolute; bottom:430px; left:50%; width:600px; margin-left:-300px; }
  #straw3 { top:1000px; left:-40px; width:560px; transform:rotate(12deg); }
  #line-z { bottom:1460px; left:50%; transform:translateX(-50%) scale(0); }
`)}
<body>
  <div id="root" data-composition-id="b3" data-start="0" data-duration="${D}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    <div id="stage" class="clip" data-start="0" data-duration="${D}" data-track-index="0">
      <div class="noren l"></div><div class="noren r"></div>
      ${zuncha('')}
      <div class="straw" id="straw3"></div>
      <div class="bubble" id="line-z">飲んでないよ〜</div>
      <div class="sub" id="line-k" style="opacity:0">「ずんちゃ丸、飲んだでしょ？」</div>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.set("#expr-normal", { display: "none" }, 0)
      .set("#expr-puffed", { display: "block" }, 0)
      .set(".zuncha", { x: -80, rotation: -4 }, 0)
      .to(".zuncha", { x: 0, duration: 0.55, ease: "back.out(1.5)" }, 0.15)
      .to("#line-k", { opacity: 1, duration: 0.3 }, 0.5)
      .to(".zuncha", { rotation: 4, duration: 0.5, yoyo: true, repeat: 2, ease: "sine.inOut" }, 0.8)
      .to("#line-z", { scale: 1, duration: 0.4, ease: "back.out(2)" }, 1.7);
    window.__timelines["b3"] = tl;
  </script>
</body></html>` },

  // b4 2.5s: 転倒→固まる「全部つながってるよ」
  b4: { dur: 2.5, html: (D) => `${head(D, `
  body { background:#efe9db; }
  .noren.l { left:0; width:340px; }
  .floor { position:absolute; bottom:0; width:100%; height:430px; background:#e2dccb; }
  .zuncha { position:absolute; bottom:280px; left:50%; width:560px; margin-left:-280px; }
  #straw4a { top:1260px; left:150px; width:330px; transform:rotate(38deg); }
  #straw4b { top:1420px; left:330px; width:300px; transform:rotate(-24deg); }
  #bang { position:absolute; top:1080px; left:720px; font-size:130px; font-weight:900; color:#e0524a;
    -webkit-text-stroke:10px #fff; paint-order:stroke; transform:scale(0); }
`)}
<body>
  <div id="root" data-composition-id="b4" data-start="0" data-duration="${D}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    <div id="stage" class="clip" data-start="0" data-duration="${D}" data-track-index="0">
      <div class="floor"></div><div class="noren l"></div>
      <div class="straw" id="straw4a"></div><div class="straw" id="straw4b"></div>
      ${zuncha('')}
      <div id="bang">！</div>
      <div class="sub" id="line-k4" style="opacity:0">「全部つながってるよ」</div>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.set("#expr-normal", { display: "none" }, 0)
      .set("#expr-puffed", { display: "block" }, 0)
      .set(".zuncha", { transformOrigin: "50% 88%" }, 0)
      .to(".zuncha", { x: -60, duration: 0.4, ease: "power1.in" }, 0.1)
      .to(".zuncha", { rotation: -74, y: 120, duration: 0.45, ease: "bounce.out" }, 0.5)
      .to("#bang", { scale: 1, duration: 0.25, ease: "back.out(2.5)" }, 0.55)
      .set("#expr-puffed", { display: "none" }, 1.05)
      .set("#expr-x", { display: "block" }, 1.05)
      .to("#line-k4", { opacity: 1, duration: 0.3 }, 1.15)
      .to("#bang", { opacity: 0, duration: 0.3 }, 1.6);
    window.__timelines["b4"] = tl;
  </script>
</body></html>` },

  // b5 2.5s: 承認→わーい→最終コピー
  b5: { dur: 2.5, html: (D) => `${head(D, `
  body { background:linear-gradient(180deg,#efe9db 0%,#dcedc8 100%); }
  .zuncha { position:absolute; bottom:330px; left:170px; width:460px; }
  .mini { position:absolute; bottom:330px; right:150px; width:250px; }
  #wai { bottom:1260px; left:150px; transform:scale(0); transform-origin:bottom center; }
  .copycard { position:absolute; top:0; left:0; width:100%; height:100%;
    background:rgba(94,156,48,.96); opacity:0;
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:36px; }
  .copy-main { font-size:96px; font-weight:900; color:#fff; letter-spacing:.04em; }
  .copy-sub { font-size:54px; font-weight:700; color:#eaf5da; }
`)}
<body>
  <div id="root" data-composition-id="b5" data-start="0" data-duration="${D}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    <div id="stage" class="clip" data-start="0" data-duration="${D}" data-track-index="0">
      ${zuncha('')}
      ${miniCup('mini')}
      <div class="bubble" id="wai">わーい！</div>
      <div class="sub" id="line-k5" style="opacity:0">「次は一緒に飲もうね」</div>
      <div class="copycard" id="card">
        <div class="copy-main">隠せない、おいしさ。</div>
        <div class="copy-sub">ずんだ茶寮　ずんだシェイク</div>
      </div>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.set("#expr-normal", { display: "none" }, 0)
      .set("#expr-happy", { display: "block" }, 0)
      .to("#line-k5", { opacity: 1, duration: 0.25 }, 0.1)
      .from(".mini", { y: 200, opacity: 0, duration: 0.4, ease: "back.out(1.4)" }, 0.15)
      .to("#wai", { scale: 1, duration: 0.35, ease: "back.out(2.2)" }, 0.6)
      .to(".zuncha", { y: -30, duration: 0.25, yoyo: true, repeat: 3, ease: "sine.inOut" }, 0.6)
      .to("#card", { opacity: 1, duration: 0.45 }, 1.6);
    window.__timelines["b5"] = tl;
  </script>
</body></html>` },
}

const gsapSrc = require.resolve('gsap/dist/gsap.min.js')
for (const [id, s] of Object.entries(scenes)) {
  const dir = path.join(here, id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'index.html'), s.html(s.dur))
  copyFileSync(gsapSrc, path.join(dir, 'gsap.min.js'))
  writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id, name: `shake-jiken ${id}`, createdAt: '2026-07-26T00:00:00Z' }, null, 2))
  console.log('scene:', id, s.dur + 's')
}
