// Stable log formatting. Keep it deterministic and compact.

export function formatEvent(event) {
  // event: {t, kind, data}
  const t = Number.isFinite(event?.t) ? event.t : 0;
  const kind = String(event?.kind ?? 'event');
  const data = event?.data ?? {};
  return `${t.toString().padStart(4,'0')}|${kind}|${stableStringify(data)}`;
}

export function stableStringify(obj) {
  if (obj === null) return 'null';
  const t = typeof obj;
  if (t === 'string') return JSON.stringify(obj);
  if (t === 'number' || t === 'boolean') return String(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
  if (t === 'object') {
    const keys = Object.keys(obj).sort();
    const parts = keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(String(obj));
}
