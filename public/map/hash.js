
// Browser-safe deterministic string hash (no crypto, no node:*).
export function hash32(str) {
  const s = String(str ?? '');
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function hash01(str) {
  const h = hash32(str);
  return (h % 1000000) / 1000000;
}
