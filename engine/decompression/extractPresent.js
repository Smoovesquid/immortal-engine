// Present-State Extractor — derives settlement entities from history ticks + final worldTick state.
// NPCs, buildings, shops, factions, tensions, ruins, secrets. All from simulation output.

// M7-S3 — size tiers drive a real spread: a hamlet is a handful of roofs, the
// city 'seat' a kingdom of dozens. Keyed by the node's size tag (assigned in
// generateMap); falls through to 'village' when untagged (back-compat).
// NPC counts stay as they were so settlement decompression's rng stream — and
// everything cast onto it (the villain's witness, dialogue) — is unchanged; only
// the SIZE the player sees (buildings) varies by tier. (Bigger living populations
// for cities are a later, separately-verified pass.)
const NPC_COUNT = { wilderness: [1, 2], hamlet: [2, 4], village: [3, 5], town: [8, 12], city: [15, 20] };
const BUILDING_COUNT = { wilderness: [0, 1], hamlet: [1, 3], village: [4, 9], town: [12, 22], city: [28, 45] };

function rangeForTag(tags, table, rng) {
  for (const key of ['city', 'town', 'village', 'hamlet', 'wilderness']) {
    if (tags.includes(key)) {
      const [lo, hi] = table[key];
      return rng.int(lo, hi);
    }
  }
  const [lo, hi] = table.village;
  return rng.int(lo, hi);
}

function hasEvent(history, eventId) {
  return history.some(h => h.eventId === eventId);
}

function eventTick(history, eventId) {
  const h = history.find(e => e.eventId === eventId);
  return h ? h.era : null;
}

function deriveNpcs(history, finalState, tags, pack, rng) {
  const count = rangeForTag(tags, NPC_COUNT, rng);
  const npcs = [];

  // Faction representatives: 1-2 per faction in final state
  for (const fac of finalState.factions) {
    npcs.push({
      role: 'representative',
      factionId: fac.id,
      disposition: fac.hostility >= 60 ? 'hostile' : fac.hostility >= 30 ? 'wary' : 'friendly',
      originTick: 0
    });
    if (fac.hostility >= 40 && npcs.length < count) {
      npcs.push({
        role: 'enforcer',
        factionId: fac.id,
        disposition: 'wary',
        originTick: 0
      });
    }
  }

  // Event-derived NPCs
  if (hasEvent(history, 'faction_war') && npcs.length < count) {
    npcs.push({ role: 'veteran', factionId: '', disposition: 'wary', originTick: eventTick(history, 'faction_war') });
  }
  if (hasEvent(history, 'peace_period') && npcs.length < count) {
    npcs.push({ role: 'mediator', factionId: '', disposition: 'friendly', originTick: eventTick(history, 'peace_period') });
  }
  if ((hasEvent(history, 'blight') || hasEvent(history, 'famine_scar')) && npcs.length < count) {
    npcs.push({ role: 'healer', factionId: '', disposition: 'friendly', originTick: eventTick(history, 'blight') ?? eventTick(history, 'famine_scar') });
  }
  if (hasEvent(history, 'famine') && npcs.length < count) {
    npcs.push({ role: 'scavenger', factionId: '', disposition: 'wary', originTick: eventTick(history, 'famine') });
  }

  // Fill remaining slots with general townfolk
  const roles = ['trader', 'laborer', 'elder', 'artisan', 'guard', 'scholar', 'innkeeper'];
  while (npcs.length < count) {
    npcs.push({
      role: rng.pick(roles),
      factionId: '',
      disposition: finalState.ecology.instability >= 40 ? 'wary' : 'friendly',
      originTick: null
    });
  }

  return npcs.slice(0, count);
}

function deriveBuildings(history, finalState, tags, rng) {
  const count = rangeForTag(tags, BUILDING_COUNT, rng);
  const buildings = [];

  // Type from node tags
  if (tags.includes('trade')) buildings.push({ name: 'market hall', tags: ['trade'], state: 'intact', originTick: 0 });
  if (tags.includes('sacred')) buildings.push({ name: 'temple', tags: ['sacred'], state: 'intact', originTick: 0 });
  if (tags.includes('military')) buildings.push({ name: 'barracks', tags: ['military'], state: 'intact', originTick: 0 });

  // Trade boom adds a market if not already present
  if (hasEvent(history, 'trade_boom') && !buildings.some(b => b.tags.includes('trade'))) {
    buildings.push({ name: 'trading post', tags: ['trade'], state: 'intact', originTick: eventTick(history, 'trade_boom') });
  }

  // Fill with generic buildings
  const types = ['house', 'workshop', 'storehouse', 'well', 'meeting hall', 'stable', 'smithy'];
  while (buildings.length < count) {
    buildings.push({ name: rng.pick(types), tags: [], state: 'intact', originTick: null });
  }

  // War/corruption marks some buildings as ruined
  const ruins = [];
  if (hasEvent(history, 'war_scar') || hasEvent(history, 'faction_war')) {
    const ruinCount = Math.min(2, Math.floor(buildings.length / 3));
    for (let i = 0; i < ruinCount && i < buildings.length; i++) {
      const b = buildings[i];
      ruins.push({
        originalName: b.name,
        cause: hasEvent(history, 'war_scar') ? 'war' : 'conflict',
        originTick: eventTick(history, 'war_scar') ?? eventTick(history, 'faction_war')
      });
      buildings[i] = { ...b, state: 'ruined' };
    }
  }
  if (hasEvent(history, 'corruption_scar')) {
    const target = buildings.find(b => b.state === 'intact');
    if (target) {
      target.state = 'ruined';
      ruins.push({
        originalName: target.name,
        cause: 'corruption',
        originTick: eventTick(history, 'corruption_scar')
      });
    }
  }

  return { buildings: buildings.slice(0, count), ruins };
}

function deriveShops(finalState, tags, pack, rng) {
  const scarcity = finalState.ecology?.scarcity ?? 0;
  const shops = [];

  if (tags.includes('wilderness')) return shops;

  const hasTrade = tags.includes('trade');
  const baseCount = hasTrade ? rng.int(2, 3) : rng.int(1, 2);

  const gear = Array.isArray(pack.gear) ? pack.gear : [];
  const shopTypes = ['general store', 'supply shop', 'apothecary', 'armorer', 'provisioner'];

  for (let i = 0; i < baseCount; i++) {
    let itemCount;
    if (scarcity < 30) itemCount = rng.int(3, 5);
    else if (scarcity < 60) itemCount = rng.int(1, 2);
    else itemCount = rng.nextFloat() < 0.5 ? 1 : 0;

    const inventory = [];
    for (let j = 0; j < itemCount && gear.length > 0; j++) {
      inventory.push(rng.pick(gear));
    }

    shops.push({
      type: shopTypes[i % shopTypes.length],
      inventory,
      originTick: null
    });
  }

  return shops;
}

function deriveFactions(finalState) {
  return finalState.factions.map(f => ({
    id: f.id,
    influence: Math.min(100, f.pressure + (100 - f.hostility) / 2),
    attitude: f.hostility >= 60 ? 'hostile' : f.hostility >= 30 ? 'wary' : 'friendly'
  }));
}

function deriveTensions(history, finalState) {
  const tensions = [];

  // Faction tension + multiple factions = power struggle
  if (hasEvent(history, 'faction_tension') && finalState.factions.length > 1) {
    tensions.push({
      type: 'power_struggle',
      actors: finalState.factions.map(f => f.id),
      severity: hasEvent(history, 'faction_war') ? 5 : 3,
      originTick: eventTick(history, 'faction_tension')
    });
  }

  // Blight + famine = survival tension
  if (hasEvent(history, 'blight') && (hasEvent(history, 'famine') || hasEvent(history, 'famine_scar'))) {
    tensions.push({
      type: 'survival',
      actors: [],
      severity: 4,
      originTick: eventTick(history, 'blight')
    });
  }

  // War + peace in same history = uneasy truce
  if (hasEvent(history, 'faction_war') && hasEvent(history, 'peace_period')) {
    tensions.push({
      type: 'uneasy_truce',
      actors: finalState.factions.map(f => f.id),
      severity: 3,
      originTick: eventTick(history, 'peace_period')
    });
  }

  // Unrest alone
  if (hasEvent(history, 'unrest') && !tensions.some(t => t.type === 'power_struggle')) {
    tensions.push({
      type: 'civil_unrest',
      actors: [],
      severity: 3,
      originTick: eventTick(history, 'unrest')
    });
  }

  return tensions;
}

function deriveSecrets(history) {
  // Scar events produce strong secrets; other charged events produce weaker secrets.
  // The settlementTicker only runs 2-10 ticks, which rarely hits scar thresholds —
  // so we also derive secrets from faction wars, blights, and unrest. Every
  // settlement with any history at all should yield at least one secret so the
  // NPC depth system has something to distribute.
  const SECRET_MAP = {
    corruption_scar: { type: 'corruption', severity: 4 },
    war_scar:        { type: 'war',        severity: 5 },
    famine_scar:     { type: 'famine',     severity: 4 },
    faction_war:     { type: 'war',        severity: 3 },
    faction_tension: { type: 'rivalry',    severity: 2 },
    blight:          { type: 'corruption', severity: 2 },
    famine:          { type: 'famine',     severity: 2 },
    unrest:          { type: 'rivalry',    severity: 2 }
  };

  const secrets = [];
  const seen = new Set();
  for (const h of history) {
    const m = SECRET_MAP[h.eventId];
    if (!m) continue;
    const key = `${m.type}|${h.era}`;
    if (seen.has(key)) continue;
    seen.add(key);
    secrets.push({ type: m.type, connectedTo: h.era, severity: m.severity });
  }

  // Floor: every settlement carries at least one buried truth from its founding,
  // so NPC depth has something private to hold even when the short history
  // simulation didn't trip any threshold detectors.
  if (secrets.length === 0) {
    secrets.push({ type: 'rivalry', connectedTo: 0, severity: 2 });
  }

  return secrets;
}

function derivePopulation(tags, rng) {
  if (tags.includes('city')) return rng.int(400, 1200);   // the seat — a city / kingdom
  if (tags.includes('town')) return rng.int(80, 300);
  if (tags.includes('village')) return rng.int(20, 80);
  if (tags.includes('hamlet')) return rng.int(5, 20);
  return rng.int(0, 5);
}

function deriveEconomy(finalState, tags) {
  const scarcity = finalState.ecology?.scarcity ?? 0;
  if (tags.includes('trade') && scarcity < 30) return 'thriving';
  if (scarcity >= 60) return 'desperate';
  if (scarcity >= 30) return 'struggling';
  return 'stable';
}

export function extractPresent(history, finalState, tags, pack, rng) {
  const npcs = deriveNpcs(history, finalState, tags, pack, rng);
  const { buildings, ruins } = deriveBuildings(history, finalState, tags, rng);
  const shops = deriveShops(finalState, tags, pack, rng);
  const factions = deriveFactions(finalState);
  const tensions = deriveTensions(history, finalState);
  const secrets = deriveSecrets(history);
  const population = derivePopulation(tags, rng);
  const economy = deriveEconomy(finalState, tags);

  return {
    buildings,
    npcs,
    shops,
    factions,
    tensions,
    ruins,
    secrets,
    population,
    economy,
    history
  };
}
