// node sheet.js out.jpg cols img1 img2 ...   Contact sheet of images, labelled with file names.
const RD = 'C:/Users/User/AppData/Local/Temp/claude/6825648f516659e4/ebafb4fd-e15b-4367-a44d-fbcfca8faff8/scratchpad/render/node_modules/';
const puppeteer = require(RD + 'puppeteer-core');
const path = require('path'), { pathToFileURL } = require('url'), fs = require('fs');
const [out, cols, ...imgs] = process.argv.slice(2);
(async () => {
  const c = +cols, w = Math.floor(1920 / c), h = Math.round(w * 9 / 16);
  const rows = Math.ceil(imgs.length / c);
  const html = `<!doctype html><body style="margin:0;background:#000;width:1920px;display:grid;grid-template-columns:repeat(${c},${w}px)">` +
    imgs.map(i => `<div style="position:relative;width:${w}px;height:${h}px"><img src="${pathToFileURL(i).href}" style="width:100%;height:100%;display:block"><span style="position:absolute;left:2px;top:2px;background:#000;color:#0f0;font:14px Segoe UI;padding:0 4px">${path.basename(i)}</span></div>`).join('');
  const tmp = path.join(path.dirname(out), '_s.html');
  fs.writeFileSync(tmp, html);
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: h * rows });
  await p.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle0' });
  await p.screenshot({ path: out, type: 'jpeg', quality: 82 });
  await b.close();
})();
