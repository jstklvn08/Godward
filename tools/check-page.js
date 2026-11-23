// Page checks for the episode pipeline (tools/produce.py).
//   node tools/check-page.js <abs path to episode.html> seek     -> seeks every 0.5 s; prints JSON {dur, errors}
//   node tools/check-page.js <abs path to episode.html> sheets   -> prints JSON [mid-time of each sheet]
const {chromium} = require('playwright');
(async () => {
  const [page, mode] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + page + '?render=1&vertical=1'); await p.waitForTimeout(800);
  let out;
  if (mode === 'sheets') {
    out = await p.evaluate(() => { const ts = SH.map(s => s.at || 0); ts.push(window.DUR - 7);
      return ts.slice(0, -1).map((a, i) => +((a + ts[i + 1]) / 2 + .3).toFixed(1)); });
  } else {
    out = await p.evaluate(() => { const o = []; if (!window.DUR) return {dur: 0, errors: ['no DUR']};
      for (let t = 0; t < window.DUR; t += .5) { try { window.seek(t); } catch (e) { o.push(t.toFixed(1) + ': ' + e.message); if (o.length > 8) break; } }
      return {dur: window.DUR, errors: o}; });
    out.errors = out.errors.concat(errs.slice(0, 5));
  }
  console.log(JSON.stringify(out)); await b.close();
})();
