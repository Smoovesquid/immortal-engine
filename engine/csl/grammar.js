import crypto from 'node:crypto';

function hashInt(str) {
  const h = crypto.createHash('sha256').update(str).digest('hex');
  return parseInt(h.slice(0, 8), 16);
}

function pickDeterministic(list, seedKey) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Grammar: empty selection list');
  }
  const n = hashInt(seedKey);
  return list[n % list.length];
}

function pickManyDeterministic(list, seedKey, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(pickDeterministic(list, seedKey + ':' + i));
  }
  return Array.from(new Set(results));
}

function generateSurfaceCandidate({ seed, domain, index }) {
  if (!seed || !domain || typeof index !== 'number') {
    throw new Error('Grammar: invalid inputs');
  }

  const type = pickDeterministic(
    domain.types,
    seed + ':' + domain.domainId + ':' + index + ':type'
  );

  const tagPool = domain.tagPools[type] || [];
  const tags = pickManyDeterministic(
    tagPool,
    seed + ':' + domain.domainId + ':' + index + ':tags',
    2
  );

  return {
    id: domain.domainId + '-' + index,
    type,
    tags
  };
}

export { generateSurfaceCandidate };
