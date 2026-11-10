#!/usr/bin/env node
// Godward renderer: turns an episode page into video, stills, contact sheets and thumbnails.
//
// An episode page must follow the page contract (see .claude/skills/godward-episode/reference/engine.md):
//   window.DUR      length in seconds
//   window.seek(t)  draws the frame at time t, synchronously
//   ?render=1       stops the page's own playback loop
//   ?v=1            switches to the 1080x1920 vertical layout
//
// Commands
//   node tools/render.js video  <page.html> <out.mp4> [options]
//   node tools/render.js stills <page.html> <outdir> <t1,t2,...> [--vertical]
//   node tools/render.js sheet  <out.jpg> <cols> <img1> <img2> ...
//   node tools/render.js shot   <page.html> <out.png> <width> <height>     (waits for window.ready)
//
// Video options
//   --vertical          1080x1920 with ?v=1 (default 1920x1080)
//   --start S --end E   render a time range (default 0 to window.DUR)
//   --audio file        mux this audio (resampled to 48 kHz stereo AAC 192k), trimmed to the range
//   --loudnorm          also normalise that audio to -14 LUFS (use for raw narration; a finished mix is left alone)
//   --workers N         parallel Chrome instances (default 4; 6 suits this laptop)
//   --fps N             default 30
//   --quality web|master  web (default): CRF 23 capped at 12 Mb/s, about 5-10x smaller than master and fine
//                         for YouTube, Shorts, Reels and TikTok. master: CRF 18 uncapped, for archiving.
//   --query "&a=b"      extra query string for the page
//
// Environment: CHROME overrides the browser path.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer-core');
const ffmpeg = require('ffmpeg-static');

const BROWSERS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const CHROME = BROWSERS.find(p => fs.existsSync(p));

const QUALITY = {
  web: ['-crf', '23', '-maxrate', '12M', '-bufsize', '24M', '-preset', 'medium'],
  master: ['-crf', '18', '-preset', 'medium'],
};

function parse(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const key = a.slice(2);
    if (['vertical', 'loudnorm'].includes(key)) opt[key] = true;
    else opt[key] = argv[++i];
  }
  return { pos, opt };
}

async function openPage(html, { vertical, query = '', width, height, wait = false } = {}) {
  if (!CHROME) throw new Error('No Chrome or Edge found. Set CHROME to the browser executable.');
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: width || (vertical ? 1080 : 1920), height: height || (vertical ? 1920 : 1080), deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const q = wait ? '' : '?render=1' + (vertical ? '&v=1' : '') + query;
  await page.goto(pathToFileURL(path.resolve(html)).href + q, { waitUntil: 'load' });
  if (errors.length) throw new Error('Page error: ' + errors.join(' | '));
  return { browser, page, errors };
}

async function stills(html, outdir, list, opt) {
  fs.mkdirSync(outdir, { recursive: true });
  const { browser, page, errors } = await openPage(html, opt);
  const made = [];
  for (const t of list.split(',').map(Number)) {
    await page.evaluate(x => window.seek(x), t);
    const out = path.join(outdir, `${opt.vertical ? 'v' : 'h'}-t${t.toFixed(2).padStart(7, '0')}.jpg`);
    await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
    made.push(out);
  }
  await browser.close();
  if (errors.length) throw new Error('Page error: ' + errors.join(' | '));
  console.log(made.join('\n'));
}

async function segment(html, out, f0, f1, fps, opt, quality) {
  const { browser, page, errors } = await openPage(html, opt);
  const ff = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...quality, out], { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', d => { ffErr = (ffErr + d).slice(-4000); });
  for (let i = f0; i < f1; i++) {
    await page.evaluate(x => window.seek(x), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((i - f0) % 300 === 0) console.log(`${path.basename(out)} frame ${i - f0}/${f1 - f0}`);
    if (errors.length) break;
  }
  ff.stdin.end();
  const code = await new Promise(r => ff.on('close', r));
  await browser.close();
  if (errors.length) throw new Error('Page error: ' + errors.join(' | '));
  if (code) throw new Error('ffmpeg failed: ' + ffErr);
}

async function video(html, out, opt) {
  const fps = +(opt.fps || 30), workers = +(opt.workers || 4);
  const quality = QUALITY[opt.quality || 'web'];
  if (!quality) throw new Error('--quality must be web or master');
  const probe = await openPage(html, opt);
  const dur = await probe.page.evaluate(() => window.DUR);
  await probe.browser.close();
  if (!(dur > 0)) throw new Error('window.DUR is missing; see the page contract.');
  const start = +(opt.start || 0), end = Math.min(+(opt.end || dur), dur);
  const F0 = Math.round(start * fps), F1 = Math.round(end * fps);
  const tmp = out + '.parts';
  fs.mkdirSync(tmp, { recursive: true });
  const per = Math.ceil((F1 - F0) / workers), parts = [];
  for (let k = 0; k < workers; k++) {
    const a = F0 + k * per, b = Math.min(F1, a + per);
    if (a < b) parts.push([path.join(tmp, `p${k}.mp4`), a, b]);
  }
  const t0 = Date.now();
  console.log(`${parts.length} workers, frames ${F0}-${F1} (${((F1 - F0) / fps).toFixed(1)} s), ${opt.vertical ? '1080x1920' : '1920x1080'}, ${opt.quality || 'web'}`);
  await Promise.all(parts.map(([p, a, b]) => segment(html, p, a, b, fps, opt, quality)));
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, parts.map(p => `file '${p[0].replace(/\\/g, '/')}'`).join('\n'));
  const cat = ['-y', '-f', 'concat', '-safe', '0', '-i', list];
  if (opt.audio) {
    const af = ['aresample=48000', 'pan=stereo|c0=c0|c1=c0'];
    const channels = probeChannels(opt.audio);
    if (channels > 1) af.pop();
    if (opt.loudnorm) af.push('loudnorm=I=-14:TP=-1.0:LRA=11', 'aresample=48000');
    af.push('apad');
    cat.push('-ss', String(start), '-t', String(end - start), '-i', opt.audio,
      '-map', '0:v', '-map', '1:a', '-af', af.join(','), '-c:a', 'aac', '-b:a', '192k', '-t', String(end - start));
  }
  cat.push('-c:v', 'copy', '-movflags', '+faststart', out);
  const r = spawnSync(ffmpeg, cat, { encoding: 'utf8' });
  if (r.status) throw new Error('ffmpeg mux failed: ' + r.stderr.slice(-2000));
  fs.rmSync(tmp, { recursive: true, force: true });
  const mb = fs.statSync(out).size / 1e6;
  console.log(`done ${out} ${mb.toFixed(1)} MB, ${(mb * 8 / (end - start)).toFixed(1)} Mb/s, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

function probeChannels(file) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = /Audio:.*?(mono|stereo|(\d+) channels)/.exec(r.stderr || '');
  if (!m) return 1;
  return m[1] === 'mono' ? 1 : m[1] === 'stereo' ? 2 : +m[2];
}

async function sheet(out, cols, imgs) {
  const c = +cols;
  const first = imgs[0] || '';
  const tall = /(^|[\\/])v-/.test(first);
  const w = Math.floor(1920 / c), h = Math.round(tall ? w * 16 / 9 : w * 9 / 16);
  const rows = Math.ceil(imgs.length / c);
  const html = `<!doctype html><body style="margin:0;background:#000;width:1920px;display:grid;grid-template-columns:repeat(${c},${w}px)">` +
    imgs.map(i => `<div style="position:relative;width:${w}px;height:${h}px"><img src="${pathToFileURL(path.resolve(i)).href}" style="width:100%;height:100%;object-fit:contain;display:block"><span style="position:absolute;left:2px;top:2px;background:#000;color:#0f0;font:14px Segoe UI,Arial;padding:0 4px">${path.basename(i)}</span></div>`).join('');
  const tmp = path.join(path.dirname(path.resolve(out)), `_sheet-${process.pid}.html`);
  fs.writeFileSync(tmp, html);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: h * rows });
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
  await browser.close();
  fs.unlinkSync(tmp);
  console.log(out);
}

async function shot(html, out, w, h) {
  const { browser, page } = await openPage(html, { width: +w, height: +h, wait: true });
  await page.waitForFunction('window.ready === true', { timeout: 60000 });
  await page.screenshot({ path: out, type: out.endsWith('.png') ? 'png' : 'jpeg', quality: out.endsWith('.png') ? undefined : 92 });
  await browser.close();
  console.log(out);
}

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, opt } = parse(rest);
  if (cmd === 'video') return video(pos[0], pos[1], opt);
  if (cmd === 'stills') return stills(pos[0], pos[1], pos[2], opt);
  if (cmd === 'sheet') return sheet(pos[0], pos[1], pos.slice(2));
  if (cmd === 'shot') return shot(pos[0], pos[1], pos[2], pos[3]);
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
  process.exitCode = cmd ? 1 : 0;
})().catch(e => { console.error(e.message || e); process.exit(1); });
