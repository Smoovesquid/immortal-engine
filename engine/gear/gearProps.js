import { clampInt } from '../util.js';

// Gear as Physics Inputs v1
// Offline + deterministic: derive aggregate signals from inventory items.

export function scoreInventorySignals(entity) {
  const inv = entity?.inventory && typeof entity.inventory === 'object' ? entity.inventory : {};
  const buckets = Object.values(inv);
  const items = [];
  for (const b of buckets) {
    if (Array.isArray(b)) items.push(...b);
  }

  let weight = 0;
  let noise = 0;
  let light = 0;
  let bulk = 0;

  for (const it of items) {
    const s = scoreItemSignals(it);
    weight += s.weight;
    noise += s.noise;
    light += s.light;
    bulk += s.bulk;
  }

  return {
    weight: clampInt(weight, 0, 999),
    noise: clampInt(noise, 0, 999),
    light: clampInt(light, 0, 999),
    bulk: clampInt(bulk, 0, 999)
  };
}

export function scoreItemSignals(item) {
  const x = item && typeof item === 'object' ? item : {};

  // Prefer explicit schema.
  const w0 = toInt(x.weight);
  const n0 = toInt(x.noise);
  const l0 = toInt(x.light);
  const b0 = toInt(x.bulk);

  const name = String(x.name || '').toLowerCase();
  const tags = Array.isArray(x.tags) ? x.tags.map(t => String(t).toLowerCase()) : [];

  // Derive sane defaults if absent.
  const derived = deriveSignalsFromTagsAndName({ name, tags });

  return {
    weight: clampInt(Number.isFinite(w0) ? w0 : derived.weight, 0, 5),
    noise: clampInt(Number.isFinite(n0) ? n0 : derived.noise, 0, 5),
    light: clampInt(Number.isFinite(l0) ? l0 : derived.light, 0, 5),
    bulk: clampInt(Number.isFinite(b0) ? b0 : derived.bulk, 0, 5)
  };
}

function deriveSignalsFromTagsAndName({ name, tags }) {
  let weight = 1;
  let noise = 0;
  let light = 0;
  let bulk = 1;

  // Light sources.
  if (/(lantern|torch|flashlight|flare|glowstick|headlamp)/.test(name)) {
    light = 4;
    noise = Math.max(noise, 1);
  }

  // Armor tends to be heavy/bulky/noisy.
  if (tags.includes('armor')) {
    weight = 3;
    bulk = 3;
    noise = Math.max(noise, 2);
  }

  // Weapons: moderate weight and some noise.
  if (tags.includes('martial') || tags.includes('weapon')) {
    weight = Math.max(weight, 2);
    bulk = Math.max(bulk, 2);
    noise = Math.max(noise, 1);
  }

  // Tools: lighter, but can add bulk.
  if (tags.includes('tools') || tags.includes('tool')) {
    weight = Math.min(weight, 2);
    bulk = Math.max(bulk, 1);
  }

  // Clothes: low weight/bulk/noise.
  if (tags.includes('clothes')) {
    weight = 1;
    bulk = 1;
    noise = Math.min(noise, 1);
  }

  // Oddities: small but "weird" (not modeled here).
  if (tags.includes('oddity')) {
    weight = 1;
    bulk = 1;
  }

  // Consumables: generally light.
  if (tags.includes('consumable')) {
    weight = 1;
    bulk = 1;
  }

  // Heavy keywords.
  if (/(mail|plate|anvil|chain)/.test(name)) {
    weight = Math.max(weight, 4);
    bulk = Math.max(bulk, 4);
    noise = Math.max(noise, 3);
  }

  // Quiet keywords.
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

function toInt(v) {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : NaN;
}


