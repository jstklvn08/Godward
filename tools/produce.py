#!/usr/bin/env python3
"""Godward episode pipeline: everything after the creative work, in one command.

The creative part stays by hand: scripts/NN-slug.md, videos/<slug>/episode.html (the animation),
videos/<slug>/audio-cues.json (the soundtrack plan), the thumbnail and the caption. Once those exist,
add videos/<slug>/episode.json:

    {"script": "scripts/29-the-good-samaritan.md", "voice": "29-samaritan-own-voice",
     "title": "The Good Samaritan", "eyebrow": "Luke · Luke 10"}

and run

    python3 tools/produce.py run <slug>                  # one episode, all stages
    python3 tools/produce.py queue <slug> <slug> ...     # several; records the next narration while the previous renders
    python3 tools/produce.py run <slug> --from mix       # restart from a stage

Stages (each logs to videos/<slug>/build/produce.log):
  trim    fill the ESV text (scripts/fill_esv.py) and cut each quote to its "keep only" note
  voice   record the narration in the narrator's own voice (voice/render_styled.py --natural)
  align   time every word (voice/align_words.py); re-record misheard passages and rushed scripture
          (voice/fix_lines.py, one round), rebuild the narration and align again
  check   seek the page every 0.5 s for errors, and save a contact sheet of every scene to build/check.jpg
  mix     build the soundtrack stems and mix; level the music bus until the voice sits 29 dB over it
  render  render the vertical video, append the brand outro, delete the raw render
  post    Post Packs preview (540x960, <15 MB), 720x900 cover, and the card in the Post Packs page
  finish  delete stems except mix.wav, commit the timing files

Never commits .esv.md, MP4s or WAVs. Publishing the Post Packs artifact and sending the MP4 are done
by Claude after the run (the pipeline prints READY with the paths).
"""
from __future__ import annotations

import argparse, html, json, math, os, re, shutil, subprocess, sys, threading, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICE = ROOT / 'voice'
PY = str(VOICE / '.venv' / 'bin' / 'python')
POSTPACK = Path(os.environ.get('GODWARD_POSTPACK', '/tmp/claude-0/-home-user-Godward/8a165157-5a16-56c4-895d-bbc0a0057b73/scratchpad/postpack'))
STAGES = ['trim', 'voice', 'align', 'check', 'mix', 'render', 'post', 'finish']
TARGET_DB = 29.0
RUSHED_WPS = 3.6
ATTRIB = ("\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n"
          "Claude-Session: https://claude.ai/code/session_01Mq7RXzfkMY8mdm9hGz23cB")


class Ep:
    def __init__(self, slug: str):
        self.slug = slug
        self.dir = ROOT / 'videos' / slug
        cfg = json.loads((self.dir / 'episode.json').read_text())
        self.cfg = cfg
        self.md = ROOT / cfg['script']
        self.esv = self.md.with_suffix('.esv.md')
        self.voice = cfg['voice']
        self.title = cfg['title']
        self.build = self.dir / 'build'
        self.audio = self.build / 'audio'
        self.build.mkdir(parents=True, exist_ok=True)
        self.log = open(self.build / 'produce.log', 'a')
        self.wav = VOICE / 'full' / self.voice / f'{self.voice}-natural.wav'
        self.mp4 = self.dir / f'{slug}-vertical.mp4'
        self.final = self.dir / f'{slug}-vertical-outro.mp4'

    def say(self, msg: str):
        line = f'[{time.strftime("%H:%M:%S")}] {self.slug}: {msg}'
        print(line, flush=True); self.log.write(line + '\n'); self.log.flush()

    def sh(self, cmd: list[str], cwd: Path = ROOT, check=True, quiet=False) -> str:
        self.say('$ ' + ' '.join(str(c) for c in cmd))
        p = subprocess.run([str(c) for c in cmd], cwd=cwd, capture_output=True, text=True)
        out = p.stdout + p.stderr
        self.log.write(re.sub(r'[^\n]*Sampling:[^\n]*\n?', '', out.replace('\r', '\n'))[-20000:] + '\n'); self.log.flush()
        if check and p.returncode != 0:
            raise RuntimeError(f'{cmd[0]} failed ({p.returncode}): {out[-1500:]}')
        return out


# ---------------------------------------------------------------- trim
def trim_quotes(text: str) -> tuple[str, int]:
    """Cut each filled ESV quote down to its (keep only "...") fragments, in both the On screen and narration lines."""
    n = 0
    for g in re.findall(r'^> \[grave\] (“.+”)\s*$', text, flags=re.M):
        m = re.search(re.escape(g) + r' \(keep only (.+?)\) ·', text)
        if not m:
            continue
        frags = [f.replace('\\"', '"') for f in re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1))]
        if not frags:
            continue
        body = ' '.join(f.strip() for f in frags)
        parts = body.replace('"', '“').split('“'); body = parts[0]  # straight quotes inside a fragment become curly pairs
        for i, part in enumerate(parts[1:]):
            body += ('“' if i % 2 == 0 else '”') + part
        body = body[0].upper() + body[1:]
        opens, closes = body.count('“'), body.count('”')
        if closes > opens:                     # the speech closes inside the fragment: open it, don't close it again
            new = '“' + (body if body[-1] in '.!?”’' else body + '.')
        elif opens and body.endswith('”'):     # an inner quote ends the line: full stop inside it, no outer quotes
            new = body if body[-2] in '.!?' else body[:-1] + '.”'
        else:
            new = '“' + (body if body[-1] in '.!?”’' else body + '.') + '”'
        if text.count(g) != 2:
            raise RuntimeError(f'quote appears {text.count(g)} times, expected 2: {g[:60]}')
        text = text.replace(g, new); n += 1
    # a whole verse that ends inside speech comes back as “...lost.”” : drop the extra closing quote
    text = re.sub(r'^(.*)$', lambda m: m.group(1).replace('””', '”') if m.group(1).count('”') > m.group(1).count('“') else m.group(1), text, flags=re.M)
    return text, n


def st_trim(e: Ep):
    if e.esv.exists() and e.esv.stat().st_mtime > e.md.stat().st_mtime:
        e.say('trim: .esv.md is newer than the script, keeping it'); return
    e.sh(['python3', 'scripts/fill_esv.py', str(e.md.relative_to(ROOT)), '--bg'])
    text, n = trim_quotes(e.esv.read_text())
    e.esv.write_text(text)
    e.say(f'trim: cut {n} quotes to their keep-only text')


# ---------------------------------------------------------------- voice
def st_voice(e: Ep):
    e.sh([PY, 'render_styled.py', '--script', str(e.esv), '--name', e.voice, '--natural'], cwd=VOICE)
    e.say(f'voice: {e.wav.name} ready')


# ---------------------------------------------------------------- align
def align(e: Ep) -> list[tuple[float, str, str]]:
    out = e.sh([PY, 'align_words.py', '--script', str(e.esv), '--audio', str(e.wav), '--out', str(e.dir / 'words.js')], cwd=VOICE)
    done = [l for l in out.splitlines() if l.startswith('DONE')]
    e.say('align: ' + (done[-1] if done else 'no DONE line'))
    return [(float(a), b, c) for a, b, c in re.findall(r"misheard at\s+([\d.]+)s\s+script: ['\"](.+?)['\"]\s+heard: ['\"](.*?)['\"]", out)]


def norm(w: str) -> str:
    return re.sub(r"[^a-z0-9']", '', w.lower())


def load_words(e: Ep) -> list:
    s = (e.dir / 'words.js').read_text()
    return json.loads(s[s.index('['):s.rindex(']') + 1])


def passage_of(e: Ep, t: float) -> str | None:
    """section.index of the passage that holds the word spoken at time t."""
    W = load_words(e); i = min(range(len(W)), key=lambda k: abs(W[k][1] - t))
    P = json.loads((VOICE / 'full' / e.voice / 'passages.json').read_text())
    texts = {k: [norm(x) for x in v['text'].split()] for k, v in P.items()}
    for span in (4, 3, 2):
        for a in range(max(0, i - span + 1), i + 1):
            seq = [norm(w[0]) for w in W[a:a + span]]
            hits = [k for k, ws in texts.items() if any(ws[j:j + span] == seq for j in range(len(ws) - span + 1))]
            if len(hits) == 1:
                m = re.match(r's(\d+)-(\d+)-', hits[0]); return f'{int(m.group(1))}.{int(m.group(2))}'
    return None


def st_align(e: Ep):
    mis = align(e)
    P = json.loads((VOICE / 'full' / e.voice / 'passages.json').read_text())
    targets = set()
    for t, script, heard in mis:
        if norm(script) == norm(heard) or norm(script).rstrip('s') == norm(heard).rstrip('s'):
            continue
        pid = passage_of(e, t)
        e.say(f'align: misheard {script!r} as {heard!r} at {t}s -> passage {pid}')
        if pid: targets.add(pid)
    for k, v in P.items():
        if v.get('mode') == 'grave' and v.get('words_per_second', 0) > RUSHED_WPS:
            m = re.match(r's(\d+)-(\d+)-', k); pid = f'{int(m.group(1))}.{int(m.group(2))}'
            e.say(f'align: rushed scripture {v["words_per_second"]} w/s -> passage {pid}'); targets.add(pid)
    if not targets:
        return
    out = e.sh([PY, 'fix_lines.py', *sorted(targets), '--script', str(e.esv), '--ref-dir', 'reference/own-voice', '--name', e.voice], cwd=VOICE)
    for l in out.splitlines():
        if 'KEPT' in l or '->' in l: e.say('fix: ' + l.strip())
    e.sh([PY, 'render_styled.py', '--script', str(e.esv), '--name', e.voice, '--natural'], cwd=VOICE)
    left = align(e)
    for t, script, heard in left:
        e.say(f'align: still hears {script!r} as {heard!r} at {t}s (left as is)')


# ---------------------------------------------------------------- check
def st_check(e: Ep):
    page = str(e.dir / 'episode.html')
    r = json.loads(e.sh(['node', 'tools/check-page.js', page, 'seek']).strip().splitlines()[-1])
    if r['errors']:
        raise RuntimeError('page errors: ' + '; '.join(r['errors']))
    times = json.loads(e.sh(['node', 'tools/check-page.js', page, 'sheets']).strip().splitlines()[-1])
    st = e.build / 'stills'; shutil.rmtree(st, ignore_errors=True)
    e.sh(['node', 'tools/render.js', 'stills', page, str(st), ','.join(map(str, times)), '--vertical'])
    cols = min(7, len(times)); rows = math.ceil(len(times) / cols)
    e.sh(['ffmpeg', '-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', str(st / 'v-t*.jpg'),
          '-vf', f'scale=270:-1,tile={cols}x{rows}', '-frames:v', '1', str(e.build / 'check.jpg')])
    shutil.rmtree(st, ignore_errors=True)
    e.say(f'check: {r["dur"]:.1f} s, no errors; scenes at {e.build / "check.jpg"}')


# ---------------------------------------------------------------- mix
def st_mix(e: Ep):
    cues = e.dir / 'audio-cues.json'
    e.sh(['node', 'tools/audio/build-audio.js', str(cues), '--words', str(e.dir / 'words.js'), '--out', str(e.audio)])
    for i in range(4):
        out = e.sh(['node', 'tools/audio/mix.js', str(cues), '--words', str(e.dir / 'words.js'), '--narration', str(e.wav),
                    '--stems', str(e.audio), '--out', str(e.audio)])
        db = float(re.search(r'voice over music: median ([\d.\-]+) dB', out).group(1))
        lufs = re.search(r'mix\.wav: .*?(-?[\d.]+) LUFS', out).group(1)
        d = json.loads(cues.read_text()); vol = d['mix']['buses'][0]['volume']
        e.say(f'mix: {lufs} LUFS, voice {db} dB over music (bus volume {vol})')
        if abs(db - TARGET_DB) <= 0.6:
            return
        d['mix']['buses'][0]['volume'] = round(vol * 10 ** ((db - TARGET_DB) / 20), 3)
        cues.write_text(json.dumps(d, indent=1, ensure_ascii=False))
    e.say('mix: kept the last level (close enough)')


# ---------------------------------------------------------------- render
def dur(p: Path) -> float:
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(p)],
                                capture_output=True, text=True).stdout.strip())


def st_render(e: Ep):
    w = str(e.cfg.get('workers', 2))
    e.sh(['node', 'tools/render.js', 'video', str(e.dir / 'episode.html'), str(e.mp4), '--vertical', '--audio', str(e.audio / 'mix.wav'), '--workers', w])
    e.sh(['tools/append-outro.sh', str(e.mp4)])
    if not e.final.exists() or dur(e.final) < dur(e.mp4):
        raise RuntimeError('outro file missing or short')
    e.mp4.unlink()
    st = e.build / 'strip.jpg'
    e.sh(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(e.final), '-vf', f'fps=1/{max(8, int(dur(e.final) / 8))},scale=240:-1,tile=8x1', '-frames:v', '1', str(st)])
    e.say(f'render: {e.final.name}, {dur(e.final):.1f} s, {e.final.stat().st_size / 1e6:.0f} MB; strip {st}')


# ---------------------------------------------------------------- post
def st_post(e: Ep):
    (POSTPACK / 'videos').mkdir(parents=True, exist_ok=True); (POSTPACK / 'covers').mkdir(parents=True, exist_ok=True)
    prev = POSTPACK / 'videos' / f'{e.slug}.mp4'; cover = POSTPACK / 'covers' / f'{e.slug}.jpg'
    kb = int(min(1200, (13.5e6 * 8 / dur(e.final) - 64e3) / 1e3))   # as sharp as the 15 MB artifact limit allows
    e.sh(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(e.final), '-vf', 'scale=540:960:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow',
          '-tune', 'animation', '-b:v', f'{kb}k', '-maxrate', f'{int(kb * 1.3)}k', '-bufsize', f'{kb * 2}k', '-c:a', 'aac', '-b:a', '64k',
          '-movflags', '+faststart', str(prev)])
    if prev.stat().st_size > 15e6:
        raise RuntimeError('preview over 15 MB')
    e.sh(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(e.dir / 'thumbnail-ig-4x5.png'), '-vf', 'scale=720:900', '-q:v', '4', str(cover)])
    page = POSTPACK / 'index.html'; s = page.read_text()
    if f'id="{e.slug}"' in s:
        e.say('post: card already on the page'); return
    cap = (e.dir / 'caption-ig.txt').read_text().rstrip('\n'); secs = round(dur(e.final))
    card = f'''<article class="post" id="{e.slug}">
  <div class="cover"><img src="covers/{e.slug}.jpg" alt="Instagram cover for {html.escape(e.title)}" loading="lazy" width="720" height="900"></div>
  <div class="body">
    <div class="eyebrow">{html.escape(e.cfg['eyebrow'])}</div>
    <div class="head"><h2>{html.escape(e.title)}</h2><span class="pill ok">Ready to post</span></div>
    <div class="meta"><span>{secs // 60}:{secs % 60:02d} reel</span><span class="num">{len(cap):,} / 2,200</span></div>
    <video class="reel" src="videos/{e.slug}.mp4" controls playsinline preload="metadata" poster="covers/{e.slug}.jpg"></video>
    <pre class="cap" id="cap-{e.slug}">{html.escape(cap)}</pre><div class="actions"><button type="button" class="copy" data-for="cap-{e.slug}">Copy caption</button><label class="posted"><input type="checkbox" id="posted-{e.slug}" data-slug="{e.slug}"> Posted</label></div>
    <p class="file">The player above is a small preview (540×960). Post the full-quality file: <code>{e.final.name}</code> ({e.final.stat().st_size / 1e6:.0f} MB), sent in chat.</p>
  </div>
</article>
'''
    assert s.count('  <footer>') == 1
    s = s.replace('  <footer>', card + '  <footer>')
    s = re.sub(r'<span class="n">(\d+)</span>', lambda m: f'<span class="n">{int(m.group(1)) + 1}</span>', s, count=1)
    page.write_text(s)
    e.say(f'post: card added; preview {prev.stat().st_size / 1e6:.1f} MB')


# ---------------------------------------------------------------- finish
def st_finish(e: Ep):
    for f in e.audio.glob('*'):
        if f.name != 'mix.wav': f.unlink()
    vf = VOICE / 'full' / e.voice
    files = [e.md, e.dir / 'words.js', e.dir / 'words.json', e.dir / 'audio-cues.json', e.dir / 'episode.json', e.dir / 'episode.html',
             vf / f'{e.voice}-natural-timings.json', vf / 'passages.json']
    files = [str(f.relative_to(ROOT)) for f in files if f.exists()]
    sidecar = e.md.with_suffix('.esv.voice.json')
    if sidecar.exists(): files.append(str(sidecar.relative_to(ROOT)))
    subprocess.run(['git', 'add', *files], cwd=ROOT)
    r = subprocess.run(['git', 'commit', '-qm', f'{e.title}: narration, timings and mix (tools/produce.py)' + ATTRIB], cwd=ROOT, capture_output=True, text=True)
    e.say('finish: ' + ('committed' if r.returncode == 0 else 'nothing new to commit'))
    e.say(f'READY {e.final} | cover {e.dir / "thumbnail-ig-4x5.png"} | postpack {POSTPACK / "index.html"}')


FN = dict(trim=st_trim, voice=st_voice, align=st_align, check=st_check, mix=st_mix, render=st_render, post=st_post, finish=st_finish)


def run(slug: str, stages: list[str]):
    e = Ep(slug)
    for s in stages:
        t = time.time(); e.say(f'== {s}')
        FN[s](e)
        e.say(f'== {s} done in {time.time() - t:.0f} s')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=['run', 'queue'])
    ap.add_argument('slugs', nargs='+')
    ap.add_argument('--from', dest='start', choices=STAGES, default='trim')
    ap.add_argument('--to', dest='stop', choices=STAGES, default='finish')
    a = ap.parse_args()
    stages = STAGES[STAGES.index(a.start):STAGES.index(a.stop) + 1]
    if a.cmd == 'run':
        for slug in a.slugs:
            run(slug, stages)
        return
    # queue: the narration of episode i+1 records while episode i aligns, mixes and renders
    pre = [s for s in stages if s in ('trim', 'voice')]; post = [s for s in stages if s not in pre]
    failed = []
    run(a.slugs[0], pre)
    for i, slug in enumerate(a.slugs):
        threads = []
        def back(sl=slug):
            try: run(sl, post)
            except Exception as ex: failed.append((sl, str(ex))); print(f'FAILED {sl}: {ex}', flush=True)
        threads.append(threading.Thread(target=back))
        if i + 1 < len(a.slugs):
            nxt = a.slugs[i + 1]
            def fore(sl=nxt):
                try: run(sl, pre)
                except Exception as ex: failed.append((sl, str(ex))); print(f'FAILED {sl}: {ex}', flush=True)
            threads.append(threading.Thread(target=fore))
        for t in threads: t.start()
        for t in threads: t.join()
    print('QUEUE DONE' + (f' with failures: {failed}' if failed else ''), flush=True)


if __name__ == '__main__':
    main()
