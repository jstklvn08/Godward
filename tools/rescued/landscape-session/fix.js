const fs=require('fs');const f=process.argv[2];let s=fs.readFileSync(f,'utf8');
const pairs=[
['"a flaming sword which turned every way." How','"a flaming sword which turned every way". How'],
['doesn\'t just say "let there be." He says "let us make."','doesn\'t just say "Let there be". He says "Let us make man".'],
['"So God created man in his own image." Male','"So God created man in his own image". Male'],
['called "the LORD God," and','called "the LORD God", and'],
['"the breath of life." The first','"the breath of life". The first'],
['"eastward in Eden," and','"eastward in Eden", and'],
['that "not." It\'s','that "not". It\'s'],
['should be alone." Adam','should be alone". Adam'],
['flesh of my flesh." Two','flesh of my flesh". Two'],
['beast of the field." Genesis','beast of the field". Genesis'],
['"thou shalt not eat of it." The serpent says: "Ye shall not surely die." Same','"thou shalt not eat of it". The serpent says: "Ye shall not surely die". Same'],
['were opened." The serpent','were opened". The serpent'],
['garden of Eden." The way back','garden of Eden". The way back'],
['- **Quotations.** Each quotation above is exact KJV text, checked against bible-api.com\'s KJV text on 2026-11-10.','- **Quotations.** Each quotation above is exact KJV text, checked against bible-api.com\'s KJV text on 2026-11-10. Where a quote stops partway through a verse, the full stop sits outside the quotation marks. One spelling differs: bible-api.com prints "Cherubim" in Genesis 3:24, while the standard 1769 KJV and clips 1–6 use "Cherubims", which the script keeps.'],
];
let miss=0;for(const [a,b] of pairs){if(!s.includes(a)){console.log('MISSING:',a);miss++;}else s=s.replace(a,b);}
fs.writeFileSync(f,s);console.log('applied',pairs.length-miss);
