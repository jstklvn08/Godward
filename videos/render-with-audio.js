// Render an animation page to MP4 at its own length (window.DUR) and mux a narration track.
//   node render-with-audio.js <page.html> <narration.wav> [stills t1,t2,...]
// Uses puppeteer-core and ffmpeg-static from tools/render (set RENDER_MODULES to that node_modules folder).
const path = require('path');
const MODS = process.env.RENDER_MODULES || 'D:/Creattion and the fall/tools/render/node_modules';
const puppeteer = require(path.join(MODS, 'puppeteer-core'));
const ffmpeg = require(path.join(MODS, 'ffmpeg-static'));
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const fs = require('fs');

const [page_, audio, mode, list] = process.argv.slice(2);
const FPS = 30;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--force-color-profile=srgb', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  let failed = false;
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); failed = true; });
  await page.goto(pathToFileURL(path.resolve(page_)).href + '?render=1');
  if (failed) process.exit(1);
  const dur = await page.evaluate(() => window.DUR);
  const base = page_.replace(/\.html$/, '');

  if (mode === 'stills') {
    for (const t of list.split(',').map(Number)) {
      await page.evaluate(x => window.seek(x), t);
      await page.screenshot({ path: `${base}-still-${String(t).replace('.', '_')}.jpg`, type: 'jpeg', quality: 80 });
    }
    console.log('stills done, duration', dur);
  } else {
    const output = base + '.mp4';
    const ff = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', audio,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
      // Pad the narration with silence so the video's tail isn't cut, then stop at the page's length.
      '-c:a', 'aac', '-b:a', '192k', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,apad', '-t', dur.toFixed(3), '-movflags', '+faststart', output],
      { stdio: ['pipe', 'ignore', 'inherit'] });
    const total = Math.ceil(FPS * dur);
    for (let i = 0; i < total; i++) {
      await page.evaluate(x => window.seek(x), i / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) console.log(`frame ${i}/${total}`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log('done', output, fs.statSync(output).size);
  }
  await browser.close();
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
