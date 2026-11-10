const fs=require('fs');const f=process.argv[2];let s=fs.readFileSync(f,'utf8');
const P=[
["g+=verse(t,88.7,70,250,['If he ate","g+=verse(t,88.7,70,300,['If he ate"],
["g+=piece(t,106.2,1300,330,label(1300,300,'A DEEP SLEEP · ONE OF HIS RIBS',{size:28,anchor:'middle'}),3,1.2);\n  g+=piece(t,106.5,1300,370,label(1300,350,'GENESIS 2:21\u201322',{size:22,anchor:'middle',bg:'#14141A'}),4,1);",
 "g+=fade(t,111.4,piece(t,106.2,1300,330,label(1300,300,'A DEEP SLEEP · ONE OF HIS RIBS',{size:28,anchor:'middle'}),3,1.2)+piece(t,106.5,1300,370,label(1300,350,'GENESIS 2:21\u201322',{size:22,anchor:'middle',bg:'#14141A'}),4,1));"],
["label(ax+150,620,'ONE FLESH · WITHOUT SHAME'","label(ax+150,540,'ONE FLESH · WITHOUT SHAME'"],
["piece(t,119.9,ax+150,680,label(ax+150,660,","piece(t,119.9,ax+150,600,label(ax+150,580,"],
["piece(t,125.0,1680,760,label(1680,740,","piece(t,125.0,1590,760,label(1590,740,"],
["piece(t,125.3,1680,800,label(1680,780,","piece(t,125.3,1590,800,label(1590,780,"],
["const ex=lerp(900,960,huddle),adx=lerp(620,820,lerp(give*.5,1,huddle));","const ex=lerp(900,960,huddle),adx=lerp(620,820,lerp(give*.3,1,huddle));"],
["const Rv=Math.max(reach*(1-take*.12),give*.7)*(1-eat*.0);","const Rv=Math.max(reach*(1-take*.12),give*.7)*(1-ease.inOut(prog(t,161.2,162.4)));"],
["  if(t<186.8)g+=bigTree(t,700,940,.7,GREYP,.25,{id:84}).split('<circle cx').length?'' :'';\n",
 "  // A dark bush in front of them while they hide.\n  if(hide>0)g+=G('',`<g filter=\"url(#sticker)\"><path d=\"M520 950 C500 860 560 800 620 830 C640 760 740 760 760 830 C820 790 900 840 880 950Z\" fill=\"#1E1C30\"/></g>`+[[600,860],[690,820],[790,870]].map(([x,y],k)=>C(x,y,6,'#3A3850')).join(''),hide);\n"],
["g+=fade(t,197.6,piece(t,187.0,ax,700,","g+=fade(t,189.3,piece(t,187.0,ax,700,"],
["g+=verse(t,253.3,60,880,['On the east side","g+=verse(t,253.3,60,175,['On the east side"],
];
let miss=0;for(const [a,b] of P){if(!s.includes(a)){console.log('MISSING:',a.slice(0,80));miss++;}else s=s.replace(a,b);}
fs.writeFileSync(f,s);console.log('applied',P.length-miss);
