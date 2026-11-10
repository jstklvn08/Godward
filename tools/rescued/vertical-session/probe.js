const RD='C:/Users/User/AppData/Local/Temp/claude/6825648f516659e4/ebafb4fd-e15b-4367-a44d-fbcfca8faff8/scratchpad/render/node_modules/';
const puppeteer=require(RD+'puppeteer-core');const {pathToFileURL}=require('url');
(async()=>{const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new'});const p=await b.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>console.log('LOG',m.text()));
await p.goto(pathToFileURL(process.argv[2]).href+'?render=1&v=1');
console.log(await p.evaluate(()=>{try{return JSON.stringify(BURSTS.slice(8,14).map(c=>[c.s,c.e,c.w.map(w=>w[0]).join(" ")]))}catch(e){return 'X '+e.message}}));await b.close();})();
