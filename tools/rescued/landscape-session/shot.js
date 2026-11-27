// node shot.js page.html out.png width height
const RD='C:/Users/User/AppData/Local/Temp/claude/6825648f516659e4/ebafb4fd-e15b-4367-a44d-fbcfca8faff8/scratchpad/render/node_modules/';
const puppeteer=require(RD+'puppeteer-core');const {pathToFileURL}=require('url');
const [html,out,w,h]=process.argv.slice(2);
(async()=>{const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new',args:['--no-sandbox','--force-color-profile=srgb']});
const p=await b.newPage();p.on('pageerror',e=>{console.error('PAGE ERROR',e.message);process.exitCode=1;});
await p.setViewport({width:+w,height:+h,deviceScaleFactor:1});await p.goto(pathToFileURL(html).href);await p.waitForFunction('window.ready');
await p.screenshot({path:out,type:out.endsWith('.png')?'png':'jpeg'});await b.close();console.log('ok',out);})();
