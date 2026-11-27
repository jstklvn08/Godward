// One sheet seen through the portrait camera, held inside its paper so no wall ever shows.
function sheetView(i,t,tc){
  const c=camAt(tc),z=Math.max(c.z,1.0);
  let x=c.x-i*STN,y=c.y;
  const xa=540/z-30,xb=1950-540/z;x=xa<xb?clamp(x,xa,xb):960;
  const ya=-640+BANDY/z,yb=1720-(FH-BANDY)/z;y=ya<yb?clamp(y,ya,yb):540;
  return `<g transform="translate(${FW/2} ${BANDY}) scale(${z.toFixed(4)}) translate(${(-x).toFixed(1)} ${(-y).toFixed(1)})">`+SHEETS[i](t,t)+'</g></g>';
}
function sheetScene(i,t,tc){return i===0?v0(t):i===1?v1(t):sheetView(i,t,tc);}
function frameV(t){
  VQ.length=0;
  const fx=focusFx(t),big=s=>s.replace(/width="1920" height="1080"/g,`width="${FW}" height="${FH}"`);
  const [wg,wd]=vg('#0C1040','#05061A','#0A0C30');
  let g=big(paperDefs(t))+wd+R(0,0,FW,FH,0,wg);
  // Which sheet, and whether we are scrolling down to the next one.
  let i=0;while(i<CUTS.length&&t>=CUTS[i])i++;
  const SL=.38;let scene;
  const kn=CUTS.findIndex(c=>t>=c-SL&&t<c+SL);
  if(kn>=1){
    // Scroll: the old scene slides up and away, the next rises from below.
    const c=CUTS[kn],q=ease.inOut(prog(t,c-SL,c+SL));
    scene=`<g transform="translate(0 ${(-FH*q).toFixed(1)})">${sheetScene(kn,t,c-PAN)}</g><g transform="translate(0 ${(FH*(1-q)).toFixed(1)})">${sheetScene(kn+1,t,c+PAN)}</g>`;
  }else scene=sheetScene(i,t,i>=2?clamp(t,CUTS[i-1]+PAN,(CUTS[i]||DUR+1)-PAN):t);
  g+=`<g transform="translate(540 960) rotate(${fx.rot.toFixed(2)}) scale(${fx.z.toFixed(4)}) translate(${(-540+fx.dx).toFixed(1)} ${(-960+fx.dy).toFixed(1)})">${scene}</g>`;
  if(t>=CUTS[0]&&t<13.4)g+=R(0,0,FW,FH,0,'#FFFBEC',{opacity:(1-ease.out(prog(t,CUTS[0],13.4))).toFixed(3)});
  g+=verseOverlay(t);
  g+=big(vignette(.38))+big(paperOver({tex:.2,grain:.32,blot:.12,texL:.3}));
  g+=subtitles(t);
  const fo=prog(t,259.4,260.3);
  if(fo>0)g+=R(0,0,FW,FH,0,'#000',{opacity:fo});
  return g;
}
