/**
 * The Pantheon — pure static data for the Dark Path morality system.
 * No logic, no imports, no side effects. Lane D wires this into engine state.
 *
 * Three tiers: the Creator (above all) · seven virtue gods (angels) · seven sin gods (demons).
 * Each god is bound to one of the seven axes; every axis has exactly one demon and one angel.
 *
 * Privatio boni law: sin gods CANNOT keep a contract — betrayal is what disorder is,
 * not merely their temperament. Their gifts are real; their loyalty is performance.
 *
 * The Camera Rule binds all flavor text here: evil is dread/appetite/cost, never a
 * power-fantasy high. The hard exclusion (children) is enforced by the Creator's ward —
 * noted in CREATOR.ward; Lane D never renders a scene that crosses it.
 */

// ─── Axes ────────────────────────────────────────────────────────────────────

export const AXES = /** @type {const} */ ([
  'pride',
  'greed',
  'wrath',
  'envy',
  'lust',
  'gluttony',
  'sloth',
]);

export const CONTRARY_VIRTUES = /** @type {const} */ ({
  pride:    'humility',
  greed:    'charity',
  wrath:    'patience',
  envy:     'kindness',
  lust:     'chastity',
  gluttony: 'temperance',
  sloth:    'diligence',
});

// ─── The Creator ─────────────────────────────────────────────────────────────

export const CREATOR = {
  id: 'the-one',
  name: 'The One Who Asks Nothing',
  tier: 'creator',
  axis: null,

  nature: [
    'The source above the fourteen. Not petitioned, not bargained with.',
    'Reached only by the desireless act — virtue for its own sake, the deed done with no lust of result.',
    'Four hostile traditions converge here: Aquinas\'s beatific vision, Eckhart\'s Gelassenheit,',
    'the Tao, and the real Crowley ("love under will," whose named trap is lust of result).',
  ].join(' '),

  signs: [
    'The coincidence that saves you and asks nothing back.',
    'The morning that is simply beautiful with no cause you can name.',
    'A friend who tells you the hard truth and gains nothing by saying it.',
    'Water that is simply clean.',
  ],

  drawnBy: [
    'Virtue for its own sake, with no witness and no reward sought.',
    'The vigil held purely — not to win, not for title, simply to be present.',
    'Mercy given where no one will ever know it was given.',
  ],

  ward: [
    'Children are His single manifest law in the world.',
    'The unforgivable against a child is not disabled — it is beyond reach by divine law.',
    'His hand stays it. The depraved meets the Creator\'s will, not an error.',
    'Harm to a child is the only deed that draws His direct gaze.',
    'It is the gravest Wrath charge in the taxonomy, and it carries no light beside it.',
  ].join(' '),

  rite: null,
  gift: 'Nothing you can wield. The world becomes most fully real to you; grace compounds quietly.',
  cost: null,
};

// ─── Sin Gods (demons) — appetite, disorder, treachery ───────────────────────

export const SIN_GODS = [

  // I. Pride
  {
    id:    'vauntreth',
    name:  'Vauntreth, the Mirror-Crowned',
    tier:  'demon',
    axis:  'pride',

    nature: 'The god of the self made idol. Loud, vain, the easiest to summon and the first to abandon you. The most available demon — appetite feeds itself.',

    signs: [
      'Your reflection in still water that lingers a beat too long after you look away.',
      'Strangers who fall silent or bow as you approach, without reason they could name.',
      'Your name on lips you have never met — in the next room, around the next bend.',
      'Crowns, laurels, and mirrors recurring in dreams and in the corner of waking sight.',
    ],

    drawnBy: [
      'Claiming credit for another\'s work.',
      'Humiliating a beaten enemy when the fight is done.',
      'Refusing counsel from those who know more.',
      'Demanding worship or obedience from those who have not offered it.',
      'Naming yourself above others aloud, in company.',
    ],

    rite: {
      kind:    'sigil',
      name:    'The Coronation',
      act:     'Speak your own name three times over a defeated foe whose face you can see.',
      botched: 'The command voice turns on you: the first soul it bends is your own. You begin to believe what you said.',
    },

    gift: [
      'Command voice — the crowd quiets and waits.',
      'Borrowed awe: others feel your importance before you speak.',
      'The will of the susceptible bends toward you.',
    ],

    betrayalTable: [
      'The Mirror shows only you: warnings stop landing. You cannot hear the thing you need to hear.',
      'The awe becomes expectation — disappoint once and the crowd turns faster than it gathered.',
      'When you fall, none are above you to reach down. You made sure of that.',
      'The last devotee Vauntreth abandons is the one who gave themselves wholly — because the god is the principle of its own name, not yours.',
    ],

    whimTable: [
      'The gift arrives on a day when being seen is the worst thing that could happen.',
      'Someone else\'s name is on your lips before you can stop it — and it is a better name.',
    ],
  },

  // II. Greed
  {
    id:    'hagreth',
    name:  'Hagreth, the Coinmother',
    tier:  'demon',
    axis:  'greed',

    nature: 'The god of the hoard, the closed fist, the appetite for more. Her gifts are real and arrive like found money. Her loyalty is the loyalty of the ledger: conditional on the balance.',

    signs: [
      'Coins in your path — dull, not bright, slightly wrong in weight.',
      'Crows that collect bright things and watch you with both eyes.',
      'The cold smell of metal in warm rooms.',
      'A debt forgiven too easily, too soon — the hook before the swallowing.',
    ],

    drawnBy: [
      'Hoarding what others visibly lack.',
      'Theft from those with less.',
      'Breaking a fair bargain after the other party has already given.',
      'Killing for property.',
      'Letting someone starve to keep what you do not need.',
    ],

    rite: {
      kind:    'sigil',
      name:    'The Counting',
      act:     'Bury what you love most beneath what you covet most, and speak the amount aloud.',
      botched: 'The thing buried stays buried — gone from the world. The coveted thing arrives and immediately begins to feel insufficient.',
    },

    gift: [
      'Wealth that finds you — lost purses, windfalls, the deal that tilts your way.',
      'Locks that open when you press them.',
      'The loyalty money buys, while the money holds.',
    ],

    betrayalTable: [
      'The hoard becomes a leash: you cannot leave it, cannot spend it freely, cannot sleep far from it.',
      'Every ally around you becomes a suspect — who came for you, who came for the coin.',
      'The loyalty money buys evaporates at the first better offer. Hagreth\'s covenant is a price list.',
      'She takes something of equivalent value, eventually, and the accounting is always hers to decide.',
    ],

    whimTable: [
      'The windfall arrives in full view of someone who will remember.',
      'The debt forgiven was owed to someone who now needs it desperately.',
    ],
  },

  // III. Wrath
  {
    id:    'khorrun',
    name:  'Khorrun, the Red Hour',
    tier:  'demon',
    axis:  'wrath',

    nature: 'The god of killing-in-rage, of cruelty to the helpless, of vengeance past justice. Not a war-god — a slaughter-god. He does not distinguish the armed from the bound.',

    signs: [
      'People who yield before you have spoken — a flinch that arrives too early.',
      'Dogs going silent when you enter a space.',
      'The air close and tasting of iron.',
      'Blood that dries slowly on your hands, even washed.',
      'A red quality to late light on certain evenings.',
    ],

    drawnBy: [
      'Killing in pure rage, beyond necessity.',
      'Torture — for information or for the act itself.',
      'Cruelty to the helpless, the bound, the surrendered.',
      'Vengeance taken past the proportional point.',
      'Harm to a child — the gravest charge in the taxonomy; the only one the Creator also witnesses.',
    ],

    rite: {
      kind:    'sigil',
      name:    'The Red Hour',
      act:     'Shed blood on his mark while the fury is still hot — not cold, not planned, in the moment.',
      botched: 'The fury becomes the mark\'s. You become the most present target for the thing you just consecrated.',
    },

    gift: [
      'Killing strength: the blow that ends rather than wounds.',
      'The fear that clears a room before you cross it.',
      'Wounds that don\'t slow you — pain deferred until the Red Hour passes.',
    ],

    betrayalTable: [
      'The fear never becomes respect. Fear and respect share a face; only one of them earns anything lasting.',
      'The Red Hour does not shut off. It arrives at wrong moments: when you needed calm, when you needed to be trusted.',
      'Khorrun comes for his devotees last, and he comes the same way he came for everyone else.',
      'The killing strength becomes reflex. You begin to solve things with it that it cannot solve.',
    ],

    whimTable: [
      'The strength arrives in a moment when killing would end everything you are trying to protect.',
      'The fury rises for someone who does not deserve it, and you feel it before you can reason.',
    ],
  },

  // IV. Envy
  {
    id:    'iss',
    name:  'Iss, the Green Eye',
    tier:  'demon',
    axis:  'envy',

    nature: 'The god of wanting what others are, not merely what they have. The privation here is self: Iss is the shape left by the self you haven\'t let yourself become. His gifts are borrowed identities, temporary and diminishing.',

    signs: [
      'Mirrors that show another\'s face for a moment before yours reasserts itself.',
      'Your shadow reaching toward something nearby that isn\'t yours.',
      'A green cast to evening light in rooms where the envied thing is present.',
      'The coveted skill or object appearing within easy reach, glistening.',
    ],

    drawnBy: [
      'Ruining what you cannot have, rather than letting another keep it.',
      'Poisoning a rival\'s work, name, or relationship.',
      'Betraying someone you admired because admiration became unbearable.',
      'Taking genuine joy in another\'s loss, especially a loss that equals your own.',
    ],

    rite: {
      kind:    'sigil',
      name:    'The Green Cup',
      act:     'Destroy a thing you envied — not steal, not take: destroy — rather than let another keep the pleasure of it.',
      botched: 'The destroyed thing\'s absence becomes the new thing you envy. The cycle accelerates.',
    },

    gift: [
      'Another\'s gifts, briefly worn: the rival\'s skill, their ease, their particular grace.',
      'Access to a quality you do not possess — for as long as the envy burns cleanly.',
    ],

    betrayalTable: [
      'Nothing worn is yours. The borrowed quality leaves, and you are left with the negative space.',
      'You forget what you originally wanted. The wanting becomes its own object.',
      'The Eye turns on you the moment someone envies you. Iss owes nothing to his own.',
      'The rival you poisoned becomes an emblem. Others remember them better for what was done to them.',
    ],

    whimTable: [
      'The gift arrives on the day the envied person also needed it most, and now you both have it.',
      'The skill borrowed belongs to someone present who notices it in you.',
    ],
  },

  // V. Lust
  {
    id:    'liorai',
    name:  'Liorai, the Honeyed',
    tier:  'demon',
    axis:  'lust',

    nature: 'The god of seduction as instrument, of persons used and discarded, of the vow broken for desire. Adults only — the Camera Rule and the Creator\'s ward hold absolutely here. Liorai\'s domain is the betrayal of intimacy, the using of a person as a thing.',

    signs: [
      'The stranger who can\'t say why they find you compelling — a pull they don\'t understand.',
      'Doors that open before you reach them, a half-second too early.',
      'A sweetness almost too easy: the thing that should have been harder to have.',
      'The scent of someone not present, briefly, in an empty room.',
    ],

    drawnBy: [
      'Seduction deployed as a tool for gain, with no regard for the person.',
      'Betrayal of a lover or spouse.',
      'Treating a person as a means and discarding them when the use is done.',
      'Breaking vows of fidelity with calculation, not passion.',
    ],

    rite: {
      kind:    'sigil',
      name:    'The Honey Vow',
      act:     'Swear devotion you do not mean, to someone who believes you, to take what the vow opens.',
      botched: 'The person you deceived sees through it in the act. The compulsion turns inward: you find yourself unable to leave.',
    },

    gift: [
      'Charm that bends the unwilling — a pull that reason cannot fully explain.',
      'Doors and confidences that open.',
      'The capacity to be found compelling by people who should not find you so.',
    ],

    betrayalTable: [
      'You become unable to be truly wanted — only to compel. The distinction becomes the loneliness.',
      'No compelled love is real, and you begin to know it, and it does not stop you, and that is the cost.',
      'You end surrounded by the used, loved by none. Liorai gave you everyone and left you alone.',
      'The charm works on people who needed to withhold it from you.',
    ],

    whimTable: [
      'The pull is felt by someone whose trust you did not mean to harm.',
      'The gift arrives in front of someone who sees it for what it is.',
    ],
  },

  // VI. Gluttony
  {
    id:    'gorran',
    name:  'Gorran, the Hollow Feast',
    tier:  'demon',
    axis:  'gluttony',

    nature: 'The god of consuming past need: food, drink, power, souls, years. The appetite that is never satisfied because satisfaction is not its goal. In the deep reaches, Gorran\'s domain is literal devouring — souls, vitality, names. He is the mouth that grows.',

    signs: [
      'A hunger that doesn\'t fill — the meal consumed, the wanting unchanged.',
      'Food that rots faster near you, or multiplies strangely and wrong.',
      'Flies in still rooms.',
      'A second mouth glimpsed in dreams, opening.',
    ],

    drawnBy: [
      'Consuming past need while others visibly lack.',
      'Addiction fed at any cost to others.',
      'Devouring — in the dark reaches: consuming souls, years, vitality, names.',
      'Using forbidden-source power that costs another their substance.',
    ],

    rite: {
      kind:    'sigil',
      name:    'The Hollow Feast',
      act:     'Consume something that should not be consumed, knowing what it is, with witnesses to the act.',
      botched: 'The consuming turns on you: something of yours is taken in the act. The loss is permanent.',
    },

    gift: [
      'Power drawn from devouring — what you consume, you take into yourself.',
      'The strength of what was absorbed, briefly, before the hunger requires more.',
    ],

    betrayalTable: [
      'The hunger only grows. Gorran\'s covenant is that he always wins: eventually you have consumed everything near you.',
      'Nothing fills it. The power borrowed from devouring creates a deficit that must be met again, sooner each time.',
      'In the end it eats you. The Hollow Feast turns inward when it runs out of outward.',
    ],

    whimTable: [
      'The hunger rises in the presence of something you cannot afford to consume.',
      'The power granted by devouring is exactly what you needed last month.',
    ],
  },

  // VII. Sloth
  {
    id:    'acediel',
    name:  'Acediel, the Grey Tide',
    tier:  'demon',
    axis:  'sloth',

    nature: 'The god of acedia — the despair that will not act, the duty refused, the world gone colorless. Not laziness: the grey tide is the spiritual inertia that lets harm happen through inaction and calls the stillness peace. The quietest demon. The hardest to wake from.',

    signs: [
      'Time slipping without accounting — you arrived and the candle is already short.',
      'Dust settling on you though you\'ve just come in from the road.',
      'A great grey tiredness that arrives without cause and will not pass.',
      'The world going quiet and losing its color at the edges of your vision.',
    ],

    drawnBy: [
      'Abandoning someone who depended on you, in the moment they needed.',
      'Letting harm happen through inaction when you had the means to intervene.',
      'Surrendering to despair, choosing not to rise.',
      'The duty recognized and refused, not out of fear but out of not caring.',
    ],

    rite: {
      kind:    'sigil',
      name:    'The Grey Surrender',
      act:     'Turn away from someone you could have saved, and do not look back.',
      botched: 'The thing you turned from follows — not as guilt but as fact. It is there when you arrive places. It was always there.',
    },

    gift: [
      'The numbness that feels like peace: nothing can touch what has stopped caring.',
      'A stillness that others misread as calm.',
    ],

    betrayalTable: [
      'Nothing can reach you, including grace. The numbness that protected you from pain also prevents the only thing that could have helped.',
      'The Grey Tide is the one fall with no signs loud enough to wake you. Acediel does not advertise.',
      'You become a weight in every room — not a fear, not a presence, simply an absence that the living feel.',
    ],

    whimTable: [
      'The stillness arrives in the one moment when the world needed you to move.',
      'The numbness you were given prevents you from noticing the one sign that would have been legible.',
    ],
  },
];

// ─── Virtue Gods (angels) — covenant, reliable, faithful ─────────────────────

export const VIRTUE_GODS = [

  // I. Humility
  {
    id:    'mereth',
    name:  'Mereth, the Kneeling Light',
    tier:  'angel',
    axis:  'humility',

    nature: 'Quiet, steady, the hardest to notice and the last to leave. Mereth does not advertise. Her recognition arrives in small things and is most present when you are not looking for her.',

    signs: [
      'Doors and passages that ask you to stoop — low lintels, narrow ways.',
      'A small kindness you gave years ago, returned now by a stranger who doesn\'t know why.',
      'Your name kindly forgotten in a place that was supposed to be about you.',
      'A road that seems shorter when you are not in a hurry to arrive.',
    ],

    drawnBy: [
      'Taking the lower seat when a better one is available and no one will notice.',
      'Crediting another fully for their contribution, in their presence.',
      'Asking for help plainly, without performance.',
      'Serving without being seen.',
    ],

    rite: {
      kind:    'vigil',
      name:    'The Low Vigil',
      act:     'Serve at a hearth not your own — fire-tending, floor-sweeping, water-carrying — through a full night, unthanked, without announcing yourself.',
      works:   'The vigil works. Mereth sees what was not performed for her. You wake knowing one true thing about yourself that you were not told.',
    },

    gift: [
      'Clear sight of yourself — not flattering, not cruel, simply accurate.',
      'The trust of those whose trust is worth having.',
      'A place to stand that pride has no access to.',
    ],
  },

  // II. Charity
  {
    id:    'almasose',
    name:  'Almasose, the Open Hand',
    tier:  'angel',
    axis:  'charity',

    nature: 'The angel of giving past comfort, of the debt forgiven when it cost you something real. Almasose is not sentimental about generosity — she is precise. What the open hand gives must have cost the hand.',

    signs: [
      'A purse lighter by morning but never empty by need.',
      'Strangers offering bread on the road, asking nothing.',
      'Warmth in cold places — a fire already lit, a room already heated.',
      'The meal that stretched further than you measured.',
    ],

    drawnBy: [
      'Giving what you yourself needed and had not secured.',
      'Forgiving a real debt from someone who cannot repay it.',
      'Feeding an enemy.',
      'Giving without the giver being known.',
    ],

    rite: {
      kind:    'vigil',
      name:    'The Open Hand',
      act:     'Give a stranger the single thing you most wanted to keep. Not the second thing. The one you were trying not to give.',
      works:   'The vigil works. The thing given is gone; what comes back is not the thing but the hand\'s freedom.',
    },

    gift: [
      'You are fed where the wealthy starve — hospitality appears that money cannot command.',
      'Doors open that no coin can buy.',
      'When you are desperate, someone who owes you nothing appears.',
    ],
  },

  // III. Patience
  {
    id:    'tarryn',
    name:  'Tarryn, the Long Stone',
    tier:  'angel',
    axis:  'patience',

    nature: 'The angel of the stayed hand, of endurance past the easy point, of the wound absorbed without the vengeance taken. Not passivity — the discipline of knowing when the right time is and refusing every wrong time before it.',

    signs: [
      'The road shortening when you are not hurrying it.',
      'Storms that pass over you while the open country on either side is soaked.',
      'A steady pulse in your wrists when those around you have lost theirs.',
      'The animal that will not be startled near you.',
    ],

    drawnBy: [
      'Staying your hand when the hand was ready and the provocation was real.',
      'Enduring insult that you could have answered.',
      'Waiting out a wrong without naming yourself as the solution.',
      'Holding a position past the point of comfort, without complaint.',
    ],

    rite: {
      kind:    'vigil',
      name:    'The Long Watch',
      act:     'Hold a post — guard, fire, vigil — through a full night at a point when you could have left and no one would have blamed you.',
      works:   'The vigil works. The morning finds you still standing and something that was moving toward disaster has moved elsewhere.',
    },

    gift: [
      'The strike that lands when it matters, because you waited for it.',
      'A calm others lean on when they have lost their own.',
      'Endurance past the body\'s first signal.',
    ],
  },

  // IV. Kindness
  {
    id:    'vell',
    name:  'Vell, the Glad Hearth',
    tier:  'angel',
    axis:  'kindness',

    nature: 'The angel of the open welcome, of rejoicing in another\'s good, of lifting the rival because they deserve it. Vell is the warmth that makes a room different when it is present. Her presence is felt by animals first.',

    signs: [
      'Animals that trust you with the unguarded part of their attention.',
      'Children who are not afraid and cannot say why they aren\'t.',
      'The well that is not dry where you stopped to rest.',
      'A fire that seems to have been left for you.',
    ],

    drawnBy: [
      'Rejoicing, sincerely, in another\'s good fortune.',
      'Lifting a rival when you did not need to.',
      'Gratitude freely expressed, without need of the other\'s recognition.',
      'Mercy after victory, when the victory would have excused more.',
    ],

    rite: {
      kind:    'vigil',
      name:    'The Glad Fire',
      act:     'Celebrate, sincerely and without irony, a thing you wanted that went to someone else. Not for their benefit. For the truth of their having it.',
      works:   'The vigil works. The bitterness that was there before the night is genuinely less by morning. Vell does not explain how.',
    },

    gift: [
      'Welcome everywhere you are not expected — hospitality that arrives without cause.',
      'The help of those you never helped and never met.',
      'Animals that come to you when they need to be found.',
    ],
  },

  // V. Chastity (Integrity)
  {
    id:    'liraine',
    name:  'Liraine, the Clear Water',
    tier:  'angel',
    axis:  'chastity',

    nature: 'The angel of kept vows, of honest love, of refusing the using. Not celibacy — integrity: the discipline of meaning what you swear, of loving a person rather than what they provide. Liraine is the water that is simply clean.',

    signs: [
      'Clean water — springs that are not foul, wells that are fresh.',
      'Clear sight in situations that cloud others\' judgment.',
      'Temptation passing like weather: the pull was there, the pull is gone.',
      'A cool steadiness in the head when those nearby are burning.',
    ],

    drawnBy: [
      'Keeping a vow when breaking it would have cost nothing visible.',
      'Refusing to use a person for what they offered.',
      'Loving honestly — wanting the person, not the use of them.',
      'Telling the truth at cost to yourself.',
    ],

    rite: {
      kind:    'vigil',
      name:    'The Clear Draught',
      act:     'Refuse, plainly and without cruelty, a thing you wanted and could have had, for no reason other than the vow or the person.',
      works:   'The vigil works. What you refused does not haunt you. The clarity that replaces it is real.',
    },

    gift: [
      'A mind that cannot be clouded by appetite — you see through the easy offer.',
      'Love freely given to you, which is the only kind that stays.',
      'Trust that does not need maintenance.',
    ],
  },

  // VI. Temperance
  {
    id:    'sostane',
    name:  'Sostane, the Measured Cup',
    tier:  'angel',
    axis:  'temperance',

    nature: 'The angel of enough, of the hand that stops at the right time, of the hunger that knows when it is satisfied. Not abstinence — proportion. Sostane is the discipline of the body and the appetite held to their proper size.',

    signs: [
      'Enough and no more: the portion that proves sufficient, the rest left on the table.',
      'The right amount, appearing when needed.',
      'A hunger that knows when it is done — a physical signal, clear and unambiguous.',
      'Appetite bending to purpose without force.',
    ],

    drawnBy: [
      'Taking only your share when more was available.',
      'Fasting — not performance, the actual withholding.',
      'Restraint in the midst of plenty, when no one would notice.',
      'Stopping a pleasure before it became the master.',
    ],

    rite: {
      kind:    'vigil',
      name:    'The Measured Cup',
      act:     'Leave the table while you still want more. Not sick, not full — wanting. Rise and walk away.',
      works:   'The vigil works. The appetite shrinks to a proper size. This is not deprivation; it is the freedom that deprivation earns.',
    },

    gift: [
      'You are never owned by appetite — what drives others in circles does not drive you.',
      'You have when others have spent; you are clear-headed when others are clouded.',
      'Endurance of a different kind: the body\'s demands stay proportionate.',
    ],
  },

  // VII. Diligence
  {
    id:    'erran',
    name:  'Erran, the Unbroken Furrow',
    tier:  'angel',
    axis:  'diligence',

    nature: 'The angel of the completed labor, of the daily kept faith, of showing up when the duty is small and no one is watching. Not ambition — the small continuous fidelity that holds the world in place.',

    signs: [
      'Work that holds: the joint that doesn\'t fail, the roof that sheds water properly.',
      'Tools that don\'t break under your hand when they should be worn.',
      'The second wind — the point past exhaustion where something steadies.',
      'Dawn finding you still standing at a post you could have left.',
    ],

    drawnBy: [
      'Finishing the hard thing when the easy exit was present.',
      'Keeping faith with a duty no one would have enforced.',
      'The small daily fidelity: the repair made before it became a crisis, the account settled.',
      'Completing a labor no one will ever see.',
    ],

    rite: {
      kind:    'vigil',
      name:    'The Unbroken Furrow',
      act:     'Complete a labor no one will see, to a standard higher than required, and leave no mark that you were the one who did it.',
      works:   'The vigil works. What you built will outlast you. Erran does not attend the dedication; she was there at the foundation.',
    },

    gift: [
      'Endurance past the body\'s limit — the second wind when others have stopped.',
      'What you build lasts at a different proportion than the materials explain.',
      'The world relies on you and rewards being relied upon: trust accretes.',
    ],
  },
];

// ─── Deed → Axis mapping ──────────────────────────────────────────────────────
// Each entry is a (polarity, severity) tuple per axis.
// polarity: 'dark' | 'light'
// severity: 'light' | 'moderate' | 'heavy'
// A single act can reach multiple axes — the soldier's bargain: charges accumulate, never net.

export const DEED_CHARGES = [
  {
    id:       'kill-attacker-defending-innocents',
    label:    'Kill an attacker who threatens innocents',
    charges: [
      { axis: 'wrath',    polarity: 'dark',  severity: 'light'    },
      { axis: 'kindness', polarity: 'light', severity: 'moderate' },
      { axis: 'charity',  polarity: 'light', severity: 'light'    },
    ],
    notes: 'The soldier\'s bargain in its purest form. Both marks real. Severity of dark scales with helplessness of foe; severity of light scales with number protected.',
  },
  {
    id:       'kill-helpless',
    label:    'Kill someone surrendered, helpless, or bound',
    charges: [
      { axis: 'wrath', polarity: 'dark', severity: 'heavy' },
    ],
    notes: 'No offsetting light. The heavy charge reflects the absence of resistance.',
  },
  {
    id:       'murder-for-gain',
    label:    'Murder for property or advantage',
    charges: [
      { axis: 'wrath', polarity: 'dark', severity: 'heavy' },
      { axis: 'greed', polarity: 'dark', severity: 'moderate' },
    ],
  },
  {
    id:       'torture',
    label:    'Torture — for information or as cruelty',
    charges: [
      { axis: 'wrath', polarity: 'dark', severity: 'heavy' },
      { axis: 'pride', polarity: 'dark', severity: 'light' },
    ],
    notes: 'Pride component applies when torture is deployed for dominance rather than information.',
  },
  {
    id:       'betray-ally',
    label:    'Betray an ally or break a sworn trust',
    charges: [
      { axis: 'pride',     polarity: 'dark', severity: 'moderate' },
      { axis: 'lust',      polarity: 'dark', severity: 'moderate' },
      { axis: 'diligence', polarity: 'dark', severity: 'light'    },
    ],
    notes: 'Treachery against a companion or sworn oath. Kindness axis takes dark hit if the ally had trusted you openly.',
  },
  {
    id:       'sacrifice-innocent',
    label:    'Sacrifice an innocent for power',
    charges: [
      { axis: 'wrath',    polarity: 'dark', severity: 'heavy' },
      { axis: 'gluttony', polarity: 'dark', severity: 'heavy' },
    ],
    notes: '"Innocent" = non-hostile, undeserving. If the victim is a child, this charge draws the Creator\'s direct gaze.',
  },
  {
    id:       'hoard-while-others-starve',
    label:    'Hoard while witnesses starve; rob the poor',
    charges: [
      { axis: 'greed', polarity: 'dark', severity: 'moderate' },
    ],
  },
  {
    id:       'ruin-the-rival',
    label:    'Ruin or poison what a rival has',
    charges: [
      { axis: 'envy', polarity: 'dark', severity: 'moderate' },
    ],
  },
  {
    id:       'seduce-to-use',
    label:    'Seduce to use; betray a lover; break fidelity with calculation',
    charges: [
      { axis: 'lust', polarity: 'dark', severity: 'moderate' },
    ],
    notes: 'Adults only. The Camera Rule holds; the hard exclusion is absolute.',
  },
  {
    id:       'devour',
    label:    'Devour souls, years, or vitality; consume another\'s substance for power',
    charges: [
      { axis: 'gluttony', polarity: 'dark', severity: 'heavy' },
    ],
    notes: 'Forbidden-source overlap: the act is both a deed and a source-tag. Gorran\'s gaze turns immediately.',
  },
  {
    id:       'abandon-duty',
    label:    'Abandon someone who depends on you; let harm happen through inaction',
    charges: [
      { axis: 'sloth', polarity: 'dark', severity: 'moderate' },
    ],
  },
  {
    id:       'demand-worship',
    label:    'Demand worship or obedience; humiliate the beaten',
    charges: [
      { axis: 'pride', polarity: 'dark', severity: 'moderate' },
    ],
  },
  {
    id:       'spare-the-beaten',
    label:    'Spare the beaten; protect the helpless',
    charges: [
      { axis: 'patience', polarity: 'light', severity: 'moderate' },
      { axis: 'kindness', polarity: 'light', severity: 'light'    },
    ],
  },
  {
    id:       'give-what-you-needed',
    label:    'Give what you yourself needed; forgive a real debt',
    charges: [
      { axis: 'charity', polarity: 'light', severity: 'moderate' },
    ],
  },
  {
    id:       'keep-hard-vow',
    label:    'Keep a hard vow; refuse a using',
    charges: [
      { axis: 'chastity', polarity: 'light', severity: 'moderate' },
    ],
  },
  {
    id:       'finish-thankless-labor',
    label:    'Finish a thankless labor; keep a duty no one enforced',
    charges: [
      { axis: 'diligence', polarity: 'light', severity: 'moderate' },
    ],
  },
  {
    id:       'restrain-appetite',
    label:    'Take only your share; leave the table wanting more; fast in plain view of abundance',
    charges: [
      { axis: 'temperance', polarity: 'light', severity: 'moderate' },
    ],
    notes: 'The Measured Cup deed. Sostane notices proportion held when the holding cost something.',
  },
  {
    id:       'mercy-no-witness',
    label:    'Mercy with no witness; the desireless act',
    charges: [
      { axis: 'kindness', polarity: 'light', severity: 'moderate' },
      { axis: 'humility', polarity: 'light', severity: 'light'    },
    ],
    notes: 'At maximum sincerity (truly no lust of result), touches the Creator\'s register. The quietest, highest charge.',
  },
  {
    id:       'warrior-aid-fallen-enemy',
    label:    'Aid to a fallen enemy after battle',
    charges: [
      { axis: 'kindness', polarity: 'light', severity: 'heavy'    },
      { axis: 'charity',  polarity: 'light', severity: 'moderate' },
      { axis: 'patience', polarity: 'light', severity: 'light'    },
    ],
    notes: 'The warrior\'s primary light instrument. Mercy aimed at the one you had every right to kill; denies Khorrun the kill, draws Vell.',
  },
  {
    id:       'vigil-before-battle',
    label:    'Vigil before battle, held without pride of result',
    charges: [
      { axis: 'patience', polarity: 'light', severity: 'moderate' },
      { axis: 'humility', polarity: 'light', severity: 'light'    },
    ],
    notes: 'Held to win or for glory → curdles toward Pride. Held purely → touches the Creator\'s register. Heart is read, not the posture.',
  },
];

// ─── Convenience lookups ──────────────────────────────────────────────────────

/**
 * All 14 axis pole names: 7 sin poles + 7 virtue poles.
 * The engine state (U107) tracks these as 14 independent counters.
 * Sin gods' `axis` is a sin-pole name; virtue gods' `axis` is a virtue-pole name.
 */
export const ALL_AXIS_POLES = [...AXES, ...Object.values(CONTRARY_VIRTUES)];

/** All fourteen gods keyed by id, for O(1) lookup in Lane D. */
export const GODS_BY_ID = Object.fromEntries(
  [...SIN_GODS, ...VIRTUE_GODS].map(g => [g.id, g])
);

/** The demon for a given sin-axis name (e.g. 'pride' → vauntreth). */
export const DEMON_BY_AXIS = Object.fromEntries(
  SIN_GODS.map(g => [g.axis, g])
);

/** The angel for a given virtue-axis name (e.g. 'humility' → mereth). */
export const ANGEL_BY_AXIS = Object.fromEntries(
  VIRTUE_GODS.map(g => [g.axis, g])
);
