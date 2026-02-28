export function buildNarrationContext(world) {
  const w = world || {};

  const currentNodeId =
    typeof w?.map?.currentNodeId === 'string'
      ? w.map.currentNodeId
      : null;

  const threads = Array.isArray(w?.instrument?.threads)
    ? w.instrument.threads
    : [];

  const scars = Array.isArray(w?.scars)
    ? w.scars
    : [];

  const activeThreads = threads
    .filter(t => t && t.status !== 'resolved')
    .map(t => ({
      id: String(t.id),
      status: String(t.status || 'open'),
      tension: Number(t.tension || 0)
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const stableScars = scars
    .map(s => ({
      id: String(s.id)
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    currentNodeId,
    activeThreads,
    scars: stableScars
  };
}
