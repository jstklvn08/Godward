#!/usr/bin/env node
// Godward post packager: gathers one episode's finished video, IG cover and caption into posts/<slug>/,
// then rebuilds posts/index.html, one page that lists every episode's post (cover, video, caption, copy button).
//
//   node tools/package.js <slug> [--video <file.mp4>]     package videos/<slug>/ and rebuild the index
//   node tools/package.js --index                         only rebuild posts/index.html
//
// It looks in videos/<slug>/ for:
//   video      --video, else <slug>-vertical-outro.mp4, else any *-outro.mp4 or *-final.mp4 (newest first).
//              Only outro-joined files count: every posted video ends with the Godward outro.
//   cover      thumbnail-ig-4x5.png
//   caption    caption-ig.txt
// and writes posts/<slug>/<slug>-reel.mp4, <slug>-cover.png, <slug>-caption.txt.
// The video is hard-linked when possible (no extra disk space), otherwise copied.
// Missing pieces are reported and shown as missing in the index; nothing is invented.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VIDEOS = path.join(ROOT, 'videos');
const POSTS = path.join(ROOT, 'posts');
const IG_LIMIT = 2200;

function findVideo(dir, slug, explicit) {
  if (explicit) return path.resolve(explicit);
  const named = path.join(dir, `${slug}-vertical-outro.mp4`);
  if (fs.existsSync(named)) return named;
  const hits = fs.readdirSync(dir)
    .filter(f => /-(final|outro)\.mp4$/i.test(f))
    .map(f => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return hits[0] || null;
}

function place(src, dest, link) {
  if (fs.existsSync(dest)) fs.rmSync(dest);
  if (link) {
    try { fs.linkSync(src, dest); return 'linked'; } catch (_) { /* other volume or not allowed */ }
  }
  fs.copyFileSync(src, dest);
  return 'copied';
}

function packageEpisode(slug, explicitVideo) {
  const dir = path.join(VIDEOS, slug);
  if (!fs.existsSync(dir)) throw new Error(`No such episode folder: videos/${slug}`);
  const out = path.join(POSTS, slug);
  fs.mkdirSync(out, { recursive: true });

  const parts = [
    { name: 'video', src: findVideo(dir, slug, explicitVideo), dest: `${slug}-reel.mp4`, link: true },
    { name: 'cover', src: path.join(dir, 'thumbnail-ig-4x5.png'), dest: `${slug}-cover.png` },
    { name: 'caption', src: path.join(dir, 'caption-ig.txt'), dest: `${slug}-caption.txt` },
  ];
  for (const p of parts) {
    const dest = path.join(out, p.dest);
    if (!p.src || !fs.existsSync(p.src)) {
      if (fs.existsSync(dest)) fs.rmSync(dest);
      console.log(`  ${p.name.padEnd(8)} MISSING (expected in videos/${slug}/)`);
      continue;
    }
    const how = place(p.src, dest, p.link);
    console.log(`  ${p.name.padEnd(8)} ${how}  ${path.relative(ROOT, p.src)} -> posts/${slug}/${p.dest}`);
  }

  const capFile = path.join(out, `${slug}-caption.txt`);
  if (fs.existsSync(capFile)) {
    const text = fs.readFileSync(capFile, 'utf8').trim();
    const hook = text.split(/\r?\n/)[0];
    if (text.length > IG_LIMIT) console.log(`  WARNING  caption is ${text.length} characters (Instagram allows ${IG_LIMIT})`);
    if (hook.length > 125) console.log(`  note     hook line is ${hook.length} characters; only about 125 show before "more"`);
  }
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SMALL = new Set(['a', 'an', 'and', 'the', 'of', 'in', 'on', 'to', 'for', 'at', 'by']);
const titleOf = slug => slug.replace(/^\d+-/, '').split('-')
  .map((w, i) => (i && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1))).join(' ');

function buildIndex() {
  fs.mkdirSync(POSTS, { recursive: true });
  const slugs = fs.readdirSync(POSTS).filter(f => fs.statSync(path.join(POSTS, f)).isDirectory()).sort();
  const cards = slugs.map(slug => {
    const has = f => fs.existsSync(path.join(POSTS, slug, f));
    const video = `${slug}-reel.mp4`, cover = `${slug}-cover.png`, cap = `${slug}-caption.txt`;
    const caption = has(cap) ? fs.readFileSync(path.join(POSTS, slug, cap), 'utf8').trim() : '';
    let size = '';
    if (has(video)) size = `${Math.round(fs.statSync(path.join(POSTS, slug, video)).size / 1e6)} MB`;
    const missing = [!has(video) && 'video', !has(cover) && 'cover', !caption && 'caption'].filter(Boolean);
    const status = missing.length
      ? `<span class="pill miss">Missing: ${missing.join(', ')}</span>`
      : '<span class="pill ok">Ready to post</span>';
    const media = has(video)
      ? `<video controls preload="none" ${has(cover) ? `poster="${slug}/${cover}"` : ''} src="${slug}/${video}"></video>`
      : has(cover) ? `<img src="${slug}/${cover}" alt="Cover for ${esc(titleOf(slug))}">` : '<div class="blank">No video or cover yet</div>';
    return `
  <article class="post">
    <div class="media">${media}</div>
    <div class="info">
      <div class="top"><h2>${esc(titleOf(slug))}</h2>${status}</div>
      <div class="files">
        ${has(video) ? `<a href="${slug}/${video}">Video</a> <span>${size}</span>` : ''}
        ${has(cover) ? `<a href="${slug}/${cover}">Cover</a>` : ''}
        ${caption ? `<a href="${slug}/${cap}">Caption</a> <span>${caption.length} / ${IG_LIMIT}</span>` : ''}
      </div>
      ${caption ? `<pre class="cap">${esc(caption)}</pre><button type="button" class="copy">Copy caption</button>` : ''}
    </div>
  </article>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Godward Posts</title>
<style>
:root{--bg:#f6f5f2;--card:#fff;--ink:#1d2233;--muted:#5b6074;--line:#e2e0da;--coral:#e0533f;--ok:#2f8a57;--okbg:#e3f3e9;--missbg:#fbe7e3}
@media (prefers-color-scheme:dark){:root{--bg:#12141c;--card:#1a1d28;--ink:#e9e8e4;--muted:#a2a5b4;--line:#2c3040;--coral:#f07a66;--ok:#6fd39a;--okbg:#1f3328;--missbg:#3a2220;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 "Segoe UI",system-ui,sans-serif;padding:32px 16px 64px}
main{max-width:980px;margin:0 auto;display:flex;flex-direction:column;gap:20px}
h1{margin:0;font-size:30px}
.sub{color:var(--muted);margin:0}
.post{display:grid;grid-template-columns:260px 1fr;gap:20px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
.media video,.media img{width:100%;border-radius:10px;background:#000;display:block}
.media video{aspect-ratio:9/16;object-fit:contain}
.blank{aspect-ratio:4/5;border:1px dashed var(--line);border-radius:10px;display:grid;place-items:center;color:var(--muted)}
.info{display:flex;flex-direction:column;gap:10px;min-width:0}
.top{display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:space-between}
h2{margin:0;font-size:20px}
.pill{font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px}
.ok{background:var(--okbg);color:var(--ok)}.miss{background:var(--missbg);color:var(--coral)}
.files{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;color:var(--muted)}
.files a{color:var(--coral);font-weight:600}
.cap{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.55 "Segoe UI",system-ui,sans-serif;background:var(--bg);border-radius:10px;padding:12px 14px}
.copy{align-self:flex-start;font:inherit;font-weight:600;border:1px solid var(--coral);color:var(--coral);background:transparent;border-radius:8px;padding:6px 14px;cursor:pointer}
.copy:focus-visible{outline:2px solid var(--coral);outline-offset:2px}
@media (max-width:640px){.post{grid-template-columns:1fr}}
</style></head><body><main>
<h1>Godward posts</h1>
<p class="sub">Each episode's Reel, cover and caption. Built by <code>node tools/package.js</code> on ${new Date().toISOString().slice(0, 10)}.</p>
${cards || '<p class="sub">No episodes packaged yet.</p>'}
</main>
<script>
document.querySelectorAll('.copy').forEach(b => b.addEventListener('click', async () => {
  const text = b.previousElementSibling.textContent;
  try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; }
  catch (e) { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selected, press Ctrl+C'; }
  setTimeout(() => { b.textContent = 'Copy caption'; }, 2000);
}));
</script>
</body></html>
`;
  fs.writeFileSync(path.join(POSTS, 'index.html'), html);
  console.log(`Index: posts/index.html (${slugs.length} episode${slugs.length === 1 ? '' : 's'})`);
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log('Usage: node tools/package.js <slug> [--video <file.mp4>] | --index');
    process.exit(1);
  }
  if (args[0] !== '--index') {
    const vi = args.indexOf('--video');
    const slug = args[0];
    console.log(`Packaging ${slug}`);
    packageEpisode(slug, vi >= 0 ? args[vi + 1] : null);
  }
  buildIndex();
}

main();
