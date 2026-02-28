// Seeded RNG: deterministic across runs.
// Uses xmur3 (string -> 32-bit) + sfc32 PRNG.

export function seedFromString(str) {
  const s = String(str ?? '');
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

export function makeRng(seed) {
  // sfc32 expects 4 seeds; derive from one.
  let a = (seed ^ 0x9e3779b9) >>> 0;
  let b = (seed ^ 0x243f6a88) >>> 0;
  let c = (seed ^ 0xb7e15162) >>> 0;
  let d = (seed ^ 0xdeadbeef) >>> 0;

  function nextFloat() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    // 0..1
    return ((t >>> 0) / 4294967296);
  }

  function int(min, maxInclusive) {
    const lo = Math.ceil(min);
    const hi = Math.floor(maxInclusive);
    const x = nextFloat();
    return lo + Math.floor(x * (hi - lo + 1));
  }

  function pick(arr) {
    if (!arr?.length) return undefined;
    return arr[int(0, arr.length - 1)];
  }

  return {
    nextFloat,
    int,
    pick
  };
}
