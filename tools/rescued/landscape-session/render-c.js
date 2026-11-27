// Usage: node render.js <dir> <name.html> stills t1,t2,... | node render.js <dir> <name.html> video
const puppeteer = require('puppeteer-core');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');

const [dir, name, mode, list] = process.argv.slice(2);
const FPS = 30, DUR = 10;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });
  await page.goto(pathToFileURL(path.join(dir, name)).href + '?render=1');
  const base = name.replace(/\.html$/, '');

  if (mode === 'stills') {
    const out = path.join(__dirname, 'stills');
    fs.mkdirSync(out, { recursive: true });
    for (const t of list.split(',').map(Number)) {
      await page.evaluate(x => window.seek(x), t);
      await page.screenshot({ path: path.join(out, `${base}-${String(t).replace('.', '_')}.jpg`), type: 'jpeg', quality: 80 });
    }
  } else {
    const output = path.join(dir, base + '.mp4');
    const ff = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-preset', 'medium', '-movflags', '+faststart', output],
      { stdio: ['pipe', 'ignore', 'ignore'] });
    const total = FPS * DUR;
    for (let i = 0; i < total; i++) {
      await page.evaluate(x => window.seek(x), i / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 98 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log('done', output, fs.statSync(output).size);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
