// node verify.js file.mp4 outprefix t1,t2,...   Prints stream info and extracts frames from the finished MP4.
const RD = 'C:/Users/User/AppData/Local/Temp/claude/6825648f516659e4/ebafb4fd-e15b-4367-a44d-fbcfca8faff8/scratchpad/render/node_modules/';
const ff = require(RD + 'ffmpeg-static');
const { spawnSync } = require('child_process');
const [file, prefix, list] = process.argv.slice(2);
const info = spawnSync(ff, ['-i', file], { encoding: 'utf8' }).stderr.split('\n').filter(l => /Duration|Stream/.test(l)).map(l => l.trim());
console.log(file.split(/[\\/]/).pop(), '\n ', info.join('\n  '));
const count = spawnSync(ff, ['-v', 'error', '-i', file, '-map', '0:v:0', '-c', 'copy', '-f', 'null', '-progress', 'pipe:1', '-'], { encoding: 'utf8' }).stdout.match(/frame=\s*(\d+)/g);
console.log('  frames:', count ? count.pop() : '?');
if (list) for (const t of list.split(',')) {
  spawnSync(ff, ['-y', '-ss', t, '-i', file, '-frames:v', '1', '-q:v', '3', `${prefix}-${t}.jpg`]);
}
