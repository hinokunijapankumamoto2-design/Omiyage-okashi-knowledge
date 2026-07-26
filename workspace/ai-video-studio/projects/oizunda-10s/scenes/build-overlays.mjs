// 「追いずんだ」10秒 POV版: 実写手元に重ねる透過ステッカーレイヤー4本
// 実行: node scenes/build-overlays.mjs → 各 scenes/o*/ を webm でレンダリング
// 内容: ずんちゃ丸ステッカー＋擬音ステッカー＋記号。実写側（手・シェイク・器）は含まない
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

// ずんちゃ丸は調理台の端＝画面右下 1/4 に常駐（カピバラルル型の定位置）
const head = (extra) => `<!doctype html>
<html lang="ja"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<script src="./gsap.min.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${W}px; height:${H}px; overflow:hidden; background:transparent;
    font-family:"Noto Sans JP","Hiragino Sans","Yu Gothic",sans-serif; }
  .zuncha { position:absolute; bottom:170px; right:80px; width:430px; }
  .onoma { position:absolute; font-weight:900; -webkit-text-stroke:12px #fff; paint-order:stroke;
    transform:scale(0); }
  ${extra}
</style></head>`

const overlays = {
  // o1 2.5s: ①追いずんだ実行中。器を掲げるポーズ＋「とろ〜〜」
  o1: { dur: 2.5, html: (D) => `${head(`
  .zuncha { transform-origin:50% 90%; }
  #toro { top:760px; right:420px; font-size:96px; color:#5e9c30; transform:rotate(-12deg) scale(0); }
  .jar { position:absolute; bottom:560px; right:130px; width:330px; height:230px; }
`)}
<body>
  <div id="root" data-composition-id="o1" data-start="0" data-duration="${D}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    <div id="stage" class="clip" data-start="0" data-duration="${D}" data-track-index="0">
      ${zuncha('')}
      <svg class="jar" viewBox="0 0 300 210" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="150" cy="105" rx="130" ry="90" fill="none" stroke="#cfe3b7" stroke-width="12"/>
        <ellipse cx="150" cy="120" rx="112" ry="70" fill="#8BCB59" opacity="0.95"/>
        <path d="M 60 150 Q 90 175 150 178 Q 210 175 240 150 L 232 190 Q 150 210 68 190 Z" fill="#6FB234"/>
      </svg>
      <div class="onoma" id="toro">とろ〜〜</div>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.set("#expr-normal", { display: "none" }, 0)
      .set("#expr-sneaky", { display: "block" }, 0)
      .set(".zuncha", { rotation: -6 }, 0)
      .to(".jar", { y: -26, rotation: -14, transformOrigin: "50% 100%", duration: 0.5, ease: "power2.out" }, 0.1)
      .to("#toro", { scale: 1, duration: 0.4, ease: "back.out(2)" }, 0.5)
      .to("#leaf-l", { rotation: -18, svgOrigin: "186 72", duration: 0.2, yoyo: true, repeat: 7, ease: "sine.inOut" }, 0.4)
      .to("#leaf-r", { rotation: 18, svgOrigin: "214 72", duration: 0.2, yoyo: true, repeat: 7, ease: "sine.inOut" }, 0.4)
      .to(".zuncha", { y: 6, duration: 0.4, yoyo: true, repeat: 2, ease: "sine.inOut" }, 0.6);
    window.__timelines["o1"] = tl;
  </script>
</body></html>` },

  // o2 2s: ②発覚。「！」＋ぷるん＋目そらし
  o2: { dur: 2, html: (D) => `${head(`
  #bang { top:700px; right:360px; font-size:150px; color:#e0524a; }
`)}
<body>
  <div id="root" data-composition-id="o2" data-start="0" data-duration="${D}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    <div id="stage" class="clip" data-start="0" data-duration="${D}" data-track-index="0">
      ${zuncha('')}
      <div class="onoma" id="bang">！</div>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.set("#expr-normal", { display: "none" }, 0)
      .set("#expr-puffed", { display: "block" }, 0)
      .to("#bang", { scale: 1, duration: 0.22, ease: "back.out(2.6)" }, 0.25)
      .fromTo("#leaf-l", { rotation: -8, svgOrigin: "186 72" }, { rotation: -30, duration: 0.18, ease: "back.out(2)" }, 0.25)
      .fromTo("#leaf-r", { rotation: 8, svgOrigin: "214 72" }, { rotation: 30, duration: 0.18, ease: "back.out(2)" }, 0.25)
      .to(".zuncha", { scaleY: 0.94, transformOrigin: "50% 100%", duration: 0.12, yoyo: true, repeat: 3 }, 0.3)
      .to("#bang", { opacity: 0, duration: 0.3 }, 1.4);
    window.__timelines["o2"] = tl;
  </script>
</body></html>` },

  // o3 3s: ③泣き→ぽん→頬ぱんぱん。「ふえ〜ん」→「ぽん」
  o3: { dur: 3, html: (D) => `${head(`
  #fuen { top:820px; right:420px; font-size:88px; color:#4a7fd0; transform:rotate(-8deg) scale(0); }
  #pon { top:1000px; right:180px; font-size:100px; color:#e8a531; transform:scale(0); }
  .tear { position:absolute; width:26px; height:40px; border-radius:50% 50% 60% 60%;
    background:#7db4f0; opacity:0; }
`)}
<body>
  <div id="root" data-composition-id="o3" data-start="0" data-duration="${D}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    <div id="stage" class="clip" data-start="0" data-duration="${D}" data-track-index="0">
      ${zuncha('')}
      <div class="tear" id="t1" style="bottom:560px; right:470px;"></div>
      <div class="tear" id="t2" style="bottom:560px; right:120px;"></div>
      <div class="onoma" id="fuen">ふえ〜ん</div>
      <div class="onoma" id="pon">ぽん</div>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.set("#expr-normal", { display: "none" }, 0)
      .set("#expr-x", { display: "block" }, 0)
      .to("#fuen", { scale: 1, duration: 0.35, ease: "back.out(2)" }, 0.15)
      .to("#t1", { opacity: 1, y: -60, duration: 0.5, repeat: 1, ease: "power1.out" }, 0.2)
      .to("#t2", { opacity: 1, y: -60, duration: 0.5, repeat: 1, ease: "power1.out" }, 0.35)
      .to(".zuncha", { rotation: -3, duration: 0.2, yoyo: true, repeat: 5, transformOrigin: "50% 90%" }, 0.2)
      // 1.6s: スプーンぽん（実写の手がここで口へ）→ 表情が puffed に切り替わり涙停止
      .set("#expr-x", { display: "none" }, 1.6)
      .set("#expr-puffed", { display: "block" }, 1.6)
      .set("#t1", { opacity: 0 }, 1.6)
      .set("#t2", { opacity: 0 }, 1.6)
      .to("#fuen", { opacity: 0, duration: 0.2 }, 1.55)
      .to("#pon", { scale: 1, duration: 0.3, ease: "back.out(2.4)" }, 1.65)
      .to("#pon", { opacity: 0, duration: 0.25 }, 2.4)
      .to(".zuncha", { scaleX: 1.04, transformOrigin: "50% 100%", duration: 0.25, yoyo: true, repeat: 1 }, 1.7);
    window.__timelines["o3"] = tl;
  </script>
</body></html>` },

  // o4 2.5s: ④幸せとろけ→ころん→承認→起き上がり（ループ点）＋「ふにゃ〜」＋枝豆回転＋湯気エッグ
  o4: { dur: 2.5, html: (D) => `${head(`
  #funya { top:820px; right:420px; font-size:92px; color:#5e9c30; transform:rotate(-10deg) scale(0); }
  .bean { position:absolute; width:60px; height:38px; border-radius:50%; background:#6FB234;
    border:5px solid #3d6b1e; opacity:0; }
  .steamEgg { position:absolute; top:520px; left:180px; width:200px; opacity:0; }
`)}
<body>
  <div id="root" data-composition-id="o4" data-start="0" data-duration="${D}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    <div id="stage" class="clip" data-start="0" data-duration="${D}" data-track-index="0">
      ${zuncha('')}
      <div class="bean" id="bn1" style="bottom:900px; right:420px;"></div>
      <div class="bean" id="bn2" style="bottom:940px; right:280px;"></div>
      <div class="onoma" id="funya">ふにゃ〜</div>
      <svg class="steamEgg" viewBox="0 0 200 110" xmlns="http://www.w3.org/2000/svg" fill="none">
        <path d="M 30 72 Q 12 58 20 40 Q 30 20 56 24 Q 66 12 84 14 Q 100 16 106 30 Q 128 26 142 38 Q 158 50 152 68 Q 144 88 118 86 Q 104 96 86 92 Q 70 88 66 76 Q 44 82 30 72 Z"
              stroke="rgba(255,255,255,.85)" stroke-width="9" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.set("#expr-normal", { display: "none" }, 0)
      .set("#expr-happy", { display: "block" }, 0)
      .set(".zuncha", { transformOrigin: "50% 92%" }, 0)
      .to("#funya", { scale: 1, duration: 0.35, ease: "back.out(2)" }, 0.1)
      // ころん（後ろに倒れる）
      .to(".zuncha", { rotation: -68, y: 90, duration: 0.5, ease: "bounce.out" }, 0.35)
      .to("#bn1", { opacity: 1, rotation: 360, x: -30, duration: 0.9, ease: "none" }, 0.5)
      .to("#bn2", { opacity: 1, rotation: -360, x: 30, duration: 0.9, ease: "none" }, 0.6)
      // 8.0s相当（シーン内1.0s）: 湯気が6フレームだけ枝豆マークに
      .to(".steamEgg", { opacity: 1, duration: 0.1 }, 1.0)
      .to(".steamEgg", { opacity: 0, duration: 0.1 }, 1.2)
      // 起き上がってループ点へ（冒頭の器へ手を伸ばす姿勢）
      .to("#funya", { opacity: 0, duration: 0.2 }, 1.5)
      .to("#bn1", { opacity: 0, duration: 0.2 }, 1.5)
      .to("#bn2", { opacity: 0, duration: 0.2 }, 1.5)
      .to(".zuncha", { rotation: -6, y: 0, duration: 0.55, ease: "back.out(1.4)" }, 1.7)
      .set("#expr-happy", { display: "none" }, 2.2)
      .set("#expr-sneaky", { display: "block" }, 2.2);
    window.__timelines["o4"] = tl;
  </script>
</body></html>` },
}

const gsapSrc = require.resolve('gsap/dist/gsap.min.js')
for (const [id, s] of Object.entries(overlays)) {
  const dir = path.join(here, id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'index.html'), s.html(s.dur))
  copyFileSync(gsapSrc, path.join(dir, 'gsap.min.js'))
  writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id, name: `oizunda overlay ${id}`, createdAt: '2026-07-26T00:00:00Z' }, null, 2))
  console.log('overlay:', id, s.dur + 's')
}
