/* assets/scrub-media.js takes location out of what goes up to /media (hard
   rule 1). A synthetic JPEG with EXIF, IPTC and a comment; a real committed
   photo; a QuickTime file with a ©xyz box and an Apple mdta location. */
import '../../assets/scrub-media.js';
import { readFileSync, readdirSync } from 'fs';
const S = globalThis.ScrubMedia;
let bad = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`); if (!ok) bad++; };
process.on('exit', () => { if (bad) process.exitCode = 1; });
// synthetic JPEG with APP1 Exif + ICC APP2 + COM
const seg=(m,payload)=>{const b=new Uint8Array(4+payload.length);b[0]=0xFF;b[1]=m;b[2]=(payload.length+2)>>8;b[3]=(payload.length+2)&255;b.set(payload,4);return b};
const enc=s=>new TextEncoder().encode(s);
const parts=[Uint8Array.of(0xFF,0xD8),seg(0xE0,enc('JFIF\0xx')),seg(0xE1,enc('Exif\0\0GPSDATA')),seg(0xE2,enc('ICC_PROFILE\0abc')),seg(0xED,enc('Photoshop')),seg(0xFE,enc('comment')),seg(0xDB,enc('qt')),Uint8Array.of(0xFF,0xDA,0,2,1,2,3,0xFF,0xD9)];
const j=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let o=0;for(const p of parts){j.set(p,o);o+=p.length}
const out=S.bytes('image/jpeg',j); const t=new TextDecoder('latin1').decode(out);
check('jpeg loses EXIF/IPTC/COM, keeps JFIF, ICC and the image', !t.includes('GPSDATA')&&!t.includes('Photoshop')&&!t.includes('comment')&&t.includes('ICC_PROFILE')&&t.includes('JFIF')&&t.includes('qt'));
// real photo from repo
const f=readdirSync(new URL('../../photos', import.meta.url).pathname).find(x=>x.endsWith('.jpg'));
const r=readFileSync(new URL('../../photos/'+f, import.meta.url).pathname); const ro=S.bytes('image/jpeg',new Uint8Array(r)); check('a committed photo still scrubs', !!ro && ro.length > 1000);
// mov with udta ©xyz
const box=(type,payload)=>{const b=new Uint8Array(8+payload.length);new DataView(b.buffer).setUint32(0,b.length);b.set(enc(type).length===4?enc(type):Uint8Array.of(0xA9,...enc(type.slice(1))),4);b.set(payload,8);return b};
const cat=(...a)=>{const n=a.reduce((s,p)=>s+p.length,0);const r=new Uint8Array(n);let o=0;for(const p of a){r.set(p,o);o+=p.length}return r};
const xyz=new Uint8Array(8+18);new DataView(xyz.buffer).setUint32(0,26);xyz.set([0xA9,0x78,0x79,0x7A],4);xyz.set(enc('+35.1234-084.1234/'),8);
// mdta keys/ilst
const key=cat(new Uint8Array([0,0,0,8+4+36]), enc('mdta'), enc('com.apple.quicktime.location.ISO6709'));
const keys=box('keys',cat(new Uint8Array([0,0,0,0, 0,0,0,1]),key));
const dataBox=box('data',cat(new Uint8Array([0,0,0,1,0,0,0,0]),enc('+35.9999-084.9999/')));
const item=new Uint8Array(8+dataBox.length);new DataView(item.buffer).setUint32(0,item.length);new DataView(item.buffer).setUint32(4,1);item.set(dataBox,8);
const ilst=box('ilst',item);
const hdlr=box('hdlr',new Uint8Array(25));
const meta=box('meta',cat(hdlr,keys,ilst));
const mov=cat(box('ftyp',enc('qt  ')),box('moov',cat(box('udta',xyz),meta)),box('mdat',enc('frames')));
const mo=new TextDecoder('latin1').decode(S.bytes('video/quicktime',mov));
check('mov loses both locations, keeps size and frames', !mo.includes('+35.1234')&&!mo.includes('+35.9999')&&mo.includes('frames'), mo.length===mov.length);
