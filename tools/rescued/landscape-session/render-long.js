// Long-form renderer: renders a time range of an episode page, optionally in parallel, then muxes audio.
// node render-long.js <html> <out.mp4> <start> <end> [audio.wav] [workers=4] [fps=30]
//   stills mode: node render-long.js <html> stills <outdir> t1,t2,...
const RD = 'C:/Users/User/AppData/Local/Temp/claude/6825648f516659e4/ebafb4fd-e15b-4367-a44d-fbcfca8faff8/scratchpad/render/node_modules/';
const puppeteer = require(RD + 'puppeteer-core');
const ffmpeg = require(RD + 'ffmpeg-static');
const { spawn, spawnSync } = require('child_process');
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);

async function openPage(html) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });
  await page.goto(pathToFileURL(html).href + '?render=1');
  return { browser, page };
}

async function stills(html, outdir, list) {
  fs.mkdirSync(outdir, { recursive: true });
  const { browser, page } = await openPage(html);
  for (const t of list.split(',').map(Number)) {
    await page.evaluate(x => window.seek(x), t);
    await page.screenshot({ path: path.join(outdir, `t${t.toFixed(2).padStart(7, '0')}.jpg`), type: 'jpeg', quality: 85 });
  }
  await browser.close();
}

async function segment(html, out, f0, f1, fps) {
  const { browser, page } = await openPage(html);
  const ff = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'medium', out], { stdio: ['pipe', 'ignore', 'ignore'] });
  for (let i = f0; i < f1; i++) {
    await page.evaluate(x => window.seek(x), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((i - f0) % 300 === 0) console.log(path.basename(out), 'frame', i - f0, '/', f1 - f0);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
}

(async () => {
  if (args[1] === 'stills') return stills(args[0], args[2], args[3]);
  const [html, out, start, end, audio, workers = '4', fpsS = '30'] = args;
  const fps = +fpsS, F0 = Math.round(+start * fps), F1 = Math.round(+end * fps), W = +workers;
  const tmp = out + '.parts'; fs.mkdirSync(tmp, { recursive: true });
  const per = Math.ceil((F1 - F0) / W), parts = [];
  for (let k = 0; k < W; k++) {
    const a = F0 + k * per, b = Math.min(F1, a + per);
    if (a < b) parts.push([path.join(tmp, `p${k}.mp4`), a, b]);
  }
  await Promise.all(parts.map(([p, a, b]) => segment(html, p, a, b, fps)));
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, parts.map(p => `file '${p[0].replace(/\\/g, '/')}'`).join('\n'));
  const cat = ['-y', '-f', 'concat', '-safe', '0', '-i', list];
  if (audio && audio !== '-') cat.push('-ss', String(start), '-t', String(+end - +start), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  cat.push('-c:v', 'copy', '-movflags', '+faststart', out);
  const r = spawnSync(ffmpeg, cat, { encoding: 'utf8' });
  if (r.status) console.error(r.stderr.slice(-2000));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('done', out, fs.statSync(out).size);
})().catch(e => { console.error(e); process.exit(1); });
