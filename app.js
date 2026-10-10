/* ---------- Long Game app ---------- */
(function(){
'use strict';
const MAXXP=13034431, LS='longgame.state.v1';
/* Three ways to run. SERVER: the local Python server, with state and snapshots on disk. HOSTED: the public site, where a relay
   answers the hiscores lookups and everything else lives in this browser. Neither: the page opened as a file. */
const CFG=window.LG||{};
const HOSTED=!!CFG.hosted;
const SERVER=!HOSTED&&location.protocol.startsWith('http');
const API=HOSTED?(CFG.api||'').replace(/\/$/,''):'';
const ONLINE=SERVER||HOSTED;
/* Quest and diary syncing is not part of the published code: the OSRS Wiki does not permit third-party use of WikiSync.
   A private local copy can supply window.LGSync (local_sync.js, kept out of the repository). Without it, quests are ticked by hand. */
const SYNC=!HOSTED&&typeof window.LGSync==='function';
const SK=Object.fromEntries(SKILLS.map(s=>[s.k,s]));
const XP=[0,0];for(let l=2;l<=126;l++){let t=0;for(let i=1;i<l;i++)t+=Math.floor(i+300*Math.pow(2,i/7));XP[l]=Math.floor(t/4);}
const lvlFor=xp=>{let l=1;while(l<99&&XP[l+1]<=xp)l++;return l;};
const INT={afk:'AFK',semi:'Semi-AFK',active:'Active',reset:'Reset',wild:'Wildcard'};
const COST={profit:'pays',free:'free',cheap:'cheap',pricey:'pricey'};
const WILD=[
{n:'Boss trip',d:'Twenty minutes at whatever your gear and stats allow. Giant Mole if in doubt.'},
{n:'Clue scroll',d:'Do one from the bank, or go and get one. Any tier.'},
{n:'Slayer task',d:'One task, start to finish.'},
{n:'Lowest skill, fifteen minutes',d:'Whatever sits at the bottom of the list. No method required.'},
{n:'Tempoross',d:'One game. Fishing XP and a Fish barrel to pray for.',req:'s:fishing 35'},
{n:'Wintertodt',d:'One game. Firemaking XP and a crate.',req:'s:firemaking 50'},
{n:'Guardians of the Rift',d:'Two games. Pouches and the Raiments of the Eye.',req:'q:Temple of the Eye;s:runecraft 27'},
{n:'Barbarian Assault',d:'A few waves toward the torso.'},
{n:'Pest Control',d:'Ten minutes of Void points.'},
{n:'Mahogany Homes',d:'Three contracts. Cheap Construction and the Carpenter’s outfit.',req:'s:construction 20'}
];

/* utils */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Math.round(n).toLocaleString('en-GB');
const fmtK=n=>n>=1e6?(n/1e6).toFixed(2).replace(/\.?0+$/,'')+'M':n>=1e3?Math.round(n/1e3)+'k':String(Math.round(n));
const hrs=h=>h<1?Math.round(h*60)+' min':h<10?h.toFixed(1).replace(/\.0$/,'')+' h':fmt(h)+' h';
const clock=ms=>{ms=Math.max(0,ms);const m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');};
const dayKey=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const ago=t=>{const m=(Date.now()-t)/60000;return m<1?'just now':m<60?Math.round(m)+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago';};
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function wpick(items,w){let t=w.reduce((a,b)=>a+b,0);if(t<=0)return items[Math.floor(Math.random()*items.length)];let r=Math.random()*t;for(let i=0;i<items.length;i++){r-=w[i];if(r<=0)return items[i];}return items[items.length-1];}
async function api(path,opts){let r;try{r=await fetch(path,opts);}catch(e){throw new Error('Could not reach the lookup. Check your connection and try again.');}const j=await r.json().catch(()=>({error:'bad response'}));if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j;}

/* state */
let S=null,view='tonight',snaps=[],sel=null,saveTimer=null,toastTimer=null,busy=false;
function blank(){return {v:1,name:'',hs:null,ws:null,wsError:null,manual:{quests:{},diaries:{},allQuests:false,allDiaries:false},prefs:{mood:'balanced',minutes:90,budget:'any',account:null,ticks:false,exclude:{},dailies:true,wildcard:true,sort:'hours'},session:null,resets:{},history:[],rotation:[]};}
async function loadState(){
  if(SERVER){try{const s=await api('/api/state');if(s&&s.v)return s;}catch(e){}}
  try{const raw=localStorage.getItem(LS);if(raw)return JSON.parse(raw);}catch(e){}
  return blank();
}
function save(){
  try{localStorage.setItem(LS,JSON.stringify(S));}catch(e){}
  if(!SERVER)return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(S)}).catch(()=>{});},400);
}

/* On the public site the XP snapshots live in this browser. Same rule as the local server: when nothing is new the trailing
   duplicate slides forward, so a gain stays on the day it was earned. */
const snapKey=n=>'longgame.snaps.'+String(n).toLowerCase().replace(/[^a-z0-9]+/g,'_');
function loadSnaps(n){try{return JSON.parse(localStorage.getItem(snapKey(n)))||[];}catch(e){return [];}}
function storeSnaps(n,a){if(a.length>600)a=a.slice(-600);try{localStorage.setItem(snapKey(n),JSON.stringify(a));}catch(e){}return a;}
function pushSnap(n,skills,total){const a=loadSnaps(n),same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
  if(a.length>1&&same(a[a.length-1].skills,skills)&&same(a[a.length-2].skills,skills))a[a.length-1].t=Date.now();else a.push({t:Date.now(),skills,total});
  return storeSnaps(n,a);}

/* data */
function skillList(){const ks=SKILLS.map(s=>s.k);if(S.hs)for(const k in S.hs.skills)if(!SK[k]){SK[k]={k,n:S.hs.skills[k].n||k,cat:'support'};ks.push(k);}return ks;}
const st=k=>(S.hs&&S.hs.skills[k])||{level:1,xp:0};
const remain=k=>Math.max(0,MAXXP-st(k).xp);
let memo={};
const once=(key,fn)=>key in memo?memo[key]:(memo[key]=fn());
const iron=()=>S.prefs.account==='iron';
const passive=k=>!!(SK[k]&&SK[k].passive); // trained by other skills (Hitpoints): never dealt, no hours of its own
const daily=k=>!!(SK[k]&&SK[k].daily);     // trained by timed runs (Farming): time left is counted in days of runs
function combatLevel(){const l=k=>st(k).level;return Math.floor(.25*(l('defence')+l('hitpoints')+Math.floor(l('prayer')/2))+Math.max(.325*(l('attack')+l('strength')),.325*Math.floor(1.5*l('ranged')),.325*Math.floor(1.5*l('magic'))));}
/* a method row is [level, name, xp/h, intensity, cost, requirements, note, extra].
   extra: who ('main' needs the Grand Exchange, 'iron' is an ironman-only route), run (a timed run), supply, tick (tick-perfect play),
   bands ([level, xp/h] steps), per (xp a run), every (minutes between runs) */
const mx=m=>m[7]||{};
/* rates the wiki leaves out, worked out from the account's own levels.
   crab-melee: the Gemstone Crab has no defence, so a 4-tick weapon lands about 97% of 1,500 swings an hour at half the max hit,
   for 4 XP per damage cut to the crab's 87.5%. Gear is assumed: strength bonus from +40 at 30 Strength to +110 at 90, no prayer or potions. */
/* item and spell figures from the wiki's pages. RSTR: ranged strength. SPELLS: [level, base XP, max hit]; earth spells at their lower max. */
const RSTR={steel:3,mithril:9,adamant:17,ruby:103,rosewood:6};
const SPELLS={fire:[[13,11.5,8],[35,22.5,12],[59,34.5,16],[75,42.5,20],[95,50.5,24]],earth:[[9,9.5,6],[29,19.5,11],[53,31.5,15],[70,40,19],[90,48.2,23]]};
/* 1,200 autocasts an hour (5-tick staff). A cast gives its base XP even on a splash, plus 2 XP per damage.
   weak: the target's elemental weakness, which adds that % to both damage and accuracy. */
function spellRate(l,el,weak,hit,mult,eff){const s=SPELLS[el].filter(x=>x[0]<=l).pop();if(!s)return 0;
  const max=s[2]+Math.floor(s[2]*weak/100),h=Math.min(.99,hit*(1+weak/100));return Math.round(1200*(s[1]+h*max)*mult*eff/500)*500;}
const CALC={
  /* Rapid style on the zero-defence crab (97% of shots land), 4 XP per damage cut to 87.5%. The wiki's progression:
     darts before 46 (2 ticks on rapid), an adamant crossbow with ruby bolts (e) from 46 (5 ticks, plus about 60 damage
     every ~20 shots from the bolt effect), a rosewood blowpipe with adamant darts from 65 (2 ticks). No potions or prayer. */
  'crab-ranged':(k,l)=>{let rstr=RSTR.steel,ticks=2,bonus=0;if(l>=65)rstr=RSTR.rosewood+RSTR.adamant;else if(l>=46){rstr=RSTR.ruby;ticks=5;bonus=3;}else if(l>=20)rstr=RSTR.mithril;
    const max=Math.floor(.5+(l+8)*(rstr+64)/640);return Math.round((max/2*.97+bonus)*3600/(ticks*.6)*4*.875/500)*500;},
  'rock-magic':(k,l)=>spellRate(l,'earth',20,.95,1,.9),
  'frost-magic':(k,l)=>spellRate(l,'fire',100,.95,1,.9),
  'gem-magic':(k,l)=>Math.max(spellRate(l,'fire',0,.95,.875,1),spellRate(l,'earth',0,.95,.875,1)),
  'crab-melee':(k,l)=>{const s=k==='strength'?l:st('strength').level;const bonus=Math.max(40,Math.min(110,Math.round(40+(s-30)*7/6)));
  const max=Math.floor(.5+(s+8+(k==='strength'?3:0))*(bonus+64)/640);return Math.round(1500*max/2*4*.875*.97/500)*500;}};
const xphAt=(m,l,k)=>{const c=mx(m).calc;if(c&&CALC[c])return CALC[c](k,l);const b=mx(m).bands;let x=m[2];if(b)for(const s of b)if(s[0]<=l)x=s[1];return x;};
const perAt=(m,l)=>{const x=mx(m);return x.per?(m[2]>0?x.per*xphAt(m,l)/m[2]:x.per):0;};
function parseReq(r){const o={q:[],s:{},d:[],c:0};if(!r)return o;r.split(';').forEach(p=>{const [t,v]=p.split(':');if(!v)return;if(t==='q')o.q=v.split('|');else if(t==='d')o.d=v.split('|');else if(t==='c')o.c=+v;else if(t==='s')v.split(',').forEach(x=>{const m=x.trim().match(/^(\w+)\s+(\d+)$/);if(m)o.s[m[1]]=+m[2];});});return o;}
function questDone(n){return once('q:'+n,()=>questDoneNow(n));}
function questDoneNow(n){
  if(S.manual.allQuests)return true;if(S.manual.quests[n])return true;
  const q=S.ws&&S.ws.quests;if(!q)return false;const norm=x=>x.replace(/’/g,"'");
  const target=norm(n);for(const k in q){if(norm(k)===target&&q[k]===2)return true;}
  const Q=QUESTS.find(x=>x.n===n);if(Q&&Q.alias)for(const a of Q.alias)for(const k in q)if(norm(k)===norm(a)&&q[k]===2)return true;
  return false;
}
function diaryDone(spec){ // 'Ardougne Medium'
  if(S.manual.allDiaries)return true;if(S.manual.diaries[spec])return true;
  const d=S.ws&&S.ws.achievement_diaries;if(!d)return false;const i=spec.lastIndexOf(' ');const region=spec.slice(0,i),tier=spec.slice(i+1);
  const r=d[region]||d[region.replace(' & ',' and ')];return !!(r&&r[tier]&&r[tier].complete);
}
function reqState(r){const o=parseReq(r);const miss=[];
  o.q.forEach(q=>{if(!questDone(q))miss.push(q);});
  for(const k in o.s)if(st(k).level<o.s[k])miss.push(o.s[k]+' '+(SK[k]?SK[k].n:k));
  o.d.forEach(d=>{if(!diaryDone(d))miss.push(d+' diary');});
  if(o.c&&combatLevel()<o.c)miss.push(o.c+' combat');
  return miss;}
function methods(k){return once('m:'+k,()=>methodsNow(k));}
function methodsNow(k){const L=st(k).level;return (METHODS[k]||[]).map((m,i)=>{const x=mx(m);const miss=reqState(m[5]);if(x.who==='main'&&iron())miss.push('the Grand Exchange');
  return {i,lv:m[0],n:m[1],xph:xphAt(m,L,k),int:m[3],cost:m[4],req:m[5],note:m[6],who:x.who||'both',run:!!x.run,supply:!!x.supply,tick:!!x.tick,start:!!x.start,est:!!x.est,setup:!!x.setup,per:Math.round(perAt(m,L)),every:x.every||0,miss,skill:k,ok:m[0]<=L&&!miss.length};}).filter(m=>m.who!=='iron'||iron());}
const cheapOnly=ms=>{if(iron()||S.prefs.budget!=='cheap')return ms;const c=ms.filter(m=>m.cost!=='pricey');return c.length?c:ms;};
/* what a session block can be: something you can grind now, so never a timed run and never a passive skill */
const noTicks=m=>S.prefs.ticks||!m.tick;
function pickable(k){if(passive(k))return [];let ms=methods(k).filter(m=>m.ok&&m.xph>0&&!m.run&&noTicks(m));if(!ms.length)ms=methods(k).filter(m=>m.ok&&!m.run&&noTicks(m)).slice(-1);return cheapOnly(ms);}
/* the fastest thing the account can do in a skill, runs included for a runs skill: what the Skills and Methods views call best */
function topMethod(k){if(passive(k))return null;const ms=cheapOnly(methods(k).filter(m=>m.ok&&m.xph>0&&noTicks(m)&&(daily(k)||!m.run)));return ms.sort((a,b)=>b.xph-a.xph)[0]||bestMethod(k);}
function bestMethod(k,mood){
  const ms=pickable(k,mood);if(!ms.length)return null;mood=mood||S.prefs.mood;
  const score=m=>(iron()&&m.supply?.6:1)*m.xph*(mood==='afk'?(m.int==='afk'?2.2:m.int==='semi'?1.4:.6):mood==='active'?(m.int==='active'?1.3:m.int==='semi'?1:.7):(m.int==='afk'?1.25:m.int==='semi'?1.1:1));
  return ms.slice().sort((a,b)=>score(b)-score(a))[0];
}
function rateFor(k){const p=pace(k,14);const m=bestMethod(k);if(m&&m.xph>0)return m.xph;if(p.perHour>0)return p.perHour;return 40000;}
function usableAt(k,m,l){const x=mx(m);if(m[0]>l||(x.tick&&!S.prefs.ticks))return false;if(x.who==='iron'?!iron():x.who==='main'&&iron())return false;if(!iron()&&S.prefs.budget==='cheap'&&m[4]==='pricey')return false;
  const o=parseReq(m[5]);for(const q of o.q)if(!questDone(q))return false;for(const s in o.s){if((s===k?l:st(s).level)<o.s[s])return false;}for(const d of o.d)if(!diaryDone(d))return false;return !(o.c&&combatLevel()<o.c);}
const FALLBACK=40000; // stands in where the wiki gives no hourly rate; anything built on it is shown as rough
function rateAt(k,l){let best=0;(METHODS[k]||[]).forEach(m=>{if(mx(m).run&&!daily(k))return;const x=xphAt(m,l,k);if(x>best&&usableAt(k,m,l))best=x;});return best;}
function rough(k){return once('r:'+k,()=>roughNow(k));}
function roughNow(k){const s=st(k);if(s.level>=99||passive(k))return false;for(let l=s.level;l<99;l++)if(!rateAt(k,l))return true;return false;}
/* xp a day from doing each available run once a day (less often if it takes longer than a day to regrow): the pace a runs skill really moves at */
function dayXpAt(k,l){let x=0;(METHODS[k]||[]).forEach(m=>{if(mx(m).run&&mx(m).per&&usableAt(k,m,l))x+=perAt(m,l)*Math.min(1,1440/(mx(m).every||1440));});return x;}
function daysLeft(k){return once('d:'+k,()=>daysLeftNow(k));}
function daysLeftNow(k){const s=st(k);if(s.level>=99||!daily(k))return 0;let d=0;for(let l=s.level;l<99;l++){const x=dayXpAt(k,l);if(!x)return 0;d+=(l===s.level?XP[l+1]-s.xp:XP[l+1]-XP[l])/x;}return d;}
function hoursLeft(k){return once('h:'+k,()=>hoursLeftNow(k));}
function hoursLeftNow(k){const s=st(k);if(s.level>=99||passive(k))return 0;let h=0;for(let l=s.level;l<99;l++){h+=(l===s.level?XP[l+1]-s.xp:XP[l+1]-XP[l])/(rateAt(k,l)||FALLBACK);}return h;}
function nextUnlock(k){const L=st(k).level;const ms=methods(k).filter(m=>!m.ok&&m.xph>0&&noTicks(m)&&!(iron()&&m.who==='main')).sort((a,b)=>a.lv-b.lv);return ms[0]||null;}
function maxStats(){const ks=skillList();let xp=0,levels=0,hours=0,maxed=0;ks.forEach(k=>{const s=st(k);xp+=Math.min(s.xp,MAXXP);levels+=99-Math.min(99,s.level);if(s.level>=99)maxed++;else hours+=hoursLeft(k);});return {pct:xp/(ks.length*MAXXP)*100,xp,levels,hours,maxed,n:ks.length};}
function pace(k,days){ // xp per day from snapshots
  if(!snaps.length)return {perDay:0,perHour:0,days:0};const cutoff=Date.now()-days*86400000;
  const inWin=snaps.filter(s=>s.t>=cutoff);const first=inWin[0]||snaps[snaps.length-1];const last=snaps[snaps.length-1];
  const span=(last.t-first.t)/86400000;if(span<0.2)return {perDay:0,perHour:0,days:span};
  const g=k?(last.skills[k]||0)-(first.skills[k]||0):(last.total||0)-(first.total||0);
  return {perDay:g/span,perHour:0,days:span};
}
function dailyGains(days){const out=[];const byDay={},first={};snaps.forEach(s=>{const k=dayKey(s.t);if(!first[k])first[k]=s;byDay[k]=s;});const keys=Object.keys(byDay).sort();
  for(let i=days-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=dayKey(d.getTime());const idx=keys.indexOf(key);let gain=0;
    if(idx>0){gain=(byDay[key].total||0)-(byDay[keys[idx-1]].total||0);}else if(idx===0){gain=(byDay[key].total||0)-(first[key].total||0);} // first day on record: measure from its first snapshot
    out.push({key,gain:Math.max(0,gain),label:d.toLocaleDateString('en-GB',{weekday:'short'}).slice(0,2)});}
  return out;}
function streak(){const days=new Set();S.history.forEach(h=>{if(Object.values(h.gains||{}).some(v=>v>0))days.add(dayKey(h.t));});dailyGains(60).forEach(d=>{if(d.gain>0)days.add(d.key);});
  let n=0;const d=new Date();if(!days.has(dayKey(d.getTime())))d.setDate(d.getDate()-1);while(days.has(dayKey(d.getTime()))){n++;d.setDate(d.getDate()-1);}return n;}
/* every: minutes, 'utc' (resets at 00:00 UTC), 'weekly', or [[level, minutes], ...] keyed on the reset's skill */
function resetEvery(r){if(!Array.isArray(r.every))return r.every==='daily'?'utc':r.every;const L=st(r.skill).level;let x=r.every[0][1];for(const s of r.every)if(s[0]<=L)x=s[1];return x;}
const resetMine=r=>!(r.who==='main'&&iron())&&!(r.who==='iron'&&!iron());
const span=ms=>ms<3600000?Math.ceil(ms/60000)+' min':ms<172800000?Math.ceil(ms/3600000)+' h':Math.ceil(ms/86400000)+' days';
function resetDue(r){const last=S.resets[r.k]||0;if(!last)return {due:true,text:'never done'};const now=Date.now(),ev=resetEvery(r);
  if(ev==='utc'){const d=new Date(),mid=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());return last<mid?{due:true,text:'due, last '+ago(last)}:{due:false,text:'ready in '+span(mid+86400000-now)};}
  const need=ev==='weekly'?7*86400000:ev*60000;
  return now-last>=need?{due:true,text:'due, last '+ago(last)}:{due:false,text:'ready in '+span(need-(now-last))};}

/* fetching */
function parseHs(j){const skills={};let total={level:0,xp:0};j.skills.forEach(s=>{const k=s.name.toLowerCase().replace(/\s+/g,'');if(s.name==='Overall'){total={level:s.level,xp:Math.max(0,s.xp)};return;}skills[k]={n:s.name,level:Math.max(1,s.level),xp:Math.max(0,s.xp),rank:s.rank};});
  const acts={};(j.activities||[]).forEach(a=>{acts[a.name]=a.score;});return {fetched:Date.now(),skills,total,acts};}
async function refresh(opts){
  if(busy)return;busy=true;render();
  try{
    const j=await api(API+'/api/hiscores?name='+encodeURIComponent(S.name));
    const hs=parseHs(j);const prev=S.hs;S.hs=hs;
    const skills={};for(const k in hs.skills)skills[k]=hs.skills[k].xp;
    if(ONLINE&&!S.prefs.account){try{const a=await api(API+'/api/acctype?name='+encodeURIComponent(S.name));if(a&&a.type)S.prefs.account=a.type==='main'?'main':'iron';}catch(e){}}
    if(SERVER){try{await api('/api/snapshot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:S.name,skills,total:hs.total.xp})});snaps=await api('/api/snapshots?name='+encodeURIComponent(S.name));}catch(e){}}
    else if(HOSTED)snaps=pushSnap(S.name,skills,hs.total.xp);
    if(SYNC&&(!opts||opts.ws!==false))await syncWiki(true);
    save();
    if(prev){const g=Object.keys(hs.skills).map(k=>hs.skills[k].xp-(prev.skills[k]?prev.skills[k].xp:0)).reduce((a,b)=>a+Math.max(0,b),0);toast(g>0?'Stats updated. +'+fmtK(g)+' XP since last time.':'Stats updated. Nothing new since last time.','');}
  }catch(e){toast(e.message||'Could not fetch.','');}
  busy=false;render();
}
async function syncWiki(quiet){
  if(!SYNC)return;
  let data=null,err=null;
  try{data=await window.LGSync(S.name);}catch(e){err=e.message;}
  if(data&&data.quests){S.ws={fetched:Date.now(),quests:data.quests,achievement_diaries:data.achievement_diaries||{},ca:data.combat_achievements||[]};S.wsError=null;if(!quiet)toast('WikiSync loaded. '+Object.values(data.quests).filter(v=>v===2).length+' quests complete.','');}
  else{S.wsError=err||'no data';if(!quiet)toast('No WikiSync data for this name. Install the WikiSync plugin in RuneLite and log in once, or tick quests by hand.','');}
  save();
}

/* session */
function candidates(){return skillList().filter(k=>st(k).level<99&&!S.prefs.exclude[k]&&pickable(k).length);}
/* The mood decides which intensities a block may use, in order of preference.
   AFK tonight: AFK methods only. Full attention: active only. Balanced: alternates, and semi-AFK fills either side when it must. */
function tiersFor(mood,i,flip){if(mood==='afk')return [['afk']];if(mood==='active')return [['active']];return (i+(flip?1:0))%2===0?[['active'],['semi'],['afk']]:[['afk'],['semi'],['active']];}
/* methods of these intensities this account can grind now: rated ones, or the last one unlocked when the wiki rates none */
function fits(k,ints){if(passive(k))return [];const ok=methods(k).filter(m=>m.ok&&!m.run&&!m.start&&noTicks(m)&&ints.includes(m.int));const rated=ok.filter(m=>m.xph>0);return cheapOnly(rated.length?rated:ok.slice(-1));}
/* the method a block of these intensities gets. An AFK block weighs effort as well as XP: a method with per-trip setup
   (Nightmare Zone's dream fee, potions and quest list) counts for three quarters of its rate. skip: activities already in the session. */
const act=n=>n.replace(/ with .*$/,''); // the activity, whatever the style: 'Gemstone Crab with Dorgeshuun crossbow' is still the crab
function pickFor(k,ints,skip){const v=m=>(iron()&&m.supply?.6:1)*(ints.includes('afk')&&m.setup?.75:1)*m.xph;return fits(k,ints).filter(m=>!skip||!skip.has(act(m.n))).sort((a,b)=>v(b)-v(a))[0]||null;}
const pool=(ints,skip)=>skillList().filter(k=>st(k).level<99&&!S.prefs.exclude[k]&&pickFor(k,ints,skip));
/* how much a skill is worth dealing: work left, scaled by how good the allowed method is next to the skill's best */
function weightFor(k,m,minutes,recent){const best=rateAt(k,st(k).level);let x=Math.pow(hoursLeft(k)+1,.8)*(m.xph>0&&best>0?Math.max(.1,Math.min(1,m.xph/best)):.5);
  if(recent.includes(k))x*=.45;const s=st(k);if(m.xph>0&&XP[s.level+1]-s.xp<m.xph*minutes/60)x*=1.3;return x;}
const MOODS={afk:'AFK',active:'active'};
function dealSession(){
  const minutes=S.prefs.minutes,mood=S.prefs.mood;let count=Math.max(1,Math.min(6,Math.round(minutes/40)));
  const blocks=[];let left=minutes;
  if(S.prefs.dailies){const due=RESETS.filter(r=>resetMine(r)&&!reqState(r.req).length&&resetDue(r).due).slice(0,2);due.forEach(r=>{blocks.push({kind:'reset',k:r.k,title:r.n,note:r.note,minutes:5,int:'reset',skill:r.skill});left-=5;});}
  // no wildcard is AFK, so an AFK night has none
  let wild=null;if(S.prefs.wildcard&&minutes>=90&&mood!=='afk'){const ws=WILD.filter(w=>!w.req||!reqState(w.req).length);wild=ws[Math.floor(Math.random()*ws.length)];left-=15;}
  const recent=S.rotation.slice(-3);const used=new Set(),titles=new Set();const skills=[]; // titles: one block per activity, so Nightmare Zone is not dealt for three stats
  const fill=tiers=>{for(let i=skills.length;i<count;i++){let got=null;
    for(const ints of tiers(i)){const cs=pool(ints,titles).filter(k=>!used.has(k));if(!cs.length)continue;
      const ms=cs.map(k=>pickFor(k,ints,titles));const k=wpick(cs,cs.map((k,j)=>weightFor(k,ms[j],left/count,recent)));got={k,m:ms[cs.indexOf(k)],want:ints};break;}
    if(!got)break;used.add(got.k);titles.add(act(got.m.n));skills.push(got);}};
  const flip=Math.random()<.5;fill(i=>tiersFor(mood,i,flip));
  // too few skills for the mood: fewer, longer blocks rather than breaking it. Only when nothing fits at all does it mix.
  if(!skills.length&&MOODS[mood]){toast('Nothing '+MOODS[mood]+' is open to this account yet, so this session mixes in other blocks.','');fill(i=>tiersFor('balanced',i));}
  const per=skills.length?Math.max(20,Math.round(left/skills.length)):0;
  skills.forEach(({k,m,want},n)=>{const mins=n===skills.length-1?Math.max(20,left-per*(skills.length-1)):per; // the last block takes up the rounding
    blocks.push({kind:'skill',k,mi:m.i,title:m.n,note:m.note,minutes:mins,int:m.int,want,xph:m.xph,est:m.est,target:Math.round(m.xph*mins/60),elapsed:0,running:null,done:false});});
  if(wild)blocks.push({kind:'wild',title:wild.n,note:wild.d,minutes:15,int:'wild',elapsed:0,running:null,done:false});
  blocks.forEach(b=>{b.elapsed=0;b.running=null;b.done=false;});
  const snap={};if(S.hs)for(const k in S.hs.skills)snap[k]=S.hs.skills[k].xp;
  S.session={t0:Date.now(),minutes,blocks,startSnap:snap,ended:null,gains:null};
  S.rotation=S.rotation.concat(blocks.filter(b=>b.kind==='skill').map(b=>b.k)).slice(-6);
  save();cue=['deal'];render();
}
function rerollBlock(i){const b=S.session.blocks[i];if(b.kind!=='skill')return;const others=S.session.blocks.filter(x=>x.kind==='skill');const used=new Set(others.map(x=>x.k)),titles=new Set(others.map(x=>act(x.title)));
  // a block dealt before moods were strict has no want: take it from the mood now
  const ints=b.want||(MOODS[S.prefs.mood]?tiersFor(S.prefs.mood,0)[0]:[b.int]);const cs=pool(ints,titles).filter(k=>!used.has(k));
  if(!cs.length){toast('Nothing else '+(ints.length===1?(ints[0]==='active'?'active':INT[ints[0]])+' ':'')+'to swap in.','');return;}
  const ms=cs.map(k=>pickFor(k,ints,titles));const k=wpick(cs,cs.map((k,j)=>weightFor(k,ms[j],b.minutes,[])));const m=ms[cs.indexOf(k)];
  Object.assign(b,{k,mi:m.i,title:m.n,note:m.note,int:m.int,want:ints,xph:m.xph,est:m.est,target:Math.round(m.xph*b.minutes/60),elapsed:0,running:null,done:false});save();cue=['swap',i];render();}
function blockElapsed(b){return b.elapsed+(b.running?Date.now()-b.running:0);}
function toggleBlock(i){const b=S.session.blocks[i];if(b.running){b.elapsed+=Date.now()-b.running;b.running=null;}else{S.session.blocks.forEach((x,j)=>{if(j!==i&&x.running){x.elapsed+=Date.now()-x.running;x.running=null;}});b.running=Date.now();}save();render();}
function doneBlock(i){const b=S.session.blocks[i];if(b.running){b.elapsed+=Date.now()-b.running;b.running=null;}b.done=true;if(b.kind==='reset'){S.resets[b.k]=Date.now();}save();render();}
async function finishSession(){
  const ok=await ask('Finish the session','Log out or hop worlds first so the hiscores catch up, then finish. I will fetch your stats and tally the gains.','Finish');if(!ok)return;
  S.session.blocks.forEach(b=>{if(b.running){b.elapsed+=Date.now()-b.running;b.running=null;}});
  await refresh({ws:false});
  const gains={};let total=0;if(S.hs)for(const k in S.hs.skills){const g=S.hs.skills[k].xp-(S.session.startSnap[k]||0);if(g>0){gains[k]=g;total+=g;}}
  const lv={};for(const k in gains){const before=lvlFor(S.session.startSnap[k]||0),after=st(k).level;if(after>before)lv[k]=after-before;}
  S.session.ended=Date.now();S.session.gains=gains;S.session.total=total;S.session.levels=lv;
  S.history.unshift({t:Date.now(),minutes:S.session.minutes,elapsed:S.session.blocks.reduce((a,b)=>a+b.elapsed,0),gains,total,levels:lv,blocks:S.session.blocks.map(b=>({kind:b.kind,k:b.k,title:b.title,done:b.done}))});
  if(S.history.length>400)S.history.length=400;save();cue=['tally'];render();
}

/* ---------- ui ---------- */
function toast(msg,val){let el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el);}el.innerHTML=(val?'<b>'+esc(val)+'</b>':'')+'<span>'+esc(msg)+'</span>';clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.remove(),3600);}
function ask(title,body,okLabel){return new Promise(res=>{const back=document.activeElement;const bg=document.createElement('div');bg.className='mbg';bg.innerHTML='<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ask-h"><h3 id="ask-h">'+esc(title)+'</h3><p>'+esc(body)+'</p><div class="acts"><button class="btn" data-m="no">Cancel</button><button class="btn pri" data-m="ok">'+esc(okLabel||'Confirm')+'</button></div></div>';document.body.appendChild(bg);const done=v=>{bg.remove();document.removeEventListener('keydown',key);if(back&&back.focus&&document.contains(back))back.focus();res(v);};const key=e=>{if(e.key==='Escape')done(false);};bg.addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(b)done(b.dataset.m==='ok');else if(e.target===bg)done(false);});document.addEventListener('keydown',key);bg.querySelector('[data-m=ok]').focus();});}

const pos=l=>((Math.min(99,Math.max(1,l))-1)/98*100).toFixed(2);
const chipSet=(key,opts,cur,label)=>'<div class="chips" role="group"'+(label?' aria-label="'+label+'"':'')+'>'+opts.map(x=>'<button class="chip'+(cur===x[0]?' on':'')+'" data-act="pref" data-k="'+key+'" data-v="'+x[0]+'" aria-pressed="'+(cur===x[0])+'">'+x[1]+'</button>').join('')+'</div>';
/* how much attention a block takes: hollow, half, filled. Never a colour, because colour belongs to the capes. */
const paceTag=t=>'<span class="pace p-'+t+'"><i></i>'+INT[t]+'</span>';
const long=h=>hrs(h).replace(/ h$/,' hours');

/* ---------- brand: the capes and the mark ---------- */
/* Each skillcape's colour and its trim, sampled from the game's own cape art. A skill wears its cape wherever it appears. */
const A='assets/osrs/';
const CAPE={attack:['#6e1e16','#cdb418'],defence:['#687bb7','#9f9b7e'],strength:['#0b6944','#931e10'],hitpoints:['#a5a4a1','#9e2114'],ranged:['#546a1f','#8b5833'],prayer:['#cdc5c5','#ceb41e'],
magic:['#988c78','#3f4191'],cooking:['#52245e','#78190d'],woodcutting:['#887143','#2e6741'],fletching:['#194c4e','#b17915'],fishing:['#839fb8','#b17915'],firemaking:['#bb6b1a','#d0b719'],
crafting:['#775d46','#cfb519'],smithing:['#565546','#b17915'],mining:['#595847','#649ab0'],herblore:['#0a600d','#c6ae18'],agility:['#34356e','#84322b'],thieving:['#6e445f','#3d3838'],
slayer:['#2a2526','#8e1c10'],farming:['#2d582e','#8fa65e'],runecraft:['#a3a398','#cdb418'],hunter:['#696347','#3a352c'],construction:['#948a77','#a57524'],sailing:['#2c597b','#715240']};
const cape=k=>CAPE[k]||['#2c241d','#b08a45'];
const capeImg=(k,trimmed)=>A+'capes-md/'+(CAPE[k]?k+(trimmed?'_t':''):'max')+'.webp';
/* a skill's icon. '?' is the wildcard's; anything else without a skill gets an empty slot so rows stay aligned */
const icon=(k,cls,title)=>'<span class="ic'+(cls?' '+cls:'')+(k==='?'?' wild':'')+'"'+(title?' title="'+esc(title)+'"':'')+'>'+(CAPE[k]?'<img src="'+A+'icons/'+k+'.png" alt="">':k==='?'?'?':'')+'</span>';
const blockIcon=(b,title)=>icon(blockSkill(b)||(b.kind==='wild'?'?':null),'',title);
/* a cape colour that still shows on the dark ground: the cape's own hue, lightened until it reads. Only a dark cape with
   almost no colour in it (Slayer's black) falls back to its trim. */
const lum=h=>{const n=parseInt(h.slice(1),16);return [n>>16,n>>8&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);};
const ratio=(x,y)=>{const a=lum(x),b=lum(y);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
const mixHex=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
const bright=k=>{const [a,b]=cape(k);const ch=[1,3,5].map(i=>parseInt(a.slice(i,i+2),16));let c=Math.max(...ch)-Math.min(...ch)<24&&lum(a)<.05?b:a;for(let i=0;i<14&&ratio(c,'#191411')<3;i++)c=mixHex(c,'#ffffff',.1);return c;};
/* the skill a block trains: its own, or the one a reset feeds. A wildcard has none. */
const blockSkill=b=>b.kind==='skill'?b.k:b.kind==='wild'?null:((RESETS.find(r=>r.k===b.k)||{}).skill||null);
/* The mark: one ring and a tail, a 9 and a g at once. The ring fills with the account's progress to max,
   so every player's icon is their own. Outside the app it sits at three quarters. */
function markInner(pct){const p=Math.max(0,Math.min(.9999,pct)),a=p*2*Math.PI,x=(32+14*Math.sin(a)).toFixed(2),y=(26-14*Math.cos(a)).toFixed(2),full=pct>=1;
  return '<g fill="none" stroke-width="9.5"><circle cx="32" cy="26" r="14" stroke="#7d7a0a"/><path d="M46 26V37c0 9.5-6 15-15 15h-5" stroke="'+(full?'#16120f':'#7d7a0a')+'"/>'+(p>.004?'<path d="M32 12A14 14 0 '+(p>.5?1:0)+' 1 '+x+' '+y+'" stroke="#16120f"/>':'')+'</g>';}
const brandHTML=pct=>'<span class="tile"><svg viewBox="0 0 64 64" aria-hidden="true">'+markInner(pct)+'</svg></span><span class="wm" aria-hidden="true">lon<span>9</span> <span>9</span>ame</span>';
function setFavicon(pct){const l=$('#fav');if(l)l.href='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#ffff00"/><g transform="translate(6.4 6.4) scale(.8)">'+markInner(pct)+'</g></svg>');}

/* ---------- motion: state changes only ---------- */
/* GSAP animates five moments (the rack filling on load, a deal, a block going live, a swap, the tally) and nothing else.
   Every screen is complete without it: the markup is final before any tween starts, and reduced motion skips them all. */
let cue=null,lastLive=null;
const still=()=>!window.gsap||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function liveIndex(){const s=S&&S.session;if(!s||s.ended)return -1;let i=s.blocks.findIndex(b=>b.running);if(i<0)i=s.blocks.findIndex(b=>!b.done);return i;}
function fillRack(){ // every cape fills from empty to its level
  document.querySelectorAll('.stage .im').forEach((el,i)=>{const to=el.style.getPropertyValue('--p');gsap.fromTo(el,{'--p':'0%'},{'--p':to,duration:.9,delay:.2+i*.025,ease:'power2.out'});});}
function goLive(){ // the block's cape comes forward on the rail and drops into the panel
  if(document.querySelector('.c.now .im'))gsap.from('.c.now .im',{y:0,scale:1,duration:.45,ease:'back.out(2)',clearProps:'transform'});
  if(document.querySelector('.live .sw img'))gsap.from('.live .sw img',{yPercent:-115,duration:.5,ease:'power3.out',clearProps:'transform'});
  gsap.from('.live .say>*,.live .clk>*',{y:8,autoAlpha:0,duration:.3,stagger:.03,delay:.1,ease:'power2.out',clearProps:'all'});
}
function xpDrops(){ // the tally, the way the game shows it: the cape fills to its new level and the XP floats up off it
  const s=S.session;if(!s||!s.gains)return;
  Object.keys(s.gains).forEach((k,n)=>{const c=document.querySelector('.c[data-k="'+k+'"]');if(!c)return;const im=c.querySelector('.im');
    const from=pos(lvlFor(s.startSnap[k]||0))+'%',to=im.style.getPropertyValue('--p');if(from!==to)gsap.fromTo(im,{'--p':from},{'--p':to,duration:1.2,delay:.2+n*.08,ease:'power2.out'});
    const d=document.createElement('span');d.className='xpdrop rs w';d.textContent='+'+fmt(s.gains[k])+' xp';c.appendChild(d);
    gsap.fromTo(d,{y:30,autoAlpha:0},{y:-18,autoAlpha:1,duration:1.1,delay:.2+n*.08,ease:'power1.out',onComplete:()=>gsap.to(d,{autoAlpha:0,duration:.5,delay:1.2,onComplete:()=>d.remove()})});});
  if(document.querySelector('.lvlup'))gsap.from('.lvlup',{y:-16,autoAlpha:0,duration:.4,delay:.6,ease:'back.out(1.6)',clearProps:'all'});
}
/* a change of view: the page crossfades and the yellow line slides to the new tab (the browser's view transition, styled in head.html).
   Where the browser has none, the new view just rises in. Reduced motion gets a plain swap. */
function go(fn){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){fn();return;}
  if(document.startViewTransition){document.startViewTransition(fn);return;}
  fn();if(window.gsap)gsap.from('main',{autoAlpha:0,y:8,duration:.22,ease:'power2.out',clearProps:'all'});
}
function animate(kind,arg){
  if(still())return;
  if(kind==='boot')fillRack();
  else if(kind==='deal'){gsap.from('.q .qc',{y:14,autoAlpha:0,duration:.35,stagger:.06,ease:'power2.out',clearProps:'all'});goLive();}
  else if(kind==='live')goLive();
  else if(kind==='swap'){const el=document.querySelector('.qc[data-row="'+arg+'"]');if(el)gsap.from(el,{rotationX:-80,transformOrigin:'50% 0',duration:.4,ease:'power2.out',clearProps:'transform'});if(arg===liveIndex())goLive();}
  else if(kind==='tally'){document.querySelectorAll('[data-count]').forEach((el,n)=>{const to=+el.dataset.count,o={v:0};gsap.to(o,{v:to,duration:.9,delay:n*.06,ease:'power2.out',onUpdate:()=>{el.textContent='+'+fmtK(o.v);}});});
    gsap.from('.last li',{x:-12,autoAlpha:0,duration:.3,stagger:.06,ease:'power2.out',clearProps:'all'});xpDrops();}
}

function render(){
  const app=$('#app');if(!S)return;memo={};
  document.documentElement.classList.toggle('lg-in',!!(S.name&&S.hs)); // the website hides its product description once an account is loaded
  if(!S.name||!S.hs){app.innerHTML=setupHTML();if(cue&&!still())fillRack();cue=null;return;}
  const views={tonight:tonightHTML,skills:skillsHTML,methods:methodsHTML,quests:questsHTML,resets:resetsHTML,history:historyHTML,settings:settingsHTML};
  const now=liveIndex();const pct=maxStats().pct/100;
  const nowK=view==='skills'?sel:view==='tonight'&&now>=0?blockSkill(S.session.blocks[now]):null;
  app.innerHTML=topHTML(pct)+(view==='tonight'||view==='skills'?rackHTML(nowK):'')+'<main class="wrap">'+(views[view]||tonightHTML)()+'</main>'+footHTML();
  setFavicon(pct);
  if(cue&&cue[0]==='boot'){if(view==='tonight'||view==='skills')animate('boot');}
  else if(view==='tonight'){if(cue)animate(cue[0],cue[1]);else if(lastLive!==null&&now>=0&&now!==lastLive)animate('live');}
  cue=null;lastLive=now;
}
function topHTML(pct){
  const tabs=[['tonight','Tonight'],['skills','Skills'],['methods','Methods'],['quests','Quests'],['resets','Resets'],['history','History'],['settings','Settings']];
  return '<header class="top"><div class="wrap"><a class="brand" href="#" data-act="view" data-v="tonight" aria-label="Long Game">'+brandHTML(pct)+'</a>'
    +'<div class="who"><b>'+esc(S.name)+'</b><span>'+(iron()?'Ironman, ':'')+'stats '+ago(S.hs.fetched)+(SYNC?', '+(S.ws?'quests synced '+ago(S.ws.fetched):'quests by hand'):'')+'</span></div>'
    +'<button class="btn sm" data-act="refresh"'+(busy?' disabled':'')+'>'+(busy?'Fetching…':'Refresh stats')+'</button>'
    +'<nav class="nav" aria-label="Views">'+tabs.map(t=>'<button'+(view===t[0]?' class="on" aria-current="page"':'')+' data-act="view" data-v="'+t[0]+'">'+t[1]+'</button>').join('')+'</nav></div></header>';
}

/* ---------- the rack ---------- */
/* Every skillcape on one rail, lowest level first. Each is drawn twice: once greyed out, once in colour and clipped
   from the bottom to its level, so a cape fills as the skill climbs. The max cape hangs at the end, filled to the account's total. */
const capePair=src=>'<img class="dim" src="'+src+'" alt=""><img class="lit" src="'+src+'" alt="">';
function capeHTML(k,nowK){const s=st(k),maxed=s.level>=99;const tip=SK[k].n+' '+s.level+(maxed?'':', '+fmtK(XP[s.level+1]-s.xp)+' xp to '+(s.level+1));
  return '<button class="c'+(maxed?' max':'')+(k===nowK?' now':'')+'" data-act="cape" data-k="'+k+'" title="'+esc(tip)+'" aria-label="'+esc(tip)+'"><span class="im" style="--p:'+pos(s.level)+'%">'+capePair(capeImg(k,maxed))+'</span><b class="rs">'+s.level+'</b></button>';}
function lvlupHTML(){ // the last session's level-up, said the way the game says it
  const s=S.session;if(!s||!s.ended||!s.levels)return '';const ks=Object.keys(s.levels).filter(k=>SK[k]);if(!ks.length)return '';const k=ks[0],n=SK[k].n;
  return '<div class="lvlup">'+icon(k)+'<span>Congratulations, you just advanced a'+(/^[AEIOU]/.test(n)?'n ':' ')+esc(n)+' level.<br>Your '+esc(n)+' level is now '+st(k).level+'.'+(ks.length>1?' And '+(ks.length-1)+' more.':'')+'</span></div>';
}
function rackHTML(nowK){
  const ks=skillList().slice().sort((a,b)=>st(a).level-st(b).level||st(a).xp-st(b).xp);const m=maxStats();const done=m.maxed===m.n;
  return '<section class="stage" aria-label="Your skillcapes"><div class="wrap"><div class="stage-top"><h1><span class="rs x3">'+m.maxed+'/'+m.n+'</span> capes</h1>'
    +'<p>'+(done?'Maxed. Every cape is on the rail.':fmt(m.levels)+' levels to go, about '+long(m.hours)+' at your best methods'+(skillList().some(rough)?' (rough where the wiki gives no rate)':'')+'.')+'</p>'+lvlupHTML()+'<button class="btn sm share-b" data-act="share">Share my rack</button></div>'
    +'<div class="capes" style="--n:'+ks.length+'">'+ks.map(k=>capeHTML(k,nowK)).join('')+'<i class="sp"></i><i class="sp"></i>'
    +'<button class="goal'+(done?' max':'')+'" data-act="view" data-v="skills" title="'+m.pct.toFixed(2)+'% of the XP to max"><span class="im" style="--p:'+m.pct.toFixed(1)+'%">'+capePair(A+'capes-md/max.webp')+'</span><b class="rs w">Max cape</b></button></div></div></section>';
}
/* ---------- share: the rack as a picture ---------- */
/* Draws the account's rack on a 1200 by 630 canvas (the size link previews use) so a player can post it. Same rules as the page:
   lowest level first, each cape greyed and then coloured up to its level, the max cape at the end. */
const loadImg=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('image'));i.src=src;});
function greyed(img,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const o=c.getContext('2d');o.drawImage(img,0,0,w,h);
  o.globalCompositeOperation='saturation';o.fillStyle='#808080';o.fillRect(0,0,w,h);o.globalCompositeOperation='multiply';o.fillStyle='#5a5a5a';o.fillRect(0,0,w,h);
  o.globalCompositeOperation='destination-in';o.drawImage(img,0,0,w,h);return c;}
async function rackImage(){
  const W=1200,H=630,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const ks=skillList().slice().sort((a,b)=>st(a).level-st(b).level||st(a).xp-st(b).xp);const m=maxStats();
  if(document.fonts&&document.fonts.load)await Promise.all(['16px RS','64px RSB','800 40px Figtree','700 26px Figtree','500 21px Figtree','800 40px Poppins'].map(f=>document.fonts.load(f,'long9ame 0123456789/').catch(()=>{})));
  const imgs=await Promise.all(ks.map(k=>loadImg(capeImg(k,st(k).level>=99))).concat(loadImg(A+'capes-md/max.webp')));
  const hard=(t,px,py,col,d)=>{x.fillStyle='#000';x.fillText(t,px+d,py+d);x.fillStyle=col;x.fillText(t,px,py);}; // the game's hard text shadow
  const hang=(img,px,py,w,h,p)=>{x.drawImage(greyed(img,w,h),px,py);if(p>0)x.drawImage(img,0,img.naturalHeight*(1-p),img.naturalWidth,img.naturalHeight*p,px,py+h*(1-p),w,h*p);};
  // ground
  x.fillStyle='#100d0b';x.fillRect(0,0,W,H);const g=x.createRadialGradient(W/2,-140,0,W/2,-140,920);g.addColorStop(0,'#3a2a1f');g.addColorStop(.5,'#1b1411');g.addColorStop(1,'#100d0b');x.fillStyle=g;x.fillRect(0,0,W,H);
  // the mark and the wordmark
  x.fillStyle='#ffff00';x.beginPath();if(x.roundRect)x.roundRect(48,40,56,56,12);else x.rect(48,40,56,56);x.fill();
  x.save();x.translate(53.6,45.6);x.scale(.7,.7);x.lineWidth=9.5;x.strokeStyle='#7d7a0a';x.beginPath();x.arc(32,26,14,0,Math.PI*2);x.stroke();x.stroke(new Path2D('M46 26V37c0 9.5-6 15-15 15h-5'));
  const pr=Math.max(0,Math.min(1,m.pct/100));if(pr>.004){x.strokeStyle='#16120f';x.beginPath();x.arc(32,26,14,-Math.PI/2,-Math.PI/2+pr*Math.PI*2);x.stroke();}x.restore();
  x.textBaseline='alphabetic';x.textAlign='left';x.font='800 40px Poppins, Figtree, sans-serif';let wx=120;
  for(const ch of 'lon9 9ame'){if(ch===' '){wx+=11;continue;}const nine=ch==='9';x.fillStyle=nine?'#ffff00':'#f0e2c4';x.fillText(ch,wx,82+(nine?8.6:0));wx+=x.measureText(ch).width-1.8;}
  // whose rack it is
  x.textAlign='right';x.font='700 26px Figtree, sans-serif';x.fillStyle='#fff';x.fillText(S.name,W-48,68);
  x.font='500 19px Figtree, sans-serif';x.fillStyle='#b9ab92';x.fillText((iron()?'Ironman, total level ':'Total level ')+fmt(S.hs.total.level),W-48,96);
  // the count
  x.textAlign='left';x.font='64px RSB, RS, sans-serif';const head=m.maxed+'/'+m.n;hard(head,48,206,'#ffff00',3);const hw=x.measureText(head).width;
  x.font='800 38px Figtree, sans-serif';x.fillStyle='#fff';x.fillText('capes',48+hw+16,204);
  x.font='500 21px Figtree, sans-serif';x.fillStyle='#b9ab92';x.fillText(m.maxed===m.n?'Maxed. Every cape is on the rail.':fmt(m.levels)+' levels to go, about '+long(m.hours)+' at the best methods',48,246);
  // the rail
  const ry=296,lg=x.createLinearGradient(0,ry,0,ry+8);lg.addColorStop(0,'#d9b56a');lg.addColorStop(.45,'#b08a45');lg.addColorStop(1,'#6f5425');x.fillStyle='rgba(0,0,0,.6)';x.fillRect(24,ry+2,W-48,8);x.fillStyle=lg;x.fillRect(24,ry,W-48,8);
  // the capes
  const cw=92,ch=Math.round(cw*622/320),x0=44,pitch=(956-cw)/Math.max(1,ks.length-1),top=ry-7;
  ks.forEach((k,i)=>{const px=Math.round(x0+i*pitch),lvl=Math.min(99,st(k).level);hang(imgs[i],px,top,cw,ch,(lvl-1)/98);});
  x.font='16px RS, sans-serif';x.textAlign='center';ks.forEach((k,i)=>hard(String(st(k).level),Math.round(x0+i*pitch)+cw/2,top+ch+32,'#ffff00',1));
  const mw=96,mh=Math.round(mw*620/320),mxp=W-48-mw;hang(imgs[imgs.length-1],mxp,top,mw,mh,pr);hard('Max cape',mxp+mw/2,top+ch+32,'#fff',1);
  // where it came from
  x.textAlign='left';x.font='600 19px Figtree, sans-serif';const site=CFG.url?CFG.url.replace(/^https?:\/\//,'').replace(/\/$/,''):'';
  x.fillStyle='#f0e2c4';x.fillText(site||'Long Game',48,H-42);x.fillStyle='#9a8d78';x.fillText('Free OSRS maxing planner',48+x.measureText(site||'Long Game').width+18,H-42);
  x.textAlign='right';x.font='500 16px Figtree, sans-serif';x.fillText('A fan project. Not affiliated with Jagex.',W-48,H-42);
  return c;
}
async function shareRack(btn){
  if(btn){btn.disabled=true;}
  let blob=null;try{const c=await rackImage();blob=await new Promise(r=>c.toBlob(r,'image/png'));}catch(e){}
  if(btn)btn.disabled=false;
  if(!blob){toast('Could not draw the picture here.','');return;}
  const url=URL.createObjectURL(blob),fname='longgame-'+S.name.replace(/[^\w-]+/g,'_')+'.png',file=new File([blob],fname,{type:'image/png'});
  const canShare=!!(navigator.canShare&&navigator.canShare({files:[file]})),canCopy=!!(navigator.clipboard&&window.ClipboardItem);
  const back=document.activeElement,bg=document.createElement('div');bg.className='mbg';
  bg.innerHTML='<div class="modal share" role="dialog" aria-modal="true" aria-labelledby="sh-h"><h3 id="sh-h">Your rack</h3><img src="'+url+'" width="1200" height="630" alt="'+esc(S.name)+'’s skillcapes on the rail, '+maxStats().maxed+' of '+maxStats().n+' at 99">'
    +'<div class="acts"><button class="btn" data-m="close">Close</button>'+(canCopy?'<button class="btn" data-m="copy">Copy image</button>':'')+(canShare?'<button class="btn" data-m="send">Share</button>':'')+'<button class="btn pri" data-m="save">Download</button></div></div>';
  document.body.appendChild(bg);const close=()=>{bg.remove();document.removeEventListener('keydown',key);setTimeout(()=>URL.revokeObjectURL(url),2000);if(back&&back.focus&&document.contains(back))back.focus();};const key=e=>{if(e.key==='Escape')close();};
  document.addEventListener('keydown',key);bg.querySelector('[data-m=save]').focus();
  bg.addEventListener('click',async e=>{const b=e.target.closest('[data-m]');if(!b){if(e.target===bg)close();return;}
    if(b.dataset.m==='close')close();
    else if(b.dataset.m==='save'){const a=document.createElement('a');a.href=url;a.download=fname;document.body.appendChild(a);a.click();a.remove();}
    else if(b.dataset.m==='copy'){try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);toast('Copied. Paste it wherever you like.','');}catch(err){toast('Could not copy it. Download it instead.','');}}
    else if(b.dataset.m==='send'){try{await navigator.share({files:[file],title:'My Long Game rack'});}catch(err){}}});
}
function setupHTML(){
  // the rack as it will look part-way through: every cape on the rail, each a little fuller than the last
  const ks=SKILLS.map(s=>s.k);const n=ks.length;
  return '<div class="setup"><header class="top"><div class="wrap"><span class="brand" role="img" aria-label="Long Game">'+brandHTML(.75)+'</span></div></header>'
    +'<section class="stage"><div class="wrap"><div class="stage-top"><h1>Every skillcape on one rail.</h1><p>Each one fills with colour as you level. The max cape waits at the end.</p></div>'
    +'<div class="capes" style="--n:'+n+'">'+ks.map((k,i)=>{const l=i===n-1?99:Math.round(30+i*(66/(n-1)));return '<span class="c'+(l>=99?' max':'')+'"><span class="im" style="--p:'+pos(l)+'%">'+capePair(capeImg(k,l>=99))+'</span><b class="rs">'+l+'</b></span>';}).join('')
    +'<i class="sp"></i><i class="sp"></i><span class="goal"><span class="im" style="--p:38%">'+capePair(A+'capes-md/max.webp')+'</span><b class="rs w">Max cape</b></span></div></div></section>'
    +'<main class="wrap"><section class="live deal"><div class="sw fan">'+['fishing','firemaking','woodcutting'].map((k,i)=>'<img src="'+capeImg(k)+'" alt="" style="--i:'+i+'">').join('')+'</div><div class="say"><h1>Start with your name</h1>'
    +'<p class="note">Long Game pulls your stats from the hiscores'+(SYNC?' and your quests and diaries from WikiSync':'')+', then deals you sessions built from what your account can actually do tonight.</p>'
    +'<div class="fields"><div class="field"><label class="lab" for="rsn">RuneScape name</label><div class="inline"><input class="in" id="rsn" placeholder="your RSN" value="'+esc(S.name)+'" autocomplete="off" spellcheck="false" autofocus><button class="btn pri" data-act="setname"'+(busy?' disabled':'')+'>'+(busy?'Fetching…':'Load my account')+'</button></div>'
    +'<span class="help">'+(HOSTED?'Your name is looked up on the official hiscores. Everything else stays in this browser.':SERVER?'Running locally. Nothing leaves this machine except the two lookups.':'Open this through Long Game.bat so it can fetch for you.')+'</span></div></div></div></section></main>'+(HOSTED?'':footHTML())+'</div>';
}

/* ---------- tonight ---------- */
function maxSideHTML(){
  const m=maxStats();const p=pace(null,7);const eta=p.perDay>0?(skillList().reduce((a,k)=>a+remain(k),0))/p.perDay:null;
  const rows=[['XP banked',fmtK(m.xp)+' of '+fmtK(m.n*MAXXP)],['At your 7-day pace',eta?fmt(Math.round(eta))+' days':'no pace yet'],['Day streak',streak()]];
  return '<section><div class="sec"><h3>To max</h3><span class="rs">'+m.pct.toFixed(2)+'%</span></div><dl class="kv">'+rows.map(r=>'<div><dt>'+r[0]+'</dt><dd>'+r[1]+'</dd></div>').join('')+'</dl></section>';
}
function resetsSideHTML(){
  const rs=RESETS.filter(r=>resetMine(r)&&!reqState(r.req).length).map(r=>({r,d:resetDue(r)})).sort((a,b)=>b.d.due-a.d.due);const due=rs.filter(x=>x.d.due).length;
  if(!rs.length)return '<section><div class="sec"><h3>Resets</h3></div><p class="quiet">Nothing unlocked yet. The Resets view lists what each one needs.</p></section>';
  return '<section><div class="sec"><h3>Resets</h3><span class="sub">'+(due?due+' due':'none due')+'</span></div><ul class="rsl">'+rs.slice(0,5).map(x=>'<li>'+icon(x.r.skill)+'<b>'+esc(x.r.n)+'</b>'
    +(x.d.due?'<span class="rs g">Due</span><button class="btn sm ghost" data-act="rd" data-k="'+x.r.k+'">Done</button>':'<span class="in-t">'+esc(x.d.text.replace('ready in','in'))+'</span>')+'</li>').join('')+'</ul>'
    +(rs.length>5?'<p class="quiet"><a href="#" data-act="view" data-v="resets">All '+rs.length+' resets</a></p>':'')+'</section>';
}
function nextCapesHTML(){
  const ks=skillList().filter(k=>st(k).level<99&&!passive(k)).sort((a,b)=>hoursLeft(a)-hoursLeft(b)).slice(0,3);if(!ks.length)return '';
  return '<section><div class="sec"><h3>Next capes</h3><span class="sub">closest first</span></div><ul class="rsl nx">'+ks.map(k=>{const dl=daysLeft(k),h=hoursLeft(k);
    return '<li><span class="mini im" style="--p:'+pos(st(k).level)+'%">'+capePair(capeImg(k))+'</span><b>'+esc(SK[k].n)+' '+st(k).level+'</b><span class="rs">'+(dl?fmt(Math.round(dl)):h<1?Math.round(h*60):fmt(Math.round(h)))+'</span><small>'+(dl?'days of runs':h<1?'min':'hours')+(rough(k)?', rough':'')+'</small></li>';}).join('')+'</ul></section>';
}
const fanHTML=ks=>'<div class="sw fan">'+ks.slice(0,3).map((k,i)=>'<img src="'+capeImg(k)+'" alt="" style="--i:'+i+'">').join('')+'</div>';
function dealPanelHTML(){
  const p=S.prefs;const keys=MOODS[p.mood]?pool([p.mood]):candidates();const top=(keys.length?keys:skillList()).slice().sort((a,b)=>st(b).level-st(a).level);
  return '<section class="live deal">'+fanHTML(top)+'<div class="say"><h2>Tonight</h2><p class="note">Deal a session built from your levels, your quests and what you did last time.</p>'
    +'<div class="fields"><div class="field"><span class="lab">Time</span>'+chipSet('minutes',[30,60,90,120,180,240].map(n=>[n,n>=60?(n/60)+' h':n+' min']),p.minutes,'Time')+'</div>'
    +'<div class="field"><span class="lab">Mood</span>'+chipSet('mood',[['balanced','Balanced'],['afk','AFK tonight'],['active','Full attention']],p.mood,'Mood')+'<span class="help">'+(p.mood==='afk'?'Every block is an AFK method.':p.mood==='active'?'Every block is an active method.':'Alternates AFK and active blocks.')+'</span></div></div>'
    +'<div class="acts"><button class="btn pri" data-act="deal">Deal tonight’s session</button><span class="help">'+(MOODS[p.mood]?keys.length+' skills with an '+MOODS[p.mood]+' method':keys.length+' skills in play')+', '+(p.dailies?'resets included':'resets off')+', '+(!p.wildcard?'no wildcard':p.mood==='afk'?'no wildcard on an AFK night':p.minutes>=90?'one wildcard':'wildcard from 90 min up')+'</span></div></div></section>';
}
function blockFact(b){
  if(b.kind==='reset')return 'Timed run, about '+b.minutes+' minutes.';
  if(b.kind==='wild')return 'Wildcard, '+b.minutes+' minutes. Whatever your account allows.';
  const s=st(b.k);const next=s.level<99?XP[s.level+1]-s.xp:0;const own=iron()&&METHODS[b.k]&&METHODS[b.k][b.mi]&&METHODS[b.k][b.mi][1]===b.title&&mx(METHODS[b.k][b.mi]).supply;
  return esc(SK[b.k].n)+' '+s.level+', '+INT[b.int]+'. '+(b.xph>0?(b.est?'About '+fmtK(b.xph)+' xp an hour, worked out from your '+(b.k==='magic'||b.k==='ranged'?SK[b.k].n:'Strength')+' level.':'≈ '+fmtK(b.xph)+' xp an hour.'):'The wiki gives no hourly rate for this one.')
    +(own?' Uses your own supplies.':'')+(next&&b.xph>0&&next<=b.target?' Level '+(s.level+1)+' this block.':'');
}
function livePanelHTML(b,i){
  const k=blockSkill(b),c=cape(k),el=blockElapsed(b),p=Math.min(1,el/(b.minutes*60000));let bar='';
  if(b.kind==='skill'){const s=st(k);if(s.level<99){const lo=XP[s.level],hi=XP[s.level+1];bar='<div class="bar"><div class="xp" style="--w:'+((s.xp-lo)/(hi-lo)*100).toFixed(1)+'%;--fill:'+bright(k)+'"><i></i></div><span class="rs w">'+fmtK(hi-s.xp)+' xp to level '+(s.level+1)+'</span></div>';}}
  return '<section class="live" data-mk="'+i+'" style="'+(k?'--cape:'+c[0]+';--trim:'+c[1]+';':'')+'--p:'+p.toFixed(3)+'"><div class="sw">'+(k?'<img src="'+capeImg(k)+'" alt="">':'<span class="rs x4 w">?</span>')+'</div>'
    +'<div class="say"><h2>'+(k?icon(k,'l'):'')+esc(b.title)+'</h2><p class="fact">'+blockFact(b)+'</p>'+(b.note?'<p class="note">'+esc(b.note)+'</p>':'')+bar
    +'<div class="acts"><button class="btn pri" data-act="tb" data-i="'+i+'">'+(b.running?'Pause':'Start')+'</button><button class="btn" data-act="db" data-i="'+i+'">Done</button>'
    +(b.kind==='skill'?'<button class="btn ghost" data-act="rb" data-i="'+i+'" title="Swap this block for another skill">Swap</button>':'')+'</div></div>'
    +'<div class="clk"><span class="rs x4" data-bt="'+i+'">'+clock(el)+'</span><small>of '+b.minutes+' min'+(b.running?', running':el?', paused':'')+'</small>'
    +(b.kind==='skill'&&b.xph>0?'<span class="rs w tgt">'+(b.est?'est. ':'')+'+'+fmtK(b.target)+' xp</span><small>this block</small>':'')+'</div><i class="prog"></i></section>';
}
function finishPanelHTML(s){
  return '<section class="live deal">'+fanHTML(s.blocks.map(blockSkill).filter(Boolean))+'<div class="say"><h2>Finish and tally</h2><p class="note">Every block is done. Log out or hop worlds first so the hiscores catch up, then finish and the gains are counted.</p>'
    +'<div class="acts"><button class="btn pri" data-act="finish">Finish session and tally</button><button class="btn ghost" data-act="redeal">Deal again</button></div></div></section>';
}
function lastSessionHTML(s){
  const ks=Object.keys(s.gains||{}).sort((a,b)=>s.gains[b]-s.gains[a]);const up=Object.keys(s.levels||{});
  return '<section class="last"><div class="sec"><h3>'+(s.total>0?'<span class="rs" data-count="'+s.total+'">+'+fmtK(s.total)+'</span> xp last session':'No XP on the hiscores yet')+'</h3><span class="sub">'+clock(s.blocks.reduce((a,b)=>a+b.elapsed,0))+' on the clock'+(up.length?', '+up.map(k=>(SK[k]?SK[k].n:k)+' +'+s.levels[k]).join(', '):'')+'</span></div>'
    +(ks.length?'<ul class="rsl">'+ks.map(k=>'<li>'+icon(k)+'<b>'+esc(SK[k]?SK[k].n:k)+'</b><span class="rs" data-count="'+s.gains[k]+'">+'+fmtK(s.gains[k])+'</span></li>').join('')+'</ul>':'<p class="quiet">Hiscores update when you log out. Refresh in a minute and the gains will land in History.</p>')+'</section>';
}
function queueHTML(s,liveI){
  const el=s.blocks.reduce((a,b)=>a+blockElapsed(b),0);const planned=s.blocks.reduce((a,b)=>a+b.minutes,0);const doneN=s.blocks.filter(b=>b.done).length;const over=planned-s.minutes;
  let h='<div class="sec"><h3>Tonight’s session</h3><span class="sub">'+new Date(s.t0).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+', '+s.minutes+' min, '+doneN+' of '+s.blocks.length+' done</span></div><div class="q">';
  s.blocks.forEach((b,i)=>{
    const k=blockSkill(b),e=blockElapsed(b);const sub=b.kind==='skill'?esc(SK[b.k].n)+', '+INT[b.int]:b.kind==='reset'?'Timed run':'Your pick';
    const tgt=b.kind==='skill'?(b.xph>0?', '+(b.est?'est. ':'')+'+'+fmtK(b.target)+' xp':', no rate'):'';
    h+='<div class="qc'+(b.done?' done':'')+(i===liveI?' now':'')+'" data-row="'+i+'"><b>'+esc(b.title)+'</b>'+blockIcon(b)+'<span class="sub">'+sub+'</span>'
      +'<div class="t">'+(b.done?'<span class="rs g">Done</span>'+(e?'<span class="rs w">'+clock(e)+'</span>':''):'<span class="rs">'+b.minutes+' min'+tgt+'</span>'+(e&&i!==liveI?'<span class="rs w">'+clock(e)+' logged</span>':''))+'</div>'
      +(b.done||i===liveI?'':'<div class="acts"><button class="btn sm" data-act="tb" data-i="'+i+'">'+(e?'Resume':'Start')+'</button><button class="btn sm ghost" data-act="db" data-i="'+i+'">Done</button>'+(b.kind==='skill'?'<button class="btn sm ghost" data-act="rb" data-i="'+i+'" title="Swap this block for another skill">Swap</button>':'')+'</div>')+'</div>';
  });
  return h+'</div><div class="acts under"><button class="btn" data-act="finish">Finish session and tally</button><button class="btn ghost" data-act="redeal">Deal again</button>'
    +'<span class="help">'+planned+' of '+s.minutes+' min planned, <span class="rs w" data-total>'+clock(el)+'</span> logged</span>'+(over>=5?'<span class="over">'+over+' min over what you asked for</span>':'')+'</div>';
}
function tonightHTML(){
  const s=S.session;let main='';
  if(!s||s.ended){
    main=dealPanelHTML()+(s&&s.ended?lastSessionHTML(s):'');
    if(!SYNC&&!S.manual.allQuests&&!Object.keys(S.manual.quests).length)main+='<p class="hint"><b>Tick your quests first.</b> This site cannot read them for you, so it assumes none are done and leaves out every method behind a quest or diary. <a href="#" data-act="view" data-v="quests">Open Quests</a> and tick what you have finished; it takes a minute and the plan and the hours to max get more accurate.</p>';
    if(!S.history.length)main+='<p class="hint"><b>How it works.</b> Every block is one skill, one method, one timer. Start the timer when you start, tick Done when you stop. When you finish the session, log out so the hiscores update, then press Finish and it tallies exactly what you gained.</p>';
  }else{
    const liveI=liveIndex();
    main=(liveI<0?finishPanelHTML(s):livePanelHTML(s.blocks[liveI],liveI))+queueHTML(s,liveI);
  }
  return '<div class="tonight"><div class="main">'+main+'</div><aside class="side">'+resetsSideHTML()+nextCapesHTML()+maxSideHTML()+'</aside></div>';
}

/* ---------- skills and methods ---------- */
function stripHTML(k){
  const s=st(k);const stops=[...new Set((METHODS[k]||[]).map(m=>m[0]).filter(l=>l>1&&l<99))];
  return '<div class="strip" style="--c:'+bright(k)+'" role="img" aria-label="Level '+s.level+' of 99, '+stops.filter(l=>l>s.level).length+' method unlocks ahead"><i class="fill" style="width:'+pos(s.level)+'%"></i>'
    +stops.map(l=>'<i class="st'+(l<=s.level?' on':'')+'" style="left:'+pos(l)+'%"></i>').join('')+'<i class="me" style="left:'+pos(s.level)+'%"></i></div>';
}
function skillsHTML(){
  const ks=skillList();const sort=S.prefs.sort;const arr=ks.slice().sort((a,b)=>sort==='level'?st(a).level-st(b).level:sort==='name'?SK[a].n.localeCompare(SK[b].n):(st(a).level>=99)-(st(b).level>=99)||hoursLeft(b)-hoursLeft(a));
  let h='<div class="sec"><h2>Skills</h2>'+chipSet('sort',[['hours','Most work left'],['level','Lowest level'],['name','A to Z']],sort,'Sort skills by')+'</div>'
    +'<table class="tt skills"><thead><tr><th><span class="vh">Icon</span></th><th>Skill</th><th class="num">Level</th><th>1 to 99, with a stop at each method unlock</th><th class="num c-to">To 99</th><th class="num c-time">Time left</th><th class="c-best">Best now</th></tr></thead><tbody>';
  arr.forEach(k=>{const s=st(k);const maxed=s.level>=99;const g=pace(k,7).perDay;const m=topMethod(k);const dl=daysLeft(k);
    h+='<tr class="'+(sel===k?'on':'')+(maxed?' maxed':'')+'" data-act="sel" data-k="'+k+'"><td class="c-lv">'+icon(k)+'</td><td class="blk"><button class="rowbtn" aria-expanded="'+(sel===k)+'">'+esc(SK[k].n)+'</button>'+(g>0?'<span class="gain">+'+fmtK(g)+' a day</span>':'')+'</td>'
      +'<td class="num"><span class="rs">'+s.level+'</span></td><td class="c-line">'+stripHTML(k)+'</td>'
      +'<td class="num c-to">'+(maxed?fmtK(s.xp)+' xp':fmtK(remain(k)))+'</td><td class="num c-time">'+(maxed?'maxed':passive(k)?'with combat':dl?Math.round(dl)+' days of runs':hrs(hoursLeft(k))+(rough(k)?', rough':iron()&&m&&m.supply?', if supplied':''))+'</td><td class="c-best">'+(maxed?'':passive(k)?'Trained by combat':m?esc(m.n):'')+'</td></tr>';});
  h+='</tbody></table>';
  if(sel&&SK[sel])h+=detailHTML(sel);
  return h;
}
function detailHTML(k){
  const s=st(k);const ms=methods(k);const now=topMethod(k);const nx=nextUnlock(k);const dl=daysLeft(k);const p7=pace(k,7);const qs=QUESTS.filter(q=>q.xp[k]&&!questDone(q.n)).sort((a,b)=>b.xp[k]-a.xp[k]);const c=cape(k);
  let h='<section class="detail"><div class="d-head"><div class="crest" style="--cape:'+c[0]+';--trim:'+c[1]+'"><img src="'+capeImg(k,s.level>=99)+'" alt=""><span class="rs x4">'+s.level+'</span></div><h3>'+icon(k,'l')+esc(SK[k].n)+'</h3>'
    +'<p>'+fmt(s.xp)+' xp. '+(s.level>=99?'Maxed.':fmt(remain(k))+' to 99, '+fmtK(XP[s.level+1]-s.xp)+' to '+(s.level+1)+'.')+'</p>'
    +(s.level<99?'<p>'+(passive(k)?'Trains itself through combat. It needs no plan of its own.':now?'Best now: <b>'+esc(now.n)+'</b> at '+(now.est?'an estimated ':'≈')+fmtK(now.xph)+'/h'+(now.run?' of time spent on the runs':'')+', about '+(dl?Math.round(dl)+' days at one of each run a day':hrs(hoursLeft(k)))+' to 99.'+(rough(k)?' The wiki gives no hourly rate for part of that, so it is a rough figure.':'')+(iron()&&now.supply?' That rate only holds while your own supplies last.':''):'No method available yet. Check the requirements in the table.')+(p7.perDay>0?' Your 7-day pace is '+fmtK(p7.perDay)+' a day.':'')+'</p>':'')
    +(nx&&s.level<99?'<p>Next unlock: <b>'+esc(nx.n)+'</b>'+(nx.lv>s.level?' at level '+nx.lv:'')+(nx.miss.length?', needs '+esc(nx.miss.join(', ')):'')+'.</p>':'')
    +(qs.length&&s.level<99?'<p>Quests still owing XP here: '+qs.slice(0,5).map(q=>'<b>'+esc(q.n)+'</b> '+fmtK(q.xp[k])).join(', ')+'.</p>':'')+'</div>'
    +(ms.length?'<div class="twrap"><table class="tt methods rows-top"><thead><tr><th class="num">Level</th><th>Method</th><th class="num">Rate</th><th>Pace</th><th>'+(iron()?'Supplies':'Cost')+'</th></tr></thead><tbody>'
    +ms.map(m=>'<tr class="'+(m.ok?'':'locked')+(now&&m.i===now.i?' best':'')+'"><td class="num lvl">'+m.lv+'</td><td class="blk"><b>'+esc(m.n)+'</b>'+(now&&m.i===now.i?'<span class="mark">Best now</span>':'')+(m.run?'<span class="mark">Run</span>':'')+(m.tick?'<span class="mark">Tick-perfect</span>':'')+'<span>'+esc(m.note)+(m.miss.length?' <em class="needs">Needs '+esc(m.miss.join(', '))+'.</em>':'')+'</span></td>'
      +'<td class="num">'+(m.run&&m.per?'≈ '+fmtK(m.per)+' a run':m.xph?(m.est?'est. ':'≈ ')+fmtK(m.xph)+'/h':'no rate')+'</td><td>'+paceTag(m.int)+'</td><td class="nowrap">'+(iron()?(m.supply?'your own':'none'):COST[m.cost])+'</td></tr>').join('')+'</tbody></table></div>':'')+'</section>';
  return h;
}
function methodsHTML(){
  const ks=skillList().filter(k=>METHODS[k]);const k=(sel&&METHODS[sel])?sel:ks[0];
  return '<div class="sec"><h2>Methods</h2><span class="sub">Every method, with what your account is missing.'+(HOSTED?' <button class="btn sm ghost" data-act="suggest" data-k="'+k+'">Missing one? Suggest it</button>':'')+'</span></div><div class="chips pick">'+ks.map(x=>'<button class="chip'+(x===k?' on':'')+'" data-act="sel" data-k="'+x+'" aria-pressed="'+(x===k)+'">'+icon(x)+esc(SK[x].n)+'</button>').join('')+'</div>'+detailHTML(k);
}

/* ---------- quests, resets, history, settings ---------- */
function questsHTML(){
  const done=q=>questDone(q.n);const undone=QUESTS.filter(q=>!done(q)).map(q=>Object.assign({},q,{tot:Object.values(q.xp).reduce((a,b)=>a+b,0)+(q.lampXp||0)})).sort((a,b)=>b.tot-a.tot);
  const short=q=>Object.keys(q.need||{}).filter(k=>st(k).level<q.need[k]).map(k=>q.need[k]+' '+SK[k].n);
  const gating=new Set();for(const k in METHODS)METHODS[k].forEach(m=>parseReq(m[5]).q.forEach(q=>gating.add(q)));RESETS.forEach(r=>parseReq(r.req).q.forEach(q=>gating.add(q)));WILD.forEach(w=>w.req&&parseReq(w.req).q.forEach(q=>gating.add(q)));
  const regions=['Ardougne','Desert','Falador','Fremennik','Kandarin','Karamja','Kourend & Kebos','Lumbridge & Draynor','Morytania','Varrock','Western Provinces','Wilderness'];const tiers=['Easy','Medium','Hard','Elite'];
  let h=!SYNC?'<div class="status"><p><b>Quests and diaries are ticked by hand.</b> The hiscores list your levels but not your quests, and there is no public source for those. Tick what you have done below, or use the two shortcuts. Until you do, methods behind a quest or diary count as locked, so your hours to max read high.</p></div>':'<div class="status'+(S.ws?'':' warn')+'"><p>'+(S.ws?'<b>WikiSync.</b> '+Object.values(S.ws.quests).filter(v=>v===2).length+' quests complete, synced '+ago(S.ws.fetched)+'.':'<b>No WikiSync data yet.</b> Install the WikiSync plugin in RuneLite, log in once, then sync. Or tick things by hand below.')+'</p><button class="btn sm" data-act="wiki">Sync WikiSync</button></div>';
  h+='<div class="chips"><button class="chip'+(S.manual.allQuests?' on':'')+'" data-act="toggle" data-p="allQuests" aria-pressed="'+!!S.manual.allQuests+'">Quest cape: every quest done</button><button class="chip'+(S.manual.allDiaries?' on':'')+'" data-act="toggle" data-p="allDiaries" aria-pressed="'+!!S.manual.allDiaries+'">Every diary done</button></div>';
  h+='<div class="two"><div><div class="sec"><h2>Worth doing for XP</h2><span class="sub">'+undone.length+' left, biggest first</span></div>'
    +(undone.length?'<table class="tt rows-top"><thead><tr><th>Quest</th><th class="num">XP</th><th class="act"><span class="vh">Mark done</span></th></tr></thead><tbody>'+undone.map(q=>'<tr><td class="blk"><b>'+esc(q.n)+'</b><span class="worn">'+Object.keys(q.xp).map(k=>icon(k,'',SK[k].n)).join('')+'</span><span>'+Object.keys(q.xp).map(k=>SK[k].n+' '+fmtK(q.xp[k])).join(', ')+(q.lamps?(Object.keys(q.xp).length?'. ':'')+esc(q.lamps):'')+(q.mini?'<em class="aside">Miniquest.</em>':'')+(short(q).length?'<em class="needs own">Short of '+esc(short(q).join(', '))+'.</em>':'')+'</span></td><td class="num">'+(q.tot?'<span class="rs">'+fmtK(q.tot)+'</span>':'')+'</td><td class="act"><button class="btn sm" data-act="tq" data-q="'+esc(q.n)+'">Mark done</button></td></tr>').join('')+'</tbody></table>':'<p class="quiet">Every XP quest on the list is done.</p>')+'</div>';
  h+='<div><div class="sec"><h2>Unlocks</h2><span class="sub">Quests that gate a method or a reset</span></div><table class="tt"><tbody>'+[...gating].sort().map(q=>{const d=questDone(q);return '<tr class="'+(d?'':'locked')+'"><td class="blk"><b>'+esc(q)+'</b></td><td class="act"><button class="chip'+(d?' on':'')+'" data-act="tq" data-q="'+esc(q)+'" aria-pressed="'+d+'">'+(d?'Done':'Not done')+'</button></td></tr>';}).join('')+'</tbody></table>';
  h+='<div class="sec"><h2>Diaries</h2><span class="sub">Tick a box to mark a tier done</span></div><table class="tt matrix"><thead><tr><th>Region</th>'+tiers.map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody>'
    +regions.map(r=>'<tr><td class="blk"><b>'+esc(r)+'</b></td>'+tiers.map(t=>{const on=diaryDone(r+' '+t);return '<td><button class="box'+(on?' on':'')+'" data-act="td" data-d="'+esc(r+' '+t)+'" aria-pressed="'+on+'" aria-label="'+esc(r+' '+t)+(on?', done':', not done')+'"></button></td>';}).join('')+'</tr>').join('')+'</tbody></table></div></div>';
  return h;
}
function resetsHTML(){
  let h='<div class="sec"><h2>Resets</h2><span class="sub">Passive XP on a timer. Tick them as you do them and the session builder slots them in when they are due.</span></div><table class="tt rows-top"><thead><tr><th><span class="vh">Icon</span></th><th>Reset</th><th>Every</th><th>Status</th><th class="act"><span class="vh">Mark done</span></th></tr></thead><tbody>';
  const everyText=r=>{const e=resetEvery(r);return e==='utc'?'Daily, 00:00 UTC':e==='weekly'?'Every 7 days':e<120?e+' min':e<2880?+(e/60).toFixed(1)+' h':+(e/1440).toFixed(1)+' days';};
  RESETS.filter(resetMine).forEach(r=>{const miss=reqState(r.req);const d=resetDue(r);
    h+='<tr class="'+(miss.length?'locked':'')+'"><td class="c-lv">'+icon(r.skill)+'</td><td class="blk"><b>'+esc(r.n)+'</b><span>'+esc(r.note)+(miss.length?' <em class="needs">Needs '+esc(miss.join(', '))+'.</em>':'')+'</span></td>'
      +'<td class="nowrap">'+everyText(r)+'</td><td class="nowrap">'+(miss.length?'<span class="mark">Locked</span>':d.due?'<span class="rs g">Due</span> '+esc(d.text.replace(/^due,? ?/,'')):esc(d.text))+'</td>'
      +'<td class="act">'+(miss.length?'':'<button class="btn sm" data-act="rd" data-k="'+r.k+'">Done now</button>')+'</td></tr>';});
  return h+'</tbody></table>';
}
function historyHTML(){
  const days=dailyGains(14);const top=Math.max(1,...days.map(d=>d.gain));const week=days.slice(-7).reduce((a,d)=>a+d.gain,0);
  const pl=(n,w)=>n+' '+w+(n===1?'':'s');
  let h='<div class="sec"><h2>Last 14 days</h2><span class="sub">XP per day from your snapshots. Refresh stats after playing and the bars fill in.</span></div>'
    +'<p class="lede"><span class="rs">+'+fmtK(week)+'</span> xp this week. '+pl(streak(),'day')+' in a row. '+pl(S.history.length,'session')+' finished, '+pl(snaps.length,'snapshot')+' taken.</p>'
    +'<div class="chart" role="img" aria-label="XP gained per day over the last 14 days"><div class="bars">'+days.map((d,i)=>'<div class="b'+(i===days.length-1?' today':'')+'" title="'+d.key+' +'+fmtK(d.gain)+'">'+(d.gain>0?'<em class="rs">+'+fmtK(d.gain)+'</em>':'')+'<i style="height:'+(d.gain/top*100).toFixed(1)+'%"></i></div>').join('')+'</div>'
    +'<div class="days">'+days.map((d,i)=>'<span'+(i===days.length-1?' class="today"':'')+'>'+d.label+'</span>').join('')+'</div></div>';
  h+='<div class="sec"><h2>Sessions</h2></div>';
  if(!S.history.length)return h+'<p class="quiet">No sessions yet. Deal one in Tonight.</p>';
  h+='<div class="twrap"><table class="tt"><thead><tr><th>When</th><th>Blocks</th><th class="num">Logged</th><th class="num">Gained</th><th>Levels</th></tr></thead><tbody>'+S.history.map(x=>'<tr><td class="nowrap">'+new Date(x.t).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})+'</td><td><span class="worn">'+x.blocks.map(b=>blockIcon(b,b.kind==='skill'&&SK[b.k]?SK[b.k].n+': '+b.title:b.title)).join('')+'</span></td><td class="num">'+clock(x.elapsed)+'</td><td class="num">'+(x.total?'<span class="rs">+'+fmtK(x.total)+'</span>':'none yet')+'</td><td>'+Object.keys(x.levels||{}).map(k=>(SK[k]?SK[k].n:k)+' +'+x.levels[k]).join(', ')+'</td></tr>').join('')+'</tbody></table></div>';
  return h;
}
function settingsHTML(){
  const p=S.prefs;
  let h='<div class="sec"><h2>Settings</h2></div><div class="form"><div class="field"><label class="lab" for="rsn">Account</label><div class="inline"><input class="in" id="rsn" value="'+esc(S.name)+'" autocomplete="off" spellcheck="false"><button class="btn" data-act="setname">Change name</button></div></div>';
  h+='<div class="field"><span class="lab">Account type</span>'+chipSet('account',[['main','Main'],['iron','Ironman']],p.account||'main','Account type')+'<span class="help">Ironman drops every method that needs the Grand Exchange and uses the wiki’s ironman routes instead. It is read from the hiscores when the name loads. Change it here if that is wrong.</span></div>';
  if(!iron())h+='<div class="field"><span class="lab">Budget</span>'+chipSet('budget',[['any','Spend what it takes'],['cheap','Cheap methods only']],p.budget,'Budget')+'<span class="help">Cheap hides the routes marked pricey.</span></div>';
  h+='<div class="field"><span class="lab">Sessions</span><div class="chips"><button class="chip'+(p.dailies?' on':'')+'" data-act="prefbool" data-k="dailies" aria-pressed="'+!!p.dailies+'">Slot in due resets</button><button class="chip'+(p.wildcard?' on':'')+'" data-act="prefbool" data-k="wildcard" aria-pressed="'+!!p.wildcard+'">One wildcard per session</button><button class="chip'+(p.ticks?' on':'')+'" data-act="prefbool" data-k="ticks" aria-pressed="'+!!p.ticks+'">Tick-perfect methods</button></div><span class="help">The wildcard only appears in sessions of 90 minutes or more. Tick-perfect methods (3-tick fishing, 1-tick karambwans and the like) are left out of plans and estimates unless you turn them on.</span></div>';
  h+='<div class="field"><span class="lab">Skills to leave out</span><div class="chips">'+skillList().filter(k=>!passive(k)).map(k=>'<button class="chip'+(p.exclude[k]?' on':'')+'" data-act="excl" data-k="'+k+'" aria-pressed="'+!!p.exclude[k]+'">'+icon(k)+esc(SK[k].n)+'</button>').join('')+'</div><span class="help">Click to drop a skill from the session builder. It still shows on the Skills view.</span></div>';
  h+='<div class="field"><span class="lab">Data</span><span class="help">'+(SERVER?'Everything is saved to the data folder next to longgame.py. Copy that folder to back it up, or export a file you can load on the website.':'Saved in this browser only. Clearing your site data removes it, so export a copy if it matters to you.')+'</span><div class="inline"><button class="btn" data-act="export">Export my data</button>'+(SERVER?'':'<button class="btn" data-act="import">Import a file</button>')+'<button class="btn danger" data-act="forget">Forget this account</button></div></div></div>';
  return h;
}

/* load a file made by Export: the account, its sessions and its XP history */
function importFile(){const inp=document.createElement('input');inp.type='file';inp.accept='application/json,.json';
  inp.onchange=async()=>{const f=inp.files[0];if(!f)return;let d=null;try{d=JSON.parse(await f.text());}catch(e){}
    if(!d||!d.state||d.state.v!==1||!d.state.prefs||typeof d.state.name!=='string'){toast('That file is not a Long Game export.','');return;}
    if(!await ask('Import this file','This replaces what is saved here with '+d.state.name+' from the file.','Import'))return;
    S=Object.assign(blank(),d.state);snaps=Array.isArray(d.snaps)?d.snaps:[];if(!SERVER)snaps=storeSnaps(S.name,snaps);save();view='tonight';cue=['boot'];render();toast('Imported '+S.name+'.','');};
  inp.click();}
/* a player's suggestion for a missing method. It goes to the relay, which files it for review; nothing is added to the data unchecked. */
function suggestForm(k){
  const back=document.activeElement;const bg=document.createElement('div');bg.className='mbg';const opt=(v,t,cur)=>'<option value="'+v+'"'+(v===cur?' selected':'')+'>'+t+'</option>';
  bg.innerHTML='<form class="modal wide" role="dialog" aria-modal="true" aria-labelledby="sg-h"><h3 id="sg-h">Suggest a method</h3><p>Know a good method that is missing? Send it and it will be checked against the wiki before it is added.</p>'
    +'<div class="grid2"><label class="field"><span class="lab">Skill</span><select class="in" name="skill">'+skillList().filter(x=>!passive(x)).map(x=>opt(x,esc(SK[x].n),k)).join('')+'</select></label>'
    +'<label class="field"><span class="lab">Level needed</span><input class="in" name="level" type="number" min="1" max="99" required></label></div>'
    +'<label class="field"><span class="lab">Method</span><input class="in" name="name" maxlength="80" required placeholder="What you do, in a few words"></label>'
    +'<div class="grid2"><label class="field"><span class="lab">XP an hour, if you know it</span><input class="in" name="xph" type="number" min="0" max="2000000" step="500"></label>'
    +'<label class="field"><span class="lab">Attention</span><select class="in" name="intensity">'+opt('afk','AFK')+opt('semi','Semi-AFK')+opt('active','Active')+'</select></label></div>'
    +'<label class="field"><span class="lab">Works for</span><select class="in" name="who">'+opt('both','Mains and ironmen')+opt('main','Mains only')+opt('iron','Ironmen only')+'</select></label>'
    +'<label class="field"><span class="lab">Wiki page that backs it up</span><input class="in" name="wiki" type="url" required pattern="https://oldschool\\.runescape\\.wiki/.+" placeholder="https://oldschool.runescape.wiki/w/..."><span class="help">A link to the method or training guide on the Old School RuneScape Wiki.</span></label>'
    +'<label class="field"><span class="lab">Anything else</span><textarea class="in" name="notes" maxlength="600" rows="3" placeholder="Quests, gear, where it is, why it is good"></textarea></label>'
    +'<input class="vh" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">'
    +'<div class="acts"><button class="btn" type="button" data-m="no">Cancel</button><button class="btn pri" type="submit">Send suggestion</button></div></form>';
  document.body.appendChild(bg);const form=bg.querySelector('form');const close=()=>{bg.remove();document.removeEventListener('keydown',key);if(back&&back.focus)back.focus();};const key=e=>{if(e.key==='Escape')close();};
  document.addEventListener('keydown',key);bg.addEventListener('click',e=>{if(e.target===bg||e.target.closest('[data-m=no]'))close();});form.elements.name.focus();
  form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('[type=submit]');b.disabled=true;b.textContent='Sending…';
    try{await api(API+'/api/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});close();toast('Sent. Thank you, it will be checked against the wiki.','');}
    catch(err){b.disabled=false;b.textContent='Send suggestion';toast(err.message||'Could not send it.','');}});
}
/* the credit Jagex's Fan Content Policy asks for, and the wiki's licence */
const footHTML=()=>'<footer class="foot wrap"><p>Long Game is a free fan project. Created using intellectual property belonging to Jagex Limited under the terms of Jagex’s Fan Content Policy. This content is not endorsed by or affiliated with Jagex.</p>'
  +'<p>Training methods and rates are adapted from the <a href="https://oldschool.runescape.wiki/" rel="noopener">Old School RuneScape Wiki</a>, used under <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" rel="noopener">CC BY-NC-SA 3.0</a>.'+(CFG.repo?' The code and the data are on <a href="https://github.com/'+esc(CFG.repo)+'" rel="noopener">GitHub</a>.':'')+'</p></footer>';

/* ---------- events ---------- */
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-act]');if(!el||!S)return;const a=el.dataset.act;
  switch(a){
    case 'view':e.preventDefault();if(el.dataset.v===view){window.scrollTo({top:0});break;}go(()=>{view=el.dataset.v;history.replaceState(null,'','#'+view);render();window.scrollTo({top:0});});break;
    case 'setname':{const n=($('#rsn')?.value||'').trim();if(!n){toast('Type your name first.','');return;}if(n!==S.name){S.name=n;S.hs=null;S.ws=null;S.session=null;S.history=[];S.rotation=[];S.prefs.account=null;snaps=[];}save();await refresh();if(S.hs){view='tonight';render();}break;}
    case 'refresh':await refresh();break;
    case 'wiki':await syncWiki(false);render();break;
    case 'pref':S.prefs[el.dataset.k]=isNaN(+el.dataset.v)?el.dataset.v:+el.dataset.v;save();render();break;
    case 'prefbool':S.prefs[el.dataset.k]=!S.prefs[el.dataset.k];save();render();break;
    case 'excl':S.prefs.exclude[el.dataset.k]=!S.prefs.exclude[el.dataset.k];save();render();break;
    case 'sel':sel=sel===el.dataset.k&&view==='skills'?null:el.dataset.k;render();if(view==='skills'){const d=$('.detail');if(d)d.scrollIntoView({behavior:'smooth',block:'nearest'});}break;
    case 'cape':{const k=el.dataset.k,same=view==='skills';const f=()=>{view='skills';sel=k;history.replaceState(null,'','#skills/'+k);render();const d=$('.detail');if(d)d.scrollIntoView({behavior:same?'smooth':'auto',block:'nearest'});};same?f():go(f);break;}
    case 'share':shareRack(el);break;
    case 'deal':dealSession();break;
    case 'redeal':ask('Deal again','Throw away tonight’s blocks and deal a fresh set?','Deal again').then(ok=>{if(ok)dealSession();});break;
    case 'tb':toggleBlock(+el.dataset.i);break;
    case 'db':doneBlock(+el.dataset.i);break;
    case 'rb':rerollBlock(+el.dataset.i);break;
    case 'finish':finishSession();break;
    case 'tq':{const q=el.dataset.q;S.manual.quests[q]=!questDone(q);if(!S.manual.quests[q])delete S.manual.quests[q];save();render();break;}
    case 'td':{const d=el.dataset.d;S.manual.diaries[d]=!diaryDone(d);if(!S.manual.diaries[d])delete S.manual.diaries[d];save();render();break;}
    case 'toggle':S.manual[el.dataset.p]=!S.manual[el.dataset.p];save();render();break;
    case 'rd':S.resets[el.dataset.k]=Date.now();save();render();toast('Logged. The timer restarts now.','');break;
    case 'export':{const u=URL.createObjectURL(new Blob([JSON.stringify({longgame:1,state:S,snaps})],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='longgame-'+S.name.replace(/[^\w-]+/g,'_')+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);break;}
    case 'import':importFile();break;
    case 'suggest':suggestForm(el.dataset.k);break;
    case 'forget':ask('Forget this account','Stats, sessions and manual ticks go. '+(SERVER?'Snapshots on disk stay.':'Your XP history stays in this browser.'),'Forget').then(ok=>{if(ok){S=blank();save();view='tonight';render();}});break;
  }
});
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1).split('/');if(S&&h[0]&&(h[0]!==view||(h[1]&&h[1]!==sel))){view=h[0];if(h[1])sel=h[1];render();}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='rsn'){const b=document.querySelector('[data-act=setname]');if(b)b.click();}});
setInterval(()=>{if(!S||!S.session||S.session.ended)return;let tot=0;S.session.blocks.forEach((b,i)=>{const e=blockElapsed(b);tot+=e;if(!b.running)return;document.querySelectorAll('[data-bt="'+i+'"]').forEach(el=>{el.textContent=clock(e);});const m=document.querySelector('[data-mk="'+i+'"]');if(m)m.style.setProperty('--p',Math.min(1,e/(b.minutes*60000)).toFixed(3));});const t=document.querySelector('[data-total]');if(t)t.textContent=clock(tot);},1000);

(async function boot(){
  S=await loadState();if(!S.prefs)S=Object.assign(blank(),S);
  if(S.name&&SERVER){try{snaps=await api('/api/snapshots?name='+encodeURIComponent(S.name));}catch(e){}}
  else if(S.name&&HOSTED)snaps=loadSnaps(S.name);
  const hv=location.hash.slice(1).split('/');if(hv[0])view=hv[0];if(hv[1])sel=hv[1]; // a reload keeps the tab you were on
  cue=['boot'];render();
  if(S.name&&S.hs&&Date.now()-S.hs.fetched>30*60000)refresh({ws:!S.ws});
})();
})();
