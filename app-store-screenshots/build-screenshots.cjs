/**
 * App Store screenshot builder.
 *
 * Renders each slide as a standalone 1284x2778 HTML page and captures it with
 * headless Edge. One page per slide rather than one scrolling document, so a
 * capture can never straddle two slides or pick up a scroll offset.
 *
 * The blue ground here is the same #2B74D6 as the launch screen, so the store
 * listing and the first thing a new user sees are the same colour.
 *
 * Usage:  node build-screenshots.js
 * Output: appstore-1284x2778/*.png
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SC_ROOT || __dirname;
const SRC_DIR = path.join(ROOT, 'upload');
const OUT_DIR = path.join(ROOT, 'appstore-1284x2778');
const WORK_DIR = path.join(ROOT, '.render');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const W = 1284;
const H = 2778;

// Copy is deliberately plain. No em dashes, and every line says what the
// screen does rather than how it feels.
const SLIDES = [
  {
    file: '01_home',
    title: 'Your co-parenting<br>hub.',
    sub: 'Custody days, pending requests and today\u2019s schedule. All there the moment you open the app.',
  },
  {
    file: '02_expenses',
    title: 'Every expense,<br>agreed on.',
    sub: 'Request, approve and track child costs with a clear record both parents can see.',
  },
  {
    file: '03_calendar',
    title: 'Custody,<br>crystal clear.',
    sub: 'One shared schedule for pickups, handovers and school events. No more guessing.',
  },
  {
    file: '04_my_scai',
    title: 'Just ask.<br>It\u2019s handled.',
    sub: 'Schedule a pickup, request funds or log a check-in. Your AI assistant does the work.',
  },
  {
    file: '05_my_scai_chat',
    title: 'Answers, in<br>plain language.',
    sub: 'Ask anything about your arrangement and get a clear, useful reply in seconds.',
  },
  {
    file: '06_monthly_report',
    title: 'Court-ready<br>in one tap.',
    sub: 'A complete monthly summary of spend, custody and communication, ready to share.',
  },
  {
    file: '07_pricing',
    title: 'Start free.<br>Upgrade later.',
    sub: 'Simple, transparent pricing with no hidden fees. Cancel any time.',
  },
  {
    file: '08_parenting_scoreboard',
    title: 'See how you\u2019re<br>coordinating.',
    sub: 'A monthly co-parenting score built from what the two of you actually log together.',
  },
  {
    file: '09_family',
    title: 'Everyone in<br>one place.',
    sub: 'Add your children, link your co-parent and invite the professionals who support you.',
  },
  {
    file: '10_messages',
    title: 'Talk on<br>the record.',
    sub: 'Secure, timestamped messages that keep communication calm and documented.',
  },
];

function page(slide, dataUri) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#2B74D6}

.slide{position:relative;width:${W}px;height:${H}px;overflow:hidden;
  display:flex;flex-direction:column;
  /* The launch screen's blue, with just enough gradient to stop 1284x2778 of
     flat colour reading as a rendering error. */
  background:linear-gradient(176deg,#3A82E0 0%,#2B74D6 38%,#2468C4 74%,#1C57A8 100%);
  font-family:"Segoe UI Variable Display","Segoe UI",-apple-system,BlinkMacSystemFont,system-ui,sans-serif}

/* Soft light behind the header and the device, so the phone reads as lit
   rather than pasted on. */
.orb{position:absolute;border-radius:50%;pointer-events:none}
.orb-a{right:-190px;top:-150px;width:716px;height:716px;
  background:radial-gradient(circle,rgba(255,255,255,.20) 0%,rgba(255,255,255,0) 68%)}
.orb-b{left:-200px;top:755px;width:636px;height:636px;
  background:radial-gradient(circle,rgba(255,255,255,.10) 0%,rgba(255,255,255,0) 68%)}

.top{position:relative;z-index:2;padding:131px 103px 0;display:flex;flex-direction:column}
.wordmark{font-size:44px;font-weight:700;color:#FFFFFF;letter-spacing:.01em;margin-bottom:72px}
.title{font-size:121px;font-weight:700;color:#FFFFFF;line-height:1.04;
  letter-spacing:-.035em;margin-bottom:40px}
.sub{font-size:47px;font-weight:400;color:rgba(255,255,255,.84);line-height:1.44;max-width:1045px}

.stage{position:relative;z-index:2;flex:1;display:flex;justify-content:center;
  align-items:flex-start;padding:103px 0 0}
.stage::before{content:"";position:absolute;top:119px;left:50%;transform:translateX(-50%);
  width:1194px;height:1194px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,255,255,.16) 0%,rgba(255,255,255,0) 62%)}

.phone{position:relative;width:896px;padding:20px;border-radius:98px;background:#0D1C2E;
  box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.18),
             0 50px 130px rgba(8,30,60,.42),
             0 18px 50px rgba(8,30,60,.3)}
.screen{position:relative;border-radius:80px;overflow:hidden;background:#F2F2F7}
.screen::after{content:"";position:absolute;top:23px;left:50%;transform:translateX(-50%);
  width:187px;height:54px;background:#0D1C2E;border-radius:27px;z-index:3}
.screen img{width:100%;display:block}
</style></head><body>
<div class="slide">
  <span class="orb orb-a"></span><span class="orb orb-b"></span>
  <div class="top">
    <div class="wordmark">SupportCard</div>
    <div class="title">${slide.title}</div>
    <div class="sub">${slide.sub}</div>
  </div>
  <div class="stage"><div class="phone"><div class="screen"><img src="${dataUri}"></div></div></div>
</div></body></html>`;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(WORK_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: EDGE,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-device-scale-factor=1'],
  });
  const tab = await browser.newPage();
  await tab.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  for (const slide of SLIDES) {
    const srcPath = path.join(SRC_DIR, slide.file + '.jpg');
    if (!fs.existsSync(srcPath)) throw new Error('missing source: ' + srcPath);
    const dataUri = 'data:image/jpeg;base64,' + fs.readFileSync(srcPath).toString('base64');

    const htmlPath = path.join(WORK_DIR, slide.file + '.html');
    fs.writeFileSync(htmlPath, page(slide, dataUri));

    await tab.goto('file:///' + htmlPath.replace(/\\/g, '/').replace(/ /g, '%20'), {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });
    // Let webfonts settle before the capture, or the first slide renders in a
    // fallback face while the rest render correctly.
    await tab.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 350));

    const out = path.join(OUT_DIR, slide.file + '.png');
    await tab.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
    console.log('rendered', slide.file);
  }

  await browser.close();
  console.log('\nDone. ' + SLIDES.length + ' slides at ' + W + 'x' + H + ' in ' + OUT_DIR);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
