// WAV I/O and ffmpeg helpers for the Godward audio tools.
// Stems are written as 16-bit PCM stereo (what the rescued pipeline used); everything is generated in float.
'use strict';
const fs = require('fs');
const { spawnSync } = require('child_process');

const FFMPEG = require('ffmpeg-static');

// Write stereo float arrays to a 16-bit WAV. peak: normalise so the loudest sample hits this value (null = no normalise).
function writeWav(path, L, R, { sr = 48000, peak = 0.9 } = {}) {
  const N = L.length;
  let pk = 0;
  for (let n = 0; n < N; n++) pk = Math.max(pk, Math.abs(L[n]), Math.abs(R[n]));
  const g = peak == null ? 1 : peak / Math.max(pk, 1e-9);
  const b = Buffer.alloc(44 + N * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + N * 4, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(N * 4, 40);
  const q = x => Math.round(Math.max(-1, Math.min(1, x * g)) * 32767);
  for (let n = 0; n < N; n++) { b.writeInt16LE(q(L[n]), 44 + n * 4); b.writeInt16LE(q(R[n]), 46 + n * 4); }
  fs.writeFileSync(path, b);
  return { peak: pk, gain: g };
}

// Decode any audio file to mono float at `sr` through ffmpeg (used for measurement).
function decodeMono(path, sr = 24000) {
  const r = spawnSync(FFMPEG, ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'],
    { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('ffmpeg decode failed for ' + path + ': ' + r.stderr);
  const buf = r.stdout;
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}

// Decode to mono at sr, but keep power of both channels (sqrt of mean square of L and R), so dual-mono and stereo read alike.
function decodePower(path, sr = 24000) {
  const r = spawnSync(FFMPEG, ['-v', 'error', '-i', path, '-ac', '2', '-ar', String(sr), '-f', 'f32le', '-'],
    { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('ffmpeg decode failed for ' + path + ': ' + r.stderr);
  const st = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
  const out = new Float32Array(st.length / 2);
  for (let i = 0; i < out.length; i++) { const a = st[2 * i], b = st[2 * i + 1]; out[i] = Math.sqrt((a * a + b * b) / 2); }
  return out;
}

function durationOf(path) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', path], { encoding: 'utf8' });
  const m = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(r.stderr || '');
  if (!m) throw new Error('could not read duration of ' + path);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}

// EBU R128 integrated loudness, LRA and true peak of a file.
function loudness(path) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 1 << 28 });
  const s = r.stderr || '';
  const tail = s.slice(s.lastIndexOf('Summary:'));
  const g = re => { const m = re.exec(tail); return m ? +m[1] : NaN; };
  return { I: g(/I:\s+(-?[\d.]+) LUFS/), LRA: g(/LRA:\s+(-?[\d.]+) LU/), TP: g(/Peak:\s+(-?[\d.inf]+) dBFS/) };
}

// EBU R128 momentary loudness (400 ms window) every 100 ms: [[t, LUFS], ...]. t is the window's end time.
function momentary(path) {
  const os = require('os'), tmp = require('path').join(os.tmpdir(), `godward-m-${process.pid}-${Date.now()}.txt`);
  // ffmpeg filter args need ':' and '\' escaped inside the file option.
  const esc = tmp.replace(/\\/g, '/').replace(/:/g, '\\:');
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-v', 'error', '-i', path, '-af',
    `ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file='${esc}'`, '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('momentary loudness failed: ' + r.stderr);
  const txt = fs.readFileSync(tmp, 'utf8'); fs.unlinkSync(tmp);
  const out = []; let t = null;
  for (const line of txt.split('\n')) {
    const a = /pts_time:([\d.]+)/.exec(line); if (a) { t = +a[1]; continue; }
    const b = /lavfi\.r128\.M=(-?[\d.]+)/.exec(line); if (b && t != null) out.push([t, +b[1]]);
  }
  return out;
}

function runFfmpeg(args, label = 'ffmpeg') {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(label + ' failed:\n' + (r.stderr || '').split('\n').slice(-25).join('\n'));
  return r.stderr || '';
}

module.exports = { FFMPEG, writeWav, decodeMono, decodePower, durationOf, loudness, momentary, runFfmpeg };
