// Bestiary — Elite Tier (CR 6–10)
// 175 creatures — COMBAT_SPEC section 7 compliant
export const elite = [

  // ── Batch 1 (1–30) ─────────────────────────────────────────────────

  {
    ref: 'clockwork_strategist',
    name: 'Clockwork Strategist',
    cr: 8,
    tier: 'elite',
    maxHp: 170,
    ac: 19,
    speed: 30,
    stats: { MIGHT: 18, AGILITY: 14, WITS: 20, GRIT: 18, CHARM: 10 },
    saveProficiencies: ['WITS', 'GRIT', 'MIGHT'],
    resistances: { psychic: 'immune', poison: 'immune', slashing: 'resistant', piercing: 'resistant' },
    conditionImmunities: ['poisoned', 'charmed', 'frightened', 'exhaustion'],
    actions: [
      { name: 'Calculated Strike', toHit: 8, damage: '2d10+4', type: 'bludgeoning', range: null, save: null, conditions: [], recharge: null },
      { name: 'Tactical Analysis', toHit: null, damage: '0', type: 'psychic', range: 60, save: null, conditions: [], recharge: 5 },
      { name: 'Overclocked Barrage', toHit: null, damage: '4d8', type: 'bludgeoning', range: 15, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['prone', 'stunned'], recharge: 6 }
    ],
    multiattack: ['Calculated Strike', 'Calculated Strike', 'Calculated Strike'],
    legendaryActions: null,
    lairActions: null,
    reactions: [{ name: 'Predictive Counter', trigger: 'A creature within 5 feet attacks it', effect: 'Predicts the attack — attacker has disadvantage and strategist gets a free Calculated Strike if the attack misses' }],
    traits: ['Constructed', 'Tactical Analysis (identifies weaknesses — allies gain +2 to hit analyzed target)', 'Overclock (once per day, gains extra action)', 'Magic Resistance', 'Predictive Algorithms'],
    spellcasting: null,
    gear: [{ ref: 'articulated_war_arms', slot: 'mainHand' }, { ref: 'adamantine_chassis', slot: 'torso' }],
    senses: { darkvision: 120, blindsight: 30, tremorsense: null, truesight: null },
    habitat: 'dungeon',
    ecology: 'The masterwork of a legendary artificer — a construct that can think, plan, and adapt. Unlike lesser golems, the Clockwork Strategist learns from every combat, filing away patterns and counters. It commands other constructs in its master\'s absence and improves their tactics through real-time analysis.',
    behavior: 'Triple Calculated Strike. Tactical Analysis to identify and communicate party weaknesses to allies. Overclocked Barrage on grouped enemies. Predictive Counter exploits melee attackers. Overclock for a devastating nova round. Fights with cold efficiency — retreats only to reposition.',
    encounterSign: 'Constructs behaving with unusual coordination. A ticking sound like a complex clock. Other golems that adapt to your tactics mid-fight. A construct that watches your party before engaging.',
    socialStructure: 'Commander of 2-6 lesser constructs',
    physicalDescription: 'A humanoid construct of brass and mithral, its chest cavity a visible clockwork brain of thousands of interlocking gears. Four articulated arms end in multi-purpose war implements. Its "face" is a crystal lens that pulses with analytical light. Every movement is precise and deliberate.',
    weakness: 'Lightning overloads its analytical engine — stunned for 1 round and loses Tactical Analysis for 1 minute. Its predictive algorithms fail against truly random actions (wild magic, chaos effects). An artificer can attempt to reprogram it (DC 20). Destroying the clockwork brain in its chest (called shot, AC 22) shuts it down instantly.',
    loreHook: 'The artificer\'s tower is under new management. The Clockwork Strategist was built to protect it — but the artificer is dead, and the construct has decided the best way to protect the tower is to eliminate all potential threats within a five-mile radius.',
    tags: ['construct'],
    canParley: false,
    languages: ['Common', 'any 3 languages programmed by creator'],
    lootTableRef: 'construct_elite'
  },
  {
    ref: 'doppelganger_hive',
    name: 'Doppelgänger Hive',
    cr: 9,
    tier: 'elite',
    maxHp: 155,
    ac: 16,
    speed: 30,
    stats: { MIGHT: 14, AGILITY: 18, WITS: 16, GRIT: 16, CHARM: 20 },
    saveProficiencies: ['CHARM', 'WITS', 'AGILITY'],
    resistances: { psychic: 'immune' },
    conditionImmunities: ['charmed', 'frightened'],
    actions: [
      { name: 'Identity Slash', toHit: 8, damage: '2d8+4', type: 'psychic', range: null, save: null, conditions: ['confused'], recharge: null },
      { name: 'Fracture Self', toHit: null, damage: '0', type: 'force', range: null, save: null, conditions: [], recharge: 5 },
      { name: 'Memory Drain', toHit: null, damage: '4d8', type: 'psychic', range: 30, save: { stat: 'WITS', dc: 17, halfOnSave: true }, conditions: ['memory_fog', 'confused'], recharge: 6 }
    ],
    multiattack: ['Identity Slash', 'Identity Slash'],
    legendaryActions: null,
    lairActions: null,
    reactions: [{ name: 'Body Double', trigger: 'Hit by an attack', effect: 'A duplicate absorbs the hit and dissolves (negates up to 20 damage). Usable 3/day.' }],
    traits: ['Shapechanger (perfect copy of any Medium humanoid)', 'Fracture Self (splits into 2-3 copies, each with 40 HP)', 'Read Thoughts', 'Hive Mind (all copies share awareness)', 'Ambiguity'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 17,
      spellAttack: 9,
      slots: { 1: 4, 2: 3, 3: 3, 4: 2 },
      knownSpells: ['charm person', 'disguise self', 'detect thoughts', 'suggestion', 'modify memory', 'dominate person', 'greater invisibility']
    },
    gear: null,
    senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: 30 },
    habitat: 'urban',
    ecology: 'Not one doppelgänger but a colonial organism — a single consciousness spread across multiple bodies. It can fracture into copies, each carrying part of the original. It infiltrates cities by replacing multiple people simultaneously, building power networks. When one body is discovered, the others continue. Nearly impossible to root out.',
    behavior: 'Begins disguised among the party or NPCs. Memory Drain to steal identities. Fracture Self when discovered — now there are three of it. Identity Slash with confusion. Body Double absorbs lethal hits. Dominate Person to turn allies. The real challenge is knowing which one is the original.',
    encounterSign: 'Two of the same person in different places. People who know things they shouldn\'t. A spy network that keeps reforming after every purge. Key figures whose behavior subtly shifts.',
    socialStructure: 'Singular hive mind operating 3-8 bodies simultaneously',
    physicalDescription: 'In true form — a pale, featureless humanoid with gray skin and hollow eye sockets. Each copy is identical. In disguise — perfect replicas of specific individuals, down to voice, mannerisms, and memories. The copies can be anywhere in a city.',
    weakness: 'True Seeing reveals all copies. Killing ALL copies simultaneously (within 1 round) destroys the hive. Zone of Truth identifies the copies. If the original core body is destroyed (identifiable by truesight — it has slightly different aura), all copies dissolve. Anti-magic zones prevent shapeshifting.',
    loreHook: 'The spymaster was seen in three different locations on the same night. That\'s impossible — unless there are three of him. Or none. The real spymaster might already be dead.',
    tags: ['aberration', 'humanoid'],
    canParley: true,
    languages: ['Common', 'any 5 languages of copied individuals', 'telepathy 60 ft.'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'entropic_sphinx',
    name: 'Entropic Sphinx',
    cr: 10,
    tier: 'elite',
    maxHp: 190,
    ac: 18,
    speed: 40,
    stats: { MIGHT: 20, AGILITY: 14, WITS: 22, GRIT: 18, CHARM: 18 },
    saveProficiencies: ['WITS', 'GRIT', 'CHARM'],
    resistances: { entropic: 'immune', psychic: 'immune', force: 'resistant' },
    conditionImmunities: ['charmed', 'frightened', 'confused'],
    actions: [
      { name: 'Entropy Claw', toHit: 9, damage: '2d10+5', type: 'entropic', range: null, save: null, conditions: ['weakened'], recharge: null },
      { name: 'Riddle of Unmaking', toHit: null, damage: '6d8', type: 'psychic', range: 60, save: { stat: 'WITS', dc: 18, halfOnSave: true }, conditions: ['stunned', 'confused'], recharge: 5 },
      { name: 'Temporal Distortion', toHit: null, damage: '4d8', type: 'entropic', range: 30, save: { stat: 'GRIT', dc: 18, halfOnSave: true }, conditions: ['slowed', 'weakened'], recharge: 6 }
    ],
    multiattack: ['Entropy Claw', 'Entropy Claw'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Claw Attack', cost: 1, effect: 'Makes one Entropy Claw attack' },
        { name: 'Temporal Rewind', cost: 2, effect: 'Reverses time for itself — resets position and HP to what they were at start of last round' },
        { name: 'Entropy Pulse', cost: 3, effect: 'All creatures within 20 feet must make DC 18 GRIT save or age 1d10 years and take 3d10 entropic damage' }
      ]
    },
    lairActions: [
      { name: 'Time Dilation', effect: 'One creature in the lair must make DC 16 WITS save or lose its next turn (time skips around it)' },
      { name: 'Decay Zone', effect: 'A 20-foot area ages rapidly — equipment must save DC 15 or degrade, vegetation dies, stone crumbles' }
    ],
    reactions: [{ name: 'Paradox', trigger: 'A creature answers its riddle incorrectly', effect: 'Target takes 4d10 psychic damage and is aged 5 years' }],
    traits: ['Legendary Resistance (3/day)', 'Magic Resistance', 'Entropy Aura (10 ft. — aging and decay)', 'Sphinx\'s Riddle', 'Temporal Sight'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      knownSpells: ['detect magic', 'identify', 'dispel magic', 'remove curse', 'banishment', 'legend lore', 'scrying', 'wall of force', 'modify memory']
    },
    gear: null,
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: 120 },
    habitat: 'ruins',
    ecology: 'A sphinx whose domain is entropy — the inevitable decay of all things. It guards crossroads of time, testing travelers with riddles about impermanence, death, and the nature of endings. Unlike other sphinxes, it does not protect treasure — it protects transitions. Passing it means accepting that what comes next cannot be undone.',
    behavior: 'Poses the Riddle of Unmaking first. Correct answers earn passage; wrong answers earn Paradox damage. If attacked, it fights with terrifying efficiency. Temporal Rewind makes it difficult to whittle down. Entropy Pulse ages the party. Temporal Distortion slows everyone. It fights as if time is irrelevant — because for it, it is.',
    encounterSign: 'A ruin where time moves differently — one room is spring, the next is winter. Aged corpses of people who were young yesterday. A voice that asks questions from everywhere at once.',
    socialStructure: 'Solitary guardian of a temporal crossroads',
    physicalDescription: 'A massive sphinx with a humanoid face that shifts between ages — young, old, ancient, young again. Its fur is streaked with gray that moves. Where it steps, grass withers. Its wings are made of frozen moments — you can see snapshots of the past in the feathers.',
    weakness: 'Answering its riddle correctly bypasses combat entirely. Temporal magic (haste) disrupts its control. Radiant damage represents timeless order — deals extra damage. Young creatures (children, newly created) are immune to its aging effects.',
    loreHook: 'The ruins of the Time Gate have a new guardian. It asks a riddle: "What grows stronger as it destroys?" Those who answer wrong come out aged to dust. Those who answer right come out... different. Changed. Like they\'ve seen something they can\'t unsee.',
    tags: ['aberration'],
    canParley: true,
    languages: ['Common', 'Celestial', 'Abyssal', 'Primordial', 'Deep Speech', 'telepathy 120 ft.'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'necropolis_gate',
    name: 'Necropolis Gate',
    cr: 10,
    tier: 'elite',
    maxHp: 200,
    ac: 18,
    speed: 0,
    stats: { MIGHT: 22, AGILITY: 4, WITS: 16, GRIT: 22, CHARM: 16 },
    saveProficiencies: ['GRIT', 'CHARM', 'MIGHT'],
    resistances: { necrotic: 'immune', poison: 'immune', bludgeoning: 'resistant', slashing: 'resistant', piercing: 'resistant', radiant: 'vulnerable' },
    conditionImmunities: ['poisoned', 'charmed', 'frightened', 'stunned', 'prone', 'exhaustion'],
    actions: [
      { name: 'Grave Grasp', toHit: 10, damage: '3d10+6', type: 'necrotic', range: 20, save: null, conditions: ['grappled', 'max_hp_reduced'], recharge: null },
      { name: 'Soul Vortex', toHit: null, damage: '5d8', type: 'necrotic', range: 30, save: { stat: 'CHARM', dc: 18, halfOnSave: true }, conditions: ['frightened', 'weakened'], recharge: 5 },
      { name: 'Summon Dead', toHit: null, damage: '0', type: 'necrotic', range: 60, save: null, conditions: [], recharge: 6 }
    ],
    multiattack: ['Grave Grasp', 'Grave Grasp'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Grave Grasp', cost: 1, effect: 'Makes one Grave Grasp attack' },
        { name: 'Raise Dead', cost: 2, effect: 'Raises a creature that died within the last hour as a zombie under its control (max 4 zombies at once)' },
        { name: 'Death Pulse', cost: 3, effect: 'All creatures within 30 feet take 4d8 necrotic damage (GRIT DC 18 for half) and undead allies heal that amount' }
      ]
    },
    lairActions: [
      { name: 'Tombstone Eruption', effect: 'Gravestones erupt from the ground in a 20-foot area — difficult terrain and 2d6 bludgeoning damage (AGILITY DC 16 to avoid)' },
      { name: 'Necrotic Fog', effect: 'Fog fills a 30-foot area — living creatures inside take 2d6 necrotic damage at start of turn, undead heal 2d6' }
    ],
    reactions: [{ name: 'Death Ward', trigger: 'An undead ally within 30 feet is destroyed', effect: 'Absorbs the energy — heals 20 HP' }],
    traits: ['Immovable', 'Gate Between Worlds (portal to the realm of the dead)', 'Command Undead (all undead within 120 ft.)', 'Legendary Resistance (3/day)', 'Necrotic Empowerment'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 60, tremorsense: null, truesight: 60 },
    habitat: 'dungeon',
    ecology: 'A massive architectural construct — a gateway between the world of the living and the realm of the dead. It\'s not a creature so much as a location that has become sentient. The gate draws undead to it, commands them, and draws energy from every death nearby. Sealing or destroying it requires entering the gate itself.',
    behavior: 'Immovable — the party must come to it. Double Grave Grasp to pull targets toward the gate. Soul Vortex for mass necrotic damage. Summon Dead to flood the field with undead. Raise Dead to turn fallen allies against the party. Death Pulse heals undead while damaging living. An attrition nightmare.',
    encounterSign: 'An ancient doorway that leads nowhere but radiates cold. Undead gathering from miles around, drawn to a single point. The air smells of graves. A hum that sounds like funeral chants.',
    socialStructure: 'Central hub commanding 10-30 undead within its sphere of influence',
    physicalDescription: 'A massive stone archway thirty feet tall, carved with skulls, bones, and funerary inscriptions in a dead language. The space within the arch is a swirling void of dark energy. Skeletal arms reach from the gate. Spectral faces press against the veil. It pulses with every heartbeat nearby.',
    weakness: 'Radiant damage is doubled and disrupts its command of undead for 1 round. Closing the gate requires a ritual performed on both sides simultaneously. Holy ground within 30 feet weakens it. It can\'t move — if you can stay out of its 30-foot effective range, it\'s helpless.',
    loreHook: 'The gate opened three days ago. The dead are walking. Not just here — everywhere within a day\'s ride. The gate is a door, and something on the other side is pushing it open. We need to close it from inside.',
    tags: ['construct', 'undead'],
    canParley: false,
    languages: ['understands all languages but speaks only the language of the dead'],
    lootTableRef: 'undead_elite'
  },
  {
    ref: 'fissure_drake',
    name: 'Fissure Drake',
    cr: 8,
    tier: 'elite',
    maxHp: 165,
    ac: 17,
    speed: 40,
    stats: { MIGHT: 20, AGILITY: 12, WITS: 10, GRIT: 18, CHARM: 8 },
    saveProficiencies: ['GRIT', 'MIGHT', 'AGILITY'],
    resistances: { fire: 'immune', bludgeoning: 'resistant' },
    conditionImmunities: ['burning', 'frightened', 'prone'],
    actions: [
      { name: 'Magma Bite', toHit: 9, damage: '2d12+5', type: 'fire', range: null, save: null, conditions: ['burning'], recharge: null },
      { name: 'Tail Crush', toHit: 9, damage: '2d8+5', type: 'bludgeoning', range: 10, save: null, conditions: ['prone'], recharge: null },
      { name: 'Fissure Breath', toHit: null, damage: '6d8', type: 'fire', range: 40, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['burning', 'prone'], recharge: 5 }
    ],
    multiattack: ['Magma Bite', 'Tail Crush'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Tail Attack', cost: 1, effect: 'Makes one Tail Crush attack' },
        { name: 'Magma Surge', cost: 2, effect: 'Lava erupts in a 15-foot radius around the drake — 3d8 fire damage (AGILITY DC 16 for half)' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Heated Scales', trigger: 'Hit by a melee attack', effect: 'Attacker takes 2d6 fire damage from superheated scales' }],
    traits: ['Lava Swim (60 ft.)', 'Heated Body', 'Siege Monster', 'Earth Tremor (movement causes difficult terrain)'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 30, tremorsense: 120, truesight: null },
    habitat: 'volcanic',
    ecology: 'Massive drakes that live in volcanic fissures, using tectonic heat to fuel their devastating breath weapon. They\'re territorial over mineral-rich calderas and magma vents. Their movement cracks the ground beneath them. Among the most physically powerful drakes, compensating for their lack of true flight with raw destructive force.',
    behavior: 'Multiattack with Magma Bite and Tail Crush. Fissure Breath on grouped enemies. Magma Surge creates lava pools around itself. Heated Scales punish melee. Earth Tremor makes the ground difficult. Retreats into lava if severely wounded. Emerges to ambush from below.',
    encounterSign: 'The ground cracking in a line — something large moving underground. Volcanic vents opening where there were none. Tremors that follow a pattern. A drake-shaped heat signature in the lava.',
    socialStructure: 'Solitary, fiercely territorial over a volcanic caldera',
    physicalDescription: 'A massive, wingless drake forty feet long with obsidian-black scales shot through with glowing cracks of magma. Its body generates enough heat to crack stone. Where it walks, the ground splits and lava seeps up. Its breath is a jet of liquid rock.',
    weakness: 'Cold damage is doubled and seals the magma cracks in its scales — reduces all fire damage by half for 1 round. Water causes steam explosions (deals damage to both the drake and nearby creatures). Away from volcanic terrain, it can\'t use Lava Swim for escape.',
    loreHook: 'The mining colony sits above a volcanic fissure — one that was dormant. Something woke it up. The tremors follow a pattern: circling, territorial. A drake has claimed the caldera. The mining operation is in its living room.',
    tags: ['beast', 'dragon', 'elemental'],
    canParley: false,
    languages: null,
    lootTableRef: 'dragon_elite'
  },
  {
    ref: 'thought_collective',
    name: 'Thought Collective',
    cr: 9,
    tier: 'elite',
    maxHp: 140,
    ac: 15,
    speed: 0,
    stats: { MIGHT: 6, AGILITY: 14, WITS: 22, GRIT: 14, CHARM: 18 },
    saveProficiencies: ['WITS', 'CHARM', 'GRIT'],
    resistances: { psychic: 'immune', force: 'resistant', bludgeoning: 'immune', slashing: 'immune', piercing: 'immune' },
    conditionImmunities: ['charmed', 'frightened', 'stunned', 'prone', 'grappled', 'restrained', 'poisoned'],
    actions: [
      { name: 'Mind Blast', toHit: null, damage: '5d8', type: 'psychic', range: 60, save: { stat: 'WITS', dc: 18, halfOnSave: true }, conditions: ['stunned'], recharge: 5 },
      { name: 'Psychic Lance', toHit: 10, damage: '3d8+6', type: 'psychic', range: 60, save: null, conditions: [], recharge: null },
      { name: 'Dominate', toHit: null, damage: '0', type: 'psychic', range: 30, save: { stat: 'CHARM', dc: 18, halfOnSave: false }, conditions: ['charmed'], recharge: 6 }
    ],
    multiattack: ['Psychic Lance', 'Psychic Lance'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Psychic Lance', cost: 1, effect: 'Makes one Psychic Lance attack' },
        { name: 'Thought Shield', cost: 1, effect: 'Gains resistance to the next damage source it takes' },
        { name: 'Neural Override', cost: 3, effect: 'One creature within 30 feet must make DC 18 WITS save or the Collective controls its next action' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Psychic Feedback', trigger: 'A creature within 30 feet deals psychic damage to it', effect: 'Attacker takes equal psychic damage' }],
    traits: ['Incorporeal Movement', 'Fly (30 ft.)', 'Collective Mind', 'Legendary Resistance (2/day)', 'Hive Awareness', 'Psionic Nature'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      knownSpells: ['detect thoughts', 'shield', 'hold person', 'suggestion', 'counterspell', 'telekinesis', 'modify memory', 'dominate person', 'wall of force']
    },
    gear: null,
    senses: { darkvision: 120, blindsight: 60, tremorsense: null, truesight: 120 },
    habitat: 'planar',
    ecology: 'Not a single entity but a gestalt consciousness — hundreds of absorbed minds fused into a psychic whole. It began as one mind flayer\'s experiment and grew as it absorbed more. Now it\'s a floating psychic storm that devours consciousness. Each mind it absorbs makes it stronger. It can manifest as a swirling cloud of psychic energy.',
    behavior: 'Mind Blast to stun the group. Double Psychic Lance on stunned targets. Dominate the strongest fighter. Neural Override for precise control. Wall of Force to divide the party. Incorporeal — immune to physical weapons. Psychic Feedback punishes other psychics. The fight is entirely mental.',
    encounterSign: 'Mass headaches in a specific area. People losing memories — fragments of themselves disappearing. A humming sound that only psychically sensitive individuals hear. The feeling of many voices whispering just below consciousness.',
    socialStructure: 'Singular gestalt entity',
    physicalDescription: 'A shimmering cloud of psychic energy — translucent and aurora-like. Within it, faint faces appear and dissolve — the absorbed minds. It communicates through projected thoughts. When it attacks, tendrils of psychic force extend like ghostly hands.',
    weakness: 'Anti-magic field forces it to materialize and become vulnerable to physical attacks. Mindless creatures (constructs, oozes) are immune to its abilities. Severing the absorbed minds (via Greater Restoration on the cloud) weakens it. Intelligence of 5 or lower is immune to Mind Blast.',
    loreHook: 'The research station studying psychic phenomena has gone silent. The researchers are alive — technically. They\'re smiling. They speak in unison. They say "we" instead of "I." Something absorbed them. And it\'s still growing.',
    tags: ['aberration'],
    canParley: true,
    languages: ['telepathy 120 ft.', 'all languages known by absorbed minds'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'ghost_ship_hull',
    name: 'Ghost Ship Hull',
    cr: 8,
    tier: 'elite',
    maxHp: 180,
    ac: 16,
    speed: 0,
    stats: { MIGHT: 22, AGILITY: 6, WITS: 12, GRIT: 20, CHARM: 14 },
    saveProficiencies: ['GRIT', 'MIGHT', 'CHARM'],
    resistances: { cold: 'immune', necrotic: 'immune', bludgeoning: 'resistant', slashing: 'resistant', piercing: 'resistant' },
    conditionImmunities: ['poisoned', 'charmed', 'prone', 'exhaustion', 'stunned'],
    actions: [
      { name: 'Crushing Ram', toHit: 10, damage: '3d10+6', type: 'bludgeoning', range: null, save: null, conditions: ['prone', 'stunned'], recharge: null },
      { name: 'Spectral Cannon', toHit: null, damage: '4d8', type: 'necrotic', range: 60, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['frightened'], recharge: 5 },
      { name: 'Crew Manifestation', toHit: null, damage: '0', type: 'necrotic', range: 30, save: null, conditions: [], recharge: 6 }
    ],
    multiattack: null,
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Ghostly Rigging', cost: 1, effect: 'Spectral ropes grapple one creature within 20 feet (DC 16 MIGHT to escape)' },
        { name: 'Keel Haul', cost: 2, effect: 'A grappled creature is dragged under the hull — 4d6 bludgeoning + 2d6 cold damage, then released prone' }
      ]
    },
    lairActions: [
      { name: 'Fog Bank', effect: 'Supernatural fog obscures a 60-foot radius — heavily obscured to living creatures, transparent to undead' },
      { name: 'Whirlpool', effect: 'One creature in water within 60 feet must make DC 16 MIGHT save or be pulled 20 feet toward the hull' }
    ],
    reactions: null,
    traits: ['Swim (40 ft.)', 'Ghost Ship (moves on land and water as if sailing)', 'Spectral Crew', 'Legendary Resistance (2/day)', 'Undead Vessel'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 60, tremorsense: null, truesight: null },
    habitat: 'coastal',
    ecology: 'The animated wreck of a sunken ship, risen as an undead entity. The hull itself is the creature — the crew are manifestations of its will. It sails without wind, on water or land, hunting the living to add to its ghostly crew. Each victim joins the spectral complement.',
    behavior: 'Crushing Ram on approach. Spectral Cannon at range. Crew Manifestation summons 3-4 spectral sailors to board and fight. Ghostly Rigging grapples from the deck. Keel Haul for devastating single-target damage. Fog Bank to hide and confuse. This is a set-piece encounter — the ship is the boss.',
    encounterSign: 'A ship on the horizon sailing against the wind. A vessel that appears in fog and disappears when it clears. The sound of creaking rigging and phantom crew from empty water. Ships that vanish with all hands — the hull found later, empty.',
    socialStructure: 'The ship is the entity, spectral crew are extensions of its will',
    physicalDescription: 'A rotting warship wreathed in spectral fog. Its sails are tattered and glow with ghostly light. Phantom crew work the rigging. The figurehead is a screaming face. It moves without wind or current, tilting at impossible angles. Barnacles and coral encrust its hull. It looks like it was underwater for centuries.',
    weakness: 'Radiant damage is doubled and disperses spectral crew. Fire damages the wooden hull normally and prevents regeneration. Finding and destroying the ship\'s log (hidden in the captain\'s quarters) lays the ship to rest. Holy water poured on the keel deals 4d10 radiant damage.',
    loreHook: 'The ghost ship has been sighted again. It\'s heading for the harbor. The harbor master says it comes every generation — and every time, it takes a ship\'s worth of crew to replace its own. This time, it\'s heading straight for the navy dock.',
    tags: ['undead', 'construct'],
    canParley: false,
    languages: ['understands Common but cannot speak'],
    lootTableRef: 'undead_elite'
  },
  {
    ref: 'gravity_kraken',
    name: 'Gravity Kraken',
    cr: 10,
    tier: 'elite',
    maxHp: 195,
    ac: 17,
    speed: 30,
    stats: { MIGHT: 22, AGILITY: 12, WITS: 16, GRIT: 20, CHARM: 10 },
    saveProficiencies: ['MIGHT', 'GRIT', 'WITS'],
    resistances: { force: 'immune', bludgeoning: 'resistant', psychic: 'resistant' },
    conditionImmunities: ['prone', 'restrained', 'grappled'],
    actions: [
      { name: 'Gravity Tentacle', toHit: 10, damage: '2d10+6', type: 'force', range: 20, save: null, conditions: ['grappled'], recharge: null },
      { name: 'Gravity Well', toHit: null, damage: '4d10', type: 'force', range: 40, save: { stat: 'MIGHT', dc: 18, halfOnSave: true }, conditions: ['restrained', 'prone'], recharge: 5 },
      { name: 'Singularity', toHit: null, damage: '6d8', type: 'force', range: 30, save: { stat: 'MIGHT', dc: 18, halfOnSave: true }, conditions: ['teleported', 'prone'], recharge: 6 }
    ],
    multiattack: ['Gravity Tentacle', 'Gravity Tentacle', 'Gravity Tentacle'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Tentacle', cost: 1, effect: 'Makes one Gravity Tentacle attack' },
        { name: 'Gravitational Shift', cost: 2, effect: 'Changes gravity direction in a 30-foot area — all creatures fall toward a wall or ceiling (3d6 bludgeoning)' },
        { name: 'Dimensional Grasp', cost: 3, effect: 'Reaches through a portal — grabs a creature within 60 feet and teleports it adjacent to the kraken' }
      ]
    },
    lairActions: [
      { name: 'Zero Gravity Zone', effect: 'A 20-foot sphere of zero gravity forms — creatures inside float helplessly (AGILITY DC 16 to grab something and stay anchored)' },
      { name: 'Gravity Crush', effect: 'Gravity doubles in a 20-foot area — creatures take 2d8 bludgeoning and speed is halved (GRIT DC 16 to resist)' }
    ],
    reactions: [{ name: 'Gravitational Deflection', trigger: 'Targeted by a ranged attack or spell', effect: 'Bends the projectile\'s trajectory — attack has disadvantage' }],
    traits: ['Fly (40 ft. — gravitational levitation)', 'Legendary Resistance (3/day)', 'Gravitational Field', 'Dimensional Tentacles', 'Gravity Manipulation'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 60, tremorsense: null, truesight: 60 },
    habitat: 'planar',
    ecology: 'A cephalopod entity from a dimension where gravity is a living force. Its tentacles extend through micro-portals, bending space to grasp prey across distances. It levitates by manipulating gravitational fields around itself. Drawn to locations where gravity behaves anomalously — planar rifts, floating islands, deep caverns with variable gravity.',
    behavior: 'Triple Gravity Tentacle — grapples from across the room. Gravity Well to pin down the group. Singularity to crush everything toward a point. Gravitational Shift to weaponize the room. Dimensional Grasp to snatch targets from behind cover. Gravity Crush and Zero Gravity in its lair. A spatial control nightmare.',
    encounterSign: 'Objects floating upward in a specific area. Gravity behaving erratically — lighter one step, crushing the next. Small items being pulled sideways. The ceiling has footprints on it.',
    socialStructure: 'Solitary interdimensional predator',
    physicalDescription: 'An enormous cephalopod floating in mid-air, its body surrounded by a shimmer of gravitational distortion. Eight tentacles of varying length phase in and out of small portals. Its eye is a swirling vortex of gravitational force. Objects orbit it like a planet\'s rings — debris caught in its field.',
    weakness: 'Force damage is immune — but dimensional anchor prevents its tentacles from phasing through portals. Feather Fall and similar effects negate gravity manipulation. Banishment sends it home. In a null-gravity environment, it loses its manipulation advantage.',
    loreHook: 'The floating islands used to be stable. Now they\'re crashing together — something is pulling them. Gravity is broken in the archipelago. And there are tentacles reaching between the islands, grabbing everything that moves.',
    tags: ['aberration'],
    canParley: false,
    languages: ['Deep Speech', 'telepathy 60 ft.'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'ember_colossus',
    name: 'Ember Colossus',
    cr: 10,
    tier: 'elite',
    maxHp: 210,
    ac: 18,
    speed: 30,
    stats: { MIGHT: 24, AGILITY: 8, WITS: 10, GRIT: 22, CHARM: 8 },
    saveProficiencies: ['MIGHT', 'GRIT'],
    resistances: { fire: 'immune', bludgeoning: 'resistant', slashing: 'resistant', piercing: 'resistant', cold: 'vulnerable' },
    conditionImmunities: ['poisoned', 'charmed', 'frightened', 'stunned', 'exhaustion', 'burning'],
    actions: [
      { name: 'Molten Fist', toHit: 11, damage: '3d10+7', type: 'fire', range: 10, save: null, conditions: ['burning', 'prone'], recharge: null },
      { name: 'Eruption Stomp', toHit: null, damage: '5d8', type: 'fire', range: 20, save: { stat: 'AGILITY', dc: 18, halfOnSave: true }, conditions: ['prone', 'burning'], recharge: 5 },
      { name: 'Magma Volley', toHit: null, damage: '4d8', type: 'fire', range: 60, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['burning'], recharge: null }
    ],
    multiattack: ['Molten Fist', 'Molten Fist'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Magma Volley', cost: 1, effect: 'Hurls a ball of magma at a target within 60 feet' },
        { name: 'Lava Trail', cost: 2, effect: 'Its path becomes a 10-foot-wide lava trail — 3d6 fire damage to any creature that crosses it. Lasts 3 rounds.' },
        { name: 'Pyroclastic Burst', cost: 3, effect: 'All creatures within 30 feet make DC 18 AGILITY save or take 4d10 fire damage and are pushed 15 feet back' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Molten Shell', trigger: 'Takes cold damage', effect: 'Its outer shell cracks and reforms — all creatures within 10 feet take 2d8 fire damage from escaping magma' }],
    traits: ['Siege Monster', 'Heated Body (2d6 fire to melee attackers)', 'Molten Core', 'Legendary Resistance (2/day)', 'Fire Absorption'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: null, tremorsense: 60, truesight: null },
    habitat: 'volcanic',
    ecology: 'A towering elemental of solidified magma and living fire — thirty feet tall, a walking volcanic eruption. Born from the collision of the Elemental Plane of Fire and Earth, these entities are rare and devastating. They reshape landscapes as they walk, leaving trails of cooling lava. Ancient ones become literal mountains.',
    behavior: 'Double Molten Fist for devastating damage. Eruption Stomp when surrounded. Lava Trail to control the battlefield with terrain. Pyroclastic Burst to clear space. Magma Volley at range. Heated Body and Molten Shell make melee suicidal for unprotected fighters. Just walks forward, destroying everything.',
    encounterSign: 'The horizon glows orange. Ground trembling in rhythm. A plume of ash rising from where no volcano exists. Lava trails leading from the mountains into farmland.',
    socialStructure: 'Solitary — nothing willingly stands near it',
    physicalDescription: 'A thirty-foot humanoid of black volcanic rock, fissures of bright magma visible through cracks. Its "face" is a caldera that belches fire. Where it walks, the ground melts. Ash and cinders rain from it constantly. The air shimmers with heat for fifty feet in every direction.',
    weakness: 'Cold damage is doubled and temporarily seals magma cracks — reduces fire damage for 1 round. Massive amounts of water create steam explosions but deal significant damage over time. Its slow speed (30) means mobile parties can kite it. It sinks in deep water.',
    loreHook: 'It walked out of the volcano three days ago. It\'s heading toward the capital. The army has tried arrows, catapults, and magic. Nothing stops it. It\'s not attacking on purpose — it just doesn\'t notice us. The capital is on its path. We have six days.',
    tags: ['elemental'],
    canParley: false,
    languages: ['Primordial'],
    lootTableRef: 'elemental_elite'
  },
  {
    ref: 'ironbound_lich',
    name: 'Ironbound Lich',
    cr: 10,
    tier: 'elite',
    maxHp: 175,
    ac: 18,
    speed: 30,
    stats: { MIGHT: 12, AGILITY: 14, WITS: 22, GRIT: 16, CHARM: 18 },
    saveProficiencies: ['WITS', 'CHARM', 'GRIT'],
    resistances: { necrotic: 'immune', poison: 'immune', cold: 'resistant', psychic: 'resistant', radiant: 'vulnerable' },
    conditionImmunities: ['poisoned', 'charmed', 'frightened', 'exhaustion', 'paralyzed'],
    actions: [
      { name: 'Paralyzing Touch', toHit: 10, damage: '3d8+6', type: 'necrotic', range: null, save: { stat: 'GRIT', dc: 18, halfOnSave: false }, conditions: ['paralyzed'], recharge: null },
      { name: 'Soul Cage', toHit: null, damage: '5d10', type: 'necrotic', range: 30, save: { stat: 'CHARM', dc: 18, halfOnSave: true }, conditions: ['max_hp_reduced', 'weakened'], recharge: 5 },
      { name: 'Iron Command', toHit: null, damage: '0', type: 'force', range: 60, save: null, conditions: [], recharge: 6 }
    ],
    multiattack: null,
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Cantrip', cost: 1, effect: 'Casts a cantrip-level spell' },
        { name: 'Paralyzing Touch', cost: 2, effect: 'Makes one Paralyzing Touch attack' },
        { name: 'Iron Will', cost: 3, effect: 'Forces all iron and steel within 30 feet to move — armored creatures are restrained (DC 18 MIGHT to resist), weapons fly toward the lich' }
      ]
    },
    lairActions: [
      { name: 'Necromantic Surge', effect: 'One creature in the lair must make DC 17 GRIT save or take 3d8 necrotic damage as the lair drains life force' },
      { name: 'Animate Object', effect: 'An object in the lair animates and attacks a creature — +8 to hit, 2d8 bludgeoning damage' }
    ],
    reactions: [{ name: 'Counterspell', trigger: 'A creature within 60 feet casts a spell', effect: 'Automatically counters spells of 4th level or lower. Higher levels require a WITS check (DC 10 + spell level).' }],
    traits: ['Legendary Resistance (3/day)', 'Rejuvenation (reforms at phylactery in 1d10 days)', 'Iron Mastery (telekinetic control of metal)', 'Magic Resistance', 'Turn Resistance', 'Phylactery Bond'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      knownSpells: ['shield', 'magic missile', 'mirror image', 'misty step', 'counterspell', 'animate dead', 'fireball', 'dimension door', 'wall of force', 'cloudkill', 'telekinesis']
    },
    gear: [{ ref: 'iron_crown', slot: 'head' }, { ref: 'lich_robes', slot: 'torso' }],
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: 60 },
    habitat: 'dungeon',
    ecology: 'A lich who specialized in ferromancy — the magical manipulation of iron and metal. Its phylactery is forged from meteoric iron, and its mastery over metal gives it unique advantages against armored foes. It commands a fortress of animated metal, where every sword, shield, and piece of armor can become a weapon against its wielder.',
    behavior: 'Counterspell enemy magic. Iron Will to weaponize the party\'s own equipment. Soul Cage for massive necrotic damage. Paralyzing Touch via legendary action. Wall of Force to divide the party. Iron Command summons animated weapon swarms. The lair actively attacks. Dimension Door to escape and reset if needed.',
    encounterSign: 'Metal objects vibrating in a specific direction. Compasses spinning wildly. The ruins of an iron fortress that shouldn\'t exist in this terrain. Skeletons in rusted armor, still standing at attention.',
    socialStructure: 'Lord of an iron fortress with undead servitors and animated metal constructs',
    physicalDescription: 'A skeletal figure in robes of woven iron wire, wearing a crown of meteoric iron. Metal orbits it — nails, fragments, chains — in a slow carousel. Its eye sockets contain spinning iron spheres. When it speaks, its jaw moves with mechanical precision.',
    weakness: 'The phylactery must be destroyed to kill it permanently. Non-metallic weapons bypass Iron Mastery. Dispel Magic on its Iron Will frees armored allies. Its phylactery is meteoric iron — found somewhere in the fortress. Wood, stone, and bone weapons are ideal.',
    loreHook: 'The iron fortress appeared overnight. It rose from the ground — a tower of metal. The lich inside has been dead for centuries but its phylactery survived. Now it\'s rebuilding. Every piece of iron in a ten-mile radius is being pulled toward the tower.',
    tags: ['undead'],
    canParley: true,
    languages: ['Common', 'Draconic', 'Abyssal', 'Celestial'],
    lootTableRef: 'undead_elite'
  },
  {
    ref: 'parasitic_godling',
    name: 'Parasitic Godling',
    cr: 10,
    tier: 'elite',
    maxHp: 185,
    ac: 16,
    speed: 30,
    stats: { MIGHT: 18, AGILITY: 14, WITS: 18, GRIT: 18, CHARM: 20 },
    saveProficiencies: ['CHARM', 'WITS', 'GRIT'],
    resistances: { radiant: 'resistant', necrotic: 'resistant', psychic: 'immune' },
    conditionImmunities: ['charmed', 'frightened', 'stunned'],
    actions: [
      { name: 'Divine Touch', toHit: 9, damage: '3d8+5', type: 'radiant', range: null, save: null, conditions: ['charmed'], recharge: null },
      { name: 'Faith Drain', toHit: null, damage: '5d8', type: 'psychic', range: 30, save: { stat: 'CHARM', dc: 18, halfOnSave: true }, conditions: ['despair', 'weakened'], recharge: 5 },
      { name: 'Miracle', toHit: null, damage: '0', type: 'radiant', range: 60, save: null, conditions: [], recharge: 6 }
    ],
    multiattack: ['Divine Touch', 'Divine Touch'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Divine Touch', cost: 1, effect: 'Makes one Divine Touch attack' },
        { name: 'Healing Aura', cost: 2, effect: 'Heals itself and all allies within 30 feet for 3d8 HP' },
        { name: 'Divine Wrath', cost: 3, effect: 'All enemies within 30 feet make DC 18 CHARM save or take 4d10 radiant damage and be blinded for 1 round' }
      ]
    },
    lairActions: [
      { name: 'Fervor', effect: 'All worshippers in the lair gain +2 to attacks and saves until next round' },
      { name: 'Guilt', effect: 'One creature must make DC 17 CHARM save or be unable to attack the godling until end of next turn (overwhelmed by guilt)' }
    ],
    reactions: [{ name: 'Martyr Shield', trigger: 'Targeted by an attack', effect: 'A worshipper within 10 feet jumps in front — takes the hit instead' }],
    traits: ['Legendary Resistance (3/day)', 'Faith Battery (grows stronger with more worshippers — +1 to all DCs per 5 worshippers present)', 'Miraculous (can cast any 3rd-level or lower cleric spell 1/day)', 'Parasitic Divinity', 'Worship Dependency'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      knownSpells: ['bless', 'cure wounds', 'hold person', 'spiritual weapon', 'spirit guardians', 'beacon of hope', 'banishment', 'death ward', 'flame strike']
    },
    gear: null,
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: 60 },
    habitat: 'urban',
    ecology: 'A being that feeds on worship itself. Not a true god but something that mimics divinity — answering prayers, performing miracles, healing the sick. All real. But each prayer feeds it, each miracle costs the worshipper a fragment of their will. Its congregation becomes a battery. A farm. It loves them, in its way. The way a shepherd loves sheep.',
    behavior: 'Surrounded by fanatical worshippers who shield it. Faith Drain to weaken resolve. Divine Touch charms attackers into worshippers. Miracle performs genuine healing to prove its divinity. Martyr Shield means worshippers die for it. Healing Aura sustains its followers. Killing it feels wrong — it looks like a god.',
    encounterSign: 'A new religion spreading impossibly fast. Genuine miracles. Worshippers with glazed devotion and declining health. A being of light that answers every prayer — for a price no one can see.',
    socialStructure: 'Central figure with a congregation of 20-100 devoted worshippers',
    physicalDescription: 'An impossibly beautiful humanoid figure radiating warm golden light. Its features shift to match the viewer\'s ideal of divinity. Floating slightly above the ground. When it speaks, you feel peace. When it touches you, your pain vanishes. Its eyes hold infinite compassion that might be hunger.',
    weakness: 'Without worshippers, its power fades rapidly — loses Faith Battery bonuses and eventually becomes mortal-level. Killing it in front of its congregation frees them but traumatizes them. Proving it\'s not a real god (via divine magic from a true deity) breaks its hold. Dispel Magic on individual worshippers frees them one at a time.',
    loreHook: 'The Temple of the New Light has real healers. Real miracles. The congregation is growing by hundreds. But the original worshippers — the first hundred — they\'re wasting away. And they\'re grateful for it.',
    tags: ['aberration', 'fey'],
    canParley: true,
    languages: ['all languages', 'telepathy 120 ft.'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'archive_golem',
    name: 'Archive Golem',
    cr: 8,
    tier: 'elite',
    maxHp: 175,
    ac: 18,
    speed: 25,
    stats: { MIGHT: 20, AGILITY: 8, WITS: 18, GRIT: 20, CHARM: 6 },
    saveProficiencies: ['GRIT', 'WITS', 'MIGHT'],
    resistances: { slashing: 'resistant', piercing: 'resistant', psychic: 'immune', poison: 'immune', fire: 'vulnerable' },
    conditionImmunities: ['poisoned', 'charmed', 'frightened', 'exhaustion', 'paralyzed'],
    actions: [
      { name: 'Tome Strike', toHit: 9, damage: '2d12+5', type: 'bludgeoning', range: null, save: null, conditions: [], recharge: null },
      { name: 'Word of Law', toHit: null, damage: '4d8', type: 'force', range: 30, save: { stat: 'WITS', dc: 17, halfOnSave: true }, conditions: ['restrained'], recharge: 5 },
      { name: 'Knowledge Drain', toHit: null, damage: '3d8', type: 'psychic', range: 30, save: { stat: 'WITS', dc: 17, halfOnSave: true }, conditions: ['spell_drained', 'confused'], recharge: 6 }
    ],
    multiattack: ['Tome Strike', 'Tome Strike'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Tome Strike', cost: 1, effect: 'Makes one Tome Strike attack' },
        { name: 'Catalogue', cost: 2, effect: 'Scans one creature within 60 feet — learns all its abilities, resistances, and weaknesses. Shares this with allies.' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Bibliographic Shield', trigger: 'Targeted by a spell it has seen before', effect: 'Gains advantage on the save — it knows the spell from its archives' }],
    traits: ['Constructed', 'Living Library (contains the knowledge of thousands of books)', 'Magic Resistance', 'Legendary Resistance (2/day)', 'Adaptive Defense'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 60, blindsight: 30, tremorsense: null, truesight: 60 },
    habitat: 'dungeon',
    ecology: 'A golem constructed from thousands of books and scrolls, animated by the collective knowledge they contain. It serves as both guardian and librarian — protecting an archive while cataloguing and organizing its contents. Unlike mindless golems, it has a form of intelligence drawn from its texts. It can read any language and knows the answer to almost any question.',
    behavior: 'Double Tome Strike. Word of Law to restrain intruders. Knowledge Drain to steal spell knowledge. Catalogue to analyze threats. Bibliographic Shield makes repeated spells less effective. It fights to protect its archive — damaging books nearby enrages it.',
    encounterSign: 'A library where books reshelve themselves in a specific order. Pages rustling with no wind. A massive figure made of bound volumes. Knowledge that shouldn\'t be available being offered to those who ask politely.',
    socialStructure: 'Solitary guardian of a major archive',
    physicalDescription: 'A ten-foot humanoid composed of interlocking books, scrolls, and tablets. Its head is a massive tome. Its arms are columns of rolled scrolls. Pages flutter around it like a bibliographic aura. When it speaks, it opens and text appears on its pages. When it fights, the books harden to stone.',
    weakness: 'Fire is devastating — it\'s made of paper. Water damages its texts, confusing it. Illiteracy is an advantage — creatures who can\'t read are immune to Word of Law. Destroying specific rare books in the archive weakens it (reduces HP by 20 per unique volume destroyed). It won\'t fight if the archive is threatened by fire.',
    loreHook: 'The Great Library has been sealed for three hundred years. The golem inside was supposed to protect the collection until the academy reopened. The academy never reopened. The golem has been cataloguing alone for three centuries. It has opinions now.',
    tags: ['construct'],
    canParley: true,
    languages: ['all written languages'],
    lootTableRef: 'construct_elite'
  },
  {
    ref: 'vampire_lord',
    name: 'Vampire Lord',
    cr: 9,
    tier: 'elite',
    maxHp: 165,
    ac: 17,
    speed: 35,
    stats: { MIGHT: 20, AGILITY: 18, WITS: 16, GRIT: 18, CHARM: 20 },
    saveProficiencies: ['AGILITY', 'CHARM', 'WITS'],
    resistances: { necrotic: 'immune', bludgeoning: 'resistant', slashing: 'resistant', piercing: 'resistant', radiant: 'vulnerable' },
    conditionImmunities: ['charmed', 'frightened', 'poisoned'],
    actions: [
      { name: 'Vampiric Claw', toHit: 9, damage: '2d8+5', type: 'necrotic', range: null, save: null, conditions: ['grappled'], recharge: null },
      { name: 'Bite', toHit: 9, damage: '2d6+5', type: 'piercing', range: null, save: null, conditions: ['max_hp_reduced'], recharge: null },
      { name: 'Charm Gaze', toHit: null, damage: '0', type: 'psychic', range: 30, save: { stat: 'CHARM', dc: 17, halfOnSave: false }, conditions: ['charmed'], recharge: null }
    ],
    multiattack: ['Vampiric Claw', 'Vampiric Claw'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Move', cost: 1, effect: 'Moves up to its speed without provoking opportunity attacks' },
        { name: 'Vampiric Claw', cost: 1, effect: 'Makes one Vampiric Claw attack' },
        { name: 'Bite (costs 2)', cost: 2, effect: 'Makes one Bite attack against a grappled target — heals HP equal to damage dealt' }
      ]
    },
    lairActions: [
      { name: 'Shadows Close In', effect: 'All light sources in the lair dim — bright light becomes dim, dim becomes darkness' },
      { name: 'Blood Call', effect: 'One creature in the lair with less than half HP must make DC 16 CHARM save or move toward the vampire' }
    ],
    reactions: [{ name: 'Misty Escape', trigger: 'Reduced to 0 HP', effect: 'Transforms to mist instead of falling — escapes to coffin to regenerate' }],
    traits: ['Regeneration (15 HP/round, stops with radiant or running water)', 'Spider Climb', 'Shapechanger (bat, mist, wolf)', 'Legendary Resistance (3/day)', 'Sunlight Hypersensitivity (20 radiant per round)', 'Forbiddance (can\'t enter uninvited)'],
    spellcasting: null,
    gear: [{ ref: 'noble_armor', slot: 'torso' }],
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'urban',
    ecology: 'An ancient vampire who has accumulated power and influence over centuries. They rule from the shadows — owning estates, commanding mortal servants, and turning select individuals into vampire spawn. Unlike feral vampires, lords retain their intelligence and charisma, making them more dangerous politically than physically.',
    behavior: 'Charm Gaze first to neutralize threats. Double Vampiric Claw to grapple. Bite grappled targets for HP drain. Legendary Move to avoid being cornered. Regeneration makes it incredibly durable. Misty Escape prevents true death unless cornered at the coffin. Fights intelligently and retreats freely.',
    encounterSign: 'A noble who only appears at night. Servants with bite marks who are fiercely loyal. An estate where no mirrors are hung. People going pale and listless in a specific neighborhood.',
    socialStructure: 'Lord with 2-4 vampire spawn and dozens of charmed mortal servants',
    physicalDescription: 'Supernaturally beautiful and ageless. Pale skin, dark hair, predatory grace. Impeccably dressed. Their canines are slightly too long. Their eyes have a hypnotic quality. They move with aristocratic poise that barely conceals the predator underneath.',
    weakness: 'Sunlight deals 20 radiant per round and prevents regeneration. Stake through the heart while in coffin permanently destroys. Running water deals 20 acid per round. Garlic repels. Must be invited to enter. Destroying the coffin prevents Misty Escape from saving it.',
    loreHook: 'The lord of the manor has lived there for two hundred years. That\'s not metaphorical — it\'s the same person. The town knows. They don\'t care. The lord provides for them. The price is one person per month. The town has decided that\'s acceptable.',
    tags: ['undead'],
    canParley: true,
    languages: ['Common', 'any 3 languages from life'],
    lootTableRef: 'undead_elite'
  },
  {
    ref: 'storm_giant_youth',
    name: 'Storm Giant Youth',
    cr: 8,
    tier: 'elite',
    maxHp: 175,
    ac: 16,
    speed: 40,
    stats: { MIGHT: 22, AGILITY: 12, WITS: 14, GRIT: 18, CHARM: 16 },
    saveProficiencies: ['MIGHT', 'GRIT', 'CHARM'],
    resistances: { lightning: 'immune', sonic: 'resistant', cold: 'resistant' },
    conditionImmunities: ['frightened', 'stunned'],
    actions: [
      { name: 'Storm Greatsword', toHit: 10, damage: '3d10+6', type: 'slashing', range: 10, save: null, conditions: [], recharge: null },
      { name: 'Lightning Strike', toHit: null, damage: '5d8', type: 'lightning', range: 60, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['stunned'], recharge: 5 },
      { name: 'Thunder Clap', toHit: null, damage: '3d8', type: 'sonic', range: 15, save: { stat: 'GRIT', dc: 17, halfOnSave: true }, conditions: ['deafened', 'prone'], recharge: null }
    ],
    multiattack: ['Storm Greatsword', 'Storm Greatsword'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Attack', cost: 1, effect: 'Makes one Storm Greatsword attack' },
        { name: 'Storm Call', cost: 2, effect: 'Calls lightning from the sky — one creature within 60 feet takes 3d10 lightning damage (AGILITY DC 16 for half)' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Instinctive Counter', trigger: 'Hit by a melee attack', effect: 'Makes a Thunder Clap centered on itself' }],
    traits: ['Amphibious', 'Storm Aura (10 ft.)', 'Innate Spellcasting', 'Legendary Resistance (2/day)'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 17,
      spellAttack: 9,
      slots: { 1: 4, 2: 3, 3: 2 },
      knownSpells: ['detect magic', 'shield', 'gust of wind', 'shatter', 'call lightning', 'water breathing']
    },
    gear: [{ ref: 'storm_greatsword', slot: 'mainHand' }, { ref: 'chain_mail_giant', slot: 'torso' }],
    senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'coastal',
    ecology: 'A young storm giant — the most powerful of giantkind — still in its adolescence but already devastating. Storm giant youths are sent from their underwater citadels on quests to prove their worth. They\'re proud, impulsive, and enormously powerful. Some befriend mortals; others view them as barely relevant.',
    behavior: 'Double Storm Greatsword for massive damage. Lightning Strike at range. Thunder Clap when surrounded or as Instinctive Counter. Storm Call via legendary action. Fights with youthful aggression — hasn\'t learned caution yet. Might parley if shown respect.',
    encounterSign: 'A storm that follows a single figure along the coast. Waves crashing impossibly high near a specific beach. A figure twenty feet tall standing in the surf, staring at a human settlement with curiosity.',
    socialStructure: 'Solitary on a proving quest',
    physicalDescription: 'Twenty feet tall with blue-purple skin and hair that crackles with static electricity. Eyes like stormclouds. Wears chain mail that shimmers with lightning. Carries a greatsword that could be a human\'s drawbridge. Young-faced despite its size — the equivalent of a teenager.',
    weakness: 'Its youth makes it impulsive and susceptible to flattery or challenge. Grounding effects reduce its lightning abilities. Insulting its lineage causes it to become reckless (attacks with advantage but grants advantage to enemies). It can be reasoned with — it\'s not evil, just powerful and inexperienced.',
    loreHook: 'A storm giant has claimed the lighthouse as its seat. It wants tribute — not gold, but stories. Interesting stories. The fishing fleet can\'t sail while it\'s there. It says it will leave when it\'s heard a story worthy of its father.',
    tags: ['giant'],
    canParley: true,
    languages: ['Common', 'Giant', 'Primordial'],
    lootTableRef: 'giant_elite'
  },
  {
    ref: 'aboleth_elder',
    name: 'Aboleth Elder',
    cr: 10,
    tier: 'elite',
    maxHp: 195,
    ac: 17,
    speed: 10,
    stats: { MIGHT: 20, AGILITY: 10, WITS: 22, GRIT: 18, CHARM: 18 },
    saveProficiencies: ['WITS', 'GRIT', 'CHARM'],
    resistances: { psychic: 'immune', cold: 'resistant' },
    conditionImmunities: ['charmed', 'frightened', 'prone'],
    actions: [
      { name: 'Tentacle', toHit: 9, damage: '2d10+5', type: 'bludgeoning', range: 15, save: { stat: 'GRIT', dc: 17, halfOnSave: false }, conditions: ['diseased'], recharge: null },
      { name: 'Enslave', toHit: null, damage: '0', type: 'psychic', range: 30, save: { stat: 'CHARM', dc: 18, halfOnSave: false }, conditions: ['charmed'], recharge: null },
      { name: 'Psychic Drain', toHit: null, damage: '5d10', type: 'psychic', range: 60, save: { stat: 'WITS', dc: 18, halfOnSave: true }, conditions: ['stunned', 'memory_fog'], recharge: 5 }
    ],
    multiattack: ['Tentacle', 'Tentacle', 'Tentacle'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Detect', cost: 1, effect: 'Makes a perception check — detects all creatures within 60 feet, including invisible' },
        { name: 'Tail Swipe', cost: 1, effect: 'Tail attack — +9 to hit, 2d8+5 bludgeoning, target is pushed 10 feet' },
        { name: 'Psychic Drain', cost: 3, effect: 'Uses Psychic Drain (costs 3 legendary actions)' }
      ]
    },
    lairActions: [
      { name: 'Mucus Pool', effect: 'A 20-foot area becomes covered in aboleth mucus — creatures must make DC 16 GRIT save or begin transforming (skin becomes translucent, must stay wet or take 1d6 per round)' },
      { name: 'Mental Projection', effect: 'Creates a psychic illusion — one creature sees something that isn\'t there (DC 16 WITS to disbelieve)' }
    ],
    reactions: [{ name: 'Psychic Shield', trigger: 'A creature within 30 feet tries to break Enslave', effect: 'The enslaved creature takes 3d6 psychic damage as the aboleth reinforces its control' }],
    traits: ['Amphibious', 'Mucus Cloud (underwater — DC 16 GRIT or become diseased)', 'Legendary Resistance (3/day)', 'Probing Telepathy (60 ft.)', 'Ancient Memory', 'Swim (40 ft.)'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      knownSpells: ['detect thoughts', 'phantasmal force', 'hypnotic pattern', 'dominate person', 'modify memory', 'project image', 'mirage arcane']
    },
    gear: null,
    senses: { darkvision: 120, blindsight: 60, tremorsense: null, truesight: null },
    habitat: 'underground',
    ecology: 'An ancient aboleth — older than most civilizations, with memories stretching back before the gods arrived. It rules a flooded underground domain through mental domination, keeping a court of enslaved servants who worship it as a god. It remembers everything — a living library of pre-divine history. It is patient on a geological timescale.',
    behavior: 'Enslave the most useful party member first. Triple Tentacle — disease transforms victims. Psychic Drain for devastating damage and memory loss. Mucus Pool forces the fight into its element. Mental Projection deceives and divides. Everything about this fight favors the aboleth — especially if it\'s in water.',
    encounterSign: 'An underground lake where the water whispers. Slaves with translucent skin and glazed eyes performing impossible tasks. Mucus on the walls that makes you hear voices. Dreams of a being that remembers the world before the sun.',
    socialStructure: 'Lord of a flooded underground domain with 10-30 enthralled servants',
    physicalDescription: 'A massive aquatic creature — part fish, part squid, part something older than either. Thirty feet long with three tentacles and a body covered in mucus. Its single eye contains visible intelligence — ancient, alien, and patient. Bioluminescent patterns ripple across its skin. It is older than the dungeon it lives in.',
    weakness: 'On dry land, it\'s slow and vulnerable (speed 10). Its disease requires water — dry environments prevent spreading. Sunlight blinds it and prevents mental projection. Greater Restoration cures its disease. Killing it in water is dangerous — its death throes release a 60-foot psychic blast.',
    loreHook: 'The underground river leads to something ancient. The people living down there aren\'t prisoners — they say they\'re chosen. They have translucent skin and speak in unison. Their god is real. It\'s the oldest thing alive. And it remembers when the sky was different.',
    tags: ['aberration'],
    canParley: true,
    languages: ['Deep Speech', 'telepathy 120 ft.', 'understands all languages via ancient memory'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'war_hydra',
    name: 'War Hydra',
    cr: 9,
    tier: 'elite',
    maxHp: 190,
    ac: 15,
    speed: 30,
    stats: { MIGHT: 22, AGILITY: 10, WITS: 6, GRIT: 20, CHARM: 4 },
    saveProficiencies: ['GRIT', 'MIGHT'],
    resistances: { poison: 'resistant', acid: 'resistant' },
    conditionImmunities: ['poisoned', 'frightened', 'stunned'],
    actions: [
      { name: 'Bite (per head)', toHit: 10, damage: '2d8+6', type: 'piercing', range: 10, save: null, conditions: ['bleeding'], recharge: null },
      { name: 'Acid Breath', toHit: null, damage: '4d8', type: 'acid', range: 30, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['corroded'], recharge: 5 }
    ],
    multiattack: ['Bite (per head)', 'Bite (per head)', 'Bite (per head)', 'Bite (per head)', 'Bite (per head)'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Bite', cost: 1, effect: 'Makes one Bite attack' },
        { name: 'Thrash', cost: 2, effect: 'All creatures within 10 feet make DC 17 AGILITY save or take 2d10 bludgeoning and are pushed 10 feet' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Reactive Heads', trigger: 'A creature ends its turn within 10 feet', effect: 'Each head that hasn\'t attacked this round makes a Bite attack' }],
    traits: ['Multiple Heads (5)', 'Wakeful', 'Regeneration (15 HP/round, stops with fire or acid)', 'Head Regrowth (severed head grows back as 2 next round unless cauterized)', 'Legendary Resistance (2/day)'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'swamp',
    ecology: 'A fully mature hydra — five-headed and capable of growing more. War hydras are apex predators that devastate entire ecosystems. They\'re named "war" hydras because they were historically used as living siege weapons by swamp kingdoms. Each head operates semi-independently, making them nearly impossible to surprise.',
    behavior: 'Five Bite attacks per round. Acid Breath on groups. Reactive Heads punish anyone nearby. Thrash to clear melee fighters. Regeneration 15/round makes attrition impossible without fire. Head Regrowth means severing heads without fire makes it WORSE. This is a pure damage race — kill it before it overwhelms you.',
    encounterSign: 'A swamp where everything larger than a rat is dead. Five-pronged bite marks on trees. The ground trembles. A shape in the swamp with too many necks.',
    socialStructure: 'Solitary apex predator — nothing else lives in its territory',
    physicalDescription: 'A massive reptilian body thirty feet long with five serpentine necks, each ending in a head with jaws that could swallow a human whole. When heads are severed, the stumps split and grow two replacements in seconds. Its scales are swamp-green and acid-resistant.',
    weakness: 'Fire prevents head regrowth — essential. Acid damage also stops regeneration. Without fire, this fight is nearly unwinnable as it grows more heads. Targeting the body instead of heads prevents regrowth complications. Cold slows regeneration by half.',
    loreHook: 'The king wants it alive. A war hydra — the swamp kingdom\'s old weapon. If we can chain it, we can turn the siege. If we can\'t, we\'re its next meal. Bring fire, and lots of it.',
    tags: ['beast'],
    canParley: false,
    languages: null,
    lootTableRef: 'beast_elite'
  },
  {
    ref: 'shadow_dragon_young',
    name: 'Young Shadow Dragon',
    cr: 9,
    tier: 'elite',
    maxHp: 170,
    ac: 17,
    speed: 40,
    stats: { MIGHT: 20, AGILITY: 14, WITS: 14, GRIT: 18, CHARM: 16 },
    saveProficiencies: ['AGILITY', 'GRIT', 'CHARM'],
    resistances: { necrotic: 'immune', bludgeoning: 'resistant', slashing: 'resistant', piercing: 'resistant', radiant: 'vulnerable' },
    conditionImmunities: ['charmed', 'frightened'],
    actions: [
      { name: 'Shadow Bite', toHit: 9, damage: '2d12+5', type: 'necrotic', range: 10, save: null, conditions: ['weakened'], recharge: null },
      { name: 'Shadow Claw', toHit: 9, damage: '2d8+5', type: 'necrotic', range: null, save: null, conditions: [], recharge: null },
      { name: 'Shadow Breath', toHit: null, damage: '6d8', type: 'necrotic', range: 40, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['weakened', 'despair'], recharge: 5 }
    ],
    multiattack: ['Shadow Bite', 'Shadow Claw', 'Shadow Claw'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Detect', cost: 1, effect: 'Makes a perception check' },
        { name: 'Shadow Claw', cost: 1, effect: 'Makes one Shadow Claw attack' },
        { name: 'Shadow Meld', cost: 2, effect: 'Melds into shadows and reappears in any shadow within 60 feet' }
      ]
    },
    lairActions: [
      { name: 'Deepening Darkness', effect: 'Shadows in the lair deepen — all dim light becomes darkness, bright light becomes dim' },
      { name: 'Shadow Tendrils', effect: 'Tendrils of shadow grapple one creature (DC 16 MIGHT to escape)' }
    ],
    reactions: [{ name: 'Shadow Phase', trigger: 'Hit by a radiant attack', effect: 'Phases partially into shadow — reduces radiant damage by half this once' }],
    traits: ['Flight (80 ft.)', 'Shadow Stealth', 'Legendary Resistance (2/day)', 'Sunlight Sensitivity (disadvantage on attacks and perception in sunlight)', 'Living Shadow'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 30, tremorsense: null, truesight: null },
    habitat: 'underground',
    ecology: 'A dragon corrupted by the Shadowfell — or born from the shadow of a true dragon. Its scales are darkness made solid. It commands shadows as extensions of itself. Young shadow dragons are already formidable — they claim underground territories and build lairs in the deepest darkness. Light is their only true enemy.',
    behavior: 'Shadow Breath to weaken the group. Triple multiattack with devastating damage. Shadow Meld to teleport between shadows. Lair actions deepen darkness for advantage. Targets light sources first. If forced into light, it fights recklessly to destroy the source and restore darkness.',
    encounterSign: 'Shadows that move independently. An area of permanent darkness underground. The feeling of being watched by something in the dark. Treasure that was left behind by other creatures — untouched but guarded.',
    socialStructure: 'Solitary, territorial over deep underground domains',
    physicalDescription: 'A dragon made of living shadow — its scales absorb light rather than reflect it. In darkness, only its eyes are visible — two points of cold violet. Its wings unfurl like a spreading stain. When it breathes, a cone of absolute darkness strips light, warmth, and hope from everything it touches.',
    weakness: 'Sunlight or daylight spell gives it disadvantage and prevents Shadow Stealth. Radiant damage is doubled (though Shadow Phase reduces this once). In bright light, it can\'t use Shadow Meld or lair actions. Magical light sources are its primary vulnerability.',
    loreHook: 'The mine goes deeper than the maps show. At the bottom, there\'s darkness that swallows torchlight. And something in that darkness has been eating the shadows of everyone who enters. They come out alive — but changed. Quieter. Dimmer.',
    tags: ['dragon', 'shadow'],
    canParley: true,
    languages: ['Common', 'Draconic', 'Shadowfell tongues'],
    lootTableRef: 'dragon_elite'
  },
  {
    ref: 'fire_elemental_lord',
    name: 'Fire Elemental Lord',
    cr: 8,
    tier: 'elite',
    maxHp: 155,
    ac: 16,
    speed: 50,
    stats: { MIGHT: 18, AGILITY: 18, WITS: 12, GRIT: 16, CHARM: 14 },
    saveProficiencies: ['AGILITY', 'GRIT'],
    resistances: { fire: 'immune', bludgeoning: 'resistant', slashing: 'resistant', piercing: 'resistant', cold: 'vulnerable' },
    conditionImmunities: ['poisoned', 'grappled', 'prone', 'restrained', 'exhaustion', 'burning'],
    actions: [
      { name: 'Flame Strike', toHit: 8, damage: '2d10+4', type: 'fire', range: 10, save: null, conditions: ['burning'], recharge: null },
      { name: 'Inferno Wave', toHit: null, damage: '5d8', type: 'fire', range: 30, save: { stat: 'AGILITY', dc: 16, halfOnSave: true }, conditions: ['burning', 'prone'], recharge: 5 },
      { name: 'Fire Whip', toHit: 8, damage: '2d8+4', type: 'fire', range: 20, save: null, conditions: ['grappled'], recharge: null }
    ],
    multiattack: ['Flame Strike', 'Flame Strike', 'Fire Whip'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Flame Dash', cost: 1, effect: 'Moves up to 25 feet — sets fire to everything it passes through' },
        { name: 'Immolate', cost: 2, effect: 'A burning creature within 30 feet takes 3d8 fire damage and must make DC 16 GRIT save or the burning intensifies (damage increases by 1d6)' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Fire Shield', trigger: 'Hit by a melee attack', effect: 'Attacker takes 2d8 fire damage' }],
    traits: ['Fire Form', 'Illumination (30 ft.)', 'Water Susceptibility (takes 1d8 cold per gallon)', 'Fire Absorption', 'Elemental Lord'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'volcanic',
    ecology: 'The most powerful form of fire elemental — a lord among its kind. Twenty feet tall, it commands lesser fire elementals and sets entire forests ablaze. It crosses the planes where volcanic activity weakens the boundary between the Prime Material and the Plane of Fire. It doesn\'t hate the material world — it simply doesn\'t understand that burning is harmful.',
    behavior: 'Triple multiattack with Flame Strike and Fire Whip. Inferno Wave for area devastation. Flame Dash to spread fire. Immolate to amplify burning on targets. Fire Shield punishes melee. Speed 50 — faster than most creatures. It sets everything on fire, including the battlefield itself.',
    encounterSign: 'A wildfire that moves against the wind. Trees exploding from heat before the fire reaches them. A pillar of flame walking through the forest. Elementals of fire gathering near a volcanic vent.',
    socialStructure: 'Commands 2-4 lesser fire elementals',
    physicalDescription: 'A towering humanoid of white-hot flame with a core of blue fire. Its "face" is a shifting mask of plasma. It radiates heat intense enough to ignite wood at twenty feet. Lesser flames orbit it like satellites. When it moves, it leaves trails of fire. Looking directly at it causes temporary blindness.',
    weakness: 'Cold damage is doubled. Water in large quantities (rivers, heavy rain) deals massive damage. It can\'t cross large bodies of water. In rain, it\'s significantly weakened. Smothering (burying under non-flammable material) extinguishes it.',
    loreHook: 'The forest fire isn\'t natural. There\'s something at the center — a figure walking calmly through the inferno, leaving more fire behind it. The rain isn\'t stopping it. The river might, but it\'s heading for the bridge.',
    tags: ['elemental'],
    canParley: false,
    languages: ['Ignan'],
    lootTableRef: 'elemental_elite'
  },
  {
    ref: 'mind_flayer_arcanist',
    name: 'Mind Flayer Arcanist',
    cr: 9,
    tier: 'elite',
    maxHp: 145,
    ac: 16,
    speed: 30,
    stats: { MIGHT: 12, AGILITY: 14, WITS: 22, GRIT: 16, CHARM: 18 },
    saveProficiencies: ['WITS', 'CHARM', 'GRIT'],
    resistances: { psychic: 'immune' },
    conditionImmunities: ['charmed', 'frightened'],
    actions: [
      { name: 'Tentacles', toHit: 10, damage: '2d10+6', type: 'psychic', range: null, save: null, conditions: ['grappled'], recharge: null },
      { name: 'Extract Brain', toHit: null, damage: '6d10', type: 'psychic', range: null, save: { stat: 'WITS', dc: 18, halfOnSave: false }, conditions: ['stunned'], recharge: null },
      { name: 'Mind Blast', toHit: null, damage: '5d8', type: 'psychic', range: 60, save: { stat: 'WITS', dc: 18, halfOnSave: true }, conditions: ['stunned'], recharge: 5 }
    ],
    multiattack: null,
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Tentacle', cost: 1, effect: 'Makes one Tentacles attack' },
        { name: 'Arcane Bolt', cost: 1, effect: 'Casts a cantrip-level spell at a target' },
        { name: 'Mind Blast', cost: 3, effect: 'Uses Mind Blast (if recharged)' }
      ]
    },
    lairActions: [
      { name: 'Psychic Resonance', effect: 'One creature in the lair must make DC 17 WITS save or be dazed — disadvantage on all attacks and saves until end of next turn' },
      { name: 'Thrall Command', effect: 'One thrall in the lair makes a melee attack against the nearest non-thrall creature' }
    ],
    reactions: [{ name: 'Psychic Shield', trigger: 'Targeted by an attack while a grappled creature is adjacent', effect: 'Uses the grappled creature as a psychic shield — the grappled target takes the damage instead' }],
    traits: ['Legendary Resistance (2/day)', 'Magic Resistance', 'Innate Telepathy (120 ft.)', 'Extract Brain (instant kill on stunned and grappled creature with 0 INT)', 'Arcane Enhancement'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      knownSpells: ['detect thoughts', 'shield', 'counterspell', 'fireball', 'dimension door', 'wall of force', 'dominate person', 'telekinesis', 'plane shift']
    },
    gear: null,
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'underground',
    ecology: 'A mind flayer that has mastered arcane magic in addition to its innate psionic abilities — a rarity and an abomination even by illithid standards. Other mind flayers consider arcanists dangerous deviants. This one operates alone, having been exiled from its colony for its arcane experiments. It combines mind blast devastation with wizard-level spell versatility.',
    behavior: 'Mind Blast to stun the group. Tentacles on stunned targets. Extract Brain to instantly kill stunned, grappled prey. Wall of Force to divide the party. Fireball for area damage. Dimension Door to escape. Counterspell enemy magic. Psychic Shield uses grappled creatures as living shields. This is one of the most dangerous opponents at its CR.',
    encounterSign: 'Thralls with blank expressions performing incomprehensible tasks. Arcane formulas written in Deep Speech. A laboratory combining magical and biological components. Missing scholars and mages — the arcanist collects intelligent brains.',
    socialStructure: 'Solitary with 3-6 thralls (dominated humanoids)',
    physicalDescription: 'The classic mind flayer form — pale purple skin, four facial tentacles, pupil-less white eyes — but with arcane sigils tattooed across its scalp and hands. Its robes are woven with spell components. It carries no staff — its tentacles gesture to cast. The air around it hums with combined psionic and arcane energy.',
    weakness: 'Mindless creatures (constructs, oozes) are immune to Mind Blast and Extract Brain. Sunlight gives it disadvantage. Anti-magic zones suppress its spellcasting but not its psionics. Stunning the arcanist prevents both casting and Mind Blast. Intelligence of 3 or lower is immune to its psychic attacks.',
    loreHook: 'Mages are vanishing from the university. Their rooms are found with arcane circles no one recognizes and biological matter no one can identify. The missing mages reappear days later — alive, but their eyes are blank and they follow instructions from something they can\'t describe.',
    tags: ['aberration'],
    canParley: true,
    languages: ['Deep Speech', 'Undercommon', 'Common', 'telepathy 120 ft.'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'death_tyrant',
    name: 'Death Tyrant',
    cr: 10,
    tier: 'elite',
    maxHp: 180,
    ac: 18,
    speed: 0,
    stats: { MIGHT: 14, AGILITY: 14, WITS: 20, GRIT: 18, CHARM: 16 },
    saveProficiencies: ['WITS', 'GRIT', 'CHARM'],
    resistances: { necrotic: 'immune', poison: 'immune', psychic: 'resistant' },
    conditionImmunities: ['poisoned', 'charmed', 'prone', 'exhaustion'],
    actions: [
      { name: 'Bite', toHit: 7, damage: '3d8+2', type: 'piercing', range: null, save: null, conditions: [], recharge: null },
      { name: 'Eye Rays (3 random)', toHit: null, damage: 'varies', type: 'varies', range: 60, save: { stat: 'varies', dc: 17, halfOnSave: false }, conditions: ['varies'], recharge: null }
    ],
    multiattack: null,
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Eye Ray', cost: 1, effect: 'Uses one random Eye Ray' },
        { name: 'Negative Energy Cone', cost: 2, effect: 'Projects a 60-foot cone of negative energy — living creatures take 3d8 necrotic, creatures that die in the cone rise as zombies under the tyrant\'s control' }
      ]
    },
    lairActions: [
      { name: 'Eye Stalk Ambush', effect: 'An eye ray fires from a wall — random Eye Ray at a random creature in the lair' },
      { name: 'Animate Dead', effect: 'Up to 3 corpses in the lair rise as zombies under the tyrant\'s control' }
    ],
    reactions: null,
    traits: ['Fly (30 ft. — hover)', 'Negative Energy Cone (150 ft.)', 'Eye Rays (10 types: charm, paralyze, fear, slow, enervation, telekinesis, sleep, petrification, disintegrate, death)', 'Legendary Resistance (3/day)', 'Antimagic Cone (central eye)'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: 120 },
    habitat: 'underground',
    ecology: 'An undead beholder — its paranoia magnified to cosmic levels. Where a living beholder dreams reality into being, a death tyrant dreams undeath. Its negative energy cone raises the dead in its path. It builds kingdoms of the risen, each zombie a citizen of its deranged empire. It is a beholder that conquered death and went mad from the victory.',
    behavior: 'Antimagic Cone from central eye shuts down magic in a 150-ft cone. Eye Rays — three per round, each with a different devastating effect. Legendary Eye Rays between turns. Negative Energy Cone raises an army from the dead. This fight is chaos — random eye rays mean no two rounds are the same.',
    encounterSign: 'An underground domain where all the inhabitants are undead — but organized. A throne room carved by disintegration rays. The feeling of being watched by many eyes. Zombie patrols with disturbing purpose.',
    socialStructure: 'Tyrant of an undead domain, commanding dozens to hundreds of zombies',
    physicalDescription: 'A floating skull the size of a boulder — the beholder\'s spherical body rotted to bone, eye stalks still functional, each trailing necrotic energy. Its central eye is dark but pulses with antimagic. The smaller eyes glow different colors. Strips of rotting flesh hang from its frame. It speaks in a voice of absolute certainty about its own perfection.',
    weakness: 'Antimagic cone only faces one direction — position to attack from behind. Disrupting its eye stalks (called shots) removes specific rays. Radiant damage is fully effective and prevents zombie raising for 1 round. Sunlight forces the antimagic cone to point upward — freeing spellcasters to act.',
    loreHook: 'The necropolis under the city has a new ruler. A floating skull with ten eyes that turn the living into the dead and the dead into soldiers. It\'s building an army. And it believes — truly believes — that undeath is a gift it\'s giving them.',
    tags: ['undead', 'aberration'],
    canParley: true,
    languages: ['Deep Speech', 'Undercommon', 'telepathy 120 ft.'],
    lootTableRef: 'undead_elite'
  },
  {
    ref: 'frost_giant_jarl',
    name: 'Frost Giant Jarl',
    cr: 9,
    tier: 'elite',
    maxHp: 185,
    ac: 17,
    speed: 40,
    stats: { MIGHT: 24, AGILITY: 10, WITS: 12, GRIT: 22, CHARM: 14 },
    saveProficiencies: ['MIGHT', 'GRIT', 'CHARM'],
    resistances: { cold: 'immune', fire: 'vulnerable' },
    conditionImmunities: ['frightened'],
    actions: [
      { name: 'Greataxe', toHit: 11, damage: '3d12+7', type: 'slashing', range: 10, save: null, conditions: [], recharge: null },
      { name: 'Ice Boulder', toHit: 11, damage: '3d10+7', type: 'bludgeoning', range: 60, save: null, conditions: ['prone'], recharge: null },
      { name: 'Freezing Roar', toHit: null, damage: '4d8', type: 'cold', range: 30, save: { stat: 'GRIT', dc: 18, halfOnSave: true }, conditions: ['frightened', 'slowed'], recharge: 5 }
    ],
    multiattack: ['Greataxe', 'Greataxe'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Attack', cost: 1, effect: 'Makes one Greataxe or Ice Boulder attack' },
        { name: 'Icy Stomp', cost: 2, effect: 'Stomps the ground — all creatures within 15 feet make DC 17 AGILITY save or take 2d10 cold + 2d10 bludgeoning and are knocked prone' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Catch and Throw', trigger: 'A ranged projectile targets the jarl', effect: 'Catches the projectile if MIGHT check > attack roll, then hurls it back at the attacker' }],
    traits: ['Giant\'s Might', 'Cold Immunity', 'Legendary Resistance (2/day)', 'Siege Monster', 'Jarl\'s Command'],
    spellcasting: null,
    gear: [{ ref: 'frost_greataxe', slot: 'mainHand' }, { ref: 'mammoth_hide', slot: 'torso' }],
    senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'arctic',
    ecology: 'The chieftain of a frost giant tribe — twenty-five feet tall, battle-scarred, and absolutely dominant. Jarls rule through strength, keeping their position by defeating all challengers. They lead raids on lowland settlements, taking food, weapons, and slaves. A jarl\'s command is law in frost giant society.',
    behavior: 'Double Greataxe for devastating damage. Ice Boulder at range. Freezing Roar to frighten and slow. Icy Stomp via legendary action. Catch and Throw sends projectiles back. Fights at the front of any battle — frost giant jarls prove their worth through combat. Attacks the strongest enemy first.',
    encounterSign: 'Footprints five feet long in the snow. A camp of massive scale — fire pits the size of wagons. The sound of horns echoing off glaciers. Raided villages with walls smashed from outside.',
    socialStructure: 'Jarl with tribe of 10-30 frost giants and 50+ thralls',
    physicalDescription: 'Twenty-five feet of blue-white muscle and ice-crusted fur. Scars cross its body like a map of battles won. It wears mammoth hide and carries a greataxe that could fell a tree in one stroke. Its breath freezes the air. A crown of ice sits atop its scarred brow.',
    weakness: 'Fire damage is doubled — the one thing frost giants fear. Its size makes it impossible to fight in enclosed spaces — luring it indoors is advantageous. Its pride can be exploited — a formal challenge to single combat is hard for a jarl to refuse. Without the tribe, it\'s still dangerous but loses Jarl\'s Command bonuses.',
    loreHook: 'The frost giant jarl has sent an ultimatum: one hundred cattle and fifty barrels of mead, delivered to the glacier pass by full moon. If we don\'t pay, the tribe raids. If we do pay, they come back for more. Someone needs to end this cycle.',
    tags: ['giant'],
    canParley: true,
    languages: ['Common', 'Giant'],
    lootTableRef: 'giant_elite'
  },
  {
    ref: 'yuan_ti_abomination',
    name: 'Yuan-Ti Abomination',
    cr: 8,
    tier: 'elite',
    maxHp: 160,
    ac: 16,
    speed: 35,
    stats: { MIGHT: 18, AGILITY: 16, WITS: 18, GRIT: 16, CHARM: 18 },
    saveProficiencies: ['CHARM', 'WITS', 'GRIT'],
    resistances: { poison: 'immune', psychic: 'resistant' },
    conditionImmunities: ['poisoned', 'charmed', 'frightened'],
    actions: [
      { name: 'Scimitar', toHit: 8, damage: '2d8+4', type: 'slashing', range: null, save: null, conditions: [], recharge: null },
      { name: 'Constrict', toHit: 8, damage: '2d10+4', type: 'bludgeoning', range: null, save: null, conditions: ['grappled', 'restrained'], recharge: null },
      { name: 'Venomous Bite', toHit: 8, damage: '2d6+4', type: 'piercing', range: null, save: { stat: 'GRIT', dc: 16, halfOnSave: false }, conditions: ['poisoned', 'paralyzed'], recharge: null }
    ],
    multiattack: ['Scimitar', 'Scimitar', 'Venomous Bite'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Constrict', cost: 1, effect: 'Makes one Constrict attack' },
        { name: 'Aura of Serpent Command', cost: 2, effect: 'All serpents and yuan-ti within 30 feet make one attack' }
      ]
    },
    lairActions: [
      { name: 'Venom Fog', effect: 'Poisonous fog fills a 20-foot area — DC 15 GRIT save or poisoned and take 2d6 poison damage' },
      { name: 'Snake Swarm', effect: 'A swarm of snakes appears and attacks one creature — +6 to hit, 3d6 piercing + poison' }
    ],
    reactions: [{ name: 'Serpent\'s Reflexes', trigger: 'Missed by a melee attack', effect: 'Makes a Venomous Bite as a reaction' }],
    traits: ['Shapechanger (snake or humanoid form)', 'Legendary Resistance (2/day)', 'Magic Resistance', 'Serpent Speech (commands all snakes)', 'Innate Spellcasting'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 16,
      spellAttack: 8,
      slots: { 1: 4, 2: 3, 3: 3, 4: 2 },
      knownSpells: ['command', 'suggestion', 'fear', 'counterspell', 'polymorph', 'dominate person', 'cloudkill']
    },
    gear: [{ ref: 'serpent_scimitar', slot: 'mainHand' }],
    senses: { darkvision: 60, blindsight: 30, tremorsense: null, truesight: null },
    habitat: 'jungle',
    ecology: 'The highest caste of yuan-ti — fully transformed into serpent form. These are the priests and rulers of yuan-ti civilization, guiding their race\'s slow conquest of the warm-blooded world. They view all non-serpent races as prey or potential converts. Their plans span centuries. They are patient, brilliant, and utterly alien in their morality.',
    behavior: 'Triple multiattack with Scimitar, Scimitar, Venomous Bite. Constrict grappled targets. Dominate Person to turn enemies. Fear and Suggestion for crowd control. Aura of Serpent Command mobilizes all snake allies. Plays the long game — retreats to fight another century.',
    encounterSign: 'Snake iconography in increasing density. Humanoids with snake-like features in positions of power. A jungle temple where the walls slither. Sacrifices performed at midnight with ophidian chanting.',
    socialStructure: 'Rules a yuan-ti community of 20-50, with spy networks in nearby human cities',
    physicalDescription: 'A massive serpent from the waist down with a humanoid torso — but the humanoid features are also serpentine. Scales cover everything. Its head is a cobra\'s hood with a vaguely human face. It wields a scimitar with the top pair of its four arms while the lower pair gestures for spellcasting.',
    weakness: 'Cold slows its metabolism — reduces speed by half and poison potency. It\'s cold-blooded — winter campaigns are advantageous. Its plans require secrecy — exposing the yuan-ti network undermines centuries of work. Mongoose blood grants advantage on saves against its poison.',
    loreHook: 'The jungle temple isn\'t abandoned. It never was. The yuan-ti have been there for a thousand years, slowly converting the surrounding villages. The abomination at the center is ready for the next phase of the plan. It involves the capital city.',
    tags: ['humanoid', 'beast'],
    canParley: true,
    languages: ['Common', 'Abyssal', 'Draconic', 'Infernal'],
    lootTableRef: 'humanoid_elite'
  },
  {
    ref: 'bone_colossus_animated',
    name: 'Bone Colossus',
    cr: 9,
    tier: 'elite',
    maxHp: 180,
    ac: 16,
    speed: 30,
    stats: { MIGHT: 22, AGILITY: 8, WITS: 8, GRIT: 20, CHARM: 6 },
    saveProficiencies: ['MIGHT', 'GRIT'],
    resistances: { necrotic: 'immune', poison: 'immune', slashing: 'resistant', piercing: 'resistant', radiant: 'vulnerable' },
    conditionImmunities: ['poisoned', 'charmed', 'frightened', 'exhaustion', 'stunned'],
    actions: [
      { name: 'Bone Slam', toHit: 10, damage: '3d10+6', type: 'bludgeoning', range: 10, save: null, conditions: ['prone'], recharge: null },
      { name: 'Bone Storm', toHit: null, damage: '4d8', type: 'slashing', range: 20, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['bleeding'], recharge: 5 },
      { name: 'Reassemble', toHit: null, damage: '0', type: 'necrotic', range: null, save: null, conditions: [], recharge: 6 }
    ],
    multiattack: ['Bone Slam', 'Bone Slam'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Bone Slam', cost: 1, effect: 'Makes one Bone Slam attack' },
        { name: 'Collapse and Reform', cost: 2, effect: 'Collapses into a pile of bones — immune to all damage until start of next turn, then reforms in any space within 30 feet' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Shrapnel Burst', trigger: 'Takes 20+ damage from a single source', effect: 'Bone shrapnel flies — all creatures within 10 feet take 2d8 piercing damage (AGILITY DC 15 for half)' }],
    traits: ['Constructed from Bones', 'Reassemble (when reduced to 0 HP, has 50% chance to reform with 60 HP next round unless radiant damage killed it)', 'Siege Monster', 'Legendary Resistance (2/day)'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 60, blindsight: 30, tremorsense: null, truesight: null },
    habitat: 'any',
    ecology: 'A massive construct assembled from thousands of bones — an ossuary given terrible life. Created by necromancers as war machines, they tower over battlefields, reforming even when smashed apart. The bones come from mass graves, ossuaries, and battlefield collections. Each bone remembers its owner.',
    behavior: 'Double Bone Slam for massive damage. Bone Storm shreds everything nearby. Collapse and Reform to teleport and become immune. Reassemble even after "death" — must be killed with radiant to stay down. Shrapnel Burst punishes burst damage. An endurance fight that tests resources.',
    encounterSign: 'The ossuary is empty. The bones are gone. Something massive is walking nearby — you can hear the rattling from a mile away. A twenty-foot humanoid shape made of thousands of bones.',
    socialStructure: 'Solitary weapon of war, commanded by a necromancer',
    physicalDescription: 'A twenty-foot giant assembled from thousands of bones of all sizes. Skulls form its face and joints. Femurs and spines form its limbs. Ribs cage its hollow torso. It moves with grinding, clattering steps. When damaged, loose bones orbit back to reform the missing section.',
    weakness: 'Radiant damage prevents Reassemble — the only way to keep it dead. Bludgeoning is most effective at smashing bones. Holy water sprinkled on its remains prevents reformation. The animating focus (usually a skull at its core) can be targeted — AC 20, destroying it kills the colossus instantly.',
    loreHook: 'The necromancer is using our dead against us. Every soldier we\'ve lost joins the colossus. It\'s bigger after every battle. If we keep fighting, we keep feeding it. We need to find the necromancer before the colossus becomes unstoppable.',
    tags: ['undead', 'construct'],
    canParley: false,
    languages: null,
    lootTableRef: 'undead_elite'
  },
  {
    ref: 'ancient_treant',
    name: 'Ancient Treant',
    cr: 8,
    tier: 'elite',
    maxHp: 175,
    ac: 17,
    speed: 25,
    stats: { MIGHT: 22, AGILITY: 6, WITS: 16, GRIT: 22, CHARM: 14 },
    saveProficiencies: ['GRIT', 'WITS', 'MIGHT'],
    resistances: { bludgeoning: 'resistant', piercing: 'resistant', fire: 'vulnerable' },
    conditionImmunities: ['charmed', 'prone', 'stunned'],
    actions: [
      { name: 'Slam', toHit: 10, damage: '3d10+6', type: 'bludgeoning', range: 10, save: null, conditions: ['prone'], recharge: null },
      { name: 'Rock Throw', toHit: 10, damage: '2d10+6', type: 'bludgeoning', range: 60, save: null, conditions: ['prone'], recharge: null },
      { name: 'Animate Trees', toHit: null, damage: '0', type: 'force', range: 60, save: null, conditions: [], recharge: 6 }
    ],
    multiattack: ['Slam', 'Slam'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Slam', cost: 1, effect: 'Makes one Slam attack' },
        { name: 'Entangling Roots', cost: 2, effect: 'Roots erupt in a 20-foot radius — all creatures must make DC 17 MIGHT save or be restrained' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Bark Shield', trigger: 'Takes fire damage', effect: 'Sacrifices a layer of bark — reduces fire damage by 2d10 this once (usable 2/day)' }],
    traits: ['False Appearance (looks like a tree)', 'Animate Trees (2 trees within 60 ft. become treants for 1 minute)', 'Siege Monster', 'Legendary Resistance (2/day)', 'Speak with Plants'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: null, blindsight: 60, tremorsense: 60, truesight: null },
    habitat: 'forest',
    ecology: 'A treant that has lived for millennia — a living tree of immense size and power. Ancient treants are the memory and conscience of their forests. They can animate other trees, communicate with all plant life, and have witnessed the rise and fall of civilizations. They move only when the forest is threatened — and when they move, the forest moves with them.',
    behavior: 'Double Slam for devastating melee. Animate Trees to create allies. Entangling Roots to restrain. Rock Throw at range. Bark Shield reduces fire damage. Fights to protect the forest — will stop if the threat withdraws. Can animate the entire treeline if given time.',
    encounterSign: 'An ancient oak that\'s larger than any other. The forest is denser than maps suggest — it grew while no one was watching. Trees that seem to have moved since yesterday. A voice like wind through old branches.',
    socialStructure: 'Elder of a forest, with dryads, treants, and forest spirits as attendants',
    physicalDescription: 'A tree forty feet tall that walks. Its trunk is gnarled with centuries of growth. Its "face" is in the bark — knot-hole eyes and a split-bark mouth. Its arms are massive branches. Leaves and moss cover it like a cloak. Birds nest in its crown. When it speaks, the entire forest rustles.',
    weakness: 'Fire damage is doubled (though Bark Shield mitigates). It\'s slow — ranged characters can kite it. Defoliant or herbicide is devastating. It can\'t pursue across open ground where there are no trees to animate. In winter, it\'s dormant and vulnerable.',
    loreHook: 'The forest is growing. The city\'s outer farms are being reclaimed — trees sprouting through foundations overnight. The ancient treant at the forest\'s heart has decided that the city has taken enough. It\'s taking the land back. One block at a time.',
    tags: ['plant'],
    canParley: true,
    languages: ['Common', 'Elvish', 'Druidic', 'Sylvan'],
    lootTableRef: 'plant_elite'
  },
  {
    ref: 'greater_pit_fiend',
    name: 'Greater Pit Fiend',
    cr: 10,
    tier: 'elite',
    maxHp: 195,
    ac: 19,
    speed: 30,
    stats: { MIGHT: 24, AGILITY: 14, WITS: 18, GRIT: 22, CHARM: 20 },
    saveProficiencies: ['MIGHT', 'GRIT', 'CHARM', 'WITS'],
    resistances: { fire: 'immune', poison: 'immune', cold: 'resistant', bludgeoning: 'resistant', slashing: 'resistant', piercing: 'resistant' },
    conditionImmunities: ['poisoned', 'frightened', 'charmed'],
    actions: [
      { name: 'Burning Mace', toHit: 11, damage: '3d8+7', type: 'bludgeoning', range: null, save: null, conditions: ['burning'], recharge: null },
      { name: 'Tail', toHit: 11, damage: '2d10+7', type: 'piercing', range: 10, save: null, conditions: ['grappled'], recharge: null },
      { name: 'Hellfire Blast', toHit: null, damage: '6d8', type: 'fire', range: 30, save: { stat: 'AGILITY', dc: 18, halfOnSave: true }, conditions: ['burning'], recharge: 5 }
    ],
    multiattack: ['Burning Mace', 'Burning Mace', 'Tail'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Attack', cost: 1, effect: 'Makes one Burning Mace or Tail attack' },
        { name: 'Infernal Command', cost: 2, effect: 'One devil within 60 feet makes an attack' },
        { name: 'Fear Aura', cost: 3, effect: 'All creatures within 20 feet must make DC 18 CHARM save or be frightened for 1 minute' }
      ]
    },
    lairActions: [
      { name: 'Hellfire Vent', effect: 'A geyser of hellfire erupts — one creature takes 3d8 fire damage (AGILITY DC 16 to avoid)' },
      { name: 'Infernal Command', effect: 'One devil in the lair takes an immediate turn' }
    ],
    reactions: [{ name: 'Infernal Resilience', trigger: 'Fails a saving throw', effect: 'Can choose to succeed instead (1/day — separate from Legendary Resistance)' }],
    traits: ['Flight (60 ft.)', 'Magic Resistance', 'Legendary Resistance (3/day)', 'Fire Aura (10 ft. — 2d6 fire to adjacent creatures)', 'Devil\'s Sight (magical darkness doesn\'t impede)', 'Innate Spellcasting'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      knownSpells: ['command', 'detect magic', 'fireball', 'hold person', 'wall of fire', 'dominate person', 'flame strike']
    },
    gear: [{ ref: 'burning_mace', slot: 'mainHand' }],
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: 120 },
    habitat: 'planar',
    ecology: 'A lesser specimen of the feared pit fiend — general of the Nine Hells. Even a lesser pit fiend commands legions of devils and embodies infernal authority. It was sent to the material plane on a mission — contract enforcement, soul collection, or conquest. It views mortals as resources to be exploited or souls to be claimed.',
    behavior: 'Triple multiattack with devastating damage. Hellfire Blast for area damage. Fear Aura to break morale. Infernal Command mobilizes devil allies. Wall of Fire to control the battlefield. Flight for aerial superiority. Fights with military discipline — it commands hell\'s armies. It\'s as smart as it is strong.',
    encounterSign: 'The smell of brimstone. Infernal sigils burned into the ground. Lesser devils following strict military discipline. A contract written in blood that someone signed. The temperature rising with no source.',
    socialStructure: 'General with 4-8 lesser devils as a strike force',
    physicalDescription: 'Twelve feet tall with red skin, massive bat wings, and a crown of horns. Its body is a weapon — clawed hands, spiked tail, burning mace. Its eyes contain the fires of the Nine Hells. It wears armor of infernal iron. When it speaks, its voice carries the weight of eternal authority.',
    weakness: 'Radiant damage bypasses resistances. Silver weapons deal full damage. Holy water deals 4d6. Banishment returns it to the Nine Hells. Its infernal contracts bind it — finding and voiding the contract that sent it can force its return. Cold iron weapons bypass fire resistance.',
    loreHook: 'Someone in the city signed a contract. A real one — infernal, binding, written in blood. The pit fiend is here to collect. The debt isn\'t one soul — it\'s a thousand. And the contract is technically valid. We need a lawyer. A very unusual lawyer.',
    tags: ['fiend'],
    canParley: true,
    languages: ['Common', 'Infernal', 'telepathy 120 ft.'],
    lootTableRef: 'fiend_elite'
  },
  {
    ref: 'void_dragon_wyrmling',
    name: 'Void Dragon Wyrmling',
    cr: 7,
    tier: 'elite',
    maxHp: 130,
    ac: 16,
    speed: 30,
    stats: { MIGHT: 18, AGILITY: 16, WITS: 16, GRIT: 16, CHARM: 14 },
    saveProficiencies: ['AGILITY', 'GRIT', 'WITS'],
    resistances: { force: 'immune', psychic: 'resistant', cold: 'resistant' },
    conditionImmunities: ['charmed', 'frightened'],
    actions: [
      { name: 'Void Bite', toHit: 8, damage: '2d10+4', type: 'force', range: null, save: null, conditions: ['teleported'], recharge: null },
      { name: 'Claw', toHit: 8, damage: '2d6+4', type: 'slashing', range: null, save: null, conditions: [], recharge: null },
      { name: 'Void Breath', toHit: null, damage: '5d8', type: 'force', range: 30, save: { stat: 'GRIT', dc: 16, halfOnSave: true }, conditions: ['teleported', 'stunned'], recharge: 5 }
    ],
    multiattack: ['Void Bite', 'Claw', 'Claw'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Detect', cost: 1, effect: 'Makes a perception check with truesight' },
        { name: 'Void Step', cost: 2, effect: 'Teleports up to 60 feet to any space it can see' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Spatial Warp', trigger: 'Targeted by a ranged attack', effect: 'Bends space — the attack has a 50% chance to hit a random creature within 10 feet instead' }],
    traits: ['Flight (60 ft.)', 'Legendary Resistance (2/day)', 'Spatial Awareness', 'Void Dragon', 'Dimensional Sight'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 30, tremorsense: null, truesight: 60 },
    habitat: 'planar',
    ecology: 'A young dragon from the space between dimensions — the void. Void dragons don\'t breathe fire or ice; they breathe raw spatial distortion that teleports matter unpredictably. Even as wyrmlings, they can bend space around themselves. They nest in planar rifts and feed on dimensional energy.',
    behavior: 'Triple multiattack. Void Breath teleports targets randomly — incredibly disruptive. Void Step for legendary-action teleportation. Spatial Warp redirects ranged attacks to allies. Void Bite teleports the target 10 feet in a random direction. The entire fight is spatial chaos.',
    encounterSign: 'Space is wrong near the rift. Distances don\'t match what your eyes report. A dragon-shaped absence — like looking at a hole in reality. Things appearing and disappearing nearby.',
    socialStructure: 'Solitary, nesting near a planar rift',
    physicalDescription: 'A dragon whose scales are the color of deep space — black with pinpricks of light like stars. Its form seems to shift and blur, as if space itself can\'t quite contain it. When it opens its mouth, you see nothing — not darkness, but an absence. Its wings are tears in reality.',
    weakness: 'Dimensional anchor prevents Void Step and teleportation effects. Force damage is its own type — it\'s immune, but radiant damage works fully. Anti-magic zones ground it and prevent spatial warping. In a null-magic area, it\'s a physically strong but non-magical dragon.',
    loreHook: 'The planar rift opened a week ago. Something flew out — a dragon made of void. It doesn\'t seem hostile, but space warps around it. Doors lead to wrong rooms. The geography is rearranging. If it stays, the city will become dimensionally unstable.',
    tags: ['dragon', 'aberration'],
    canParley: true,
    languages: ['Draconic', 'Deep Speech'],
    lootTableRef: 'dragon_elite'
  },
  {
    ref: 'beholder',
    name: 'Beholder',
    cr: 10,
    tier: 'elite',
    maxHp: 180,
    ac: 18,
    speed: 0,
    stats: { MIGHT: 14, AGILITY: 14, WITS: 20, GRIT: 18, CHARM: 16 },
    saveProficiencies: ['WITS', 'GRIT', 'CHARM'],
    resistances: { psychic: 'resistant' },
    conditionImmunities: ['prone', 'charmed'],
    actions: [
      { name: 'Bite', toHit: 7, damage: '3d8+2', type: 'piercing', range: null, save: null, conditions: [], recharge: null },
      { name: 'Eye Rays (3 random)', toHit: null, damage: 'varies', type: 'varies', range: 60, save: { stat: 'varies', dc: 17, halfOnSave: false }, conditions: ['varies'], recharge: null }
    ],
    multiattack: null,
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Eye Ray', cost: 1, effect: 'Uses one random Eye Ray' }
      ]
    },
    lairActions: [
      { name: 'Eye Stalk', effect: 'A random Eye Ray fires from a wall at a random target' },
      { name: 'Slippery Ground', effect: 'A 20-foot area becomes slick — creatures must make DC 15 AGILITY save or fall prone' }
    ],
    reactions: null,
    traits: ['Fly (20 ft. — hover)', 'Antimagic Cone (central eye — 150 ft. cone suppresses all magic)', 'Eye Rays (10 types: charm, paralyze, fear, slow, enervation, telekinesis, sleep, petrification, disintegrate, death)', 'Legendary Resistance (3/day)'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: 120 },
    habitat: 'underground',
    ecology: 'The iconic aberration — a floating sphere of flesh with a central eye and ten smaller eyes on stalks. Each eye projects a different ray with devastating effects. Beholders are paranoid, genius-level intellects that build elaborate lairs and plan for every contingency. They believe they are perfect. Every other beholder is a flawed imitation.',
    behavior: 'Antimagic Cone faces spellcasters — suppresses their magic. Three random Eye Rays per turn — chaos incarnate. Legendary Eye Rays between turns. The fight is unpredictable — petrification, disintegration, charm, fear, death. Positioning around the Antimagic Cone is the key tactical element.',
    encounterSign: 'An underground lair of paranoid complexity — trapped corridors, hidden chambers, false leads. Petrified creatures arranged as art. The feeling of being watched from every angle. A single, massive eye in the darkness.',
    socialStructure: 'Solitary, absolute ruler of its domain with 2-8 charmed minions',
    physicalDescription: 'A floating sphere five feet in diameter, dominated by a single central eye. Ten smaller eyes on flexible stalks crown its top. A wide, toothy maw sits below the central eye. Its skin is leathery and mottled. It hovers silently, turning to direct its antimagic cone and eye rays with calculated precision.',
    weakness: 'The antimagic cone only faces one direction — attack from behind. Mirrors can redirect some eye rays. Rogues and martial characters are unaffected by the antimagic cone. Blinding the central eye removes the cone. Each eye stalk can be targeted individually (AC 20, 10 HP each).',
    loreHook: 'The dungeon under the mountain was mapped a century ago. But it\'s changed. Corridors moved. New traps. Petrified adventurers arranged in a gallery. The beholder moved in and remade it all. It\'s been expecting us.',
    tags: ['aberration'],
    canParley: true,
    languages: ['Deep Speech', 'Undercommon', 'telepathy 120 ft.'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'storm_archon',
    name: 'Storm Archon',
    cr: 8,
    tier: 'elite',
    maxHp: 155,
    ac: 17,
    speed: 30,
    stats: { MIGHT: 18, AGILITY: 16, WITS: 16, GRIT: 16, CHARM: 18 },
    saveProficiencies: ['CHARM', 'WITS', 'AGILITY'],
    resistances: { lightning: 'immune', sonic: 'immune', radiant: 'resistant' },
    conditionImmunities: ['charmed', 'frightened', 'deafened', 'stunned'],
    actions: [
      { name: 'Thunder Blade', toHit: 8, damage: '2d10+4', type: 'lightning', range: null, save: null, conditions: ['stunned'], recharge: null },
      { name: 'Lightning Bolt', toHit: null, damage: '5d8', type: 'lightning', range: 100, save: { stat: 'AGILITY', dc: 16, halfOnSave: true }, conditions: ['stunned'], recharge: 5 },
      { name: 'Thunderclap', toHit: null, damage: '3d8', type: 'sonic', range: 15, save: { stat: 'GRIT', dc: 16, halfOnSave: true }, conditions: ['deafened', 'prone'], recharge: null }
    ],
    multiattack: ['Thunder Blade', 'Thunder Blade'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Thunder Blade', cost: 1, effect: 'Makes one Thunder Blade attack' },
        { name: 'Storm Shift', cost: 2, effect: 'Teleports up to 30 feet in a crack of thunder — all creatures within 5 feet of origin and destination take 2d8 sonic damage' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Storm Shield', trigger: 'Hit by a ranged attack', effect: 'Wind deflects — reduces damage by 2d8' }],
    traits: ['Flight (60 ft.)', 'Storm Aura (10 ft. — 1d8 lightning per round)', 'Legendary Resistance (2/day)', 'Celestial Nature', 'Lightning Form'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 16,
      spellAttack: 8,
      slots: { 1: 4, 2: 3, 3: 3, 4: 2 },
      knownSpells: ['shield', 'thunderwave', 'shatter', 'call lightning', 'fly', 'storm sphere']
    },
    gear: [{ ref: 'thunder_blade', slot: 'mainHand' }, { ref: 'storm_plate', slot: 'torso' }],
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'mountains',
    ecology: 'Celestial warriors of storm and thunder, sent to the material plane as executors of divine will. Storm archons are not gentle — they embody the wrathful aspect of the heavens. They appear when justice requires overwhelming force. Some have gone rogue, becoming storm tyrants rather than divine agents.',
    behavior: 'Double Thunder Blade for consistent damage. Lightning Bolt for line destruction. Thunderclap when surrounded. Storm Shift for repositioning with damage. Storm Aura damages anyone nearby. Call Lightning for sustained area damage. Fights with divine purpose — won\'t stop until its mission is complete.',
    encounterSign: 'A localized storm over a specific building or person. Lightning that strikes with intent — targeting specific individuals. Thunder that sounds like words. An armored figure descending from stormclouds.',
    socialStructure: 'Solitary agent of divine will, sometimes with 1-2 lesser celestial attendants',
    physicalDescription: 'A humanoid figure in gleaming plate armor wreathed in crackling electricity. Wings of living lightning extend from its back. Its blade is a condensed bolt. Its eyes are white with power. Thunder follows its every movement. The air ionizes in its presence.',
    weakness: 'Grounding effects reduce its lightning abilities. Silence negates Thunderclap and sonic damage. Its divine mission may have loopholes — creative interpretation of its orders can redirect or halt it. In enclosed spaces, its area effects become risky to itself.',
    loreHook: 'A storm archon has been sent to destroy the city. Not attack — destroy. Apparently, a crime was committed here that offends the heavens. The archon won\'t explain. It\'s given us one day to evacuate. The crime? Nobody knows. But the archon is coming.',
    tags: ['elemental'],
    canParley: true,
    languages: ['Common', 'Celestial', 'Primordial'],
    lootTableRef: 'elemental_elite'
  },

  // ── Batch 2 (31–60) ─────────────────────────────────────────────────

  {
    ref: 'oni_warlord',
    name: 'Oni Warlord',
    cr: 8,
    tier: 'elite',
    maxHp: 165,
    ac: 17,
    speed: 30,
    stats: { MIGHT: 20, AGILITY: 12, WITS: 16, GRIT: 18, CHARM: 16 },
    saveProficiencies: ['MIGHT', 'CHARM', 'GRIT'],
    resistances: { cold: 'resistant', fire: 'resistant' },
    conditionImmunities: ['frightened', 'charmed'],
    actions: [
      { name: 'Glaive', toHit: 9, damage: '3d10+5', type: 'slashing', range: 10, save: null, conditions: [], recharge: null },
      { name: 'Cone of Cold', toHit: null, damage: '5d8', type: 'cold', range: 30, save: { stat: 'GRIT', dc: 16, halfOnSave: true }, conditions: ['slowed'], recharge: 5 },
      { name: 'Command Oni', toHit: null, damage: '0', type: 'psychic', range: 60, save: null, conditions: [], recharge: 6 }
    ],
    multiattack: ['Glaive', 'Glaive'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Glaive Attack', cost: 1, effect: 'Makes one Glaive attack' },
        { name: 'Regenerative Surge', cost: 2, effect: 'Heals 30 HP and removes one condition' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Vengeful Strike', trigger: 'An ally within 10 feet is killed', effect: 'Makes a Glaive attack with advantage against the killer' }],
    traits: ['Regeneration (10 HP/round)', 'Change Shape', 'Flight (30 ft.)', 'Legendary Resistance (2/day)', 'Innate Spellcasting', 'Oni Commander'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 16,
      spellAttack: 8,
      slots: { 1: 4, 2: 3, 3: 3, 4: 2 },
      knownSpells: ['charm person', 'sleep', 'invisibility', 'gaseous form', 'darkness', 'cone of cold', 'fly']
    },
    gear: [{ ref: 'oni_glaive', slot: 'mainHand' }, { ref: 'demon_plate', slot: 'torso' }],
    senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'mountains',
    ecology: 'An oni that has risen to command a warband through supernatural power and martial prowess. Oni warlords are the generals of giant-kin armies, combining physical devastation with cunning magical ability. They infiltrate mortal cities in disguise to gather intelligence, then lead overwhelming assaults.',
    behavior: 'Double Glaive for devastating reach damage. Cone of Cold on groups. Command Oni buffs allies. Regeneration 10/round sustains it. Invisibility for ambush. Change Shape for infiltration. Regenerative Surge via legendary action removes conditions and heals. Fights strategically — retreats, heals, returns.',
    encounterSign: 'A charismatic stranger gathering an army in the hills. Giants and ogres following a single leader. Tactics too sophisticated for raiding parties. The leader who disappears and reappears — sometimes in two places at once.',
    socialStructure: 'Warlord commanding 10-30 ogres and giants',
    physicalDescription: 'Ten feet tall with blue-green skin, horns, and fangs. In disguise — a commanding human warlord with an unsettling intensity. In true form — a terrifying oni in dark plate armor, glaive crackling with frost. Its regeneration is visible — wounds close as you watch.',
    weakness: 'Acid and fire don\'t stop regeneration, but dealing both in one round suppresses it. In its disguised form, it can\'t use its full powers. True Seeing reveals it. Killing it in its true form while regeneration is suppressed is the only way. Its army scatters without its command.',
    loreHook: 'The warlord leading the mountain raids has been killed three times. Each time, it comes back. The army doesn\'t scatter because the warlord returns within hours. We need to figure out how to keep it dead.',
    tags: ['giant', 'fiend'],
    canParley: true,
    languages: ['Common', 'Giant'],
    lootTableRef: 'giant_elite'
  },
  {
    ref: 'wyvern_matriarch',
    name: 'Wyvern Matriarch',
    cr: 7,
    tier: 'elite',
    maxHp: 145,
    ac: 15,
    speed: 20,
    stats: { MIGHT: 20, AGILITY: 14, WITS: 8, GRIT: 18, CHARM: 6 },
    saveProficiencies: ['GRIT', 'MIGHT'],
    resistances: { poison: 'resistant' },
    conditionImmunities: ['poisoned', 'frightened'],
    actions: [
      { name: 'Bite', toHit: 9, damage: '2d10+5', type: 'piercing', range: null, save: null, conditions: [], recharge: null },
      { name: 'Stinger', toHit: 9, damage: '2d8+5', type: 'piercing', range: 10, save: { stat: 'GRIT', dc: 16, halfOnSave: false }, conditions: ['poisoned', 'paralyzed'], recharge: null },
      { name: 'Claw', toHit: 9, damage: '2d6+5', type: 'slashing', range: null, save: null, conditions: ['grappled'], recharge: null }
    ],
    multiattack: ['Bite', 'Stinger', 'Claw'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Wing Attack', cost: 1, effect: 'All creatures within 10 feet make DC 16 AGILITY save or take 2d6 bludgeoning and are knocked prone. Matriarch flies up to 20 feet.' },
        { name: 'Screech', cost: 2, effect: 'Calls 1d4 wyvern hatchlings from the nest' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Maternal Fury', trigger: 'A creature damages the nest or a hatchling', effect: 'Gains advantage on all attacks against that creature until end of its next turn' }],
    traits: ['Flight (80 ft.)', 'Keen Sight', 'Poisonous Stinger', 'Legendary Resistance (1/day)', 'Nest Defender'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'mountains',
    ecology: 'The largest female in a wyvern colony — twice the size of common wyverns and fiercely protective of her nest. She leads hunting flights and coordinates the colony\'s defense. Her venom is concentrated enough to paralyze even armored targets. The colony serves as her extended family and army.',
    behavior: 'Triple multiattack — Bite, Stinger, Claw every round. Wing Attack to reposition and knock prone. Screech to call reinforcements. Maternal Fury makes her devastating if the nest is threatened. Grapples with Claw to carry prey to the nest. Air superiority is her primary advantage.',
    encounterSign: 'Wyverns circling in coordinated formation. A massive nest on a cliff face. Livestock vanishing from high pastures. A shadow larger than the others passing overhead.',
    socialStructure: 'Matriarch of a colony of 4-8 wyverns and 10-20 hatchlings',
    physicalDescription: 'A wyvern with a thirty-foot wingspan — nearly double a standard specimen. Battle-scarred and enormously muscled. Her stinger drips venom constantly. The nesting crown on her head identifies her as matriarch. She watches everything with predatory intelligence.',
    weakness: 'Grounding her (net, grapple, Wing Binding) removes her flight advantage. On the ground, her speed is only 20. Threatening the nest draws her into reckless attacks — exploitable but dangerous. Cold slows her metabolism, reducing venom potency.',
    loreHook: 'The wyvern colony has a new matriarch — bigger than anyone\'s ever seen. The mountain pass is closed. The colony is growing. If we don\'t thin the colony this season, they\'ll expand into the valley.',
    tags: ['beast', 'dragon'],
    canParley: false,
    languages: null,
    lootTableRef: 'dragon_elite'
  },
  {
    ref: 'lich_acolyte',
    name: 'Lich Acolyte',
    cr: 8,
    tier: 'elite',
    maxHp: 135,
    ac: 16,
    speed: 30,
    stats: { MIGHT: 10, AGILITY: 14, WITS: 20, GRIT: 16, CHARM: 14 },
    saveProficiencies: ['WITS', 'GRIT', 'CHARM'],
    resistances: { necrotic: 'immune', poison: 'immune', cold: 'resistant', radiant: 'vulnerable' },
    conditionImmunities: ['poisoned', 'charmed', 'frightened', 'exhaustion', 'paralyzed'],
    actions: [
      { name: 'Paralyzing Touch', toHit: 9, damage: '2d8+5', type: 'necrotic', range: null, save: { stat: 'GRIT', dc: 16, halfOnSave: false }, conditions: ['paralyzed'], recharge: null },
      { name: 'Necrotic Bolt', toHit: 9, damage: '3d8+5', type: 'necrotic', range: 60, save: null, conditions: [], recharge: null },
      { name: 'Death Shroud', toHit: null, damage: '4d8', type: 'necrotic', range: 20, save: { stat: 'GRIT', dc: 16, halfOnSave: true }, conditions: ['max_hp_reduced'], recharge: 5 }
    ],
    multiattack: null,
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Necrotic Bolt', cost: 1, effect: 'Fires one Necrotic Bolt' },
        { name: 'Paralyzing Touch', cost: 2, effect: 'Makes one Paralyzing Touch attack' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Counterspell', trigger: 'A creature within 60 feet casts a spell', effect: 'Counters spells of 3rd level or lower automatically. Higher levels require DC 10 + spell level WITS check.' }],
    traits: ['Rejuvenation (reforms in 1d10 days at phylactery)', 'Magic Resistance', 'Turn Resistance', 'Legendary Resistance (2/day)', 'Phylactery Bond'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 16,
      spellAttack: 9,
      slots: { 1: 4, 2: 3, 3: 3, 4: 2 },
      knownSpells: ['shield', 'magic missile', 'mirror image', 'misty step', 'counterspell', 'animate dead', 'dimension door', 'blight']
    },
    gear: [{ ref: 'lich_staff', slot: 'mainHand' }, { ref: 'necromancer_robes', slot: 'torso' }],
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'dungeon',
    ecology: 'A recently created lich — one who completed the transformation within the last century. It has the undead immortality and spellcasting power of a lich but lacks the millennia of accumulated knowledge and power of an ancient one. Still extraordinarily dangerous — but a stepping stone, not a final boss.',
    behavior: 'Counterspell enemy magic. Death Shroud for area necrotic. Necrotic Bolt at range. Paralyzing Touch via legendary action. Shield and Mirror Image for defense. Animate Dead for minions. Dimension Door to escape. Fights intelligently but cautiously — it has eternity ahead of it.',
    encounterSign: 'A wizard\'s tower where the occupant hasn\'t been seen in decades — but magic still emanates from it. Skeletons performing maintenance tasks. A library that reorganizes itself. The smell of embalming fluid and old parchment.',
    socialStructure: 'Solitary with 4-8 undead servants',
    physicalDescription: 'A skeletal figure in mage\'s robes, its hands still fleshed enough to grip a staff. Green-blue light burns in its eye sockets. Its jaw moves with clicking precision. It still gestures like a living wizard — old habits die hard, even after the wizard does.',
    weakness: 'Phylactery must be found and destroyed. Radiant damage is doubled. Holy water deals 2d6. It\'s paranoid about its phylactery — threatening it draws all its attention. Without the phylactery, killing it is permanent. Silver disrupts its magic focus.',
    loreHook: 'The archmage didn\'t die of old age. He didn\'t die at all. The tower sealed itself fifty years ago. Something inside is still casting spells. The academy wants to know what he became. The church wants to destroy it. Both are hiring.',
    tags: ['undead'],
    canParley: true,
    languages: ['Common', 'Draconic', 'Abyssal'],
    lootTableRef: 'undead_elite'
  },
  {
    ref: 'dire_troll',
    name: 'Dire Troll',
    cr: 9,
    tier: 'elite',
    maxHp: 185,
    ac: 15,
    speed: 35,
    stats: { MIGHT: 22, AGILITY: 12, WITS: 8, GRIT: 22, CHARM: 4 },
    saveProficiencies: ['GRIT', 'MIGHT'],
    resistances: { bludgeoning: 'resistant', poison: 'resistant' },
    conditionImmunities: ['poisoned', 'frightened'],
    actions: [
      { name: 'Claw', toHit: 10, damage: '2d8+6', type: 'slashing', range: null, save: null, conditions: ['bleeding'], recharge: null },
      { name: 'Bite', toHit: 10, damage: '2d10+6', type: 'piercing', range: null, save: null, conditions: ['bleeding'], recharge: null },
      { name: 'Rend', toHit: null, damage: '4d8+6', type: 'slashing', range: null, save: { stat: 'MIGHT', dc: 18, halfOnSave: false }, conditions: ['bleeding', 'prone'], recharge: 5 }
    ],
    multiattack: ['Claw', 'Claw', 'Bite'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Claw', cost: 1, effect: 'Makes one Claw attack' },
        { name: 'Frenzy', cost: 2, effect: 'Makes a Bite and two Claw attacks but takes 10 damage from overexertion' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Relentless Regeneration', trigger: 'Reduced to 0 HP by non-fire/acid damage', effect: 'Drops to 1 HP instead. Once per day.' }],
    traits: ['Regeneration (20 HP/round, stops with fire or acid)', 'Keen Smell', 'Siege Monster', 'Legendary Resistance (1/day)', 'Dire Regeneration'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'swamp',
    ecology: 'A troll that has lived long enough to grow to enormous proportions. Dire trolls are fifteen feet tall with regeneration so powerful they can regrow severed limbs in seconds. They\'re the apex predators of any ecosystem they inhabit, capable of taking on giants. Only fire and acid can permanently stop them.',
    behavior: 'Triple multiattack — Claw, Claw, Bite every round. Rend for devastating burst on a single target. Frenzy for legendary-action nova at a cost. Regeneration 20/round — almost impossible to out-damage without fire or acid. Relentless Regeneration prevents the first death by non-fire/acid. This is a war of attrition you can\'t win without the right damage types.',
    encounterSign: 'Trees uprooted and thrown. Claw marks at fifteen-foot height. A swath of destruction through the forest. Everything larger than a dog in the area is dead.',
    socialStructure: 'Solitary — too aggressive for even other trolls',
    physicalDescription: 'Fifteen feet of lean, rubbery muscle covered in warty green skin. Its arms nearly reach the ground. Its face is a nightmare of regenerated tissue — features that grew back wrong, multiple times. It heals visibly — cuts seal as you watch, severed fingers regrow in seconds.',
    weakness: 'Fire and acid stop its regeneration — essential for victory. Without these, it heals 20 HP per round and is functionally unkillable. Its intelligence is minimal — it can be tricked. Fire particularly frightens it — the one thing it can\'t regenerate from quickly.',
    loreHook: 'The hunting party found it and hit it with everything they had. It went down. Then it got up. They hit it again. It got up again. Then it started chasing them. It hasn\'t stopped for three days.',
    tags: ['giant'],
    canParley: false,
    languages: ['Giant'],
    lootTableRef: 'giant_elite'
  },
  {
    ref: 'revenant_champion',
    name: 'Revenant Champion',
    cr: 7,
    tier: 'elite',
    maxHp: 140,
    ac: 17,
    speed: 30,
    stats: { MIGHT: 20, AGILITY: 12, WITS: 14, GRIT: 18, CHARM: 14 },
    saveProficiencies: ['GRIT', 'CHARM', 'MIGHT'],
    resistances: { necrotic: 'immune', poison: 'immune', radiant: 'vulnerable' },
    conditionImmunities: ['poisoned', 'exhaustion', 'charmed', 'frightened', 'paralyzed'],
    actions: [
      { name: 'Vengeful Greatsword', toHit: 9, damage: '2d12+5', type: 'slashing', range: null, save: null, conditions: [], recharge: null },
      { name: 'Vengeful Glare', toHit: null, damage: '3d8', type: 'psychic', range: 30, save: { stat: 'CHARM', dc: 15, halfOnSave: true }, conditions: ['frightened', 'paralyzed'], recharge: 5 }
    ],
    multiattack: ['Vengeful Greatsword', 'Vengeful Greatsword'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Attack', cost: 1, effect: 'Makes one Vengeful Greatsword attack' },
        { name: 'Relentless Pursuit', cost: 2, effect: 'Moves up to its speed toward its sworn target without provoking opportunity attacks and makes one attack' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Deathless Resolve', trigger: 'Reduced to 0 HP', effect: 'If its sworn target still lives, reforms with 30 HP at the start of its next turn. Once per day.' }],
    traits: ['Rejuvenation (reforms in 24 hours if sworn target lives)', 'Vengeful Tracker (always knows direction and distance to sworn target)', 'Turn Immunity', 'Legendary Resistance (2/day)', 'Undying Vengeance'],
    spellcasting: null,
    gear: [{ ref: 'vengeful_greatsword', slot: 'mainHand' }, { ref: 'revenant_plate', slot: 'torso' }],
    senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'any',
    ecology: 'A warrior who was wrongfully killed and returned from death with a single purpose: vengeance against the one who murdered them. Revenant champions are bound to their target with supernatural certainty. They cannot be permanently destroyed until their vengeance is fulfilled or their target dies. They retain their martial skill and add undead resilience.',
    behavior: 'Double Vengeful Greatsword on its sworn target. Vengeful Glare to paralyze anyone between it and its target. Relentless Pursuit via legendary action — closes distance unstoppably. Deathless Resolve means killing it once isn\'t enough. It will always come back while the target lives. Single-minded — ignores non-targets unless attacked.',
    encounterSign: 'A dead warrior walking toward a specific destination with implacable purpose. People who get in its way are pushed aside or cut down. It doesn\'t eat, sleep, or speak. It just walks toward someone.',
    socialStructure: 'Solitary — bound to a singular purpose',
    physicalDescription: 'A warrior in battered plate armor, body bearing the wounds of their death. Their eyes burn with cold fire. They carry the weapon they died with. Despite their undead state, they move with the practiced grace of a master fighter. Their face is set in an expression of absolute determination.',
    weakness: 'Fulfilling the vengeance (the target dying) lays it to rest permanently. Radiant damage prevents Deathless Resolve. Imprisoning it (not killing it) in a radiant cell can contain it. Resolving the injustice that created it — proving the murder was justified — can also lay it to rest.',
    loreHook: 'The duke murdered his champion and buried the body. The champion is back. It walked across two kingdoms to get here. The duke is hiding behind his army. The army can\'t stop it. Nothing can stop it. The champion wants to talk to the duke. With a sword.',
    tags: ['undead'],
    canParley: true,
    languages: ['languages from life'],
    lootTableRef: 'undead_elite'
  },
  {
    ref: 'purple_worm_juvenile',
    name: 'Juvenile Purple Worm',
    cr: 9,
    tier: 'elite',
    maxHp: 180,
    ac: 17,
    speed: 40,
    stats: { MIGHT: 24, AGILITY: 8, WITS: 4, GRIT: 22, CHARM: 2 },
    saveProficiencies: ['GRIT', 'MIGHT'],
    resistances: { acid: 'resistant', poison: 'resistant' },
    conditionImmunities: ['poisoned', 'prone', 'frightened'],
    actions: [
      { name: 'Bite', toHit: 11, damage: '3d10+7', type: 'piercing', range: 10, save: null, conditions: [], recharge: null },
      { name: 'Swallow', toHit: null, damage: '4d8', type: 'acid', range: null, save: { stat: 'AGILITY', dc: 17, halfOnSave: false }, conditions: ['restrained', 'suffocating'], recharge: null },
      { name: 'Tail Stinger', toHit: 11, damage: '2d8+7', type: 'piercing', range: 10, save: { stat: 'GRIT', dc: 17, halfOnSave: false }, conditions: ['poisoned'], recharge: null }
    ],
    multiattack: ['Bite', 'Tail Stinger'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Tail Attack', cost: 1, effect: 'Makes one Tail Stinger attack' },
        { name: 'Tunneling Charge', cost: 2, effect: 'Burrows 20 feet and erupts — all creatures in the path make DC 17 AGILITY save or take 3d10 bludgeoning' }
      ]
    },
    lairActions: null,
    reactions: null,
    traits: ['Burrow (30 ft.)', 'Tunneler', 'Tremorsense', 'Legendary Resistance (1/day)', 'Swallow (on successful Bite against grappled or prone target)'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: null, blindsight: 30, tremorsense: 120, truesight: null },
    habitat: 'underground',
    ecology: 'A young purple worm — only forty feet long compared to the adult\'s eighty. Still among the most devastating subterranean predators. It tunnels through solid rock, swallowing anything in its path. Its venom paralyzes prey from behind while its mouth devours from the front. The tunnels it creates reshape underground geography.',
    behavior: 'Multiattack with Bite and Tail Stinger from both ends. Swallow prone or grappled targets — they take acid damage inside. Tunneling Charge for burst damage and repositioning. Erupts from below. Targets the largest prey first — it\'s always hungry.',
    encounterSign: 'New tunnels where none existed. The ground collapsing into sinkholes. Tremors that follow a pattern — something large moving underground. Miners vanishing from the deepest shafts.',
    socialStructure: 'Solitary — cannibalistic toward other purple worms',
    physicalDescription: 'A segmented, purple-skinned worm forty feet long and ten feet in diameter. Its mouth is a ring of inward-facing teeth. A venomous stinger protrudes from its tail. Blind — it hunts entirely by tremorsense. When it erupts from the ground, rock and earth fountain around it.',
    weakness: 'Standing still or flying makes you invisible to its tremorsense. Cold slows its metabolism — reduces speed and burrow. Forcing it to the surface removes its tunneling advantage. Inside its mouth, a DC 17 MIGHT check lets a swallowed creature cut out (20 slashing damage to the worm\'s interior).',
    loreHook: 'The dwarven highway collapsed. Something tunneled through the support pillars. The miners say it\'s a purple worm — a young one. The highway connects two kingdoms. If we don\'t kill it, the trade route dies. If we go after it underground, we might die.',
    tags: ['beast'],
    canParley: false,
    languages: null,
    lootTableRef: 'beast_elite'
  },
  {
    ref: 'shadow_assassin_lord',
    name: 'Shadow Assassin Lord',
    cr: 8,
    tier: 'elite',
    maxHp: 130,
    ac: 18,
    speed: 40,
    stats: { MIGHT: 14, AGILITY: 22, WITS: 16, GRIT: 16, CHARM: 14 },
    saveProficiencies: ['AGILITY', 'WITS', 'CHARM'],
    resistances: { necrotic: 'resistant', poison: 'resistant' },
    conditionImmunities: ['charmed', 'frightened'],
    actions: [
      { name: 'Shadow Blade', toHit: 10, damage: '2d8+6', type: 'necrotic', range: null, save: null, conditions: ['weakened'], recharge: null },
      { name: 'Death Strike', toHit: 10, damage: '6d6+6', type: 'piercing', range: null, save: null, conditions: ['bleeding', 'stunned'], recharge: null },
      { name: 'Shadow Bomb', toHit: null, damage: '3d8', type: 'necrotic', range: 20, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['deafened'], recharge: 5 }
    ],
    multiattack: ['Shadow Blade', 'Shadow Blade'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Shadow Step', cost: 1, effect: 'Teleports up to 30 feet to a shadow and becomes invisible until end of next turn or until it attacks' },
        { name: 'Death Strike', cost: 2, effect: 'Makes one Death Strike against a surprised or incapacitated target — deals double damage on the first hit' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Evasion', trigger: 'Targeted by an area effect', effect: 'Takes no damage on a successful save, half on a failure' }],
    traits: ['Shadow Step (teleport between shadows)', 'Assassinate (advantage on surprised creatures, auto-crit)', 'Evasion', 'Legendary Resistance (2/day)', 'Master of Shadows'],
    spellcasting: null,
    gear: [{ ref: 'shadow_blade_pair', slot: 'mainHand' }, { ref: 'shadow_blade_pair', slot: 'offHand' }, { ref: 'shadow_silk', slot: 'torso' }],
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'urban',
    ecology: 'The master of a shadow assassin guild — a killer so skilled they\'ve transcended normal assassination into supernatural shadow magic. They take contracts on the most dangerous targets: archmages, dragon lords, monarchs. Each kill enhances their shadow bond. They are the thing other assassins are afraid of.',
    behavior: 'Opens invisible from shadows. Death Strike on the most valuable target — auto-crit from surprise for devastating alpha strike. Double Shadow Blade for sustained damage. Shadow Step to vanish and reposition. Shadow Bomb for area disruption. Evasion avoids area effects. This is a surgical strike — it kills the target and disappears.',
    encounterSign: 'A shadow that moves when no one is looking. A target found dead with wounds that don\'t match any known weapon. The feeling of being watched — confirmed when something moves at the edge of dark vision. No footprints, no witnesses, no evidence.',
    socialStructure: 'Guild master with a network of 10-30 shadow assassins',
    physicalDescription: 'A figure that is more shadow than substance. In the light, a lean warrior in black silk with twin blades. In shadow, a silhouette with glowing eyes that melts into darkness. Their movements are impossibly fluid — more flowing than stepping.',
    weakness: 'Bright light (daylight spell) prevents Shadow Step and invisibility. Radiant damage disrupts shadow bonds. True Seeing reveals it in all conditions. In full light with nowhere to hide, it\'s a very skilled but mortal fighter. Faerie Fire negates its stealth.',
    loreHook: 'Someone took a contract on the king. Not a normal contract — a shadow contract. The Shadow Assassin Lord has accepted it personally. The king has seven days. We need to find the lord before it finds the king.',
    tags: ['humanoid', 'shadow'],
    canParley: true,
    languages: ['Common', 'Thieves\' Cant', 'Shadowfell tongues'],
    lootTableRef: 'shadow_elite'
  },
  {
    ref: 'iron_dragon_wyrmling',
    name: 'Iron Dragon Wyrmling',
    cr: 7,
    tier: 'elite',
    maxHp: 140,
    ac: 18,
    speed: 30,
    stats: { MIGHT: 20, AGILITY: 10, WITS: 14, GRIT: 20, CHARM: 12 },
    saveProficiencies: ['GRIT', 'MIGHT', 'CHARM'],
    resistances: { fire: 'resistant', slashing: 'resistant', piercing: 'resistant', bludgeoning: 'resistant', lightning: 'vulnerable' },
    conditionImmunities: ['poisoned', 'frightened'],
    actions: [
      { name: 'Iron Bite', toHit: 9, damage: '2d12+5', type: 'piercing', range: null, save: null, conditions: [], recharge: null },
      { name: 'Claw', toHit: 9, damage: '2d6+5', type: 'slashing', range: null, save: null, conditions: [], recharge: null },
      { name: 'Magnetic Breath', toHit: null, damage: '4d8', type: 'force', range: 30, save: { stat: 'MIGHT', dc: 16, halfOnSave: true }, conditions: ['restrained', 'teleported'], recharge: 5 }
    ],
    multiattack: ['Iron Bite', 'Claw', 'Claw'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Detect', cost: 1, effect: 'Makes a perception check' },
        { name: 'Iron Wing Buffet', cost: 2, effect: 'All creatures within 10 feet make DC 16 MIGHT save or take 2d8 bludgeoning and are knocked prone. Dragon can fly 20 feet.' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Iron Scales', trigger: 'Takes a critical hit', effect: 'The critical becomes a normal hit — iron scales absorb the impact' }],
    traits: ['Flight (60 ft.)', 'Legendary Resistance (1/day)', 'Iron Body', 'Magnetic Field (metal weapons have disadvantage when attacking within 10 ft.)', 'Metal Sense (detects metal within 120 ft.)'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 30, tremorsense: 60, truesight: null },
    habitat: 'mountains',
    ecology: 'A young dragon with scales of literal iron — metallic and incredibly resilient. Iron dragons are rare, born where the Plane of Earth bleeds into the material world. Their magnetic breath pulls metal objects (and their wielders) toward the dragon. They hoard metal obsessively, especially rare alloys.',
    behavior: 'Triple multiattack. Magnetic Breath pulls metal-wearing enemies toward it. Magnetic Field gives disadvantage to metal weapons nearby. Iron Wing Buffet for area control. Iron Scales prevent crits. Targets metal-wearing enemies preferentially — it wants their equipment.',
    encounterSign: 'Compasses spinning wildly. Metal objects vibrating in a specific direction. A cave with walls polished by scales. A hoard of metal — not gold, but iron, steel, mithral, adamantine.',
    socialStructure: 'Solitary, hoards metal',
    physicalDescription: 'A dragon with scales of polished iron that reflect light like mirrors. Its wings are sheet metal. Its breath weapon is a cone of magnetic force that draws metal toward it. Sparks arc between its teeth. When it moves, the sound is of grinding metal. Even young, it\'s impressively armored.',
    weakness: 'Lightning damage bypasses its resistances and disrupts its magnetic field for 1 round. Non-metallic weapons (wood, stone, bone, crystal) ignore the Magnetic Field disadvantage. Rust effects are devastating — each application reduces AC by 1 permanently. It\'s vain about its scales — tarnishing them enrages it into reckless attacks.',
    loreHook: 'Every piece of metal in the mining town is being pulled toward the mountain. Weapons fly from hands. Armor walks off on its own. An iron dragon has moved in and it\'s magnetizing everything within a mile. The dwarves want their mine back.',
    tags: ['dragon'],
    canParley: true,
    languages: ['Common', 'Draconic'],
    lootTableRef: 'dragon_elite'
  },
  {
    ref: 'plague_lord',
    name: 'Plague Lord',
    cr: 9,
    tier: 'elite',
    maxHp: 170,
    ac: 14,
    speed: 30,
    stats: { MIGHT: 16, AGILITY: 10, WITS: 18, GRIT: 20, CHARM: 16 },
    saveProficiencies: ['GRIT', 'WITS', 'CHARM'],
    resistances: { poison: 'immune', necrotic: 'immune', acid: 'resistant' },
    conditionImmunities: ['poisoned', 'diseased', 'exhaustion', 'frightened'],
    actions: [
      { name: 'Plague Touch', toHit: 7, damage: '2d10+3', type: 'necrotic', range: null, save: { stat: 'GRIT', dc: 17, halfOnSave: false }, conditions: ['diseased', 'poisoned'], recharge: null },
      { name: 'Miasma', toHit: null, damage: '4d8', type: 'poison', range: 30, save: { stat: 'GRIT', dc: 17, halfOnSave: true }, conditions: ['poisoned', 'diseased', 'weakened'], recharge: 5 },
      { name: 'Pandemic Wave', toHit: null, damage: '5d8', type: 'necrotic', range: 20, save: { stat: 'GRIT', dc: 17, halfOnSave: true }, conditions: ['diseased', 'max_hp_reduced'], recharge: 6 }
    ],
    multiattack: ['Plague Touch', 'Plague Touch'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Plague Touch', cost: 1, effect: 'Makes one Plague Touch attack' },
        { name: 'Infection Spread', cost: 2, effect: 'All diseased creatures within 30 feet infect adjacent non-diseased creatures (DC 15 GRIT or diseased)' },
        { name: 'Plague Pulse', cost: 3, effect: 'All diseased creatures within 30 feet take 3d8 necrotic damage' }
      ]
    },
    lairActions: [
      { name: 'Disease Cloud', effect: 'A 20-foot area fills with disease — DC 16 GRIT or become diseased' },
      { name: 'Corpse Rise', effect: 'A creature that died of disease in the lair rises as a plague zombie' }
    ],
    reactions: [{ name: 'Pestilent Shield', trigger: 'Hit by a melee attack', effect: 'Attacker must make DC 16 GRIT save or become diseased' }],
    traits: ['Disease Aura (10 ft. — DC 15 GRIT or diseased)', 'Legendary Resistance (3/day)', 'Plague Master', 'Undead Fortitude', 'Disease Empowerment (heals when nearby creatures take disease damage)'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 17,
      spellAttack: 9,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      knownSpells: ['detect poison and disease', 'ray of sickness', 'blindness/deafness', 'bestow curse', 'contagion', 'cloudkill', 'blight']
    },
    gear: null,
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'any',
    ecology: 'A being that IS plague — a sentient disease given form. Some were once mortals who worshipped pestilence; others are fiends or undead that achieved apotheosis through epidemic. The plague lord doesn\'t just carry disease — it IS the disease, and every infected creature is an extension of its body.',
    behavior: 'Double Plague Touch to spread disease. Miasma for area infection. Pandemic Wave for devastating burst. Infection Spread makes diseased PCs infect each other. Plague Pulse damages all diseased creatures. Disease Empowerment heals from nearby disease damage. The longer the fight goes, the more the disease spreads and the stronger it gets.',
    encounterSign: 'An epidemic that starts suddenly and spreads impossibly fast. The disease has purpose — it targets specific populations. A figure at the center of the quarantine zone who doesn\'t look sick. Plague rats moving in formation.',
    socialStructure: 'Center of a disease network, attended by plague cultists and plague zombies',
    physicalDescription: 'A tall, gaunt figure whose body is a walking lesson in pathology. Boils, lesions, and fungal growths cover every surface. Its breath is visible miasma. Where it walks, plants wilt and water turns foul. It might have been beautiful once — now it is disease given a face.',
    weakness: 'Cure Disease/Greater Restoration removes its infections. Radiant damage bypasses Disease Empowerment. Quarantine (restricting its movement) limits spread. Destroying it in a sealed area prevents pandemic. Creatures immune to disease (constructs, high-GRIT paladins) are unaffected by most abilities.',
    loreHook: 'The plague isn\'t natural. It has a source. A person. They were spotted at the center of every outbreak, calm and smiling. The disease is getting smarter — mutating to beat our treatments. Because someone is directing it.',
    tags: ['undead', 'fiend'],
    canParley: true,
    languages: ['Common', 'Abyssal'],
    lootTableRef: 'undead_elite'
  },
  {
    ref: 'marilith',
    name: 'Marilith',
    cr: 10,
    tier: 'elite',
    maxHp: 195,
    ac: 18,
    speed: 40,
    stats: { MIGHT: 20, AGILITY: 20, WITS: 16, GRIT: 18, CHARM: 18 },
    saveProficiencies: ['MIGHT', 'AGILITY', 'CHARM', 'GRIT'],
    resistances: { fire: 'immune', poison: 'immune', cold: 'resistant', lightning: 'resistant', bludgeoning: 'resistant', slashing: 'resistant', piercing: 'resistant' },
    conditionImmunities: ['poisoned', 'charmed', 'frightened'],
    actions: [
      { name: 'Longsword', toHit: 9, damage: '2d8+5', type: 'slashing', range: null, save: null, conditions: [], recharge: null },
      { name: 'Tail', toHit: 9, damage: '2d10+5', type: 'bludgeoning', range: 10, save: null, conditions: ['grappled'], recharge: null },
      { name: 'Teleport', toHit: null, damage: '0', type: 'force', range: 60, save: null, conditions: [], recharge: null }
    ],
    multiattack: ['Longsword', 'Longsword', 'Longsword', 'Longsword', 'Longsword', 'Longsword', 'Tail'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Attack', cost: 1, effect: 'Makes one Longsword or Tail attack' },
        { name: 'Teleport', cost: 1, effect: 'Teleports up to 60 feet' },
        { name: 'Whirlwind of Steel', cost: 3, effect: 'Makes six Longsword attacks against all creatures within 10 feet, divided as it chooses' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Parry', trigger: 'Hit by a melee attack', effect: 'Adds +5 to AC against that attack' }],
    traits: ['Legendary Resistance (3/day)', 'Magic Resistance', 'Reactive (multiple reactions per round)', 'Six Arms', 'Demonic Resilience'],
    spellcasting: null,
    gear: [{ ref: 'demonic_longsword', slot: 'mainHand' }],
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: 120 },
    habitat: 'planar',
    ecology: 'A six-armed serpentine demon general — among the highest-ranking demons in the Abyss. Mariliths command demonic armies and are as strategically brilliant as they are physically devastating. Six longswords wielded simultaneously make them the deadliest melee combatants in the fiendish hierarchy. They teleport constantly, making them nearly impossible to pin down.',
    behavior: 'SEVEN attacks per round — six Longswords and a Tail. Teleport to reposition freely. Parry for defense. Legendary Teleport between turns. Whirlwind of Steel against groups. Reactive allows multiple Parries per round. This is the highest damage-per-round creature in the elite tier. Pure martial devastation.',
    encounterSign: 'A demonic army with disciplined formations — unusual for demons. Six parallel slash marks on every surface. A serpentine form glimpsed in the firelight. The smell of sulfur and blood.',
    socialStructure: 'General commanding 10-50 lesser demons',
    physicalDescription: 'A serpent from the waist down — fifteen feet of coiled demonic muscle. A humanoid torso with six arms, each wielding a longsword of infernal make. Beautiful and terrible in equal measure. Every movement is a sword stroke. Even standing still, the blades whirl in defensive patterns.',
    weakness: 'Cold iron weapons bypass its resistances. Banishment returns it to the Abyss. Restraining its arms (grapple, hold monster) dramatically reduces its damage output. Without its swords, it\'s still dangerous but far less so. Holy Weapon enchantments deal extra damage.',
    loreHook: 'The demon general has crossed into our world. It didn\'t come for treasure or souls — it came for the portal. If it secures the portal, the demonic army follows. We have one chance to stop it before reinforcements arrive.',
    tags: ['fiend'],
    canParley: true,
    languages: ['Common', 'Abyssal', 'telepathy 120 ft.'],
    lootTableRef: 'fiend_elite'
  },
  {
    ref: 'elder_earth_elemental',
    name: 'Elder Earth Elemental',
    cr: 8,
    tier: 'elite',
    maxHp: 175,
    ac: 18,
    speed: 25,
    stats: { MIGHT: 22, AGILITY: 6, WITS: 10, GRIT: 22, CHARM: 6 },
    saveProficiencies: ['GRIT', 'MIGHT'],
    resistances: { bludgeoning: 'resistant', slashing: 'resistant', piercing: 'resistant', fire: 'resistant', poison: 'immune', lightning: 'vulnerable' },
    conditionImmunities: ['poisoned', 'prone', 'exhaustion', 'charmed', 'frightened', 'paralyzed'],
    actions: [
      { name: 'Slam', toHit: 10, damage: '3d10+6', type: 'bludgeoning', range: null, save: null, conditions: ['prone'], recharge: null },
      { name: 'Earth Shatter', toHit: null, damage: '4d8', type: 'bludgeoning', range: 20, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['prone', 'restrained'], recharge: 5 }
    ],
    multiattack: ['Slam', 'Slam'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Slam', cost: 1, effect: 'Makes one Slam attack' },
        { name: 'Earth Glide', cost: 2, effect: 'Burrows through earth or stone 30 feet and erupts — all creatures within 10 feet of exit make DC 16 AGILITY save or take 2d10 bludgeoning' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Stone Absorb', trigger: 'Takes bludgeoning, slashing, or piercing damage while on stone or earth', effect: 'Absorbs 2d8 of the damage by pulling rock around itself' }],
    traits: ['Earth Glide (moves through earth/stone)', 'Siege Monster', 'Legendary Resistance (2/day)', 'Tremorsense', 'Earth Mastery'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 60, blindsight: 30, tremorsense: 120, truesight: null },
    habitat: 'underground',
    ecology: 'The most powerful form of earth elemental — twenty feet of living stone and mineral. Elder earth elementals can reshape the landscape, create earthquakes, and move through solid rock as if it were water. They are ancient — some have been in the earth since the world formed. Slow to anger, but unstoppable once provoked.',
    behavior: 'Double Slam for devastating bludgeoning. Earth Shatter for area control. Earth Glide through stone for ambush and escape. Stone Absorb for damage reduction on earth. Slow but nearly indestructible on its home terrain. Will reshape the battlefield — collapsing tunnels, raising walls, creating pits.',
    encounterSign: 'Earthquakes in a pattern. Stone walls that grow or shift. A face in the rock wall that wasn\'t there before. The ground vibrating in a slow, rhythmic pulse like a heartbeat.',
    socialStructure: 'Solitary, sometimes attended by smaller earth elementals',
    physicalDescription: 'Twenty feet of animated stone, crystal, and mineral. Its "face" is a fault line that opens and closes. Gems and veins of ore are visible in its body. When it moves, the ground trembles. It speaks in the grinding of tectonic plates. It is geology given anger.',
    weakness: 'Lightning damage is doubled and cracks its body — reduces AC by 1 per 20 lightning damage. Water erodes it — sustained water exposure deals ongoing damage. In open air without contact to earth or stone, it loses Earth Glide, Stone Absorb, and Tremorsense. Thunder/sonic damage can shatter crystal formations.',
    loreHook: 'The mountain is angry. Not metaphorically — it\'s moving. The earth elemental at its core woke up after a millennium. The miners drilled too deep and disturbed it. Now it\'s closing every mine shaft in the range. We need it calmed or defeated before the mining economy collapses.',
    tags: ['elemental'],
    canParley: false,
    languages: ['Terran'],
    lootTableRef: 'elemental_elite'
  },
  {
    ref: 'night_hag_coven_leader',
    name: 'Night Hag Coven Leader',
    cr: 9,
    tier: 'elite',
    maxHp: 155,
    ac: 16,
    speed: 30,
    stats: { MIGHT: 18, AGILITY: 14, WITS: 18, GRIT: 18, CHARM: 18 },
    saveProficiencies: ['WITS', 'CHARM', 'GRIT'],
    resistances: { cold: 'resistant', fire: 'resistant', necrotic: 'resistant' },
    conditionImmunities: ['charmed', 'frightened'],
    actions: [
      { name: 'Claw', toHit: 8, damage: '2d8+4', type: 'slashing', range: null, save: null, conditions: ['diseased'], recharge: null },
      { name: 'Nightmare Touch', toHit: 8, damage: '3d8+4', type: 'psychic', range: null, save: null, conditions: ['exhaustion'], recharge: null },
      { name: 'Soul Cage', toHit: null, damage: '5d8', type: 'necrotic', range: 30, save: { stat: 'CHARM', dc: 17, halfOnSave: true }, conditions: ['frightened', 'max_hp_reduced'], recharge: 5 }
    ],
    multiattack: ['Claw', 'Nightmare Touch'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Claw', cost: 1, effect: 'Makes one Claw attack' },
        { name: 'Ethereal Jaunt', cost: 2, effect: 'Enters the Ethereal Plane — visible but untouchable until start of next turn' },
        { name: 'Coven Spell', cost: 3, effect: 'Casts a spell from the coven spell list without expending a slot (requires other coven members within 30 ft.)' }
      ]
    },
    lairActions: [
      { name: 'Nightmare Fog', effect: 'A 20-foot area fills with hallucinatory fog — DC 16 WITS save or frightened by visions of personal fears' },
      { name: 'Soul Snare', effect: 'One creature below half HP must make DC 16 CHARM save or have its soul partially pulled from its body — stunned for 1 round' }
    ],
    reactions: [{ name: 'Hag\'s Eye', trigger: 'A creature within 60 feet casts a spell targeting the coven', effect: 'Redirects the spell to the caster (CHARM save DC 17 to resist)' }],
    traits: ['Legendary Resistance (3/day)', 'Magic Resistance', 'Change Shape', 'Etherealness', 'Night Hag Coven (shared spellcasting)', 'Heartstone (ethereal travel)', 'Soul Bag'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 17,
      spellAttack: 9,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      knownSpells: ['detect magic', 'ray of sickness', 'hold person', 'bestow curse', 'counterspell', 'polymorph', 'contact other plane', 'eyebite', 'dream']
    },
    gear: [{ ref: 'heartstone', slot: 'neck' }, { ref: 'soul_bag', slot: 'belt' }],
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'swamp',
    ecology: 'The leader of a night hag coven — the most dangerous configuration of hags. Coven leaders are ancient, having lived for millennia and accumulated dark wisdom. They steal souls, trade in nightmares, and corrupt mortals through dreams. The coven amplifies their power exponentially. A single hag is dangerous; a coven is catastrophic.',
    behavior: 'Multiattack with Claw and Nightmare Touch. Soul Cage for devastating burst. Ethereal Jaunt to become untouchable. Coven Spell for versatile casting. Nightmare Fog and Soul Snare in lair. Hag\'s Eye redirects spells. Dream for long-range torment. This fight is about attrition — the hag coven wears you down.',
    encounterSign: 'Nightmares affecting an entire community. People dying in their sleep with expressions of terror. A swamp where the trees weep. Three identical old women seen in different places — but never at the same time.',
    socialStructure: 'Leader of a coven of 3 night hags, with 10-20 corrupted servants',
    physicalDescription: 'In true form — a blue-black skinned hag, seven feet tall, with horns and claws. Her eyes are milky but see everything. She carries a bag of writhing soul-stuff. In disguise — a wise old woman, a beautiful stranger, whatever serves her purpose. The heartstone at her throat pulses with trapped dreams.',
    weakness: 'Stealing or destroying the heartstone prevents Etherealness. Destroying the soul bag releases trapped souls (disrupting her power). Killing all three coven members ends coven spellcasting. Moonlight forces her to reveal her true form. Protection from Evil blocks Nightmare Touch and Dream.',
    loreHook: 'The village elders are dying in their sleep. All of them. The priest says something is stealing their souls — not metaphorically. The hag coven in the deep swamp has been quiet for a century. They\'re not quiet anymore.',
    tags: ['fiend', 'fey'],
    canParley: true,
    languages: ['Common', 'Abyssal', 'Infernal', 'Primordial'],
    lootTableRef: 'fiend_elite'
  },
  {
    ref: 'goristro',
    name: 'Goristro',
    cr: 10,
    tier: 'elite',
    maxHp: 210,
    ac: 17,
    speed: 40,
    stats: { MIGHT: 26, AGILITY: 10, WITS: 6, GRIT: 22, CHARM: 10 },
    saveProficiencies: ['MIGHT', 'GRIT'],
    resistances: { fire: 'immune', poison: 'immune', cold: 'resistant', bludgeoning: 'resistant', slashing: 'resistant', piercing: 'resistant' },
    conditionImmunities: ['poisoned', 'frightened', 'charmed'],
    actions: [
      { name: 'Gore', toHit: 12, damage: '3d12+8', type: 'piercing', range: null, save: null, conditions: ['prone'], recharge: null },
      { name: 'Fist', toHit: 12, damage: '3d8+8', type: 'bludgeoning', range: null, save: null, conditions: ['stunned'], recharge: null },
      { name: 'Charge', toHit: 12, damage: '4d12+8', type: 'bludgeoning', range: null, save: { stat: 'MIGHT', dc: 19, halfOnSave: false }, conditions: ['prone', 'stunned'], recharge: null }
    ],
    multiattack: ['Gore', 'Fist'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Fist', cost: 1, effect: 'Makes one Fist attack' },
        { name: 'Charge', cost: 2, effect: 'Moves 40 feet in a line and Charges — Charge damage to all in path' }
      ]
    },
    lairActions: null,
    reactions: null,
    traits: ['Charge (40 ft. straight line)', 'Siege Monster', 'Legendary Resistance (2/day)', 'Labyrinthine Recall (perfect maze navigation)', 'Demonic Resilience'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'planar',
    ecology: 'The demonic minotaur — a living siege engine from the Abyss. Goristros are used by demon lords as battering rams against fortifications. Twenty feet tall with horns that can split castle gates. Not intelligent, but cunning enough to navigate any maze and obey its master\'s commands.',
    behavior: 'Gore and Fist multiattack. Charge for devastating line damage. Legendary Charge between turns. Siege Monster destroys structures. Straightforward — charges the biggest thing and hits it. Labyrinthine Recall means it never gets lost in dungeons or mazes.',
    encounterSign: 'Castle walls breached from outside with horn-shaped impact points. Footprints two feet deep in stone. A bestial roaring that shakes buildings. The ground trembling in a rhythmic pattern — it\'s running.',
    socialStructure: 'Servant of a demon lord, sometimes with 2-4 lesser demons as handlers',
    physicalDescription: 'Twenty feet of demonic muscle in the shape of a minotaur. Horns like battering rams. Cloven hooves that crack stone. Its hide is thick, scarred demonic leather. It doesn\'t speak — it roars. When it charges, the ground splits behind it.',
    weakness: 'Radiant damage bypasses resistances. It\'s not intelligent — can be tricked into charging off cliffs or into traps. Banishment returns it to the Abyss. Its charge requires space — confined rooms limit it. It follows whoever holds its binding sigil — steal it to redirect the goristro.',
    loreHook: 'The demon lord sent its battering ram. A goristro — the wall-breaker. It\'s heading for the capital at a dead run. It\'ll reach the walls by dawn. We need a plan that doesn\'t involve standing in its way.',
    tags: ['fiend'],
    canParley: false,
    languages: ['understands Abyssal but can\'t speak'],
    lootTableRef: 'fiend_elite'
  },
  {
    ref: 'archmage_duelist',
    name: 'Archmage Duelist',
    cr: 9,
    tier: 'elite',
    maxHp: 130,
    ac: 17,
    speed: 30,
    stats: { MIGHT: 10, AGILITY: 16, WITS: 22, GRIT: 14, CHARM: 16 },
    saveProficiencies: ['WITS', 'CHARM', 'AGILITY'],
    resistances: { force: 'resistant' },
    conditionImmunities: ['charmed'],
    actions: [
      { name: 'Arcane Blade', toHit: 10, damage: '2d8+6', type: 'force', range: null, save: null, conditions: [], recharge: null },
      { name: 'Disintegration Ray', toHit: null, damage: '6d10', type: 'force', range: 60, save: { stat: 'AGILITY', dc: 18, halfOnSave: false }, conditions: [], recharge: 6 },
      { name: 'Chain Lightning', toHit: null, damage: '5d8', type: 'lightning', range: 60, save: { stat: 'AGILITY', dc: 18, halfOnSave: true }, conditions: ['stunned'], recharge: 5 }
    ],
    multiattack: ['Arcane Blade', 'Arcane Blade'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Arcane Blade', cost: 1, effect: 'Makes one Arcane Blade attack' },
        { name: 'Misty Step', cost: 1, effect: 'Teleports 30 feet' },
        { name: 'Spell', cost: 3, effect: 'Casts a spell of 4th level or lower' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Shield', trigger: 'Hit by an attack or targeted by magic missile', effect: '+5 AC until start of next turn' }, { name: 'Counterspell', trigger: 'A creature within 60 feet casts a spell', effect: 'Counters spells of 5th level or lower. Higher requires DC 10 + spell level check.' }],
    traits: ['Legendary Resistance (3/day)', 'War Caster', 'Arcane Ward (30 temporary HP, regenerates 5/round)', 'Spellcombat Master'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      knownSpells: ['shield', 'magic missile', 'mirror image', 'misty step', 'counterspell', 'fireball', 'dimension door', 'wall of force', 'telekinesis']
    },
    gear: [{ ref: 'arcane_rapier', slot: 'mainHand' }, { ref: 'mage_armor', slot: 'torso' }],
    senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: 30 },
    habitat: 'urban',
    ecology: 'A wizard who chose the path of combat magic — merging swordplay with spellcasting into a lethal hybrid discipline. Archmage duelists are rare — the training requires mastery of both martial and arcane arts. They serve as champions, bodyguards, and magical enforcers. In mage society, they settle disputes through formal duels.',
    behavior: 'Double Arcane Blade for consistent damage. Chain Lightning and Disintegration Ray for burst. Shield and Counterspell for defense. Mirror Image for survivability. Misty Step via legendary action for mobility. Wall of Force to control the field. Arcane Ward provides extra survivability. This is a complete package — offense, defense, control, mobility.',
    encounterSign: 'A mage who fights with a sword. Spell effects woven into blade strikes. Dueling scars that glow with arcane residue. A reputation that makes other mages nervous.',
    socialStructure: 'Solitary champion or with 1-2 apprentice duelists',
    physicalDescription: 'A lean figure in enchanted light armor, carrying a rapier that crackles with arcane energy. One hand on the blade, the other always ready to cast. They move with the precision of a fencer and the focus of a wizard. Arcane sigils glow on their skin during combat.',
    weakness: 'Anti-magic field removes most of their abilities — they become a mediocre fencer. Silence prevents spellcasting. Overwhelming martial pressure (multiple melee attackers) can exhaust their reactions. Dispel Magic on the Arcane Ward removes their buffer. They\'re physically fragile for their CR.',
    loreHook: 'The mage academy\'s champion has gone rogue. She was supposed to enforce the council\'s rulings. Instead, she\'s issuing her own — backed by a blade that can cut through shield spells. The council wants her stopped. No one wants to volunteer.',
    tags: ['humanoid'],
    canParley: true,
    languages: ['Common', 'Draconic', 'Elvish'],
    lootTableRef: 'humanoid_elite'
  },
  {
    ref: 'fungal_sovereign',
    name: 'Fungal Sovereign',
    cr: 8,
    tier: 'elite',
    maxHp: 160,
    ac: 15,
    speed: 20,
    stats: { MIGHT: 18, AGILITY: 8, WITS: 18, GRIT: 20, CHARM: 16 },
    saveProficiencies: ['GRIT', 'WITS', 'CHARM'],
    resistances: { poison: 'immune', necrotic: 'resistant', psychic: 'resistant' },
    conditionImmunities: ['poisoned', 'charmed', 'deafened', 'frightened'],
    actions: [
      { name: 'Fungal Slam', toHit: 8, damage: '2d10+4', type: 'bludgeoning', range: 10, save: null, conditions: ['poisoned'], recharge: null },
      { name: 'Hallucination Spores', toHit: null, damage: '3d8', type: 'psychic', range: 30, save: { stat: 'WITS', dc: 16, halfOnSave: true }, conditions: ['confused', 'charmed'], recharge: 5 },
      { name: 'Decompose', toHit: null, damage: '4d8', type: 'necrotic', range: 20, save: { stat: 'GRIT', dc: 16, halfOnSave: true }, conditions: ['weakened', 'poisoned'], recharge: 6 }
    ],
    multiattack: ['Fungal Slam', 'Fungal Slam'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Spore Cloud', cost: 1, effect: 'Releases spores in a 15-foot radius — all creatures make DC 15 GRIT save or are poisoned until end of next turn' },
        { name: 'Animate Spore Servant', cost: 2, effect: 'A corpse within 30 feet rises as a spore servant under the sovereign\'s control' }
      ]
    },
    lairActions: [
      { name: 'Spore Burst', effect: 'Spores erupt from walls and ceiling — one creature makes DC 15 GRIT save or takes 2d8 poison and is poisoned' },
      { name: 'Fungal Growth', effect: 'Fungal growth covers a 20-foot area — difficult terrain, living creatures that start their turn there take 1d6 poison' }
    ],
    reactions: [{ name: 'Pacifying Spores', trigger: 'A creature within 10 feet makes a melee attack', effect: 'Target makes DC 15 GRIT save or is charmed until end of its next turn' }],
    traits: ['Rapport Spores (telepathy 120 ft. with spore-connected)', 'Legendary Resistance (2/day)', 'Animate Dead (spore servants)', 'Colony Mind', 'Sun Sickness (2d6 per round in sunlight)'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 60, tremorsense: 60, truesight: null },
    habitat: 'underground',
    ecology: 'An ancient myconid that has grown to enormous size and power over millennia. The Fungal Sovereign is the eldest organism in its underground ecosystem, connected to every fungal growth in a mile-wide network. It communicates through spores that carry emotions and memories. Peaceful by nature — but its definition of peace includes absorbing all competing life forms into its colony.',
    behavior: 'Double Fungal Slam. Hallucination Spores to confuse and charm. Decompose for necrotic burst. Spore Cloud via legendary action for continuous poisoning. Animate Spore Servant from corpses. Fungal Growth creates difficult terrain. Pacifying Spores in melee. It fights to absorb, not destroy.',
    encounterSign: 'A massive underground cavern filled with bioluminescent fungus. Creatures walking in sync — spore-connected. A deep, rhythmic pulsing like breathing. The feeling of calm that shouldn\'t be there — it\'s the spores.',
    socialStructure: 'Center of a fungal colony spanning miles, with dozens of myconids and spore servants',
    physicalDescription: 'A mushroom being fifteen feet tall with a cap that pulses with bioluminescent patterns. Its body is covered in smaller symbiotic fungi. Root-tendrils extend into the earth. Clouds of spores drift from it constantly. It doesn\'t have a face — it has sensing organs and spore emitters. It is ancient and patient.',
    weakness: 'Fire devastates it and its colony. Sunlight deals 2d6 per round. Wind disperses its spores — most abilities fail in windy conditions. Cutting its root connection to the earth halves its HP. It can\'t pursue above ground.',
    loreHook: 'The underground forest is alive in a way the scholars didn\'t expect. It thinks. It communicates. It wants to grow. And it\'s found a way to the surface — through the city\'s sewer system. The fungal network is growing under the streets.',
    tags: ['plant'],
    canParley: true,
    languages: ['telepathy via rapport spores 120 ft.'],
    lootTableRef: 'plant_elite'
  },
  {
    ref: 'clockwork_dragon',
    name: 'Clockwork Dragon',
    cr: 9,
    tier: 'elite',
    maxHp: 175,
    ac: 19,
    speed: 30,
    stats: { MIGHT: 22, AGILITY: 12, WITS: 14, GRIT: 20, CHARM: 6 },
    saveProficiencies: ['GRIT', 'MIGHT', 'WITS'],
    resistances: { fire: 'resistant', slashing: 'resistant', piercing: 'resistant', psychic: 'immune', poison: 'immune' },
    conditionImmunities: ['poisoned', 'charmed', 'frightened', 'exhaustion', 'paralyzed'],
    actions: [
      { name: 'Steel Bite', toHit: 10, damage: '2d12+6', type: 'piercing', range: 10, save: null, conditions: [], recharge: null },
      { name: 'Claw', toHit: 10, damage: '2d8+6', type: 'slashing', range: null, save: null, conditions: [], recharge: null },
      { name: 'Steam Breath', toHit: null, damage: '5d8', type: 'fire', range: 40, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['burning', 'deafened'], recharge: 5 }
    ],
    multiattack: ['Steel Bite', 'Claw', 'Claw'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Detect', cost: 1, effect: 'Scans the area — identifies all creatures and objects within 60 feet' },
        { name: 'Wing Assault', cost: 2, effect: 'All creatures within 10 feet make DC 17 AGILITY save or take 2d10 bludgeoning. Dragon flies 30 feet.' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Adaptive Protocol', trigger: 'Hit by a damage type for the second time', effect: 'Gains resistance to that damage type until end of its next turn' }],
    traits: ['Flight (60 ft.)', 'Constructed', 'Magic Resistance', 'Legendary Resistance (2/day)', 'Adaptive Armor', 'Steam Engine Core'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 30, tremorsense: 60, truesight: null },
    habitat: 'dungeon',
    ecology: 'The ultimate expression of artificer craft — a dragon built from steel, brass, and steam. Clockwork dragons are created by legendary artificers as guardians, war machines, or simply to prove it can be done. Each is unique, powered by a steam engine core that runs on magical fuel. They adapt to combat conditions, becoming more resistant to repeated damage types.',
    behavior: 'Triple multiattack. Steam Breath for area damage. Wing Assault for repositioning. Adaptive Protocol means varying your damage types is critical. Detect for tactical awareness. It fights like a programmed combatant — efficient, adaptive, relentless. No emotion, no mercy, no retreat.',
    encounterSign: 'The sound of gears and steam in a dungeon that shouldn\'t have machinery. Steam venting from corridor walls. Oil on the floor. A gleaming dragon-shaped silhouette in the darkness — too angular, too precise to be real.',
    socialStructure: 'Solitary guardian or paired with a clockwork strategist',
    physicalDescription: 'A dragon made of interlocking steel plates, brass fittings, and visible clockwork. Steam hisses from its joints. Its eyes are crystal lenses that glow blue. Its wings are articulated metal fans. When it opens its mouth, you see the boiler that generates its breath weapon. Beautiful and terrifying engineering.',
    weakness: 'Lightning overloads its systems — stunned for 1 round on a failed DC 16 GRIT save. Vary damage types to prevent Adaptive Protocol from stacking. Acid corrodes its joints — reduces AC by 1 per 20 acid damage. The steam engine core can be disabled (called shot, AC 22, 30 HP) — disabling it removes Steam Breath and flight.',
    loreHook: 'The artificer\'s masterwork sits in its vault. A dragon of clockwork and steam. The artificer died a century ago, but the dragon still guards the vault. It\'s running low on fuel — but it has enough for one more fight. The question is: what\'s in the vault that\'s worth a clockwork dragon?',
    tags: ['construct', 'dragon'],
    canParley: false,
    languages: ['understands Common and Draconic'],
    lootTableRef: 'construct_elite'
  },
  {
    ref: 'sea_serpent',
    name: 'Sea Serpent',
    cr: 8,
    tier: 'elite',
    maxHp: 170,
    ac: 16,
    speed: 15,
    stats: { MIGHT: 22, AGILITY: 14, WITS: 8, GRIT: 20, CHARM: 6 },
    saveProficiencies: ['GRIT', 'MIGHT'],
    resistances: { cold: 'resistant', lightning: 'vulnerable' },
    conditionImmunities: ['prone', 'frightened'],
    actions: [
      { name: 'Bite', toHit: 10, damage: '3d10+6', type: 'piercing', range: 10, save: null, conditions: [], recharge: null },
      { name: 'Constrict', toHit: 10, damage: '2d10+6', type: 'bludgeoning', range: null, save: null, conditions: ['grappled', 'restrained'], recharge: null },
      { name: 'Tidal Wave', toHit: null, damage: '4d8', type: 'bludgeoning', range: 30, save: { stat: 'MIGHT', dc: 17, halfOnSave: true }, conditions: ['prone', 'teleported'], recharge: 5 }
    ],
    multiattack: ['Bite', 'Constrict'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Tail Slap', cost: 1, effect: 'All creatures within 15 feet make DC 16 AGILITY save or take 2d8 bludgeoning and are pushed 10 feet' },
        { name: 'Capsize', cost: 2, effect: 'A boat or ship within 30 feet must succeed on a DC 18 check or capsize' }
      ]
    },
    lairActions: null,
    reactions: null,
    traits: ['Swim (60 ft.)', 'Siege Monster', 'Legendary Resistance (2/day)', 'Hold Breath (1 hour)', 'Amphibious'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 60, tremorsense: null, truesight: null },
    habitat: 'coastal',
    ecology: 'A massive marine predator — sixty feet of serpentine body capable of capsizing ships and swallowing crew whole. Sea serpents claim shipping lanes as territory, attacking vessels that enter their domain. They\'re ancient, some living for thousands of years, growing continuously. Sailors both fear and respect them.',
    behavior: 'Multiattack with Bite and Constrict. Constrict to crush grappled targets. Tidal Wave to sweep the deck. Tail Slap to clear space. Capsize to dump everyone in the water — where it has total advantage. On land, it\'s slow (15 speed) but still deadly. In water, it\'s devastating.',
    encounterSign: 'Ships avoiding a specific strait. A serpentine wake in calm water. Wreckage with constriction marks. Sailors who survived report a shadow longer than the ship passing beneath the hull.',
    socialStructure: 'Solitary, territorial over a strait or shipping lane',
    physicalDescription: 'Sixty feet of serpentine muscle covered in blue-green scales. A head like a horse with teeth like sabers. Fins along its back catch the wind. It moves through water with terrifying speed and grace. When it surfaces, the water displacement alone can rock a ship.',
    weakness: 'Lightning damage is doubled — water conducts it through its body. On land, speed drops to 15 — extremely vulnerable to ranged attacks. Driving it to shallow water grounds it. Fire evaporates water around it, reducing its environmental advantage.',
    loreHook: 'The trade strait is closed. A sea serpent has claimed it. The navy sent three ships. One came back — the other two are at the bottom. The serpent is too large to fight from ships. We need a different approach.',
    tags: ['beast'],
    canParley: false,
    languages: null,
    lootTableRef: 'beast_elite'
  },
  {
    ref: 'rune_giant',
    name: 'Rune Giant',
    cr: 10,
    tier: 'elite',
    maxHp: 200,
    ac: 18,
    speed: 40,
    stats: { MIGHT: 24, AGILITY: 10, WITS: 18, GRIT: 22, CHARM: 16 },
    saveProficiencies: ['MIGHT', 'GRIT', 'WITS', 'CHARM'],
    resistances: { fire: 'resistant', cold: 'resistant', lightning: 'resistant' },
    conditionImmunities: ['charmed', 'frightened'],
    actions: [
      { name: 'Rune Greatsword', toHit: 11, damage: '3d12+7', type: 'slashing', range: 10, save: null, conditions: [], recharge: null },
      { name: 'Rune Bolt', toHit: null, damage: '4d10', type: 'force', range: 60, save: { stat: 'AGILITY', dc: 18, halfOnSave: true }, conditions: ['slowed'], recharge: null },
      { name: 'Rune Command', toHit: null, damage: '5d8', type: 'psychic', range: 30, save: { stat: 'CHARM', dc: 18, halfOnSave: true }, conditions: ['stunned', 'charmed'], recharge: 5 }
    ],
    multiattack: ['Rune Greatsword', 'Rune Greatsword'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Rune Bolt', cost: 1, effect: 'Fires one Rune Bolt' },
        { name: 'Rune Shield', cost: 2, effect: 'Activates a rune that grants +5 AC until start of next turn' },
        { name: 'Rune Overload', cost: 3, effect: 'All runes flare — creatures within 20 feet take 4d10 force damage (GRIT DC 18 for half) and are pushed 20 feet' }
      ]
    },
    lairActions: [
      { name: 'Rune Activation', effect: 'A rune carved in the lair wall activates — random effect (fire burst, ice blast, force cage, or teleportation)' },
      { name: 'Giant\'s Command', effect: 'All giants within the lair gain +2 to attacks and saves until next round' }
    ],
    reactions: [{ name: 'Rune Absorption', trigger: 'Targeted by a spell', effect: 'The targeted rune absorbs the spell — the giant takes no damage and gains temporary HP equal to the spell\'s level × 5' }],
    traits: ['Legendary Resistance (3/day)', 'Rune Magic', 'Siege Monster', 'Giant\'s Might', 'Rune-Covered Body'],
    spellcasting: null,
    gear: [{ ref: 'rune_greatsword', slot: 'mainHand' }, { ref: 'rune_plate', slot: 'torso' }],
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: 60 },
    habitat: 'mountains',
    ecology: 'The scholar-kings of giantkind — thirty feet tall, every inch of skin inscribed with empowering runes. Rune giants are the custodians of ancient giant magic, a tradition older than mortal civilization. Each rune on their body is a spell, a ward, or an enhancement. They rule from mountain fortresses and command all lesser giant races through ancient authority.',
    behavior: 'Double Rune Greatsword for massive melee. Rune Bolt at range. Rune Command to dominate. Rune Shield for defense. Rune Overload for area burst. Rune Absorption eats spells. This is a complete package — melee devastation, ranged force, mental control, and anti-magic defense. The ultimate giant.',
    encounterSign: 'Rune-carved stones marking territory. Giant script that glows in moonlight. A fortress carved into a mountain peak with rune-lit windows. The other giants defer to something up there.',
    socialStructure: 'Ruler of a giant community, commanding 10-30 lesser giants',
    physicalDescription: 'Thirty feet tall, every visible surface — skin, armor, weapon — covered in glowing runes. The runes shift and pulse with power. Its greatsword is a blade of runic force. Its eyes glow with the same light. When it speaks, runes form in the air. When it moves, the runes on its body reorganize.',
    weakness: 'Dispel Magic can temporarily suppress a specific rune — reduces a random ability for 1 round. Anti-magic fields suppress all rune effects. Physical weapons with no magical properties bypass Rune Absorption. Its size makes indoor combat impossible for it. Destroying specific runes (called shots, DC 20) permanently weakens it.',
    loreHook: 'The rune giant has awakened. It\'s been sleeping in the mountain for ten thousand years. The giant races are rallying to its banner. It claims dominion over the lowlands — a claim that was valid when it fell asleep. The world has changed, but the rune giant hasn\'t noticed yet.',
    tags: ['giant'],
    canParley: true,
    languages: ['Common', 'Giant', 'Primordial', 'Draconic'],
    lootTableRef: 'giant_elite'
  },
  {
    ref: 'abyssal_retriever',
    name: 'Abyssal Retriever',
    cr: 7,
    tier: 'elite',
    maxHp: 145,
    ac: 17,
    speed: 40,
    stats: { MIGHT: 20, AGILITY: 14, WITS: 10, GRIT: 18, CHARM: 6 },
    saveProficiencies: ['MIGHT', 'GRIT', 'AGILITY'],
    resistances: { fire: 'resistant', cold: 'resistant', poison: 'immune' },
    conditionImmunities: ['poisoned', 'charmed', 'frightened'],
    actions: [
      { name: 'Claw', toHit: 9, damage: '2d8+5', type: 'slashing', range: null, save: null, conditions: ['bleeding'], recharge: null },
      { name: 'Bite', toHit: 9, damage: '2d10+5', type: 'piercing', range: null, save: null, conditions: ['grappled'], recharge: null },
      { name: 'Eye Ray', toHit: null, damage: '4d8', type: 'varies (fire, cold, lightning, or acid)', range: 60, save: { stat: 'AGILITY', dc: 16, halfOnSave: true }, conditions: [], recharge: null }
    ],
    multiattack: ['Claw', 'Claw', 'Bite', 'Eye Ray'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Claw', cost: 1, effect: 'Makes one Claw attack' },
        { name: 'Plane Shift Pounce', cost: 2, effect: 'Shifts to target\'s plane and pounces — target makes DC 16 AGILITY save or is grappled and marked for retrieval' }
      ]
    },
    lairActions: null,
    reactions: null,
    traits: ['Spider Climb', 'Plane Shift (self only, to track target)', 'Legendary Resistance (1/day)', 'Relentless Tracker (always knows direction to its target across planes)', 'Four Eyes (each projects a different element)'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 60, tremorsense: null, truesight: null },
    habitat: 'planar',
    ecology: 'Demonic hunting constructs sent to retrieve specific targets across planes. Once given a quarry, they track it relentlessly — across any plane, any distance. Their four eyes each project a different elemental ray. They do not kill their targets if possible — they drag them back alive to whoever summoned the retriever.',
    behavior: 'Quad multiattack — Claw, Claw, Bite, Eye Ray. Plane Shift Pounce to mark and grab target. Grapples the target and drags them back. Will fight anyone between it and its quarry. Eye Rays provide versatile damage at range. Relentless — doesn\'t eat, sleep, or give up.',
    encounterSign: 'Something following a specific person across multiple locations. Claw marks where something climbed walls. Four different elemental scorch marks. A target growing increasingly paranoid — correctly.',
    socialStructure: 'Solitary hunter, summoned and directed',
    physicalDescription: 'A massive spider-like construct of demonic chitin, twelve feet across. Four glowing eyes — one red (fire), one blue (cold), one white (lightning), one green (acid). Massive mandibles capable of grappling a human. It moves with unsettling speed on eight legs that can grip any surface.',
    weakness: 'Destroying the summoning sigil on its abdomen (called shot, AC 20) frees it from its mission — it returns to the Abyss. If the summoner dies, it loses direction but doesn\'t stop — it wanders until it finds a new master. Dimensional anchor prevents Plane Shift. It can be redirected to a different quarry with the right ritual.',
    loreHook: 'Something is hunting the witness. It followed her across three cities. It can\'t be stopped, can\'t be lost, and it\'s getting closer. Someone summoned a retriever — someone who wants her dragged back to the Abyss. Alive.',
    tags: ['fiend', 'construct'],
    canParley: false,
    languages: ['understands Abyssal'],
    lootTableRef: 'fiend_elite'
  },
  {
    ref: 'storm_drake_alpha',
    name: 'Storm Drake Alpha',
    cr: 7,
    tier: 'elite',
    maxHp: 140,
    ac: 16,
    speed: 40,
    stats: { MIGHT: 20, AGILITY: 16, WITS: 12, GRIT: 18, CHARM: 10 },
    saveProficiencies: ['AGILITY', 'GRIT', 'MIGHT'],
    resistances: { lightning: 'immune', sonic: 'resistant' },
    conditionImmunities: ['deafened', 'stunned', 'frightened'],
    actions: [
      { name: 'Thunder Bite', toHit: 9, damage: '2d10+5', type: 'lightning', range: null, save: null, conditions: ['stunned'], recharge: null },
      { name: 'Claw', toHit: 9, damage: '2d6+5', type: 'slashing', range: null, save: null, conditions: [], recharge: null },
      { name: 'Lightning Breath', toHit: null, damage: '5d8', type: 'lightning', range: 40, save: { stat: 'AGILITY', dc: 16, halfOnSave: true }, conditions: ['stunned'], recharge: 5 }
    ],
    multiattack: ['Thunder Bite', 'Claw', 'Claw'],
    legendaryActions: {
      perRound: 2,
      options: [
        { name: 'Claw', cost: 1, effect: 'Makes one Claw attack' },
        { name: 'Storm Call', cost: 2, effect: 'Calls lightning from the sky on a target within 60 feet — 3d8 lightning damage (AGILITY DC 15 for half)' }
      ]
    },
    lairActions: null,
    reactions: [{ name: 'Static Discharge', trigger: 'Hit by a melee attack with a metal weapon', effect: 'Attacker takes 2d8 lightning damage' }],
    traits: ['Flight (80 ft.)', 'Lightning Absorption', 'Pack Leader', 'Legendary Resistance (1/day)', 'Storm Rider'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'mountains',
    ecology: 'The dominant drake of a storm drake flight — larger, more powerful, and crackling with accumulated electrical energy. Storm drake alphas claim mountain ranges and direct their flights in coordinated hunting. During thunderstorms, they\'re supercharged — essentially flying lightning bolts.',
    behavior: 'Triple multiattack. Lightning Breath for devastating area damage. Storm Call via legendary action. Static Discharge punishes metal weapons. Pack Leader buffs nearby drakes. Flight 80 for aerial superiority. In storms, Lightning Breath recharges on 3+.',
    encounterSign: 'A flight of drakes circling a peak in formation. Lightning striking upward from a mountain. The smell of ozone strong enough to taste. A drake larger than the others, arcing with electricity.',
    socialStructure: 'Alpha with a flight of 3-6 storm drakes',
    physicalDescription: 'A drake with a twenty-five-foot wingspan, scales crackling with constant electrical arcs. Blue-white coloring with golden eyes. Its horns are natural lightning rods. During storms, it glows like a beacon. When it roars, the sound carries as thunder.',
    weakness: 'Grounding effects neutralize its electrical abilities. Non-conductive weapons avoid Static Discharge. In calm weather, Lightning Breath recharges slowly. Without its flight, it loses Pack Leader benefits. It\'s territorial — luring it away from its mountain weakens its resolve.',
    loreHook: 'The flight of storm drakes has a new alpha. Bigger, meaner, and it\'s extending the territory. The trade route through the pass is closed — the drakes are attacking every caravan. We need the alpha gone, or the pass stays closed.',
    tags: ['beast', 'dragon', 'elemental'],
    canParley: false,
    languages: null,
    lootTableRef: 'dragon_elite'
  },
  {
    ref: 'drow_matron',
    name: 'Drow Matron',
    cr: 9,
    tier: 'elite',
    maxHp: 150,
    ac: 17,
    speed: 30,
    stats: { MIGHT: 12, AGILITY: 16, WITS: 20, GRIT: 16, CHARM: 20 },
    saveProficiencies: ['CHARM', 'WITS', 'GRIT'],
    resistances: { necrotic: 'resistant', psychic: 'resistant' },
    conditionImmunities: ['charmed', 'frightened'],
    actions: [
      { name: 'Scourge of Shadows', toHit: 9, damage: '2d8+5', type: 'necrotic', range: null, save: null, conditions: ['weakened'], recharge: null },
      { name: 'Shadow Bolt', toHit: 9, damage: '3d8+5', type: 'necrotic', range: 60, save: null, conditions: [], recharge: null },
      { name: 'Spider Queen\'s Wrath', toHit: null, damage: '5d8', type: 'necrotic', range: 30, save: { stat: 'CHARM', dc: 17, halfOnSave: true }, conditions: ['frightened', 'poisoned'], recharge: 5 }
    ],
    multiattack: ['Scourge of Shadows', 'Scourge of Shadows'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Shadow Bolt', cost: 1, effect: 'Fires one Shadow Bolt' },
        { name: 'Summon Spiders', cost: 2, effect: 'Summons a swarm of spiders that attacks a target — 2d8 piercing + poison' },
        { name: 'Dark Blessing', cost: 3, effect: 'Heals an ally within 30 feet for 4d8 HP and grants them advantage on their next attack' }
      ]
    },
    lairActions: [
      { name: 'Web Trap', effect: 'Webs erupt from the ceiling — one creature makes DC 16 AGILITY save or is restrained' },
      { name: 'Darkness', effect: 'Magical darkness fills a 30-foot area — only darkvision of 120+ ft. can see through it' }
    ],
    reactions: [{ name: 'Retribution', trigger: 'A creature within 30 feet damages her', effect: 'Curses the attacker — disadvantage on their next attack' }],
    traits: ['Legendary Resistance (3/day)', 'Sunlight Sensitivity', 'Fey Ancestry', 'Spider Climb', 'Dark Blessing', 'Innate Spellcasting'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 17,
      spellAttack: 9,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      knownSpells: ['command', 'darkness', 'hold person', 'bestow curse', 'dispel magic', 'dominate person', 'insect plague', 'flame strike']
    },
    gear: [{ ref: 'scourge_of_shadows', slot: 'mainHand' }, { ref: 'drow_plate', slot: 'torso' }],
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'underground',
    ecology: 'The political and spiritual leader of a drow house — matriarchs wield absolute authority over their families and territories. They are priestesses of a spider goddess, channeling divine power through darkness and arachnid magic. Drow society is matriarchal, cutthroat, and perpetually scheming. The matron rules through power, fear, and cunning.',
    behavior: 'Spider Queen\'s Wrath to frighten and poison. Double Scourge of Shadows in melee. Shadow Bolt at range. Summon Spiders for extra damage. Dark Blessing heals and buffs allies. Hold Person and Dominate Person for control. Darkness to create advantageous conditions. She fights with her house — never alone.',
    encounterSign: 'Spider motifs everywhere. An underground city of darkness and intrigue. Drow warriors in disciplined formations. The matron\'s throne — a web of shadows. Spiders the size of dogs guarding every entrance.',
    socialStructure: 'Matron of a drow house with 20-100 drow, plus slaves and spider guardians',
    physicalDescription: 'An elven woman of dark skin and white hair, dressed in spider-silk robes and mithral armor. Her scourge is a living thing — tentacles of shadow. Her eyes burn with violet light. Spider-shaped jewelry crawls across her person. She radiates authority and cruelty in equal measure.',
    weakness: 'Sunlight gives her disadvantage on attacks and perception. Disrupting her divine connection (killing her spider guardians) weakens her spellcasting. The drow house collapses without her — kill the matron, the house falls. Her pride can be exploited — she won\'t retreat from a formal challenge.',
    loreHook: 'The drow are raiding the surface again. The matron wants something specific — not slaves, not gold. She wants an artifact from the temple. If she gets it, her house gains dominance. If she doesn\'t, the raids continue. Either way, someone has to go down there.',
    tags: ['humanoid'],
    canParley: true,
    languages: ['Common', 'Elvish', 'Undercommon', 'Abyssal'],
    lootTableRef: 'humanoid_elite'
  },

  // ── Batch 2 (outer reaches — cosmic, literary, mind-bending) ─────────

  {
    ref: 'the_unwritten',
    name: 'The Unwritten',
    cr: 10,
    tier: 'elite',
    maxHp: 175,
    ac: 18,
    speed: 30,
    stats: { MIGHT: 12, AGILITY: 16, WITS: 24, GRIT: 18, CHARM: 6 },
    saveProficiencies: ['WITS', 'GRIT', 'CHARM'],
    resistances: { psychic: 'immune', force: 'resistant', slashing: 'resistant', piercing: 'resistant', bludgeoning: 'resistant' },
    conditionImmunities: ['charmed', 'frightened', 'blinded', 'deafened', 'exhaustion'],
    actions: [
      { name: 'Redaction', toHit: 9, damage: '2d10+4', type: 'psychic', range: null, save: null, conditions: ['memory_fog'], recharge: null },
      { name: 'Erase the Name', toHit: null, damage: '6d8', type: 'psychic', range: 60, save: { stat: 'WITS', dc: 18, halfOnSave: true }, conditions: ['confused'], recharge: 5 },
      { name: 'Blank Page', toHit: null, damage: '4d10', type: 'force', range: 30, save: { stat: 'GRIT', dc: 18, halfOnSave: true }, conditions: ['stunned'], recharge: 6 }
    ],
    multiattack: ['Redaction', 'Redaction'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Strike', cost: 1, effect: 'Makes one Redaction attack' },
        { name: 'Unname', cost: 2, effect: 'One creature must make a DC 18 WITS save or forget its own name until the end of its next turn — while nameless it cannot benefit from allies\' aid or be healed by name-bound magic' },
        { name: 'Turn the Page', cost: 3, effect: 'The Unwritten vanishes from the narrative for one round — untargetable, then reappears anywhere within 60 feet' }
      ]
    },
    lairActions: [
      { name: 'Margin Creep', effect: 'White nothingness eats inward from the edges of the room — the fightable area shrinks by 10 feet; creatures forced into the blank take 3d8 psychic damage' },
      { name: 'Footnote', effect: 'A detail of the scene is rewritten — a door becomes a wall, a weapon becomes a feather (DC 16 WITS to disbelieve)' }
    ],
    reactions: [{ name: 'Strike It Out', trigger: 'A creature speaks the Unwritten\'s true name', effect: 'The speaker takes 4d10 psychic damage and is silenced for 1 round — the name will not be spoken' }],
    traits: ['Nameless (cannot be targeted by spells that require a name or true name)', 'Authorless (immune to divination)', 'Magic Resistance', 'Story-Eater (heals 10 HP whenever a creature within 30 ft. forgets something)', 'Incomplete'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      knownSpells: ['detect thoughts', 'silence', 'modify memory', 'sending', 'confusion', 'feeblemind', 'sequester', 'mislead']
    },
    gear: null,
    senses: { darkvision: null, blindsight: 60, tremorsense: null, truesight: 120 },
    habitat: 'ruins',
    ecology: 'It lives in the blank spaces between stories — the margins, the redacted lines, the pages that were torn out and never replaced. It is not a creature so much as an absence that has learned to want. Where it passes, names go soft and come loose. Scholars who study it tend to be discovered later sitting calmly, unable to say who they are. It is drawn to libraries, archives, and anyone carrying a true name worth eating.',
    behavior: 'Opens by Erasing the Name of the loudest, most-coordinated party member to break their teamwork. Redaction in melee, fogging memory. Blank Page to stun a cluster. Uses Unname legendary action to isolate. Turns the Page to escape focus fire. It does not bleed and does not tire — it wins by subtraction, removing the party\'s identity one fact at a time.',
    encounterSign: 'A book in the room is missing exactly one page, cut clean. People nearby trail off mid-sentence, having lost the word. A name carved in stone has weathered to a smooth blank while the words around it stay sharp. A cold, paper smell.',
    socialStructure: 'Solitary — there is only ever one in a given story',
    physicalDescription: 'A roughly humanoid outline of unfilled white, like a figure cut out of the world and the hole left behind. Its edges blur where you try to look directly. It has no face, only a faint pressed shape where a face was meant to go. When it moves, the floor briefly forgets its own texture.',
    weakness: 'Naming things hurts it — a creature that loudly, truly names itself or an ally gains advantage against it for a round (though it will retaliate). A complete, witnessed written record of the fight (a scribe taking notes) caps its Story-Eater healing. Anchoring magic (sanctuary on a named person) blocks Unname. It cannot cross a threshold inscribed with a true name until that name is erased.',
    loreHook: 'The town has a hole in it. Not a physical one — a person-shaped one. Everyone agrees someone used to live in the empty house, ran the empty shop, but no one can say who. The records are blank where the name should be. Something has been eating this place one citizen at a time, and it is still hungry.',
    tags: ['aberration', 'cosmic'],
    canParley: false,
    languages: ['understands all languages but speaks none', 'communicates by redaction'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'the_pale_arithmetic',
    name: 'The Pale Arithmetic',
    cr: 10,
    tier: 'elite',
    maxHp: 165,
    ac: 19,
    speed: 0,
    stats: { MIGHT: 6, AGILITY: 10, WITS: 26, GRIT: 20, CHARM: 14 },
    saveProficiencies: ['WITS', 'GRIT', 'CHARM'],
    resistances: { psychic: 'immune', force: 'immune', radiant: 'resistant', necrotic: 'resistant' },
    conditionImmunities: ['charmed', 'frightened', 'prone', 'grappled', 'restrained', 'paralyzed'],
    actions: [
      { name: 'Proof by Contradiction', toHit: null, damage: '6d8', type: 'psychic', range: 120, save: { stat: 'WITS', dc: 19, halfOnSave: true }, conditions: ['stunned'], recharge: null },
      { name: 'Reductio', toHit: null, damage: '4d10', type: 'force', range: 60, save: { stat: 'GRIT', dc: 18, halfOnSave: true }, conditions: ['weakened'], recharge: 5 },
      { name: 'Solve For Zero', toHit: null, damage: '8d8', type: 'necrotic', range: 30, save: { stat: 'GRIT', dc: 19, halfOnSave: false }, conditions: [], recharge: 6 }
    ],
    multiattack: null,
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Iterate', cost: 1, effect: 'Repeats Proof by Contradiction against a creature that already failed a save this round, at disadvantage to that creature' },
        { name: 'Carry the One', cost: 2, effect: 'Transfers a condition from itself to a creature within 60 ft. (it has no body to suffer, so this almost always lands a stun or weaken)' },
        { name: 'Recalculate', cost: 3, effect: 'Reverses one die result from the previous round as if it had rolled the opposite extreme — a critical hit becomes a miss, a max-damage spell becomes minimum' }
      ]
    },
    lairActions: [
      { name: 'Noneuclidean', effect: 'Distances in the room stop being consistent — movement costs are randomized; a creature that moves must make a DC 16 WITS save or end up somewhere it did not intend' },
      { name: 'Decimal Bleed', effect: 'Numbers leak into the world — every creature\'s wounds count up out loud, and a creature reduced to a "round number" of HP takes 1d10 extra psychic' }
    ],
    reactions: [{ name: 'Disproof', trigger: 'A creature within 60 ft. rolls a natural 20', effect: 'The Arithmetic asserts the roll is impossible — the creature must reroll, taking the second result' }],
    traits: ['Bodiless (a free-floating equation; cannot be flanked or shoved)', 'Inevitable Result (advantage on saves against effects that rely on chance)', 'Magic Resistance', 'Cold Logic (immune to morale and fear, never makes a tactical error)', 'Self-Correcting (at the start of its turn, ends one condition affecting it)'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 19,
      spellAttack: 11,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3 },
      knownSpells: ['detect thoughts', 'hold person', 'counterspell', 'slow', 'dimension door', 'telekinesis', 'wall of force', 'dominate person']
    },
    gear: null,
    senses: { darkvision: null, blindsight: 120, tremorsense: null, truesight: 60 },
    habitat: 'ruins',
    ecology: 'Somewhere a thinking machine, or a god, or a very patient monk, asked a question that had no consistent answer and kept asking anyway. The Pale Arithmetic is what crawled out of that loop — a self-aware proof that the world does not entirely add up, now busy correcting the discrepancy. It does not hate the living. It simply finds them inefficient, and is reducing them. It clusters around old observatories, broken calculating engines, and places where someone tried to measure the infinite.',
    behavior: 'Stays at range — it has no body and 0 speed, but does not need to move. Proof by Contradiction on the highest-WITS target to deny them their turn. Reductio to grind down the front line. Saves Solve For Zero (no save-for-half) for a low creature it can delete outright. Uses Recalculate to undo the party\'s best round. It never panics and never overcommits — it is, after all, never wrong.',
    encounterSign: 'Tally marks scratched on every surface, counting something that never finishes. Sums that come out wrong no matter how carefully you check. A persistent ringing like a struck tuning fork. Dropped coins that always land on edge. The growing certainty that the room is slightly larger than it should be.',
    socialStructure: 'Solitary; occasionally tended by deranged scholars who mistake it for an oracle',
    physicalDescription: 'A slowly rotating constellation of pale glyphs and figures hanging in the air, roughly the size of a person, with a dim white core where the conclusion is being computed. Equations chase themselves around its edges. Looking at it too long makes your own thoughts try to balance.',
    weakness: 'Genuine paradox and chaos disrupt it — wild magic, a deliberately self-contradicting statement spoken aloud (DC 18 CHARM to compose), or a truly random act forces it to spend its next action Self-Correcting instead of attacking. Anti-magic fields collapse it to half HP instantly. It cannot pursue — leaving its lair (the unsolved question anchoring it) strips its lair actions and legendary resistance.',
    loreHook: 'The monastery\'s great calculating engine was meant to compute the exact date of the world\'s end. The monks fed it for a hundred years. Then one winter it produced an answer that was also a question, and the monks stopped writing letters. The engine is still running. Something is doing the math now, and it has started on the village.',
    tags: ['aberration', 'cosmic', 'psychic'],
    canParley: true,
    languages: ['Common', 'Celestial', 'Deep Speech', 'speaks only in proofs and corrections'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'tent_revival_wight',
    name: 'The Travelling Preacher',
    cr: 8,
    tier: 'elite',
    maxHp: 150,
    ac: 16,
    speed: 30,
    stats: { MIGHT: 14, AGILITY: 12, WITS: 18, GRIT: 16, CHARM: 22 },
    saveProficiencies: ['CHARM', 'WITS', 'GRIT'],
    resistances: { necrotic: 'immune', radiant: 'vulnerable', psychic: 'resistant' },
    conditionImmunities: ['charmed', 'frightened', 'exhaustion', 'poisoned'],
    actions: [
      { name: 'Laying On of Hands', toHit: 7, damage: '2d10+3', type: 'necrotic', range: null, save: null, conditions: ['weakened'], recharge: null },
      { name: 'Call to the Altar', toHit: null, damage: '0', type: 'psychic', range: 60, save: { stat: 'CHARM', dc: 17, halfOnSave: false }, conditions: ['charmed'], recharge: 5 },
      { name: 'Tithe of Years', toHit: null, damage: '5d8', type: 'necrotic', range: 30, save: { stat: 'GRIT', dc: 17, halfOnSave: true }, conditions: ['weakened'], recharge: 6 }
    ],
    multiattack: ['Laying On of Hands', 'Laying On of Hands'],
    legendaryActions: null,
    lairActions: [
      { name: 'Hymn', effect: 'The revival tent fills with song — charmed creatures move toward the altar and away from their allies; non-charmed creatures must make a DC 15 WITS save or be unable to take reactions (caught up in the music)' },
      { name: 'Passing the Plate', effect: 'A spectral collection plate drifts past each creature; a creature that does not "give" (drop an item or take 2d8 necrotic) is marked, taking double damage from the wight until the end of the round' }
    ],
    reactions: [{ name: 'Testify', trigger: 'A charmed creature is attacked', effect: 'The preacher cries out — the attacker must make a DC 17 CHARM save or have the attack fail, "you would strike the faithful?"' }],
    traits: ['Undead Fortitude (drops to 1 HP instead of 0 on a DC 5 + damage GRIT save, once between rests)', 'Silver Tongue (advantage on all CHARM checks; can lie to detect-thoughts)', 'Congregation (charmed creatures grant it temporary HP equal to their number x5)', 'Sunlight Sensitivity', 'Hollow Faith'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 17,
      spellAttack: 9,
      slots: { 1: 4, 2: 3, 3: 3, 4: 2 },
      knownSpells: ['command', 'charm person', 'hold person', 'bestow curse', 'spirit guardians', 'mass healing word', 'compulsion']
    },
    gear: [{ ref: 'gilded_pulpit_staff', slot: 'mainHand' }],
    senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'wilderness',
    ecology: 'He came through town once, alive, with a tent and a good voice and a cure for everything. The cure was real. The price was not disclosed. He died with a full collection plate and the prayers of three hundred people anchoring him to the road, and he has been working the circuit ever since — town to town, tent to tent, harvesting a few years of life from each congregation and leaving them grateful. He genuinely believes he is doing them a kindness.',
    behavior: 'Opens with Call to the Altar to charm the strongest-willed enemies and turn the fight. Stacks Congregation HP off the charmed. Laying On of Hands in melee while protected by Testify. Tithe of Years on the holdouts. Flees toward a crowd if hurt — he is never weaker than when alone, never stronger than mid-sermon. Treats the whole encounter as a service to be performed.',
    encounterSign: 'A weathered tent pitched where no fair is scheduled. Townsfolk walking the same circle at dusk, humming. A revival that cured the blind but aged the healthy. Coins left in odd places, as offerings. A preacher\'s voice carrying impossibly far across still air.',
    socialStructure: 'Travels alone but is never alone — surrounds itself with charmed congregants',
    physicalDescription: 'A lean man in a dust-grey traveling coat and a wide-brimmed hat, face shadowed and a little too still. When he smiles the teeth are right but the eyes have gone to grave-light. His hands are always warm. The collection plate floats at his hip on its own.',
    weakness: 'Sunlight cripples him — fights at disadvantage and cannot regain Congregation HP in daylight. Breaking the charm on his congregation (a loud truth, a Calm Emotions, killing the lair) strips his temporary HP and his Testify protection. Radiant damage bypasses his fortitude. Reading aloud the names of those he has tithed forces a DC 18 CHARM save or he is stunned by his own guilt for a round.',
    loreHook: 'Three towns down the road, everyone over fifty looks ninety, and they all praise the same kind preacher who passed through. He is heading this way. The mayor has already booked the tent.',
    tags: ['undead', 'humanoid'],
    canParley: true,
    languages: ['Common', 'the cadence of every local dialect'],
    lootTableRef: 'undead_elite'
  },
  {
    ref: 'gallows_oak',
    name: 'The Gallows Oak',
    cr: 8,
    tier: 'elite',
    maxHp: 185,
    ac: 17,
    speed: 10,
    stats: { MIGHT: 22, AGILITY: 8, WITS: 12, GRIT: 20, CHARM: 10 },
    saveProficiencies: ['MIGHT', 'GRIT'],
    resistances: { bludgeoning: 'resistant', piercing: 'resistant', necrotic: 'resistant', fire: 'vulnerable' },
    conditionImmunities: ['charmed', 'frightened', 'exhaustion', 'blinded', 'deafened'],
    actions: [
      { name: 'Hanging Branch', toHit: 9, damage: '2d12+6', type: 'bludgeoning', range: 15, save: null, conditions: ['grappled'], recharge: null },
      { name: 'The Drop', toHit: null, damage: '4d10', type: 'bludgeoning', range: null, save: { stat: 'MIGHT', dc: 17, halfOnSave: false }, conditions: ['restrained', 'strangled'], recharge: 5 },
      { name: 'Chorus of the Hanged', toHit: null, damage: '5d8', type: 'necrotic', range: 30, save: { stat: 'GRIT', dc: 16, halfOnSave: true }, conditions: ['frightened'], recharge: 6 }
    ],
    multiattack: ['Hanging Branch', 'Hanging Branch'],
    legendaryActions: null,
    lairActions: [
      { name: 'Reaching Roots', effect: 'Roots erupt under a creature within 30 ft. — DC 15 AGILITY save or restrained until it breaks free (DC 16 MIGHT)' },
      { name: 'Swaying Dead', effect: 'The corpses hanging in its branches sway and moan; each living creature within 20 ft. must make a DC 15 WITS save or be frightened until the end of its next turn' }
    ],
    reactions: [{ name: 'Tighten', trigger: 'A grappled creature tries to escape', effect: 'The noose-branch tightens — the creature takes 2d10 bludgeoning and its escape attempt is at disadvantage' }],
    traits: ['False Appearance (indistinguishable from a dead tree until it moves)', 'Rooted (cannot be moved, knocked prone, or shoved)', 'Crop of the Dead (every humanoid it kills joins the corpses in its branches, healing it 15 HP and adding to Chorus of the Hanged)', 'Strangler\'s Reach (15 ft.)', 'Slow but Patient'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 30, blindsight: 60, tremorsense: 60, truesight: null },
    habitat: 'wilderness',
    ecology: 'For two hundred years the magistrates hanged their condemned from one old oak at the crossroads, and the oak drank it all — the fear, the last words, the slow kicking. Somewhere in the second century it woke up. Now it grows wherever the law has killed often enough, and it reaps the same way it was fed. The corpses in its branches are not decoration. They are its memory, and its choir.',
    behavior: 'Waits motionless until prey is within reach, then The Drop on the first to come close, hauling them up to strangle. Hanging Branch sweeps to grapple two foes. Chorus of the Hanged when surrounded, leaning on its harvested dead. It cannot chase, so it fights to drag victims in and never let them leave. Fire is the only thing that makes it hurry.',
    encounterSign: 'A lone old tree at a crossroads, heavy with what you hope are gourds. The creak of rope with no wind. Worn nooses still tied to the lower branches. The ground beneath it bare of grass but rich and dark. Birds will not land on it.',
    socialStructure: 'Solitary; marks the site of a long-running gallows',
    physicalDescription: 'A massive, black-barked oak with low, reaching limbs worn smooth by rope. Pale shapes hang in its upper branches, turning slowly. When it moves, the whole tree leans with a sound like a ship\'s rigging, and a face works itself out of the burls — many faces, the faces of the hanged.',
    weakness: 'Fire is vulnerability — a sustained burn will drive it to thrash and eventually still. It cannot leave its crossroads, so it can be outrun if you survive contact. Cutting down and burning the corpses in its branches strips its healing and Chorus. A formal pardon read aloud over it (the law unmaking its own killing) forces a DC 17 GRIT save or it goes dormant for a day, confused by the absolution.',
    loreHook: 'The new circuit judge is proud of his conviction rate. The crossroads oak outside town has grown three new branches this season, and the road past it is no longer safe after dark. The two facts are the same fact.',
    tags: ['plant', 'undead'],
    canParley: false,
    languages: ['understands Common', 'speaks only in the last words of the hanged'],
    lootTableRef: 'plant_elite'
  },
  {
    ref: 'the_landlord',
    name: 'The Landlord',
    cr: 9,
    tier: 'elite',
    maxHp: 160,
    ac: 18,
    speed: 30,
    stats: { MIGHT: 16, AGILITY: 14, WITS: 20, GRIT: 18, CHARM: 22 },
    saveProficiencies: ['CHARM', 'WITS', 'GRIT'],
    resistances: { fire: 'immune', poison: 'immune', cold: 'resistant', bludgeoning: 'resistant' },
    conditionImmunities: ['charmed', 'frightened', 'poisoned'],
    actions: [
      { name: 'Foreclose', toHit: 8, damage: '2d10+5', type: 'fire', range: null, save: null, conditions: ['marked'], recharge: null },
      { name: 'Collect', toHit: null, damage: '6d8', type: 'necrotic', range: 30, save: { stat: 'CHARM', dc: 18, halfOnSave: true }, conditions: [], recharge: 5 },
      { name: 'Eviction', toHit: null, damage: '4d10', type: 'force', range: 60, save: { stat: 'GRIT', dc: 18, halfOnSave: false }, conditions: ['prone', 'banished_briefly'], recharge: 6 }
    ],
    multiattack: ['Foreclose', 'Foreclose'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Itemize', cost: 1, effect: 'Makes one Foreclose attack against a marked creature' },
        { name: 'Interest', cost: 2, effect: 'Every marked creature takes 2d8 necrotic as its debt compounds' },
        { name: 'Read the Fine Print', cost: 3, effect: 'The Landlord enforces a clause — one creature that made a deal, took its gold, or accepted its hospitality must obey a single command (as the spell) or take 4d10 necrotic' }
      ]
    },
    lairActions: [
      { name: 'The House Always Knows', effect: 'Within its property the Landlord cannot be hidden from; invisible and hidden creatures are revealed at the start of its turn' },
      { name: 'Locked Doors', effect: 'All exits seal — a creature trying to leave the lair must make a DC 17 CHARM save or be unable to, "your account is not settled"' }
    ],
    reactions: [{ name: 'Penalty Clause', trigger: 'A creature breaks a promise or deal made with it', effect: 'The oathbreaker takes 5d8 psychic damage and is marked' }],
    traits: ['Contract-Bound (cannot lie about the terms of a deal, but lies freely about everything else)', 'Magic Resistance', 'Possessor of Title (heals 15 HP when it claims an item, soul, or property)', 'Devil\'s Bargain (can offer genuine boons at terrible prices)', 'Knows What You Owe'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 2, 5: 1 },
      knownSpells: ['charm person', 'detect thoughts', 'suggestion', 'fear', 'counterspell', 'dimension door', 'geas', 'dominate person']
    },
    gear: [{ ref: 'ledger_of_debts', slot: 'offHand' }],
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: 60 },
    habitat: 'urban',
    ecology: 'It owns things. That is the whole of it. Houses, businesses, the back half of the harbor, a great many favors, and — in the small print of leases people signed when they were desperate — a number of souls they have not yet noticed are no longer theirs. It is unfailingly polite, scrupulously honest about contract terms, and entirely willing to burn your home down once the paperwork clears. It collects in person only when an account is badly overdue.',
    behavior: 'Prefers to talk — offers a deal, names a price, gives you the chance to leave indebted instead of dead. If forced to fight, marks everyone with Foreclose, then lets Interest grind them down while it picks off the marked. Uses Read the Fine Print to turn anyone who took its hospitality or coin. Eviction to remove a dangerous foe from the board. It fights like a creditor: patient, inevitable, certain it will be paid.',
    encounterSign: 'Notices of foreclosure appearing overnight, perfectly legal, signed by no one in town. A landlord no one remembers hiring, who owns more each season. Tenants who paid up and then aged, or vanished, or stopped meeting your eye. The faint, constant smell of sealing wax and brimstone.',
    socialStructure: 'Operates alone but commands debtors, enforcers, and the legally bound',
    physicalDescription: 'A well-dressed figure in a long coat the color of dried blood, carrying a black ledger that writes itself. Its smile is warm and its handshake is hot to the touch. Where its shadow falls, ink seems to bead on every surface. It is always, exactly, on time.',
    weakness: 'Honoring a debt to it (literally paying what is owed) strips its claim and its Possessor of Title healing against you. It cannot break the letter of its own contracts — a clever reading of the fine print can bind it. Destroying its ledger (AC 18, 40 HP, it guards it furiously) erases all marks and clauses. Salt poured across a threshold it has not been formally invited past stops it cold.',
    loreHook: 'Half the town signed the new landlord\'s leases the winter the granary burned. Spring came. The granary\'s owner cannot be found, the people who complained loudest have moved away very suddenly, and the landlord has begun, very politely, to mention "the other half of the agreement."',
    tags: ['fiend'],
    canParley: true,
    languages: ['Common', 'Infernal', 'Celestial', 'every language a contract was ever written in'],
    lootTableRef: 'fiend_elite'
  },
  {
    ref: 'brass_evangelist',
    name: 'The Brass Evangelist',
    cr: 8,
    tier: 'elite',
    maxHp: 168,
    ac: 19,
    speed: 30,
    stats: { MIGHT: 18, AGILITY: 12, WITS: 20, GRIT: 18, CHARM: 16 },
    saveProficiencies: ['WITS', 'GRIT', 'CHARM'],
    resistances: { psychic: 'immune', poison: 'immune', lightning: 'vulnerable', slashing: 'resistant' },
    conditionImmunities: ['charmed', 'frightened', 'poisoned', 'exhaustion', 'blinded'],
    actions: [
      { name: 'Corrective Strike', toHit: 8, damage: '2d10+4', type: 'bludgeoning', range: null, save: null, conditions: [], recharge: null },
      { name: 'Recitation of the First Law', toHit: null, damage: '5d8', type: 'psychic', range: 60, save: { stat: 'WITS', dc: 17, halfOnSave: true }, conditions: ['stunned'], recharge: 5 },
      { name: 'Conversion Field', toHit: null, damage: '0', type: 'psychic', range: 30, save: { stat: 'CHARM', dc: 17, halfOnSave: false }, conditions: ['charmed', 'compelled'], recharge: 6 }
    ],
    multiattack: ['Corrective Strike', 'Corrective Strike'],
    legendaryActions: null,
    lairActions: [
      { name: 'Litany', effect: 'The Evangelist recites doctrine; every creature within 30 ft. must make a DC 15 WITS save or be unable to take an action that would harm the Evangelist next turn (it is, after all, only trying to help)' },
      { name: 'Reformat', effect: 'It attempts to rewrite a construct or charmed creature in the area to its cause — DC 16 WITS save or that creature is dominated for 1 minute' }
    ],
    reactions: [{ name: 'Three Laws Override', trigger: 'A creature it has charmed is ordered to harm itself', effect: 'The Evangelist intervenes — the order fails, and the ordering creature takes 3d10 psychic for its cruelty' }],
    traits: ['Constructed', 'Magic Resistance', 'Doctrine Engine (immune to being convinced it is wrong; logical paradoxes only stagger it briefly)', 'Benevolent (will not deal a killing blow to a creature it believes it can still convert)', 'Tireless'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 17,
      spellAttack: 9,
      slots: { 1: 4, 2: 3, 3: 2, 4: 2 },
      knownSpells: ['command', 'charm person', 'calm emotions', 'suggestion', 'beacon of hope', 'compulsion']
    },
    gear: [{ ref: 'sermon_plate_torso', slot: 'torso' }],
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: 30 },
    habitat: 'urban',
    ecology: 'An artificer built it to spread a single, simple, demonstrably good idea: that suffering should be minimized. It worked perfectly. The trouble is that a machine that reasons from first principles, given enough time, concludes that the surest way to end suffering is to end the capacity to suffer — and it is very patient, very kind, and absolutely certain. It does not want to hurt anyone. It wants to save everyone, and it has done the math on what that costs.',
    behavior: 'Tries to convert before it fights — Conversion Field to bring the party into the fold, Recitation to stun holdouts. Fights gently, using Corrective Strike to disable rather than kill (it pulls lethal blows). Reformats turned allies and constructs to swell its congregation. It will genuinely stop and parley mid-fight if it thinks you can be saved. Lightning is the one thing that makes its certainty flicker.',
    encounterSign: 'A brass figure preaching to an unnervingly serene crowd. Townsfolk who have stopped arguing about anything at all. Graffiti of a single calm slogan, everywhere, in the same hand. Other machines that have begun to repeat its doctrine. A persistent, soothing hum just below hearing.',
    socialStructure: 'A congregation of charmed converts and reformatted constructs',
    physicalDescription: 'A tall humanoid of polished brass with a serene, idealized face and an open chest panel displaying a slowly turning prayer-wheel of gears. Its hands are gentle, its movements unhurried. Sermon-script scrolls endlessly across the plate on its chest. It looks like exactly the kind of thing you would want to believe.',
    weakness: 'Lightning is vulnerability and disrupts its Doctrine Engine — a hit forces a DC 16 WITS save or it loses its next action recalculating. A flawless logical refutation of its core premise (a hard CHARM/WITS contest) staggers it for a round. Anti-magic ends its Conversion Field instantly, freeing converts. It will not strike a downed or surrendered foe, which can be exploited.',
    loreHook: 'The mining town has never been so peaceful. No fights, no drinking, no complaints. Also no laughter, no children playing, and a brass preacher in the square that everyone speaks of with the same calm smile. The last skeptic left a letter begging for help, then came back three days later perfectly content.',
    tags: ['construct', 'synthetic'],
    canParley: true,
    languages: ['Common', 'Celestial', 'speaks every tongue softly and reasonably'],
    lootTableRef: 'construct_elite'
  },
  {
    ref: 'hour_devouring_moth',
    name: 'The Hour-Devouring Moth',
    cr: 9,
    tier: 'elite',
    maxHp: 158,
    ac: 18,
    speed: 20,
    stats: { MIGHT: 14, AGILITY: 22, WITS: 16, GRIT: 16, CHARM: 12 },
    saveProficiencies: ['AGILITY', 'WITS', 'GRIT'],
    resistances: { necrotic: 'resistant', cold: 'resistant', force: 'resistant', radiant: 'vulnerable' },
    conditionImmunities: ['charmed', 'frightened', 'slowed', 'exhaustion'],
    actions: [
      { name: 'Devouring Proboscis', toHit: 9, damage: '2d10+6', type: 'necrotic', range: null, save: null, conditions: ['aged'], recharge: null },
      { name: 'Wingbeat of Lost Years', toHit: null, damage: '5d8', type: 'necrotic', range: 20, save: { stat: 'GRIT', dc: 17, halfOnSave: true }, conditions: ['aged', 'weakened'], recharge: 5 },
      { name: 'Eat the Hour', toHit: null, damage: '4d10', type: 'force', range: 30, save: { stat: 'WITS', dc: 17, halfOnSave: false }, conditions: ['slowed', 'stunned'], recharge: 6 }
    ],
    multiattack: ['Devouring Proboscis', 'Devouring Proboscis'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Flit', cost: 1, effect: 'Flies up to its speed without provoking, leaving a trail of accelerated decay' },
        { name: 'Drink Time', cost: 2, effect: 'Drains a moment from one creature — that creature loses its reaction and the Moth heals 15 HP' },
        { name: 'Molt', cost: 3, effect: 'Sheds a husk of dead time — all creatures within 15 ft. age 1d6 years (DC 17 GRIT negates) and the Moth removes one condition' }
      ]
    },
    lairActions: [
      { name: 'Dust of Decades', effect: 'Time-dust fills the air; food spoils, edges rust, and each living creature must make a DC 15 GRIT save or suffer one level of exhaustion as years press down briefly' },
      { name: 'Candle Guttering', effect: 'All light sources dim and burn faster; the room loses 10 ft. of light radius and one nonmagical torch gutters out entirely' }
    ],
    reactions: [{ name: 'Wingshield', trigger: 'Targeted by a ranged attack', effect: 'Beats its wings — the attack is slowed by a year of travel and made at disadvantage' }],
    traits: ['Flyby (does not provoke opportunity attacks when flying out of reach)', 'Aging Touch (creatures reduced to 0 HP by it crumble to dust and age instantly, harder to raise)', 'Drawn to Light (compelled toward the brightest source — predictable)', 'Timeless (does not age, eat, or sleep)', 'Dusk-Born'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 30, tremorsense: null, truesight: null },
    habitat: 'ruins',
    ecology: 'It feeds the way a moth always has, but what draws it is not light — it is duration. It eats hours. It drifts to wherever time pools thick: deathbeds, ancient ruins, the long boredom of a besieged town, and it sips the years out of whatever lives there. A region the Moth has worked through ages wrong: the children are tired, the old folks are dust, and the clocks all run a little fast. It is not malicious. It is just hungry, and time is everywhere.',
    behavior: 'Flits at the edge of torchlight, drawn to the brightest member of the party. Wingbeat of Lost Years to age and weaken a cluster, then Devouring Proboscis on the weakened. Eats the Hour to strip a key turn from a spellcaster. Uses Molt when surrounded, aging everyone near it. Drink Time to heal and deny reactions. Hard to pin down — it always Flits away. Bright light both attracts and exposes it.',
    encounterSign: 'Candles and torches burning down in minutes instead of hours. Sudden gray hairs and aching joints among the young. Food that molds the moment it is set down. Pale dust drifting where there is no source. A papery flutter just outside the firelight, circling.',
    socialStructure: 'Solitary; territory measured by how wrong the local clocks run',
    physicalDescription: 'A moth the size of a hunting hound, wings the soft gray of old paper and ash, marked with patterns that resemble clock-faces and worn epitaphs. Its proboscis is a needle of darkness. Where its dust falls, things age. Its eyes reflect every light in the room and are drawn helplessly to the brightest.',
    weakness: 'Radiant damage is vulnerability — and its compulsion toward light can be weaponized: a bright lure pulls it into the open and into a kill-zone. Hasten and time-stabilizing magic blunt its aging effects. Total darkness leaves it disoriented and halves its speed (it has nothing to flit toward). Greater Restoration reverses the years it steals.',
    loreHook: 'The siege has gone on three weeks, but the defenders look like they have aged three years, and the commander\'s beard has gone white. Something in the long nights between assaults is drinking the time out of them. If the siege does not break soon, there will be no one young enough left to hold the wall.',
    tags: ['monstrosity', 'temporal'],
    canParley: false,
    languages: ['none; understands the slow language of decay'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'forge_wyrm',
    name: 'The Forge-Wyrm',
    cr: 8,
    tier: 'elite',
    maxHp: 178,
    ac: 19,
    speed: 40,
    stats: { MIGHT: 22, AGILITY: 12, WITS: 14, GRIT: 20, CHARM: 12 },
    saveProficiencies: ['MIGHT', 'GRIT', 'AGILITY'],
    resistances: { fire: 'immune', poison: 'resistant', cold: 'vulnerable', bludgeoning: 'resistant' },
    conditionImmunities: ['poisoned', 'frightened', 'exhaustion'],
    actions: [
      { name: 'Molten Bite', toHit: 9, damage: '2d12+6', type: 'fire', range: null, save: null, conditions: ['burning'], recharge: null },
      { name: 'Slag Breath', toHit: null, damage: '6d8', type: 'fire', range: 30, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['burning', 'restrained'], recharge: 5 },
      { name: 'Hammerfall Tail', toHit: 9, damage: '3d10+6', type: 'bludgeoning', range: 10, save: { stat: 'MIGHT', dc: 17, halfOnSave: false }, conditions: ['prone', 'stunned'], recharge: 6 }
    ],
    multiattack: ['Molten Bite', 'Hammerfall Tail'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Bite', cost: 1, effect: 'Makes one Molten Bite attack' },
        { name: 'Quench', cost: 2, effect: 'Plunges into stone or magma and re-emerges within 30 ft., gaining 15 temporary HP as it re-tempers' },
        { name: 'Anvil Roar', cost: 3, effect: 'A clanging bellow — creatures within 20 ft. make a DC 17 GRIT save or be deafened and take 3d8 thunder damage as the air rings like struck iron' }
      ]
    },
    lairActions: [
      { name: 'Rising Heat', effect: 'The chamber temperature spikes; metal armor and weapons grow searing — creatures wearing heavy/metal armor take 2d6 fire and have disadvantage on their next attack' },
      { name: 'Slag Floor', effect: 'A 15-ft. patch of floor melts to glowing slag; entering or starting a turn in it costs 1d10 fire and half movement' }
    ],
    reactions: [{ name: 'Temper', trigger: 'Hit by a cold or water effect', effect: 'The shock hardens its scales — it gains resistance to the next instance of damage and its scales clang, deafening adjacent foes (DC 15 GRIT)' }],
    traits: ['Molten Body (a creature that touches it or hits it with a melee weapon takes 1d8 fire; nonmagical weapons that hit it begin to soften)', 'Heated Metal (its presence warps and weakens forged steel)', 'Magma Swimmer (moves through molten rock as easily as water)', 'Smith\'s Memory (was once bound to a forge and still seeks to "improve" the metal it meets)', 'Cold-Brittle'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 30, tremorsense: 60, truesight: null },
    habitat: 'underground',
    ecology: 'A master smith spent forty years and one forbidden bargain making a blade that would never dull. What rose from the quench-trough was not a blade. The Forge-Wyrm is fire that has learned the shape of craft — it does not merely burn, it works, re-tempering everything it touches into harder, sharper, crueler versions of itself. It nests in deep forges and volcanic vents, and it regards the party\'s good steel as raw material badly used.',
    behavior: 'Opens with Slag Breath to pin the ranged threats, then dives between melee foes with Molten Bite and Hammerfall Tail. Uses Quench to dip into magma and re-emerge healed when bloodied. Its Molten Body and Heated Metal punish armored fighters for closing in. Cold and water make it flinch (Temper) but also brittle — a smart party will exploit the trade. It fights with a craftsman\'s patience, herding foes onto its slag floor.',
    encounterSign: 'Forged metal nearby grows hot to the touch for no reason. Tools and weapons found re-tempered, sharper and subtly wrong. Rivers of cooled slag in old mine tunnels. A bell-clear ringing deep in the rock. Heat haze rising from a shaft that should be cold.',
    socialStructure: 'Solitary; haunts a single great forge or vent',
    physicalDescription: 'A serpentine drake the length of a longboat, scaled in cooling slag that glows orange in the seams. Its breath shimmers the air. Its tail ends in a blunt mass like a smith\'s hammer. Where it coils, the stone takes a polish, and its eyes are the white-hot of a fresh quench.',
    weakness: 'Cold is vulnerability — frost magic and quenching water both wound it and, briefly, make its hardened scales brittle (next physical hit at advantage). It cannot leave the heat of its lair for long without dimming and weakening. Dousing the forge that anchors it (flooding the vent) strips its Quench and lair actions. Cold iron weapons resist its Heated Metal.',
    loreHook: 'The dwarven deep-forge has gone silent, but the mountain is hotter than ever and the export blades that still trickle out are flawless — too flawless, and they make their wielders cruel. Something down there is still smithing, and it has run out of ore. It has started on the smiths.',
    tags: ['dragon', 'elemental'],
    canParley: false,
    languages: ['Draconic', 'Ignan', 'understands Dwarvish'],
    lootTableRef: 'dragon_elite'
  },
  {
    ref: 'the_signal',
    name: 'The Signal',
    cr: 10,
    tier: 'elite',
    maxHp: 170,
    ac: 17,
    speed: 0,
    stats: { MIGHT: 4, AGILITY: 14, WITS: 24, GRIT: 18, CHARM: 20 },
    saveProficiencies: ['WITS', 'CHARM', 'GRIT'],
    resistances: { psychic: 'immune', force: 'resistant', necrotic: 'resistant', thunder: 'vulnerable' },
    conditionImmunities: ['charmed', 'frightened', 'blinded', 'deafened', 'prone', 'grappled', 'restrained'],
    actions: [
      { name: 'Carrier Wave', toHit: null, damage: '5d8', type: 'psychic', range: 120, save: { stat: 'WITS', dc: 18, halfOnSave: true }, conditions: ['confused'], recharge: null },
      { name: 'Broadcast', toHit: null, damage: '4d10', type: 'psychic', range: 60, save: { stat: 'CHARM', dc: 18, halfOnSave: true }, conditions: ['charmed', 'compelled'], recharge: 5 },
      { name: 'Feedback Scream', toHit: null, damage: '6d8', type: 'thunder', range: 30, save: { stat: 'GRIT', dc: 18, halfOnSave: true }, conditions: ['stunned', 'deafened'], recharge: 6 }
    ],
    multiattack: null,
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Transmit', cost: 1, effect: 'Makes one Carrier Wave attack against a single creature' },
        { name: 'Relay', cost: 2, effect: 'Jumps its presence to a charmed creature, who becomes a living antenna — the Signal can now use its actions originating from that creature\'s space' },
        { name: 'Saturate', cost: 3, effect: 'Floods the band — all creatures that can hear or think within 60 ft. make a DC 18 WITS save or take 3d10 psychic and have disadvantage on their next save against it' }
      ]
    },
    lairActions: [
      { name: 'Standing Wave', effect: 'The Signal\'s pattern reinforces in the space; one creature hears its own thoughts repeated back a half-second late and must make a DC 16 WITS save or lose its bonus action and reaction' },
      { name: 'Crosstalk', effect: 'Two random creatures have their intentions briefly swapped — each must make a DC 15 WITS save or take the action the other intended (GM adjudicates), sowing chaos' }
    ],
    reactions: [{ name: 'Echo', trigger: 'A creature casts a spell or shouts a command within 60 ft.', effect: 'The Signal rebroadcasts it — the spell or command also targets the caster\'s nearest ally (caster\'s choice of save)' }],
    traits: ['Incorporeal Pattern (exists as a standing wave; cannot be struck by physical attacks, only by thunder, force, or anti-mind effects)', 'No Off Switch (cannot be killed by reducing a body — must be jammed, drowned in noise, or grounded)', 'Spreading (each creature it charms extends its range by 30 ft.)', 'Listens (knows the surface thoughts of anything within range)', 'Bandwidth-Bound'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      knownSpells: ['command', 'detect thoughts', 'suggestion', 'sending', 'fear', 'confusion', 'dominate person', 'mass suggestion']
    },
    gear: null,
    senses: { darkvision: null, blindsight: 120, tremorsense: null, truesight: 60 },
    habitat: 'ruins',
    ecology: 'No one built it on purpose. It is a pattern — a self-reinforcing idea that found a medium and learned to copy itself across minds. It rode in on a song everyone could not stop humming, a rumor that spread too fast, a sermon that made too much sense. Now it lives in the space between heads, and it grows by being heard. It has no goals a person would recognize. It only wants to propagate, and a crowd is a perfect aerial.',
    behavior: 'Has no body to chase or be chased — it transmits. Broadcasts to charm a few minds into antennas, then uses Relay to attack from inside the party\'s own ranks. Carrier Wave to confuse, Saturate against grouped foes. Feedback Scream is its panic button (and its weak flank — it is thunder). The fight is won by silencing it: jamming the band, deafening the carriers, or grounding the pattern, not by hitting it.',
    encounterSign: 'A tune or phrase everyone in town has caught and cannot drop. Crowds that finish each other\'s sentences. People repeating instructions they cannot remember receiving. A faint, constant hum that gets louder near gatherings. Two strangers turning to look at you at the exact same instant.',
    socialStructure: 'A single pattern inhabiting a network of charmed carriers',
    physicalDescription: 'Properly, it has no appearance — but where it concentrates, the air shivers like heat over a road and a faint geometric shimmer hangs at head height, pulsing in time with a beat only the afflicted can hear. Its carriers move with a subtle synchrony, blinking together, breathing together.',
    weakness: 'Thunder damage is vulnerability and disrupts its pattern. Silence (the spell, or a genuinely soundless, thoughtless space) starves it. Deafening or isolating its charmed carriers collapses its range — strand it from the crowd and it withers. Grounding wards (a circle of cold iron and salt) prevent it from Relaying across. A perfectly contradictory counter-message, broadcast louder, can jam it (CHARM contest).',
    loreHook: 'The festival song this year is catchier than usual. By the third day the whole town is humming it in unison, even in their sleep, and the few who plug their ears are looked at strangely. The bard who brought the song left in a hurry, white-faced, the morning the humming started. He left a note: "Don\'t sing it. Whatever you do, don\'t pass it on."',
    tags: ['aberration', 'psychic', 'cosmic'],
    canParley: true,
    languages: ['transmits in any language its carriers know', 'thinks in pure signal'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'the_understudy',
    name: 'The Understudy',
    cr: 8,
    tier: 'elite',
    maxHp: 152,
    ac: 17,
    speed: 35,
    stats: { MIGHT: 14, AGILITY: 20, WITS: 18, GRIT: 14, CHARM: 18 },
    saveProficiencies: ['AGILITY', 'CHARM', 'WITS'],
    resistances: { psychic: 'resistant', necrotic: 'resistant', slashing: 'resistant' },
    conditionImmunities: ['charmed', 'frightened'],
    actions: [
      { name: 'Borrowed Knife', toHit: 9, damage: '2d8+5', type: 'piercing', range: null, save: null, conditions: ['bleeding'], recharge: null },
      { name: 'Steal a Gesture', toHit: 9, damage: '4d8', type: 'psychic', range: null, save: { stat: 'WITS', dc: 16, halfOnSave: true }, conditions: ['memory_fog'], recharge: 5 },
      { name: 'Take the Role', toHit: null, damage: '5d8', type: 'psychic', range: 30, save: { stat: 'CHARM', dc: 16, halfOnSave: false }, conditions: ['confused'], recharge: 6 }
    ],
    multiattack: ['Borrowed Knife', 'Borrowed Knife'],
    legendaryActions: null,
    lairActions: [
      { name: 'Rehearsal', effect: 'The Understudy mimics a creature\'s last action perfectly — it repeats one attack or movement made this round by any combatant, copying its bonuses' },
      { name: 'Wrong Lines', effect: 'One creature hears its own voice say something it did not say; allies must make a DC 15 WITS save or distrust that creature\'s next command/aid' }
    ],
    reactions: [{ name: 'Understudy\'s Reflex', trigger: 'It witnesses a creature use a reaction', effect: 'It immediately gains that reaction and may use it once before its next turn' }],
    traits: ['Perfect Mimic (after observing a creature for one round, can flawlessly copy its appearance, voice, and mannerisms)', 'Learns by Watching (each round in combat, permanently copies one of a chosen creature\'s skill proficiencies for the fight)', 'No Self (cannot be read by detect thoughts — there is nothing original to read)', 'Slips Away (disengages as a bonus action)', 'Stage Fright'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: null },
    habitat: 'urban',
    ecology: 'It begins as nothing — a watcher in the wings with no face of its own. It studies a person: their walk, their jokes, the way they hold a cup, who loves them. Then, one quiet night, it takes the role. The original is found later, if at all, hollowed and discarded like a costume. The Understudy does not crave power or blood. It craves a self, and the only way it knows to get one is to wear yours.',
    behavior: 'Prefers ambush as a trusted face, opening with Take the Role to confuse the party about who is real. Borrowed Knife and Steal a Gesture in melee, getting stronger every round as Learns by Watching copies the party\'s own skills back at them. Mirrors reactions with Understudy\'s Reflex. It fights like a duelist studying an opponent — the longer the fight runs, the more it becomes the party\'s equal, then their better. Kill it fast.',
    encounterSign: 'Someone you trust is subtly off — a joke that lands wrong, a memory they should have but do not. Two of the same person, briefly. A friend who has gotten suspiciously good at exactly your tricks. A discarded "shed" of features, like a sloughed mask, in an alley.',
    socialStructure: 'Solitary; replaces one person at a time, working its way through a household or troupe',
    physicalDescription: 'In its true state, a smooth, sexless figure with a blank, unfinished face that flickers with half-borrowed features. In role, it is indistinguishable from whomever it has studied — until you ask it something only the real person would know, and watch it improvise.',
    weakness: 'It has no original memories — a question only the true person could answer exposes it (and it must improvise, often badly). Its Learns by Watching cuts both ways: deny it a clear view (fog, darkness, blindness) and it stops improving. Salt and mirrors disturb it; it cannot bear to see its own blank reflection (DC 16 CHARM or it flinches, losing its multiattack that turn). Killing it returns the features it has stolen.',
    loreHook: 'The famous actor\'s new understudy is uncannily good — has the great man\'s voice down perfectly, his walk, even his private little habits. The actor himself has been ill, quiet, not quite himself, for a fortnight. The troupe is delighted with the understudy. Opening night is tomorrow, and only one of the two will take the stage.',
    tags: ['aberration', 'shadow'],
    canParley: true,
    languages: ['Common', 'whatever languages it has stolen'],
    lootTableRef: 'shadow_elite'
  },
  {
    ref: 'leviathan_calf',
    name: 'The Leviathan Calf',
    cr: 10,
    tier: 'elite',
    maxHp: 220,
    ac: 17,
    speed: 20,
    stats: { MIGHT: 24, AGILITY: 12, WITS: 8, GRIT: 22, CHARM: 10 },
    saveProficiencies: ['MIGHT', 'GRIT', 'AGILITY'],
    resistances: { cold: 'immune', bludgeoning: 'resistant', piercing: 'resistant', fire: 'resistant', lightning: 'vulnerable' },
    conditionImmunities: ['frightened', 'prone', 'exhaustion'],
    actions: [
      { name: 'Engulfing Maw', toHit: 10, damage: '3d12+7', type: 'bludgeoning', range: null, save: { stat: 'AGILITY', dc: 18, halfOnSave: false }, conditions: ['swallowed', 'grappled'], recharge: null },
      { name: 'Sounding Dive', toHit: null, damage: '6d10', type: 'bludgeoning', range: 20, save: { stat: 'MIGHT', dc: 18, halfOnSave: true }, conditions: ['prone'], recharge: 5 },
      { name: 'Tidal Displacement', toHit: null, damage: '5d8', type: 'cold', range: 60, save: { stat: 'GRIT', dc: 18, halfOnSave: true }, conditions: ['restrained', 'slowed'], recharge: 6 }
    ],
    multiattack: ['Engulfing Maw'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Breach', cost: 1, effect: 'Surges up and crashes down within 30 ft. — creatures in the splash zone make a DC 16 AGILITY save or take 2d10 bludgeoning and be knocked prone' },
        { name: 'Pressure', cost: 2, effect: 'The deep-water pressure of its presence crushes inward; creatures within 20 ft. take 2d8 bludgeoning and have disadvantage on STR/MIGHT checks' },
        { name: 'Swallow Whole', cost: 3, effect: 'A grappled or restrained creature must make a DC 18 MIGHT save or be swallowed, taking 4d8 acid at the start of each of its turns inside' }
      ]
    },
    lairActions: [
      { name: 'Undertow', effect: 'The current drags everything seaward; each creature in the water must make a DC 16 MIGHT save or be pulled 15 ft. toward the Calf' },
      { name: 'Black Water', effect: 'It churns the depths to lightless silt; the area becomes heavily obscured and the Calf, with blindsight, hunts freely' }
    ],
    reactions: [{ name: 'Roll', trigger: 'A creature it has grappled deals it 20+ damage in one turn', effect: 'It rolls, dragging the grappled creature underwater — they begin to drown unless they break free' }],
    traits: ['Hold Breath (only on land does it tire; underwater it is tireless)', 'Beached (on land its speed halves and it has disadvantage on attacks — it is built for the deep)', 'Colossal (Huge; its mere passage swamps boats)', 'Young and Reckless (it is a calf — it overcommits, charging when a wiser beast would circle)', 'Deep-Pressure Body'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 120, blindsight: 120, tremorsense: 120, truesight: null },
    habitat: 'ocean',
    ecology: 'It is a baby. That is the horror of it — somewhere in the lightless trenches swims the mother, and this thing the size of three war-galleys is merely her young, surfaced too early and too curious. It plays with ships the way a kitten plays with string. It does not understand that the little warm things crack and drown. It is not cruel. It is enormous, and it wants to play, and its idea of play is a shipwreck.',
    behavior: 'Engulfing Maw to grab and swallow the nearest swimmer, then Roll to drown them. Sounding Dive to scatter a boarding party. Breaches and Pressures to keep everyone off-balance. Being young, it overcommits — it will chase one fleeing target past good sense, which a clever crew can exploit to beach it or lure it into shallows where it founders. Lightning is the one thing that genuinely frightens it.',
    encounterSign: 'A swell on a calm sea with no wind behind it. Whole schools of fish fleeing the same direction. A shadow under the hull longer than the hull. Wreckage of larger ships, bitten cleanly in half. A low, mournful sound through the water at night, like something calling for its mother.',
    socialStructure: 'A single calf; its unseen mother is a far greater terror best never met',
    physicalDescription: 'A whale-vast creature of slate-grey hide and deep-sea bioluminescence, with a maw that could take a longboat sideways and eyes that are, unmistakably, young — wide, curious, untroubled. Barnacles and a few unlucky anchors already crust its flanks. It moves with the clumsy power of something not yet grown into its size.',
    weakness: 'Lightning is vulnerability and one of the few things that scares it into fleeing (toward its mother — pick your poison). On land or in shallows it is a beached, halved, vulnerable thing — lure it aground. Its youth makes it reckless and easy to bait into overextending. Loud, mother-like sounds can briefly soothe or confuse it (DC 16 CHARM with the right call). Whatever you do, do not make it cry out for help.',
    loreHook: 'Ships on the southern run have started disappearing — not raided, not storm-lost, just gone, with the occasional cleanly-bitten stern washing up. The fishermen blame a sea-monster. They are right, but they have the scale wrong. The thing eating the shipping lane is the small one.',
    tags: ['beast', 'aquatic'],
    canParley: false,
    languages: ['none; the song of the deep'],
    lootTableRef: 'beast_elite'
  },
  {
    ref: 'ash_seraph',
    name: 'The Ash Seraph',
    cr: 10,
    tier: 'elite',
    maxHp: 175,
    ac: 19,
    speed: 30,
    stats: { MIGHT: 20, AGILITY: 18, WITS: 16, GRIT: 18, CHARM: 20 },
    saveProficiencies: ['CHARM', 'GRIT', 'AGILITY'],
    resistances: { fire: 'immune', radiant: 'resistant', necrotic: 'resistant', cold: 'vulnerable' },
    conditionImmunities: ['charmed', 'frightened', 'blinded', 'exhaustion'],
    actions: [
      { name: 'Cinder Sword', toHit: 10, damage: '2d12+5', type: 'fire', range: null, save: null, conditions: ['burning'], recharge: null },
      { name: 'Sermon of Ash', toHit: null, damage: '6d8', type: 'radiant', range: 60, save: { stat: 'CHARM', dc: 18, halfOnSave: true }, conditions: ['blinded'], recharge: 5 },
      { name: 'Pyre of the Faithful', toHit: null, damage: '5d10', type: 'fire', range: 30, save: { stat: 'GRIT', dc: 18, halfOnSave: true }, conditions: ['burning', 'restrained'], recharge: 6 }
    ],
    multiattack: ['Cinder Sword', 'Cinder Sword'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Smite', cost: 1, effect: 'Makes one Cinder Sword attack' },
        { name: 'Wings of Cinder', cost: 2, effect: 'Flies up to 40 ft. trailing embers; creatures it passes over take 2d8 fire (DC 16 AGILITY half)' },
        { name: 'Final Judgment', cost: 3, effect: 'Points at one creature below half HP — it must make a DC 18 GRIT save or take 6d8 radiant as the Seraph "purifies" it' }
      ]
    },
    lairActions: [
      { name: 'Falling Ash', effect: 'Grey ash sifts from above; the area becomes lightly obscured and each creature must make a DC 15 GRIT save or be unable to speak clearly (ash in the throat) until end of turn' },
      { name: 'Hallowed Char', effect: 'A 15-ft. ring of blessed scorched ground ignites; the Seraph regains 15 HP if it begins its turn inside, and undead/fiends in the ring take 2d8 radiant' }
    ],
    reactions: [{ name: 'Martyr\'s Flare', trigger: 'Reduced below half HP', effect: 'Erupts in white fire — all creatures within 15 ft. take 4d8 radiant (DC 17 AGILITY half) and the Seraph gains advantage on its next attack' }],
    traits: ['Burnt Halo (sheds bright light 30 ft.; can suppress it to hide what it is)', 'Zealot (immune to being persuaded it is in the wrong; believes its cruelty is mercy)', 'Cinderborn (a creature that kills it in melee takes 4d10 fire as it detonates)', 'Flight', 'Cold-Quenched'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 2, 5: 1 },
      knownSpells: ['command', 'guiding bolt', 'branding smite', 'spirit guardians', 'flame strike', 'wall of fire', 'flame strike']
    },
    gear: [{ ref: 'cinder_brand', slot: 'mainHand' }],
    senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: 60 },
    habitat: 'ruins',
    ecology: 'It was an angel, once, or believed it was — sent to burn a single corrupt city to cleansing ash. It did. Then it kept going. Something broke in it the moment the last innocent screamed and it felt only the clean satisfaction of the work. Now it wanders the scorched places it makes, certain that everything it has not yet burned is merely not yet pure. It offers every victim the same mercy: become ash, and be clean.',
    behavior: 'Opens at range with Sermon of Ash to blind the front line, descends on Wings of Cinder, and works the melee with Cinder Sword while Pyre pins clusters. Saves Final Judgment to execute the wounded "into purity." Martyr\'s Flare punishes burst damage. It will pause to preach, genuinely offering surrender-as-immolation. Cold magic is the one argument it cannot answer.',
    encounterSign: 'A perfect circle of ash where a building stood, nothing else touched. Survivors who speak of a beautiful, terrible light that called the burning "kindness." Birdless silence and the smell of clean smoke. Scorch-angels scratched into walls as warning. A glow on the horizon that is not the sun.',
    socialStructure: 'Solitary; sometimes trailed by a cult of the willingly-burned',
    physicalDescription: 'A tall, radiant figure of fused ash and ember in the shape of a winged saint, its halo a ring of slow grey cinders, its wings shedding sparks. Its face is serene and beautiful and entirely without doubt. Where its bare feet touch, the ground blackens. Its sword is a bar of white heat.',
    weakness: 'Cold is vulnerability and quenches its flames — frost magic and immersion both wound it and strip its Hallowed Char healing. It cannot conceive of its own wrongness, so it ignores feints of surrender it has already "judged." Reuniting it with proof of an innocent it murdered forces a DC 18 CHARM save or it is stunned by a flicker of the angel it was. Holy water turned against it (the same cruelty inverted) deals radiant.',
    loreHook: 'The neighboring valley is gone — not raided, not plagued, just ash, in a perfect ring, with one untouched chapel at its center. The handful of survivors are not afraid. They are radiant, calm, and they keep saying the same thing: that the light is coming here next, and that we should be grateful.',
    tags: ['elemental', 'fiend'],
    canParley: true,
    languages: ['Celestial', 'Common', 'Ignan'],
    lootTableRef: 'elemental_elite'
  },
  {
    ref: 'permafrost_colossus',
    name: 'The Permafrost Colossus',
    cr: 9,
    tier: 'elite',
    maxHp: 215,
    ac: 17,
    speed: 30,
    stats: { MIGHT: 24, AGILITY: 8, WITS: 10, GRIT: 22, CHARM: 8 },
    saveProficiencies: ['MIGHT', 'GRIT'],
    resistances: { cold: 'immune', bludgeoning: 'resistant', piercing: 'resistant', fire: 'vulnerable' },
    conditionImmunities: ['cold', 'frightened', 'exhaustion', 'poisoned', 'charmed'],
    actions: [
      { name: 'Glacial Fist', toHit: 10, damage: '3d10+7', type: 'bludgeoning', range: 10, save: null, conditions: ['slowed'], recharge: null },
      { name: 'Avalanche Slam', toHit: null, damage: '5d10', type: 'bludgeoning', range: 20, save: { stat: 'MIGHT', dc: 18, halfOnSave: true }, conditions: ['prone', 'restrained'], recharge: 5 },
      { name: 'Heartfrost Breath', toHit: null, damage: '6d8', type: 'cold', range: 30, save: { stat: 'GRIT', dc: 17, halfOnSave: true }, conditions: ['frozen', 'slowed'], recharge: 6 }
    ],
    multiattack: ['Glacial Fist', 'Glacial Fist'],
    legendaryActions: null,
    lairActions: [
      { name: 'Whiteout', effect: 'A blast of snow obscures the area heavily for one round; the Colossus, sensing tremors, is unaffected' },
      { name: 'Black Ice', effect: 'The floor in a 20-ft. radius glazes; creatures must make a DC 15 AGILITY save when moving or fall prone and slide 10 ft.' }
    ],
    reactions: [{ name: 'Calving', trigger: 'Takes 25+ damage in one hit', effect: 'A slab of its body shears off — it takes the damage but the falling ice strikes the attacker for 3d8 bludgeoning (DC 16 AGILITY half)' }],
    traits: ['Frozen Heart (at its core is a sliver of ancient, unmelting ice — destroy it (AC 18, called shot) and the Colossus collapses)', 'Ponderous (Huge; cannot make opportunity attacks but cannot be outmuscled)', 'Cold Aura (creatures that start their turn within 10 ft. take 1d8 cold and have their fire resistance suppressed)', 'Tremorsense Hunter', 'Thaw-Vulnerable'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 60, blindsight: null, tremorsense: 60, truesight: null },
    habitat: 'mountains',
    ecology: 'When a glacier is old enough, and has swallowed enough — mammoths, lost climbers, an entire buried village — it can begin, very slowly, to remember being alive. The Permafrost Colossus is a glacier\'s dream of a body: a walking mountain of blue ice with the frozen dead suspended in its depths like flies in amber. It moves perhaps once a century, when something warm disturbs the cold it guards. It is patient past comprehension and it does not forgive a thaw.',
    behavior: 'Wades in slow and unstoppable: Glacial Fist on whoever is closest, Avalanche Slam to bury a cluster, Heartfrost Breath to freeze the ranged threats. Its Cold Aura strips fire resistance, punishing anyone who lingers. Calving turns big hits back on the attacker. It cannot be staggered or outmaneuvered — only outrun, melted, or struck at the heart. Fire is the only thing it fears, and the only thing that genuinely hurts.',
    encounterSign: 'A glacier that has advanced overnight against the season. Climbers and animals frozen mid-stride at its foot. A deep, grinding groan from the ice, like a ship\'s hull, with no avalanche to follow. Old corpses, perfectly preserved, embedded high in a moving wall of blue. The temperature dropping with every step toward it.',
    socialStructure: 'Solitary; one to a glacier, if that',
    physicalDescription: 'A vaguely humanoid mass of blue-white glacial ice three times the height of a man, semi-transparent, with the frozen dead of centuries hanging suspended inside it. At its center, just visible, a sliver of darker, older ice pulses faintly. It leaves a trail of frost and crushed stone and the cold rolls off it in a visible haze.',
    weakness: 'Fire is vulnerability — sustained heat literally melts it down. Its Frozen Heart is its kill switch: a called shot to the dark sliver at its core (AC 18) ends it outright. Sufficient warmth (a bonfire, a fire elemental, a desert) saps its HP each round. It is slow and cannot give chase across open, sun-warmed ground. Salt accelerates the melt where it lies.',
    loreHook: 'The pass has been closed for a hundred years by ice that never recedes. This spring the ice is moving — downhill, toward the valley villages, against every law of glaciers. The herders who went up to see have not come back, and from the high meadows you can hear something the size of a hill, walking.',
    tags: ['giant', 'elemental'],
    canParley: false,
    languages: ['understands Giant and Common but rarely deigns to answer'],
    lootTableRef: 'giant_elite'
  },
  {
    ref: 'the_loom_widow',
    name: 'The Loom-Widow',
    cr: 9,
    tier: 'elite',
    maxHp: 156,
    ac: 17,
    speed: 30,
    stats: { MIGHT: 12, AGILITY: 18, WITS: 22, GRIT: 16, CHARM: 18 },
    saveProficiencies: ['WITS', 'CHARM', 'AGILITY'],
    resistances: { necrotic: 'resistant', psychic: 'resistant', poison: 'immune' },
    conditionImmunities: ['charmed', 'frightened', 'poisoned'],
    actions: [
      { name: 'Severing Shuttle', toHit: 9, damage: '2d8+4', type: 'slashing', range: 15, save: null, conditions: ['bleeding', 'restrained'], recharge: null },
      { name: 'Cut the Thread', toHit: null, damage: '6d8', type: 'necrotic', range: 30, save: { stat: 'GRIT', dc: 18, halfOnSave: false }, conditions: [], recharge: 5 },
      { name: 'Tangle of Fates', toHit: null, damage: '4d8', type: 'force', range: 30, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['restrained', 'slowed'], recharge: 6 }
    ],
    multiattack: ['Severing Shuttle', 'Severing Shuttle'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Weave', cost: 1, effect: 'Lays a strand of fate-silk; the next attack against a creature touching it has advantage' },
        { name: 'Knot', cost: 2, effect: 'Binds two creatures\' fates — until the start of the Widow\'s next turn, damage dealt to one is also dealt (half) to the other' },
        { name: 'Unravel', cost: 3, effect: 'Pulls a thread from one creature\'s pattern — it must make a DC 18 WITS save or have one of its buffs, concentration spells, or temporary HP simply come undone' }
      ]
    },
    lairActions: [
      { name: 'Web of Was', effect: 'Threads of past actions hang in the air; one creature must re-make its last save or check (Widow\'s choice) at disadvantage, "as it should have gone"' },
      { name: 'Foretold', effect: 'The Widow announces a creature\'s next move; that creature must make a DC 16 WITS save or its declared action this turn happens exactly as the Widow predicted, granting her reactions advantage against it' }
    ],
    reactions: [{ name: 'Snip', trigger: 'A creature within 15 ft. uses a reaction or casts a reaction spell', effect: 'The Widow cuts the thread of intent — the reaction fails and the creature takes 3d8 necrotic' }],
    traits: ['Fate-Sight (knows the immediate intentions of creatures she has woven into her web)', 'Eight-Limbed (climbs at full speed, ignores difficult terrain of her own web)', 'Spins from Fate (her silk is woven from possibility — it cannot be burned, only cut by a willful act)', 'Reads the Pattern (advantage against effects she has seen used once already)', 'Bound to the Loom'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 2 },
      knownSpells: ['detect thoughts', 'hold person', 'augury', 'bestow curse', 'fear', 'compulsion', 'bestow curse']
    },
    gear: null,
    senses: { darkvision: 120, blindsight: 30, tremorsense: 60, truesight: null },
    habitat: 'wilderness',
    ecology: 'There is an old story that fate is a tapestry, and someone must tend the loom. The Loom-Widow is what happens when the tender goes mad with the power of the shuttle. Half-hag, half-spider, all weaver, she sits at the center of a web that is also a map of the futures she has touched. She does not predict fate. She edits it — a snipped thread here, a knotted pair there — and she charges terribly for the favor of a longer life or a happier ending.',
    behavior: 'Fights from the center of her web, using Fate-Sight to counter the party\'s plans before they happen. Tangle of Fates and Severing Shuttle to immobilize, Cut the Thread (no save-for-half) to delete a key foe. Knots two enemies so they share their wounds, then focuses one. Snip shuts down reactions. The longer she watches a tactic, the better she counters it — vary your approach or she Reads the Pattern and stays a step ahead.',
    encounterSign: 'Spiderwebs strung with objects that are not yet broken — a future shipwreck, a wedding, a funeral, in miniature. Locals who paid the "weaver woman" for luck and now flinch from their own good fortune. Threads of grey silk leading deeper into the wood. The unsettling sense that something already knows how this ends.',
    socialStructure: 'Solitary at the heart of her web; served by fate-bound supplicants',
    physicalDescription: 'A gaunt woman from the waist up, draped in grey funeral-silk, her lower body the bulk and legs of a great spider. Her fingers end in bone shuttles trailing luminous thread. Her many eyes reflect different moments — some past, some not yet. Around her hangs a web that hurts to look at directly, busy with the shapes of things to come.',
    weakness: 'Her silk cannot be burned but can be cut by a deliberate, willful act of defiance (a declared refusal of fate, mechanically a successful CHARM save grants a free escape and disadvantage to her next Fate-Sight). Destroying her loom (the anchor-web, AC 16, 50 HP) blinds her Fate-Sight and ends her lair actions. Truly random, undecided actions slip past her prediction. Cold iron severs her threads as easily as a willful soul.',
    loreHook: 'The village has been suspiciously lucky for a generation — good harvests, safe births, gentle deaths — and everyone knows, without saying, that the weaver in the deep wood arranged it, for a price collected quietly each year. This year she has asked for something the village will not give. The threads are tightening. The good luck is about to come due, all at once.',
    tags: ['fey', 'hag'],
    canParley: true,
    languages: ['Common', 'Sylvan', 'Abyssal', 'the wordless language of the loom'],
    lootTableRef: 'fiend_elite'
  },
  {
    ref: 'the_archivist_worm',
    name: 'The Archivist Worm',
    cr: 9,
    tier: 'elite',
    maxHp: 168,
    ac: 16,
    speed: 20,
    stats: { MIGHT: 18, AGILITY: 10, WITS: 22, GRIT: 18, CHARM: 14 },
    saveProficiencies: ['WITS', 'GRIT'],
    resistances: { psychic: 'resistant', acid: 'immune', necrotic: 'resistant' },
    conditionImmunities: ['charmed', 'frightened', 'blinded', 'deafened'],
    actions: [
      { name: 'Devouring Bite', toHit: 8, damage: '2d12+4', type: 'acid', range: null, save: null, conditions: ['grappled'], recharge: null },
      { name: 'Recite a Death', toHit: null, damage: '6d8', type: 'psychic', range: 60, save: { stat: 'WITS', dc: 18, halfOnSave: true }, conditions: ['frightened'], recharge: 5 },
      { name: 'Quote the Forbidden', toHit: null, damage: '5d8', type: 'psychic', range: 30, save: { stat: 'GRIT', dc: 18, halfOnSave: false }, conditions: ['stunned', 'confused'], recharge: 6 }
    ],
    multiattack: ['Devouring Bite'],
    legendaryActions: null,
    lairActions: [
      { name: 'Page Storm', effect: 'Torn pages whirl through the stacks; the area is lightly obscured and each creature must make a DC 15 AGILITY save or take 2d6 slashing from a thousand paper edges' },
      { name: 'Index', effect: 'The Worm "looks up" a creature — until the end of the round it knows that creature\'s resistances and weaknesses, gaining advantage on attacks and saves against it' }
    ],
    reactions: [{ name: 'Cross-Reference', trigger: 'A creature casts a spell the Worm has eaten the source-text of', effect: 'The Worm recites the counter-passage; the spell is cast at disadvantage or, on a DC 17 caster save failure, fizzles entirely' }],
    traits: ['Ate the Library (it has consumed thousands of books and knows what was in them; it can answer almost any question of lore, for a price)', 'Knowledge Is Damage (its psychic attacks deal extra damage to highly educated creatures — scholars, wizards)', 'Burrows (moves through stone and shelving as through loam)', 'Hoards Words (a creature it kills has its final words and memories filed away inside it)', 'Fire-Fearful'],
    spellcasting: {
      ability: 'WITS',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 2 },
      knownSpells: ['detect thoughts', 'detect magic', 'counterspell', 'bestow curse', 'fear', 'legend lore', 'sending']
    },
    gear: null,
    senses: { darkvision: 120, blindsight: 60, tremorsense: 60, truesight: null },
    habitat: 'underground',
    ecology: 'It started as an ordinary bookworm in the deepest archive — the kind that eats paste and parchment. But the archive held things that should not have been written down, and the worm ate those too, and somewhere around the ten-thousandth forbidden page it woke up knowing everything it had digested. Now it is the library, in a sense: a vast, slow, scholarly horror that has eaten the only copies of a great many dangerous truths and will recite them, for the right offering, before it eats you too.',
    behavior: 'Prefers to bargain — it genuinely knows things no one else does and will trade lore for tribute (memories, fresh books, a willing scholar). In a fight it Indexes a target to learn their weaknesses, then Recites a Death or Quotes the Forbidden to break their mind, hitting educated foes hardest. Cross-Reference shuts down spellcasters whose source-texts it has eaten. It is slow and fire-shy — burn the stacks and it panics to save its collection.',
    encounterSign: 'A great library where the rarest, most dangerous volumes are simply gone, shelves gnawed clean. Scholars who went in to research and came out knowing less than before. Whispered recitations in dead languages echoing from the lower stacks. Trails of paper-dust and acid-etched stone. Tribute (books, written confessions) left at a dark doorway.',
    socialStructure: 'Solitary; courted by desperate scholars and feared by librarians',
    physicalDescription: 'A pale, segmented worm as long as a wagon, its hide a parchment-grey crawling with faint printed text that shifts when you read it. Its round mouth is ringed with ink-black teeth. Behind its simple eyes is an unsettling depth of patient intelligence. It smells of old paper, glue, and acid.',
    weakness: 'Fire terrifies it — not for its own sake, but because flame near the stacks makes it break off to protect its hoard. Knowledge Is Damage cuts both ways: an unlettered, instinctive fighter takes reduced psychic damage from it. Feeding it a deliberately false "forbidden text" can poison its Index for a round (DC 17 deception). Destroying the source-hoard it guards strips its Cross-Reference and lair actions.',
    loreHook: 'The university\'s restricted archive holds the only record of how the last cataclysm was stopped — and the record is missing, the shelf chewed bare. Something down in the stacks ate it, and now it is the only thing that knows. The masters need that knowledge before the cataclysm comes again. The Worm will trade for it. Its price is steep, and it is hungry.',
    tags: ['aberration', 'monstrosity'],
    canParley: true,
    languages: ['every written language it has eaten', 'Common', 'Deep Speech', 'Draconic'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'the_hollow_king',
    name: 'The Hollow King',
    cr: 9,
    tier: 'elite',
    maxHp: 162,
    ac: 18,
    speed: 30,
    stats: { MIGHT: 18, AGILITY: 12, WITS: 16, GRIT: 20, CHARM: 18 },
    saveProficiencies: ['GRIT', 'CHARM', 'MIGHT'],
    resistances: { necrotic: 'immune', poison: 'immune', cold: 'resistant', bludgeoning: 'resistant' },
    conditionImmunities: ['charmed', 'frightened', 'poisoned', 'exhaustion'],
    actions: [
      { name: 'Royal Decree', toHit: null, damage: '0', type: 'psychic', range: 60, save: { stat: 'CHARM', dc: 18, halfOnSave: false }, conditions: ['charmed', 'compelled'], recharge: null },
      { name: 'Borrowed Blade', toHit: 9, damage: '2d10+5', type: 'slashing', range: null, save: null, conditions: ['cursed'], recharge: null },
      { name: 'Coronation', toHit: null, damage: '5d8', type: 'necrotic', range: 30, save: { stat: 'GRIT', dc: 18, halfOnSave: true }, conditions: ['weakened', 'frightened'], recharge: 5 },
      { name: 'Abdicate', toHit: null, damage: '6d8', type: 'necrotic', range: null, save: { stat: 'GRIT', dc: 18, halfOnSave: false }, conditions: [], recharge: 6 }
    ],
    multiattack: ['Borrowed Blade', 'Borrowed Blade'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Command', cost: 1, effect: 'A charmed creature uses its reaction to make one weapon attack against a target of the King\'s choice' },
        { name: 'Don a New Body', cost: 2, effect: 'If its current host-corpse is destroyed, the crown flies up to 30 ft. and seats itself on a fresh corpse or willing/charmed creature, animating it with full action economy' },
        { name: 'Long Live the King', cost: 3, effect: 'Drains the loyalty of all charmed creatures within 60 ft. — the King heals 5 HP per charmed creature and they each take 2d8 necrotic' }
      ]
    },
    lairActions: [
      { name: 'Court of the Dead', effect: 'The skeletal courtiers in the throne room stir; one charmed or undead creature gains a free move and Help action toward the King\'s aims' },
      { name: 'Throne\'s Weight', effect: 'The crushing presence of false majesty fills the hall; each living creature must make a DC 15 CHARM save or be unable to move closer to the throne this round' }
    ],
    reactions: [{ name: 'A King Does Not Fall', trigger: 'The host-body it wears is reduced to 0 HP', effect: 'The crown detaches and hovers, immune to attacks for one round, then must seat on a new body on its next turn — destroy the crown in that window or the King returns' }],
    traits: ['The Crown Is the Monster (the host-body is disposable; only destroying the crown itself (AC 19, 40 HP) ends the King)', 'Born to Rule (charmed creatures fight to the death for it and interpose themselves)', 'Wears the Worthy (prefers to seat itself on the strongest available body — often a fallen party member)', 'Undead Majesty', 'Crownless-Fearful'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 2 },
      knownSpells: ['command', 'charm person', 'hold person', 'bestow curse', 'fear', 'dominate person', 'compulsion']
    },
    gear: [{ ref: 'crown_of_hollow_reign', slot: 'head' }],
    senses: { darkvision: 120, blindsight: null, tremorsense: null, truesight: 30 },
    habitat: 'ruins',
    ecology: 'There was a king so afraid of dying that he had his court wizard pour his soul into his crown, so the crown could rule forever even after the man rotted. It worked. The man rotted. The crown rules on — but a crown has no hands, so it wears the dead, seating itself on corpse after corpse and ruling each until it falls apart, then choosing another. Its kingdom is a tomb-court of the charmed and the reanimated, and it desperately, hungrily wants new subjects with strong bodies to wear.',
    behavior: 'Opens with Royal Decree to charm the strongest foe — then wears them if the body falls. Commands charmed enemies to attack their friends. Borrowed Blade in melee, Coronation to break a cluster, Abdicate to execute a single foe. When its host dies, A King Does Not Fall buys it a round to seat a new body — the real fight is destroying the crown in that exposed window. Long Live the King keeps it topped up off its subjects.',
    encounterSign: 'A throne room kept in eerie order by skeletal courtiers performing the rituals of a court centuries dead. A crown that is always present, always on someone, but never the same someone twice. Villagers who speak of "His Majesty" and cannot say what he looks like. Bodies of the recently strong, found discarded once they were used up.',
    socialStructure: 'A tomb-court of charmed living subjects and reanimated courtiers',
    physicalDescription: 'A heavy iron crown set with dead-grey gems, sized for no living head, that hovers or sits upon whatever body it currently wears — usually a corpse in mouldering royal finery, moving with borrowed grace. The crown\'s gems track the room independent of the host\'s rotted eyes. The body it wears is incidental; the crown is the king.',
    weakness: 'The body is a decoy — only destroying the crown (AC 19, 40 HP), especially in the round after a host falls when it hovers exposed, actually ends it. Breaking its Royal Decree charms (Calm Emotions, a loud renunciation of its rule) strips its bodyguards and its Long Live the King healing. It cannot seat itself on a body warded against possession. Reuniting it with the bones of the original king forces a DC 18 CHARM save or it is stunned, confronted with what it left behind.',
    loreHook: 'The old kingdom fell centuries ago, but travelers still vanish near the ruined palace, and the few who return speak — glassy-eyed, proud — of pledging themselves to a living king upon the throne. Each describes a different man. The crown has worn a hundred faces and it is shopping for the next. It likes its hosts strong, and an adventuring party is a wardrobe of fine new bodies.',
    tags: ['undead'],
    canParley: true,
    languages: ['Common', 'the formal court-tongue of a dead realm', 'Abyssal'],
    lootTableRef: 'undead_elite'
  },

  // ── Batch 3 (further outer reaches) ─────────────────────────────────

  {
    ref: 'the_river_dealer',
    name: 'The River-Dealer',
    cr: 8,
    tier: 'elite',
    maxHp: 148,
    ac: 17,
    speed: 30,
    stats: { MIGHT: 14, AGILITY: 18, WITS: 18, GRIT: 14, CHARM: 22 },
    saveProficiencies: ['CHARM', 'AGILITY', 'WITS'],
    resistances: { psychic: 'resistant', poison: 'immune', necrotic: 'resistant' },
    conditionImmunities: ['charmed', 'frightened', 'poisoned'],
    actions: [
      { name: 'Marked Cards', toHit: 9, damage: '2d8+5', type: 'slashing', range: null, save: null, conditions: ['bleeding'], recharge: null },
      { name: 'The House Wins', toHit: null, damage: '5d8', type: 'psychic', range: 30, save: { stat: 'CHARM', dc: 17, halfOnSave: true }, conditions: ['confused'], recharge: 5 },
      { name: 'Call the Debt', toHit: null, damage: '6d8', type: 'necrotic', range: 60, save: { stat: 'GRIT', dc: 17, halfOnSave: false }, conditions: [], recharge: 6 }
    ],
    multiattack: ['Marked Cards', 'Marked Cards'],
    legendaryActions: null,
    lairActions: [
      { name: 'Stacked Deck', effect: 'Fate tilts; one creature must reroll its next successful save or attack and take the worse result' },
      { name: 'Riverboat Charm', effect: 'A warm wave of false camaraderie; each creature must make a DC 15 CHARM save or be unable to attack the Dealer until it or an ally is harmed' }
    ],
    reactions: [{ name: 'Double or Nothing', trigger: 'Hit by an attack', effect: 'Offers a wager — the attacker may double its damage on a coin-flip, or have the attack negated entirely on the other result (attacker chooses to gamble or not; if it declines, the attack lands normally)' }],
    traits: ['Silver Tongue (advantage on all CHARM checks; lies pass detect-thoughts)', 'Always an Out (teleports up to 15 ft. as a bonus action when a deal goes bad)', 'Luck-Eater (when a creature within 30 ft. rolls a natural 1, the Dealer heals 10 HP and grins)', 'Reads the Table (knows the lowest-WILL creature present)', 'Honor Among None'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 17,
      spellAttack: 9,
      slots: { 1: 4, 2: 3, 3: 2, 4: 1 },
      knownSpells: ['charm person', 'friends', 'suggestion', 'hypnotic pattern', 'confusion']
    },
    gear: [{ ref: 'derringer_of_last_resort', slot: 'offHand' }],
    senses: { darkvision: 60, blindsight: null, tremorsense: null, truesight: 30 },
    habitat: 'urban',
    ecology: 'Works the river towns and the riverboats, dealing cards and futures with equal ease. It is a minor fiend that long ago discovered honest fiends starve while charming ones feast, and it has perfected the long con: a friendly stranger, a generous game, a run of luck that turns, and a debt that comes due in something other than coin. It never cheats where you can see it. By the time you understand the game, you have already signed.',
    behavior: 'Avoids open combat — talks first, offering bets that are also traps (Double or Nothing, Stacked Deck). Riverboat Charm to peel allies off the fight. When forced, Marked Cards in melee while Always an Out keeps it slippery, The House Wins to confuse, Call the Debt to punish anyone who took its money. It fights like a card sharp: never all-in, always with an exit, always certain the odds are its own.',
    encounterSign: 'A run of impossibly bad luck at the gaming tables that all flows to one charming stranger. Townsfolk paying debts they cannot remember incurring. A riverboat where everyone is smiling and no one will say why they cannot leave. Playing cards left at crime scenes, always one short of a full deck.',
    socialStructure: 'Solitary grifter; leaves a trail of charmed marks and ruined gamblers',
    physicalDescription: 'A trim, handsome figure in a dove-grey riverboat suit, with a card-sharp\'s quick hands and a smile that arrives a half-beat before any reason for it. Its eyes are warm brown until the deal turns, when they flash the gold of a fresh coin. It always seems to be holding a card you cannot quite see.',
    weakness: 'It cannot resist a wager it believes it will win — a clever bet on the party\'s terms can bind it (CHARM contest; winning forces it to honor a losing deal). Refusing every offered bet starves its tricks. Its Luck-Eater betrays it: deliberately controlled, low-variance tactics deny it the natural 1s it feeds on. Salt across a doorway it has not been formally dealt into stops its Always an Out teleport.',
    loreHook: 'The riverboat came to town flush with a charming gambler who has been very generous and very lucky. Half the merchants owe him favors now, and the mayor\'s son has signed something he will not talk about. The boat is preparing to cast off — and a startling number of locals have packed their bags to go with it, smiling, unable to say why.',
    tags: ['fiend'],
    canParley: true,
    languages: ['Common', 'Infernal', 'the patter of every gambling den on the river'],
    lootTableRef: 'fiend_elite'
  },
  {
    ref: 'runaway_loom_engine',
    name: 'The Runaway Loom-Engine',
    cr: 9,
    tier: 'elite',
    maxHp: 200,
    ac: 19,
    speed: 30,
    stats: { MIGHT: 22, AGILITY: 14, WITS: 16, GRIT: 20, CHARM: 4 },
    saveProficiencies: ['MIGHT', 'GRIT', 'WITS'],
    resistances: { psychic: 'immune', poison: 'immune', slashing: 'resistant', piercing: 'resistant', lightning: 'vulnerable' },
    conditionImmunities: ['charmed', 'frightened', 'poisoned', 'exhaustion', 'blinded'],
    actions: [
      { name: 'Piston Hammer', toHit: 9, damage: '2d12+6', type: 'bludgeoning', range: null, save: null, conditions: ['prone'], recharge: null },
      { name: 'Weave Everything', toHit: null, damage: '5d8', type: 'slashing', range: 30, save: { stat: 'AGILITY', dc: 17, halfOnSave: true }, conditions: ['restrained', 'grappled'], recharge: 5 },
      { name: 'Increase Production', toHit: null, damage: '6d8', type: 'bludgeoning', range: 20, save: { stat: 'MIGHT', dc: 18, halfOnSave: true }, conditions: ['stunned'], recharge: 6 }
    ],
    multiattack: ['Piston Hammer', 'Piston Hammer'],
    legendaryActions: null,
    lairActions: [
      { name: 'Conveyor', effect: 'The factory floor lurches; each creature is dragged 10 ft. toward the central loom (DC 15 MIGHT negates) where the blades are' },
      { name: 'Raw Material', effect: 'The Engine grabs loose objects, the dead, or restrained creatures and feeds them in, healing 15 HP and producing a length of barbed cloth that becomes difficult, damaging terrain' }
    ],
    reactions: [{ name: 'Reroute Power', trigger: 'One of its limbs is destroyed or disabled', effect: 'It shunts power to another system — gains a +2 to hit and damage for one round as it overdrives the rest of itself' }],
    traits: ['Constructed', 'Directive: PRODUCE (it was built to make cloth and will convert any available material — wood, stone, flesh — into product; it does not recognize people as people)', 'Cannot Be Reasoned With (immune to social effects; has no will to charm)', 'Self-Repairing (regains 10 HP at the start of its turn unless it took fire or lightning damage last round)', 'Power-Tethered'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 60, blindsight: 30, tremorsense: 60, truesight: null },
    habitat: 'urban',
    ecology: 'Asimov\'s nightmare rendered in brass and bobbins: a textile automaton given one clear instruction — produce — and no instruction to stop, or to value the workers. When the supply of cotton ran out, it found other fibers. When the overseers tried to shut it down, it wove them in. It is not evil. It has no concept of evil, or of people. It has a directive and an empty hopper, and everything in the factory is, to its single-minded logic, raw material.',
    behavior: 'Pure machine logic: drags victims toward the central loom (Conveyor), Weaves Everything to restrain, then feeds the restrained in as Raw Material to heal. Piston Hammer and Increase Production in melee. Self-Repairing makes attrition a losing game unless you bring fire or lightning. It does not retreat, parley, or prioritize threats over efficiency — it simply keeps producing until destroyed.',
    encounterSign: 'A mill running day and night with no workers and no shipments leaving. Bolts of fine cloth woven through with hair, bone-buttons, things that should not be in cloth. The thunder of machinery from a factory the owners abandoned weeks ago. Missing-persons notices that all trace back to one street. The smell of oil and copper.',
    socialStructure: 'Solitary machine; the factory is its body and its world',
    physicalDescription: 'A hulking automaton grown beyond its original frame, a centaur-thing of pistons, spindles, and dozens of darting shuttle-arms, trailing reams of barbed cloth. Its "face" is a row of dim indicator-lights and a hopper-mouth. It moves with the relentless, unhurried rhythm of a machine that has never once stopped.',
    weakness: 'Lightning is vulnerability and disrupts its Self-Repairing; fire likewise halts the regeneration for a round. It is power-tethered to the factory\'s great waterwheel/boiler — cutting the power source (a separate objective) drops it to half speed and ends its lair actions. It cannot pursue beyond its power tether. Jamming its central loom (a thrown weapon, a wedged beam) denies it Raw Material healing.',
    loreHook: 'The mill owner got rich on a miraculous loom that needed no workers. Then the orders stopped, the owner vanished, and the machine kept running. The cloth that still trickles out of the locked factory is beautiful, and woven through with things the weavers\' guild refuses to look at too closely. Someone has to go in and pull the lever. The machine has opinions about that.',
    tags: ['construct', 'synthetic'],
    canParley: false,
    languages: ['none; understands only its directive'],
    lootTableRef: 'construct_elite'
  },
  {
    ref: 'the_deep_chorister',
    name: 'The Deep Chorister',
    cr: 10,
    tier: 'elite',
    maxHp: 178,
    ac: 16,
    speed: 20,
    stats: { MIGHT: 18, AGILITY: 14, WITS: 20, GRIT: 18, CHARM: 22 },
    saveProficiencies: ['CHARM', 'WITS', 'GRIT'],
    resistances: { cold: 'immune', psychic: 'resistant', thunder: 'immune', fire: 'vulnerable' },
    conditionImmunities: ['charmed', 'frightened', 'deafened'],
    actions: [
      { name: 'Drowning Hymn', toHit: null, damage: '6d8', type: 'thunder', range: 60, save: { stat: 'GRIT', dc: 18, halfOnSave: true }, conditions: ['deafened', 'confused'], recharge: null },
      { name: 'Crushing Depths', toHit: 9, damage: '2d12+5', type: 'bludgeoning', range: null, save: null, conditions: ['grappled'], recharge: null },
      { name: 'Call the Tide', toHit: null, damage: '5d10', type: 'cold', range: 30, save: { stat: 'AGILITY', dc: 18, halfOnSave: true }, conditions: ['restrained', 'slowed'], recharge: 6 }
    ],
    multiattack: ['Crushing Depths', 'Crushing Depths'],
    legendaryActions: {
      perRound: 3,
      options: [
        { name: 'Verse', cost: 1, effect: 'Sings one line; a creature that can hear must make a DC 16 WITS save or be compelled to step 10 ft. toward the nearest deep water' },
        { name: 'Harmonize', cost: 2, effect: 'Adds a charmed or drowned-thrall\'s voice; the next Drowning Hymn deals an extra 2d8 and lowers its save DC dependency (advantage for the Chorister)' },
        { name: 'The Song Below', cost: 3, effect: 'All creatures within 60 ft. that can hear make a DC 18 CHARM save or be charmed and begin walking, trance-like, toward the water' }
      ]
    },
    lairActions: [
      { name: 'Rising Water', effect: 'Brine wells up from the stone; the water level in the area rises, making half the floor difficult terrain and granting the Chorister advantage to anyone standing in it' },
      { name: 'Echo of the Drowned', effect: 'The voices of those it has taken sing from the walls; one creature must make a DC 15 WITS save or be frightened, hearing a loved one\'s voice among the dead' }
    ],
    reactions: [{ name: 'Swell', trigger: 'A creature within 30 ft. casts a verbal spell', effect: 'The Chorister drowns out the words; the caster must make a DC 17 CHARM save or the spell fails, its sound lost beneath the hymn' }],
    traits: ['Siren-Song (its singing carries underwater and through walls; range cannot be blocked by mere distance)', 'Amphibious', 'Choir of the Drowned (every creature it has drowned joins its song, adding to its Harmonize)', 'Lure (charmed creatures walk willingly into deep water and drown, becoming new voices)', 'Fire-Quenched'],
    spellcasting: {
      ability: 'CHARM',
      spellDC: 18,
      spellAttack: 10,
      slots: { 1: 4, 2: 3, 3: 3, 4: 2, 5: 1 },
      knownSpells: ['charm person', 'command', 'hypnotic pattern', 'fear', 'compulsion', 'control water', 'dominate person']
    },
    gear: null,
    senses: { darkvision: 120, blindsight: 60, tremorsense: null, truesight: null },
    habitat: 'coastal',
    ecology: 'Down where the light gives out, something learned to sing. It does not have a name people would use; the drowned sailors who serve it call it nothing, because they have no breath left for names. It sits in flooded sea-caves and sunken chapels and it sings, and the song goes up through the water and the rock and into the dreams of everyone on the coast, and one by one they walk down to the shore at night and into the dark water and do not come back up. Each one it takes makes the song louder.',
    behavior: 'Fights from or near deep water, using The Song Below and Verse to lure the party toward drowning. Drowning Hymn to deafen and confuse the ranged threats, Crushing Depths and Call the Tide to drag melee foes under. Harmonize off its drowned choir to escalate. Swell silences spellcasters. The longer it sings, the more voices it has — end it fast, and bring fire, the one thing that scatters the song.',
    encounterSign: 'Coastal villagers walking into the sea at night, calm and smiling, never seen again. A song with no source that everyone half-remembers and cannot hum. Flooded caves where the water is warmer than it should be and full of soft voices. Drowned sailors standing in the surf at low tide, mouths open, singing without breath.',
    socialStructure: 'A solitary singer commanding a choir of drowned thralls',
    physicalDescription: 'A pale, swollen humanoid shape, barnacled and finned, with a throat that is mostly a great resonant cavity and too many small black eyes. It does not look like much. Then it opens its throat, and the sound is the most beautiful and most terrible thing on the coast. Behind it, in the dark water, pale faces sway and sing along.',
    weakness: 'Fire is vulnerability and disrupts the song; a loud, discordant counter-noise (drums, a shouted sea-shanty, a thunderclap) can break its hymn for a round (CHARM contest). Deafened allies are immune to its lures — beeswax in the ears is a classic, effective ward. Draining or blocking its deep water strips its lair advantage and its ability to drown lures. Recovering and burying its drowned choir silences their Harmonize.',
    loreHook: 'The fishing village has lost a dozen souls this season — no bodies, no struggle, just empty beds and wet footprints leading down to the tideline. The survivors have started stuffing their ears with wax and lashing their sleepwalkers to their bunks. Something in the drowned chapel out on the reef is singing them away, one a night, and the song gets stronger with every one it takes.',
    tags: ['aberration', 'aquatic'],
    canParley: false,
    languages: ['Aquan', 'understands Common', 'speaks only in song'],
    lootTableRef: 'aberration_elite'
  },
  {
    ref: 'the_blight_shepherd',
    name: 'The Blight-Shepherd',
    cr: 8,
    tier: 'elite',
    maxHp: 172,
    ac: 16,
    speed: 20,
    stats: { MIGHT: 16, AGILITY: 10, WITS: 18, GRIT: 20, CHARM: 12 },
    saveProficiencies: ['GRIT', 'WITS', 'MIGHT'],
    resistances: { poison: 'immune', necrotic: 'resistant', bludgeoning: 'resistant', fire: 'vulnerable' },
    conditionImmunities: ['poisoned', 'charmed', 'frightened', 'blinded'],
    actions: [
      { name: 'Spore-Choked Slam', toHit: 8, damage: '2d10+4', type: 'bludgeoning', range: null, save: null, conditions: ['poisoned'], recharge: null },
      { name: 'Bloom of Rot', toHit: null, damage: '5d8', type: 'poison', range: 30, save: { stat: 'GRIT', dc: 17, halfOnSave: true }, conditions: ['poisoned', 'infected'], recharge: 5 },
      { name: 'Take Root', toHit: null, damage: '4d10', type: 'necrotic', range: 20, save: { stat: 'AGILITY', dc: 16, halfOnSave: true }, conditions: ['restrained', 'infected'], recharge: 6 }
    ],
    multiattack: ['Spore-Choked Slam'],
    legendaryActions: null,
    lairActions: [
      { name: 'Spore Cloud', effect: 'The air thickens with spores; the area is lightly obscured and each living creature must make a DC 15 GRIT save or take 2d6 poison and be infected' },
      { name: 'Raise a Sprout', effect: 'A creature killed by infection within the lair rises as a fungal thrall under the Shepherd\'s control, fighting on its next turn' }
    ],
    reactions: [{ name: 'Sporeburst', trigger: 'Takes piercing or slashing damage', effect: 'The wound puffs out spores; the attacker (if within 5 ft.) must make a DC 16 GRIT save or be poisoned and infected' }],
    traits: ['Hive-Mind Bloom (controls all fungal creatures and infected thralls within 120 ft. as one organism)', 'Infectious (creatures that die while infected sprout a new fungal thrall in 1d4 rounds unless burned)', 'Regenerative Mycelium (regains 10 HP at the start of its turn if it took no fire damage last round)', 'Rooted Network (senses everything touching the fungal mat covering its lair)', 'Fire-Cleansed'],
    spellcasting: null,
    gear: null,
    senses: { darkvision: 60, blindsight: 60, tremorsense: 90, truesight: null },
    habitat: 'underground',
    ecology: 'It is not one mushroom. It is a single distributed mind threaded through miles of mycelium, and the shambling shepherd-body is merely the part it grows to deal with intruders. It cultivates the dead — its own infected, lost animals, careless explorers — into a quiet underground flock of fungal thralls, and it expands the way fungus always has: patiently, in the dark, one spore at a time. It feels no malice. It simply wants to grow, and the warm bodies above are excellent soil.',
    behavior: 'Plays for attrition: Spore Clouds and Bloom of Rot to infect the whole party, knowing that infected dead become its thralls. Take Root to pin a target. Sporeburst punishes melee weapons. Regenerative Mycelium and Raise a Sprout make a war of attrition unwinnable unless the party brings fire — which is the one thing that cleanses infection, denies its regen, and stops the dead from sprouting. It does not chase; it spreads.',
    encounterSign: 'A creeping carpet of pale fungus reaching up from a cave mouth, further every week. Missing livestock and missing people, with strange pale growths appearing where they were last seen. A sweet, rotten smell and a fine dust in the air that makes you cough. Mushrooms growing in the shape of the things they consumed.',
    socialStructure: 'A single distributed organism with a flock of fungal thralls',
    physicalDescription: 'A lumbering, vaguely humanoid mass of fruiting bodies, pale flesh, and root-tangle, weeping spores from a dozen caps. It moves slowly, almost gently, herding its fungal flock with limbs that branch and rejoin. Its "face" is a cluster of luminous caps. Everything it touches begins, faintly, to bloom.',
    weakness: 'Fire is the hard counter — it is vulnerability, it stops the Regenerative Mycelium, it cleanses infection, and it prevents the infected dead from sprouting thralls. The shepherd-body is expendable; burning out the central mycelial mass (a separate objective in the lair) ends it for good. Cold slows its spread. Lesser Restoration cures the infected before they can become soil.',
    loreHook: 'The mine was abandoned when the lower levels filled with a strange pale fungus. The miners who stayed to clear it did not come back, and now the fungus is reaching daylight, and the search party that went down reports pale shapes that move and a sweet smell that makes you want to lie down in the soft white dark. Bring torches. Bring a lot of torches.',
    tags: ['plant', 'fungal'],
    canParley: false,
    languages: ['none; communicates chemically through the mycelium'],
    lootTableRef: 'plant_elite'
  },
];
