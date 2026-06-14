// Things — objects with immutable true edges.
//
// Two-variance wall, third node:
//   Claims   (world.claims[])      = NPC maps  — distorted, propagated, never truth
//   True edges (thing.trueEdge)    = territory — engine-authored, immutable, latent
//
// A thing carries a trueEdge: an accurate, engine-owned account of a real
// timeline event. It is the territory-fragment. The LLM never writes it;
// propagation never touches it. It exists as the object witnessed.
//
// True edges are latent until a player act of discovery. Discovery:
//   - surfaces the description to the player
//   - marks thing.trueEdge.discovered = true on world.things
//   - does NOT mint a claim, does NOT touch world.claims
//   - does NOT overwrite any NPC's belief
// NPCs keep their maps. Only the player now holds the territory-fragment.
//
// Thing schema:
//   id          stable string, e.g. "thing:wardens_ledger"
//   name        display name shown to the player
//   description surface appearance before discovery (what the player finds the object as)
//   nodeId      where the object lives
//   trueEdge    engine-owned accurate account, or null if the thing carries no witness
//     eventRef    timeline event id this edge is anchored to ("scarFormed:0")
//     description engine-authored text — never LLM-generated, never rewritten
//     discovered  false until revealTrueEdge(); set true on first reveal

export function mintThing(world, { id, name, description, nodeId, trueEdge = null, vision = false }) {
  if (!id) return world;
  const things = Array.isArray(world.things) ? world.things : [];
  if (things.some(t => t.id === id)) return world; // idempotent

  const edge = trueEdge ? {
    eventRef:    trueEdge.eventRef    ? String(trueEdge.eventRef)    : null,
    description: trueEdge.description ? String(trueEdge.description) : '',
    discovered:  false,
  } : null;

  return {
    ...world,
    things: [...things, {
      id:          String(id),
      name:        String(name        || id),
      description: String(description || ''),
      nodeId:      String(nodeId      || ''),
      trueEdge:    edge,
      // vision: true marks this thing as the aperture plant. Ingesting it
      // fires the vision event and sets the player's vision:root mark.
      // The sealed contents (VISION_TEXT) are never stored here.
      ...(vision ? { vision: true } : {}),
    }],
  };
}

// Reveal a thing's true edge to the player.
//
// Returns { world, revealed } where:
//   world    — updated world with thing.trueEdge.discovered = true
//   revealed — the trueEdge object (description + eventRef), or null if none
//
// If already discovered, returns current state without re-mutating.
// Never touches world.claims. The player holds the fragment; NPCs do not.
export function revealTrueEdge(world, thingId) {
  const things = Array.isArray(world.things) ? world.things : [];
  const idx    = things.findIndex(t => t.id === thingId);
  if (idx === -1)            return { world, revealed: null };
  const thing = things[idx];
  if (!thing.trueEdge)       return { world, revealed: null };
  if (thing.trueEdge.discovered) return { world, revealed: thing.trueEdge };

  const updated    = { ...thing, trueEdge: { ...thing.trueEdge, discovered: true } };
  const nextThings = things.map((t, i) => i === idx ? updated : t);
  return {
    world:    { ...world, things: nextThings },
    revealed: updated.trueEdge,
  };
}
