import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const packsDir = path.join(root, 'packs');

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function deriveSignalsFromTagsAndName({ name, tags }) {
  let weight = 1;
  let noise = 0;
  let light = 0;
  let bulk = 1;

  if (/(lantern|torch|flashlight|flare|glowstick|headlamp)/.test(name)) {
    light = 4;
    noise = Math.max(noise, 1);
  }
  if (tags.includes('armor')) {
    weight = 3;
    bulk = 3;
    noise = Math.max(noise, 2);
  }
  if (tags.includes('martial') || tags.includes('weapon')) {
    weight = Math.max(weight, 2);
    bulk = Math.max(bulk, 2);
    noise = Math.max(noise, 1);
  }
  if (tags.includes('tools') || tags.includes('tool')) {
    weight = Math.min(weight, 2);
    bulk = Math.max(bulk, 1);
  }
  if (tags.includes('clothes')) {
    weight = 1;
    bulk = 1;
    noise = Math.min(noise, 1);
  }
  if (tags.includes('oddity')) {
    weight = 1;
    bulk = 1;
  }
  if (tags.includes('consumable')) {
    weight = 1;
    bulk = 1;
  }
  if (/(mail|plate|anvil|chain)/.test(name)) {
    weight = Math.max(weight, 4);
    bulk = Math.max(bulk, 4);
    noise = Math.max(noise, 3);
  }
  if (/(soft|cloth|felt|quiet)/.test(name)) {
    noise = Math.max(0, noise - 1);
  }

  return {
    weight: clampInt(weight, 0, 5),
    noise: clampInt(noise, 0, 5),
    light: clampInt(light, 0, 5),
    bulk: clampInt(bulk, 0, 5)
  };
}

async function main() {
  const packIds = await fs.readdir(packsDir);
  for (const packId of packIds) {
    const gearPath = path.join(packsDir, packId, 'gear.json');
    try {
      const raw = await fs.readFile(gearPath, 'utf8');
      const json = JSON.parse(raw);

      let changed = false;
      for (const [cat, arr] of Object.entries(json)) {
        if (!Array.isArray(arr)) continue;
        json[cat] = arr.map((it) => {
          if (!it || typeof it !== 'object') return it;
          const name = String(it.name || '').toLowerCase();
          const tags = Array.isArray(it.tags) ? it.tags.map(t => String(t).toLowerCase()) : [];
          const d = deriveSignalsFromTagsAndName({ name, tags });

          const out = { ...it };
          for (const k of ['weight','noise','light','bulk']) {
            if (!(k in out)) {
              out[k] = d[k];
              changed = true;
            }
          }
          return out;
        });
      }

      if (changed) {
        await fs.writeFile(gearPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
        console.log(`patched: ${path.relative(root, gearPath)}`);
      } else {
        console.log(`ok:      ${path.relative(root, gearPath)}`);
      }
    } catch (e) {
      // ignore packs without gear
    }
  }
}

await main();
