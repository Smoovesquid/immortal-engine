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
    ref: 'pit_fiend_lesser',
    name: 'Lesser Pit Fiend',
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
];
