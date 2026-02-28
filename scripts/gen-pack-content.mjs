import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const packs = [
  { id:'fantasy', dir:'fantasy', name:'Fantasy', baseLoc:['sunken crypt','mossy stair','ruined watchtower','blackwood ford','salt-cave'], baseObj:['recover a stolen relic','break a local curse','escort a wary scholar','map the lower tunnels','find the missing courier'], vibe:['lanternlit','iron','black'] },
  { id:'space-rift', dir:'space-rift', name:'Space Rift', baseLoc:['derelict corridor','rift-lab airlock','asteroid outpost','glitch-hangar','reactor spine'], baseObj:['stabilize the rift','recover the black box','trace the missing signal','seal a hull breach','wake the sleeping AI'], vibe:['neon','static','void-cold'] },
  { id:'zombie', dir:'zombie', name:'Zombie Apocalypse', baseLoc:['abandoned bus depot','grocery backroom','overgrown cul-de-sac','flooded underpass','rail yard office'], baseObj:['secure clean water','rescue a trapped neighbor','reach the radio tower','find antibiotics','fortify the safehouse'], vibe:['scrappy','grey','raw'] },
  { id:'haunted', dir:'haunted', name:'Haunted House', baseLoc:['attic landing','locked nursery','basement stair','mirror hallway','cold pantry'], baseObj:['find the house key','identify the spirit','break the binding','return a stolen keepsake','seal the speaking door'], vibe:['whispery','drafty','razor'] },
  { id:'modern', dir:'modern', name:'Modern IRL', baseLoc:['empty parking garage','late diner booth','office stairwell','train platform edge','motel laundry room'], baseObj:['get the evidence','avoid being followed','make the handoff','confirm the leak','clear your name'], vibe:['bright','late-night','hard'] }
];

function expand50(seed, templates){
  const out=[];
  for(let i=0;i<50;i++){
    const t=templates[i%templates.length];
    out.push(t.replace('{i}', String(i+1)));
  }
  return out;
}

function uniq(arr){
  const seen=new Set();
  const out=[];
  for(const x of arr){
    const s=String(x);
    if(seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

for(const p of packs){
  const file=path.join(root,'packs',p.dir,'pack.json');
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));

  const locations = uniq(expand50(p.id,[
    `${p.baseLoc[0]} (level {i})`,
    `${p.baseLoc[1]} (level {i})`,
    `${p.baseLoc[2]} (level {i})`,
    `${p.baseLoc[3]} (level {i})`,
    `${p.baseLoc[4]} (level {i})`,
    `side passage: ${p.baseLoc[1]} (marker {i})`,
    `threshold: ${p.baseLoc[2]} (marker {i})`,
    `backway: ${p.baseLoc[3]} (marker {i})`,
    `deep pocket: ${p.baseLoc[0]} (marker {i})`,
    `dead end: ${p.baseLoc[4]} (marker {i})`
  ]));

  const objectives = uniq(expand50(p.id,[
    `${p.baseObj[0]} (before dawn {i})`,
    `${p.baseObj[1]} (by the next bell {i})`,
    `${p.baseObj[2]} (no casualties {i})`,
    `${p.baseObj[3]} (bring proof {i})`,
    `${p.baseObj[4]} (quietly {i})`,
    `learn the truth behind ${p.baseObj[1]} ({i})`,
    `remove the obstacle blocking ${p.baseObj[0]} ({i})`,
    `earn leverage to ${p.baseObj[2]} ({i})`,
    `find a safer route to ${p.baseObj[3]} ({i})`,
    `secure resources to ${p.baseObj[4]} ({i})`
  ]));

  const complications = uniq(expand50(p.id,[
    `a clock starts when you arrive ({i})`,
    `someone is lying about the map ({i})`,
    `the easy route is watched ({i})`,
    `your supplies are short ({i})`,
    `a harmless detail is the trap ({i})`,
    `help comes with strings attached ({i})`,
    `noise carries farther than it should ({i})`,
    `the ground shifts under pressure ({i})`,
    `a rival group is already here ({i})`,
    `the exit won’t be where you left it ({i})`
  ]));

  const npcArchetypes = uniq(expand50(p.id,[
    `wary guide with a secret ({i})`,
    `injured veteran who won’t quit ({i})`,
    `smiling fixer with bad news ({i})`,
    `devout believer with a knife ({i})`,
    `skeptical scholar chasing proof ({i})`,
    `runaway heir who knows a shortcut ({i})`,
    `quiet hunter who hears everything ({i})`,
    `friendly stranger who asks too much ({i})`,
    `frightened child with a key detail ({i})`,
    `local authority with a vendetta ({i})`
  ]));

  const sensoryMotifs = uniq(expand50(p.id,[
    `air tastes of ${p.vibe[0]} dust ({i})`,
    `${p.vibe[1]} silence presses on your ears ({i})`,
    `${p.vibe[2]} light bends at the edges ({i})`,
    `a faint metallic tang follows you ({i})`,
    `footsteps echo one beat late ({i})`,
    `the temperature drops without wind ({i})`,
    `a distant drip keeps perfect time ({i})`,
    `your shadow looks slightly wrong ({i})`,
    `the smell of ozone lingers ({i})`,
    `a low hum threads through the walls ({i})`
  ]));

  const next = {
    ...raw,
    locations,
    objectives,
    complications,
    npcArchetypes,
    sensoryMotifs
  };

  fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  console.log('wrote', file);
}
