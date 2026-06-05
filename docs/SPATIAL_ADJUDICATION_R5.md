# SPATIAL_ADJUDICATION_R5 — Board-Aware Tactics

**Goal:** Actions respect position on the board. "Hide behind the barrel" means the barrel is between you and the threat. "Flank the wolf" requires tactical positioning.

**Done when:** Spatial coordinate system integrated, 5 spatial rulings tested, board state affects DC/outcomes.

---

## The Problem (Why R5 Matters)

Without spatial adjudication, all actions are location-agnostic:
- "Hide behind barrel" works even if barrel is 50 feet away
- "Flank the enemy" works whether you're adjacent or across the map
- You can block a doorway while standing in the next room

With spatial adjudication:
- "Hide behind barrel" only works if barrel is between you and threat AND you're adjacent
- "Flank" requires you to move to flank position (costs action)
- Cover is positional (lose it if you move)

---

## Coordinate System

### Map Layer (Already Exists)
```
World has map with nodes:
  nodes: [
    { id: 'n0', name: 'cellar', edges: [...], furniture: [...] },
    { id: 'n1', name: 'west-hall', edges: [...], furniture: [...] }
  ]
  
Nodes are connected by edges:
  edges: [
    { from: 'n0', to: 'n1', distance: 30 }
  ]
```

### Intra-node Positioning (NEW)
```
Within a node, position is (ux, uy, elevation):
  ux, uy = position in 2D node space (0-100)
  elevation = vertical level (0 = floor, 1 = first level, etc.)

Player position extends to:
  party[0].position = {
    nodeId: 'n0',
    ux: 50,           // X position in node (0-100)
    uy: 30,           // Y position in node (0-100)
    elevation: 0,     // vertical level
    interior: false   // is this an indoor area?
  }

Furniture positions within nodes:
  furniture[0] = {
    name: 'wooden barrel',
    ux: 75,           // positioned in node space
    uy: 20,
    elevation: 0,
    ...
  }
```

### Distance Calculation
```
// Euclidean distance between two positions in same node
distance(p1, p2) {
  const dx = p1.ux - p2.ux;
  const dy = p1.uy - p2.uy;
  return Math.sqrt(dx*dx + dy*dy);
}

// Adjacent = within 15 feet (distance < 1.5 on 0-100 scale)
isAdjacent(p1, p2) {
  return distance(p1, p2) < 1.5;
}

// Same elevation (can't jump down to another level without roll)
sameLevel(p1, p2) {
  return p1.elevation === p2.elevation;
}
```

---

## Five Spatial Rulings

### 1. HIDE_BEHIND_POSITIONED — Cover works if positioned correctly

**Preconditions:**
- Object exists in same node
- Object has bulk >= 3 (large enough to hide behind)
- Object is between you and threat (line-of-sight check)
- You are adjacent to object (within 1.5 units)

**Resolution:**
- Approach: finesse
- Stat: AGILITY
- DC: 10 + threat.perception
- Success: Full cover (AC +2), invisible to threat
- Mixed: Partial cover (AC +1), visible but obstructed
- Failure: Exposed, lose action

**Example:**
```
Player at (50, 50), barrel at (75, 50), wolf at (95, 50)
Distance: player to barrel = 25 units (not adjacent!) → Ruling fails precondition
Required: Move closer first (costs action)

Player at (72, 50), barrel at (75, 50), wolf at (95, 50)
Distance: player to barrel = 3 units (adjacent!) ✓
Line of sight: barrel is between player and wolf ✓
→ Ruling applies
```

---

### 2. FLANK — Position to gain tactical advantage

**Preconditions:**
- Enemy exists in same node
- You are not currently adjacent to enemy (would require movement)
- Movement path is clear (no obstacles)

**Resolution:**
- Approach: force (aggressive move) or finesse (tactical positioning)
- Stat: MIGHT or AGILITY
- DC: 10 + enemy.combat_awareness
- Success: Move to flank position, next attack +2 bonus
- Mixed: Move to flank position (position only, no bonus yet)
- Failure: Position visible, enemy uses reaction

**Delta ops:**
- modifyPosition (player moves to flank position)
- condition (flanking bonus +2 AC)
- reaction (if available to enemy)

**Example:**
```
Player at (30, 50), goblin at (70, 50)
Action: "move to flank the goblin"
Distance: 40 units (not adjacent)
DC: 10 + 2 (awareness) = 12
Roll: 14 + 2 (AGILITY) = 16 vs 12 → SUCCESS
Result: Player moves to (75, 65), gains flanking bonus
```

---

### 3. BLOCK_DOORWAY — Position to prevent passage

**Preconditions:**
- Doorway or narrow passage exists in node
- You have enough reach/size to block it (bulk >= 2)
- You are adjacent to the doorway

**Resolution:**
- Approach: force (stand firm) or endure (brace yourself)
- Stat: MIGHT or GRIT
- DC: 10 + enemy.strength (if someone tries to push through)
- Success: Enemy cannot pass, must find alternate route
- Mixed: Enemy can push through (costs 2 actions, you stay in place)
- Failure: Enemy pushes you aside (you move, doorway clear)

**Position effect:**
- Blocking uses the doorway's position
- Enemies moving through that doorway must deal with you
- Can be flanked or surrounded

---

### 4. CHARGE — Move at speed toward enemy with position advantage

**Preconditions:**
- Enemy in same node
- Clear line of movement (distance >= 15 units, path clear)
- You have momentum (previous action was not dodge/defend)

**Resolution:**
- Approach: force
- Stat: MIGHT
- DC: 10 + distance_in_units / 10 (longer charges are riskier)
- Success: Move to enemy, attack bonus +1, but AC -1 (overcommitted)
- Mixed: Move to enemy, attack at normal bonus/AC
- Failure: Stumble, fall prone, lose next action

**Position effect:**
- Must move from current position to enemy position
- Creates line of movement (could hit allies in the way)

---

### 5. DISENGAGE — Tactical retreat while maintaining position advantage

**Preconditions:**
- You are currently in combat (adjacent to enemy)
- You have action available
- Movement path to safety is clear

**Resolution:**
- Approach: finesse
- Stat: AGILITY
- DC: 10 (automatic success with no bonus/penalty)
- Success: Move away, enemy doesn't get reaction
- Mixed: Move away, enemy gets reaction at disadvantage
- Failure: Enemy reaction hits, lose action

**Position effect:**
- Breaks adjacency, prevents opportunity attacks
- Narrate flowing movement backward while watching enemy

---

## Integration with Existing Rules

### Position Initialization
```javascript
// In newWorld() or beginAdventure():
w.party[0].position = {
  nodeId: currentNodeId,
  ux: 50 + random(-10, 10),  // Randomize slightly
  uy: 50 + random(-10, 10),
  elevation: 0,
  interior: w.scene.interior || false
};
```

### Position Persistence
```javascript
// Position saved in party[0].position
// Survives scene transitions
// Updated when movement actions complete
```

### Position in Adjudication
```javascript
// Before rolling a spatial ruling:
1. Get player position (party[0].position)
2. Get target position (object.position or enemy.position)
3. Compute distance and line-of-sight
4. Check preconditions (adjacent, clear path, etc.)
5. Modify DC if distance affects difficulty
6. Apply deltas including position changes
```

---

## Line-of-Sight Calculation

For cover/positioning to work, we need to know if object is between player and threat.

```javascript
function objectBlocksLineOfSight(player, object, threat) {
  // Simplified: check if object center is on line between player and threat
  const playerToThreat = {
    x: threat.ux - player.ux,
    y: threat.uy - player.uy
  };
  
  const playerToObject = {
    x: object.ux - player.ux,
    y: object.uy - player.uy
  };
  
  // If object is roughly on the line between player and threat
  // (within 10 units of the line), it blocks line of sight
  const crossProduct = playerToThreat.x * playerToObject.y - 
                       playerToThreat.y * playerToObject.x;
  const distance = Math.abs(crossProduct) / 
                   Math.sqrt(playerToThreat.x**2 + playerToThreat.y**2);
  
  return distance < 10; // blocks if within 10 units of line
}
```

---

## Position Deltas

New delta types for spatial adjudication:

```javascript
// Move player to new position
{
  op: 'modifyPosition',
  partyMemberId: 'party',
  position: {
    nodeId: 'n0',
    ux: 75,
    uy: 50,
    elevation: 0
  }
}

// Move object to new position
{
  op: 'modifyFurniture',
  nodeId: 'n0',
  entityId: 'barrel-1',
  position: { ux: 50, uy: 50 }
}

// Create temporary condition (flanking, prone, etc.)
{
  op: 'condition',
  name: 'flanking',
  duration: 1, // rounds
  bonus: 2
}
```

---

## Testing Strategy

### Unit Tests (Position & LOS)
```javascript
// U89-01: distance calculation
// U89-02: adjacency detection
// U89-03: line of sight blocking
// U89-04: same elevation check
// U89-05: movement path validation
```

### Integration Tests (Spatial Rulings)
```javascript
// U89-06: HIDE_BEHIND_POSITIONED preconditions
// U89-07: FLANK movement and bonus
// U89-08: BLOCK_DOORWAY positioning
// U89-09: CHARGE distance-based DC
// U89-10: DISENGAGE reaction handling
```

### End-to-End Tests (Board State)
```javascript
// U89-11: adjudicate respects position
// U89-12: movement costs action
// U89-13: position persists across turns
// U89-14: line of sight affects cover value
// U89-15: spatial determinism (same seed = same positions)
```

---

## Not in Scope (R6+)

- Multiple party members (NPC allies)
- Creature positioning (enemies have positions too)
- Combat board visualization
- Movement orders and initiative
- Opportunity attacks and reactions

These are R6+ work once the core 5 spatial rulings are locked.

---

## Success Criteria

- [ ] Position system initialized in party[0]
- [ ] 5 spatial rulings defined and wired
- [ ] Distance and LOS calculations working
- [ ] Position deltas applied correctly
- [ ] Position persists across scenes
- [ ] Spatial determinsm verified
- [ ] All 15 U89 tests passing
- [ ] Full test suite green

---

## Timeline Estimate

- Position system setup: 1 hour
- 5 spatial rulings: 2 hours
- Distance/LOS helpers: 1 hour
- Testing & verification: 1–2 hours
- **Total: 5–6 hours for R5 complete**

---

## Architecture Summary

```
┌─ adjudicate(world, playerText)
│
├─ Detect physical interaction + target
├─ Check for ruling match
│
└─ If spatial ruling (HIDE_BEHIND, FLANK, BLOCK, CHARGE, DISENGAGE)
    ├─ Get player position
    ├─ Get target position
    ├─ Compute distance & LOS
    ├─ Check spatial preconditions
    ├─ Modify DC based on positioning
    ├─ Roll + resolve
    ├─ Apply position deltas
    └─ Log spatial ruling
```

**Core insight:** Board state affects DC and outcomes. Tactical positioning matters.

