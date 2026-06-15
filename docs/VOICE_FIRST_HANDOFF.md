# Voice-First Handoff — the conversation so far, and what's next

> Paste-ready prompt for a fresh session. Everything below was DISCUSSED and
> DECIDED with Tim on 2026-06-12. No voice code exists yet. Do not start
> implementing until Tim hands over recordings or explicitly opens a packet.

---

## PROMPT

You are picking up a planning thread on the Immortal Engine
(`~/Projects/immortal-engine`). Read `CLAUDE.md`, `docs/THE_DM_TEST.md`,
`docs/PLAYTEST_PROTOCOL.md`, and `docs/ROADMAP.md` first — they govern
everything. The roadmap's stated endpoint is **voice-first, DM-adjudicated
tabletop**. This handoff captures the voice-layer vision Tim and the previous
session converged on, the decisions already locked, and the immediate next
step.

### The vision (rearticulated, as agreed)

The game becomes a spoken conversation with a DM — ultimately as a native
iPhone experience. One narrator voice performs EVERYTHING: narration in their
anchor voice, NPCs as that same performer doing "bits" (the silly girl, the
gruff dwarf), exactly like a human DM at a table. NOT a cast of unique
synthetic NPC voices — that idea was considered and rejected in favor of
one-performer-doing-bits, which passes the DM Test better, costs less, and is
truer to the table. Players speak their intents; table-talk questions ("how
hurt am I?", "what does fire bolt do?") are free actions answered in-fiction
and in-voice (the engine already has `isMetaQuestion`/`handleMetaQuestion` in
`engine/grace/gracefulAdjudication.js` and a combat table-talk gate).

### Decisions already LOCKED (do not relitigate)

1. **No ElevenLabs. No cloud voice platforms. Ever.** Tim is a union voice
   actor (SAG-AFTRA implications) and will not let any third party hold
   rights or custody of voice models. All voice tech must be open-weights,
   run locally, and produce artifacts Tim owns outright (recordings +
   trained weights as files). "Pay once, own the masters."
2. **The unit is the "narrator kit":** one performer's anchor voice + a
   roster of performed bits (each bit captured as its OWN reference
   recording — clone the performance, not the person). Multiple narrator
   kits will exist; Tim's actor friends get right of first refusal on
   narrator slots, properly papered (consent, license, exclusivity and
   revocation clauses settled up front; union interactive agreements when
   commercial).
3. **Engine-side, voice is presentation, never canon.** worldHash never sees
   it. The deterministic artifact is a per-NPC **acting note** (a one-line
   stage direction minted at NPC genesis — e.g. "reedy, suspicious,
   smoker's rasp"); whichever narrator kit is active resolves the note to
   its nearest bit. Same NPC, same note, every replay, any narrator.
4. **Fallback ladder discipline** (mirrors the LLM narration layer): owned
   local neural voice → Web Speech API with seeded pitch/rate → text only.
   The game never blocks on audio.
5. **iPhone end-state is a native shell** (or thin native wrapper), not a
   PWA: needed for reliable on-device speech recognition, barge-in
   (player interrupts → TTS stops, like a polite DM), audio session
   control, and contextual vocabulary biasing — feed the recognizer the
   scene's minted proper nouns (NPC/place names) so it hears
   procedurally generated names correctly. Confirmation reflex required
   for destructive intents ("…you're ATTACKING him?") because
   "attack/ask the innkeeper" mishears are one-way doors.

### Known hard problems (design work, none fatal)

- **Switching latency**: the narrator→bit→narrator snap must be seamless or
  the bit dies. Test this FIRST, before voice quality.
- **Conversational latency budget**: speech-in → intent → resolution →
  first spoken syllable ≈ 1.5s. Deterministic resolution is instant;
  recognition + TTS startup eat the budget → stream TTS
  sentence-by-sentence (affects how the composer emits text).
- **Speaker attribution**: the composer must tag which prose spans are
  spoken by whom (the real engineering lift; valuable even for text play).

### The immediate next step (the only active task)

**The bit-survival test.** Tim will self-record two takes (same room, same
mic, quiet, lossless-ish): (1) 3–5 min as NARRATOR reading real game prose;
(2) 3–5 min fully IN one strong character bit (big pitch/rhythm signature),
varied sentence types. When the files arrive:

- Build a LOCAL zero-shot cloning pipeline (F5-TTS or Chatterbox class —
  open weights, runs on his Mac, nothing leaves the machine).
- Generate a stitched exchange: narrator line → character line → narrator
  line, using each take as its own reference.
- Judge (Tim's ears): does it sound like him; does the BIT survive cloning
  (the open question — timbre clones reliably, performance only partially);
  how bad is the narrator↔bit seam; what's generation latency on his
  hardware.
- This is STANDALONE — no engine changes, no packet, scripts + audio out.
  If the bit survives → spec the voiceSpec/acting-note + speaker-tagging
  packets. If not → Route 2 fallback is instruction-driven TTS (one voice +
  per-line stage directions; an OpenAI client already exists in
  `server/ai.js`, ~$0.70/session for prototyping under the $20 budget rule).

### Cost truths already established (for reference, not revisiting)

Local/owned: $0 per session forever; one-time training of polished voices is
tens of dollars DIY (rented GPU) or hundreds–low-thousands per voice if a
contractor delivers trained weights (that's the legitimate "pay once, own
it" — hire the work, not the platform). Cloud platforms are rent: ~$0.70
(OpenAI) to $4–10 (ElevenLabs) per voiced session, voices held hostage to
the subscription — rejected.

### Standing constraints

- Determinism is the floor; acting notes are seeded; audio is never hashed.
- Silent fallback everywhere; voice failure must never break a turn.
- $20 dev API budget — keep any cloud experiments gated and cheap.
- PLAYTEST_PROTOCOL applies to any future in-game surfacing: live v1.html
  (or the future shell) verification with screenshots before handoff.
- Two combat engines / two play surfaces traps: see memory notes
  `two-combat-engines` and `live-verify-save-seeding`.

First action for the new session: confirm with Tim whether the recordings
exist yet. If yes → build the local test pipeline. If no → answer questions,
refine the recording spec, do NOT build ahead of the test.

---

## Addendum 2026-06-12 — concrete task lists (agreed with Tim)

**Recording setup (Tim, DIY):** Zoom H4N, closet booth, dead silent. WAV
48kHz/24-bit PCM (never MP3), X/Y mics on stand, ~8in off-axis, peaks
-12..-6dB. Deliverables in `voices/` (gitignore this dir): per-voice mono
24-bit WAV masters + a best-30s continuous reference clip each, plus 30s
roomtone. Narrator: 5 min test tier reading REAL game prose + 30-60 min
archive tier for future fine-tune. Bits: one file per character, 3-5 min,
fully in character (greeting/question/exclamation/mutter/ramble/laugh).
Audacity: mix to mono, cut flubs, normalize -3dB peak, NO noise
reduction/EQ/compression. Masters backed up off-machine — the recordings
are the owned asset.

**Coding sequence (gated, in order):**
1. gitignore voices/ + local zero-shot pipeline (F5-TTS/Chatterbox class,
   Apple Silicon), standalone scripts only.
2. Bit-survival test: stitched narrator→bit→narrator exchange from real
   game prose + per-sentence latency numbers. TIM'S EARS ARE THE GATE.
3. Local voice server: Express endpoint {text, voiceRef} → streamed audio,
   model pre-warmed.
4. tts.js fallback ladder: local cloned voice → Web Speech robot → text
   (converse mode already exists: tts.onIdle loop, commit 64db279).
5. Speaker attribution in composer (engine packet; the real lift).
6. Acting notes minted at NPC genesis (deterministic, seeded).
7. Acting note → bit mapping per narrator kit; pinned bits for villain +
   companions.
8. Rhythm polish: sentence-streaming TTS, narrator↔bit seam, latency.
9. Later/optional: fine-tuned narrator model from archive tier; native
   iPhone shell (barge-in, scene-vocabulary hints).

---

## The cast list — narrator kit v1 (Tim), recording roster

One mic (the boom into XLR-1 won the A/B — use it for ALL of these), one
room, WAV 48kHz/24-bit. Per bit: 3-5 min fully in character, covering a
greeting, a question, an exclamation, something muttered, a longer ramble,
and a laugh if the character has one. File names as shown.

### Tier 0 — the gate (record first, this alone unlocks the test)
| # | Voice | Direction | Covers | File |
|---|-------|-----------|--------|------|
| 0 | **The Narrator** | Your natural DM-at-the-table voice. Conversational, unhurried, a storyteller not an announcer. | All narration, any NPC without a bit | `narrator` |
| 1 | **The Silly Girl** | Bright, quick, young, delighted by everything, rushes her words. BIG pitch signature — this is the bit-survival test. | Children, excitable apprentices, giddy servants | `bit_sillygirl` |

### Tier 1 — the working six (covers ~90% of NPC genesis output)
| # | Voice | Direction | Covers | File |
|---|-------|-----------|--------|------|
| 2 | **The Gruff Elder** | Old, slow, gravel; weighs every word like it costs him. | Elders, old farmers, veterans, retired soldiers | `bit_gruffelder` |
| 3 | **The Warm Innkeep** | Hearty, loud-ish, welcoming; laughs easy, talks with his hands. | Innkeepers, friendly traders, ferrymen in a good mood | `bit_warminnkeep` |
| 4 | **The Suspicious One** | Reedy, guarded, low; trails off, doesn't finish sentences, checks over his shoulder. | Scavengers, watchmen, paranoid laborers, witnesses who wish they hadn't seen it | `bit_suspicious` |
| 5 | **The Oily Merchant** | Smooth, ingratiating, every sentence is halfway to a deal. | Shopkeepers, debt-keepers, fences, guild types | `bit_oilymerchant` |
| 6 | **The Old Woman** | Cracked, knowing, amused by you; says the true thing sideways. | Healers, widows, hedge-witches, grandmothers | `bit_oldwoman` |
| 7 | **The Cold One** | Flat, clipped, quiet menace; never raises the voice, never hurries. | Enforcers, cultists, hostile lieutenants, KHORRUN-adjacent humans | `bit_coldone` |

### Tier 2 — the campaign voices (record when the test passes)
| # | Voice | Direction | Covers | File |
|---|-------|-----------|--------|------|
| 8 | **The Villain** | Patient, intimate, almost kind; the most dangerous thing in the room and in no hurry about it. Distinct from The Cold One: warmer, worse. | THE adversary (villain.js mints one per seed), recruitment overtures, dark-gift moments | `bit_villain` |
| 9 | **The Companion** | Steady, direct, dry warmth; the friend who tells you the truth. | Companions (interjections/objections get a LOT of airtime — P-78 lines), trusted allies | `bit_companion` |
| 10 | **The Scholar** | Precise, fussy, slightly breathless; in love with his own footnotes. | Scholars, scribes, historians (Aldous Vane types), sages who identify items | `bit_scholar` |
| 11 | **The Big Simple One** | Deep, slow, kind; short sentences, means all of them. | Laborers, smiths, gentle giants | `bit_bigsimple` |
| 12 | **The Haughty Noble** | Crisp, bored, superior; Shakespeare-flavored (crownlands seeds). | Lords, stewards, magistrates, anyone with a seal ring | `bit_noble` |
| 13 | **The Creature** | Non-human: rasp, growl, wrongness — whatever your throat survives. Use sparingly in the session; it shreds vocal cords. Record LAST. | Talking monsters, oni, sphinxes, the thing at the bottom of the well | `bit_creature` |

Recording order within a session: narrator first (warm), bits young→old→
rough, The Creature dead last. Mark room tone once. Masters + 30s refs per
voice into `voices/masters/` and `voices/refs/` as specced above.

Mapping note for the coding side: acting notes minted at NPC genesis resolve
to the nearest bit by (age, warmth, status, menace) axes; NPCs with no good
match fall back to the narrator's anchor voice — which is correct table
behavior (not every NPC gets a funny voice from a real DM either).

---

## Recording copy — narrator kit v1

Slate each file: say the file name and "take one" at the top (gets cut).
Flub a line → pause two seconds, say it again, keep rolling. Stay IN the
bit for the whole file, including the slate if you like. Every bit script
covers the checklist: greeting / question / exclamation / mutter / ramble /
laugh.

### 0 — `narrator` (read at your natural table pace; ~5 min)

You wake in your own bed, your own life. It will not stay ordinary.

The morning comes up gray over Trader's Camp, woodsmoke and wet rope, and the
road out front already has one set of tracks in it that nobody will claim.
You know this place the way you know your own hands. Which is why the small
wrongnesses land like dropped plates: the well bucket left up. The dog that
won't cross the square. The way old Hadric looks at the tree line now,
instead of at you, when he says good morning.

The blade goes through where the wing roots meet the shoulder, and the thing
comes apart with a sound like wet canvas tearing. You're left standing in
the sudden quiet, breathing hard, holding a sword that's heavier than it was
a minute ago. The dark between the trees does not applaud. It takes notes.

There's a question you should be asking, and it isn't "what was that." It's
"what was it running from."

You travel through the morning and into the afternoon, the county unrolling
in hedgerow and stone wall and fields gone slightly to seed. Twice you pass
shrines with fresh offerings and no people. At the ford, the water is low
and honest and crossing it costs you nothing but wet boots, which, in this
county, in this season, feels like being let off easy. By dusk the lights of
Hollow Chapel show through the trees — fewer of them than there should be.

They say the land out past the Sunken Road has stopped keeping its seasons.
They say someone is paying desperate folk in old coin for errands no one
will describe. They say a lot of things in this county lately, and the
trouble with the things they say is how many of them are turning out to be
true.

Roll me a check. No — wait. Tell me what you're actually doing first, and
then we'll see if the dice care.

The door is oak, iron-banded, and it has not been opened in a long time.
Cold air moves under it like something breathing on your ankles. You can
force it, you can knock, you can walk away — and I want to be honest with
you: one of those three is the smart one, and you already know it's not the
one you're about to pick.

Night again. The fire down to coals. Your companion takes the first watch
without being asked, and the last thing you hear before sleep is the wind
working at the shutters of a farmhouse where, you'd swear, no lamp was lit
when you passed it at dusk.

Previously: you'd learned the name under the county's sickness. Someone was
sent to make sure you couldn't repeat it. That didn't go the way they
planned. The road to Deepvein Camp is open, the weather is turning, and
somewhere ahead of you, something patient has stopped being patient.

What do you do?

### 1 — `bit_sillygirl` (bright, quick, rushes her words; BIG energy)

Hi! Hi hi hi — are you the one? You ARE the one, oh my gosh, everyone said
there was a stranger and I said I bet I find them first and I FOUND you
first!

Did you really fight a thing in the woods? What was it like? Was it all
teeth? Berrin says it was all teeth but Berrin lies about literally
everything, one time he said he touched a star and it was an onion. An
ONION!

Wait wait wait — say the thing again. The thing you said! Say it slower!

(muttering, conspiratorial) ...okay but don't tell my gran I'm out here,
because she says the road's not safe, and she's probably right, she's right
about basically everything, it's so annoying...

You know what I think? I think the well went cold because something's living
down there, and I think it's lonely, because everything down a well would be
lonely, and Gran says I'm not allowed to lower the bucket anymore just to
say hello to it, which is RUDE, because what if it waits for me? What if I'm
the only one who's nice to it and now nobody is?

(big laugh) Hahaha! You made a face! You made SUCH a face just now!

Okay okay okay — I have to go, but if you find any monsters, normal-sized
ones, not big ones — come get me FIRST. Promise? You have to actually say
it. Out loud. That's the rule.

### 2 — `bit_gruffelder` (old gravel; every word costs him something)

Hm. Stranger. Well enough — sit, if you're sitting.

You want to know about the road, I expect. Everyone wants to know about the
road. Nobody wants to know about the field next to it, and the field's where
the trouble's standing.

What did you say your business was? No — say it again, slower. My ears keep
what they want these days.

(muttering) ...forty years I've watched that tree line. Forty years it
stayed where trees ought to stay...

I'll tell you what I told the boy they sent before you. The county doesn't
get sick all at once. It gets sick the way a man does — a little tired, a
little careless, a few small debts he means to settle and doesn't. And then
one morning he can't get up out of the chair. We are all still getting up
out of the chair, stranger. For now.

Ha. Hah! No — I'll laugh if I please, it's the one thing left that's free.

You'll want to be gone before full dark. That's not a threat, boy. It's a
kindness. There's a difference, and the day you can't tell it anymore, you
stay indoors.

### 3 — `bit_warminnkeep` (hearty, hands moving, laughs easy)

HA! Look what the road dragged in! Come in, come in — mind the step, it
bites strangers.

Sit anywhere that isn't the hearth-chair, that's Marta's, she will end you
and I will help her hide your boots.

What'll it be then? And before you say "just water" — friend, look me in
the eye and tell me you've eaten today. That's what I thought. Stew's
coming, your protest is noted and overruled.

(big laugh) Hahaha! "Just passing through!" Oh, that's good. That's GOOD.
Nobody passes through, friend. The county's sticky. Ask anybody — ask me!
Came here twenty years ago to fix one roof.

(lower, leaning in) ...now between you and me and the cat — there's been
talk. Fellows with coin older than my grandmother, paying for errands
nobody'll name. You hear the same talk in your travels, you come tell ME
first, eh? I pour faster for people with news.

Anyway! Eat. The bread's yesterday's but the butter's brave, and the bed
upstairs is honest even if the mirror flatters. You need anything in the
night, knock twice. Once is the wind. We ignore the wind in this house, it
encourages it.

### 4 — `bit_suspicious` (reedy, guarded, trails off; checks behind himself)

...You talking to me? Fine. Keep your voice down about it.

I don't know you. That's not — look, it's nothing personal, I don't know
anybody anymore, that's the whole... that's where we are now.

Who sent you? Quick now. Wrong answer and I'm gone.

(mutters) ...knew it. Knew it the minute the dog wouldn't cross the
square...

You want to know what I saw. Course you do. Everyone wants to know what I —
fine. FINE. But not here. You see the way the chapel light sits crooked on
the water? When it... no. No, forget the light. Forget I said about the
light.

Hh. Heh. Funny. You're the first one to ask me a question in a month that
wasn't "you all right, Wick?" I'm not all right. Asking after a man's health
when the WELLS have gone wrong — that's, that's rearranging chairs, is what
that is...

Travelers go missing a day at a time. You heard that? A day at a time. And
they come back wrong by one small habit. One. Small. Habit. Liss used to
whistle going up the lane. Now she don't. You live next to someone twenty
years, you notice the whistle, you... ...I have to go. Don't follow me. Don't
NOT follow me neither — just — leave room for doubt, yeah?

### 5 — `bit_oilymerchant` (smooth; every sentence is halfway to a deal)

Welcome, welcome — and may I say, you have the look of someone with
excellent taste and recent hardships. My favorite kind of customer.

Browse. Please. Touching is free; everything after that, we'll discuss.

Now what is it you're after? Protection? Provisions? Information? I stock
all three. The first two are on shelves.

Oh! Oh, now THIS — you've found it already, you clever thing — this came to
me from an estate sale of unusual finality. Listen to the hum on it. That's
not damage, friend, that's PROVENANCE.

(quietly, almost to himself) ...everything in this county's for sale lately,
that's the part nobody says out loud...

You strike me as someone who hears things on the road. So here is my
standing offer, and I extend it to very few: names, movements, anything with
old coin attached — I pay in better goods than gold. Gold spends once.
A favor from me compounds.

Ha-ha! No no, the price is the price — but for YOU, because you make the
shop look dangerous and that's good for business: call it a neighborly
discount, and call it nothing else, because if word gets out I have a heart,
I'm ruined.

### 6 — `bit_oldwoman` (cracked, knowing, amused by you)

Well now. Look at you. Come in off the step before the cold makes a liar of
that brave face.

Sit. The kettle's already on — no, don't be impressed, it's always on. At my
age you learn the difference between expecting trouble and being ready for
company. They take the same kettle.

What's your name, child? Mm. And your real one?

(soft cackle) Heh heh. There it is. There's the face your mother warned
people about.

(muttering, working at something) ...feverfew, willow bark, and don't mind
the smell, the smell is the medicine telling the truth...

I'll say this once, so put down the cup and hear it. The thing you're
chasing — and you ARE chasing, don't insult us both — it's old, and it's
patient, and it has learned the county's habits the way I've learned my
garden's. You can still root it out. But you go at it like a creature, all
blade and noise, and it will spend you like a coin. Go at it like a weed.
Find where it FEEDS.

Ohh, don't look so grim! I've buried two husbands and one god, child. The
trick to all three is the same: you say the true thing at the graveside and
you keep the garden anyway. More tea?

### 7 — `bit_coldone` (flat, clipped, quiet menace; never hurries)

Stop there. That's close enough.

State your business. Once. I don't repeat questions.

You're the one from Trader's Camp. We know about you. That's not a threat —
threats are for people who might not follow through. Consider it
bookkeeping.

(low, flat) ...he said you'd come by the ford road. He's not often wrong...

Here is how the next minute goes. You turn around. You walk back the way you
came. You develop a poor memory and a sudden love of staying home. In
exchange, the people you've talked to this week keep all the habits they
currently have. The whistling. The morning walks. All of it.

Hm. That's the closest I come to laughing, if you're wondering.

You think the county's sick. The county's being ORGANIZED. There's a
difference, and the difference is payroll. You can be on it, you can be off
it, or you can be a line item under cleanup. The pay's in old coin. It
spends fine. Choose.

### 8 — `bit_villain` (patient, intimate, almost kind; the most dangerous
thing in the room and in no hurry about it)

So. You're the one who's been pulling at my threads. Come in. The cold out
there is rude and I am not.

Do you know what I admire about you? Genuinely — sit, this isn't a trap,
traps are for animals — what I admire is your APPETITE. The county is a
heavy thing to care about, and you carry it like it's yours. That's not
mockery. I had an appetite like that once.

What did they tell you about me, in the villages? The missing days? The old
coin? (soft, genuinely amused) Hm. Hm hm hm. The coin isn't old, by the way.
The coin is RIGHT. Everything else has drifted.

(murmured, almost tender) ...you've been hurt in my service twice now and
neither of us was paid for it...

Here is the truth nobody downstream of me is brave enough to say: I am not
growing. I am TIDYING. Every loose thread in this county — the feuds, the
debts, the wells nobody maintains, the gods nobody feeds — every one of them
ends in me, trimmed, settled, accounted. You call it a sickness because you
arrived late. The fever isn't the disease, little thread. The fever is the
mending.

You could hold a corner of this. I don't offer twice, and I have never once
lied to you. Check. Go on — check. Everyone who told you about me lied at
least once. I haven't. Isn't that worth a longer conversation?

No? ...Hm. Then thank you for coming all this way. Truly. It's a long road,
and you walked it just to die polite.

### 9 — `bit_companion` (steady, dry warmth; the friend who tells you the truth)

Morning. You snore, by the way. Like a cart losing a wheel. Thought you
should know before it gets us killed.

So what's the plan today? And before you answer — is it a plan, or is it a
direction with confidence?

Ha! Fine. Fine. Direction with confidence it is. It's worked so far, I'll
give you that.

(quietly, by the fire) ...I keep thinking about the ferryman's face. He
wasn't lying. That's what's eating me — he believed every word...

Look — I'll follow you through most doors. I have. You've earned that, and
I don't say it cheap. But what happened in the square back there — no, don't
do the shrug, listen — that's twice now I've watched you reach for the
expensive answer when the cheap one was standing right there. I'm not your
conscience. I'm just the one who has to carry you out when the bill comes.

...All right. Enough. Hand me the whetstone and tell me about this chapel,
and if you say "it's probably fine" I'm turning around. That's the joke.
I'm not turning around. You know I'm not turning around.

### 10 — `bit_scholar` (precise, fussy, slightly breathless; loves his own footnotes)

Ah! A visitor! Mind the folios — MIND the folios — yes, just, perch
anywhere that isn't paper. So. Hardly anyone. Comes up here.

You've brought me something? Or a question. Oh, I do hope it's a question,
questions don't need dusting.

Now this is — wait. Wait wait wait. WHERE did you find this? No — don't
touch the rim — the residue is DIAGNOSTIC.

(muttering, flipping pages) ...third dynasty, no, the seal's wrong, FOURTH,
which would mean — oh. Oh dear. Oh that's much worse...

You must understand, the texts disagree — well, the texts always disagree,
that's practically what texts are FOR — but on this one point, Vane's
county history and the chapel annals and even the silly verse the children
skip rope to, all three converge, and convergence, my friend, convergence
is the historian's smoke alarm: "when the seasons stop keeping and the coin
comes home, the patient hand has cleared its throat." Skip-rope verse! In
evidence! Ha! Hahaha — forgive me, it isn't funny, it's TERRIFYING, I laugh
when I'm terrified, ask anyone.

Take notes. No, properly — take notes, because I shall only be brilliant
about this once, and then I shall need to lie down.

### 11 — `bit_bigsimple` (deep, slow, kind; short sentences, means all of them)

Oh. Hullo. Didn't hear you. I was thinking.

You want the smith? I'm the smith. Well. I'm the hammer. Da was the smith.
I keep his fire going.

What you got there, then? Can I hold it? ...Heavy. Good heavy. Somebody
loved making this.

(quiet) ...fire's talking funny tonight. Green at the edges. Da would've
known what that means...

People come through, they ask me things like I don't notice things. I
notice things. I just don't say them fast. The wagons go out heavy and come
back light, and nobody sells anything. The miller's boy has new boots and
old eyes. And the man who pays with the funny coin — he never looks at the
fire. Everybody looks at the fire. It's a FIRE. He looks at the door.

Heh. Heh heh. You talk to me like I'm a person. That's nice. Lot of folks
talk to me like I'm a wall with a name. Walls notice things too, though.
That's the part they forget.

You be careful out there. And — here. Take the nails. No charge. Things
fall apart out there, and you seem like somebody trying to hold things
together. Walls notice that too.

### 12 — `bit_noble` (crisp, bored, superior; every word slightly down its nose)

Yes? ...Ah. The errant blade. You may approach. Do wipe something first —
anything, really, you're wearing most of the county.

I shall be brief, as brevity is the single luxury this posting affords me.
You've been ASKING QUESTIONS. In my district. Charming. Do you know what
questions cost, hereabouts? No — that wasn't rhetorical — I genuinely wonder
if you know. Everyone else has learned.

Hah. "Justice." How quaint. You say it the way the priests say "harvest" —
loudly, and in hope.

(murmured, examining his rings) ...my grandfather hanged men for less, and
his district SANG, gods how I tire of this century...

Understand my position. I do not care for the creature in the hills, the
coin, the wells, or, with respect, for you. I care that the rents arrive
and the roads stay passable. At present, something is disturbing both. If
your blundering should happen to remove that disturbance, I am prepared to
have noticed nothing, signed nothing, and — in the fullness of time — paid
something. That is the entire shape of our friendship. Do not embroider it.

You're still here. How remarkable. The door is the large wooden thing in
the wall, since you appear to favor plain speech.

### 13 — `bit_creature` (non-human: rasp, growl, wrongness — RECORD LAST,
it shreds the voice; whatever your throat survives)

Sssso. Warm thing. It walks into the dark on purpose. The dark is
flattered.

Closer. CLOSER. ...There. Now the little light cannot lie for you.

Why does it come? Hm? Sssay it. The teeth want to hear the shape of it.

(low, wet, to itself) ...hungry hungry hungry, quiet now, it SPOKE to us,
the polite ones taste of regret...

We remember when the stones of this county were stacked, warm thing. We
remember the river before they named it and after they shamed it. The
patient one upstairs, with his coins and his tidiness — hhh — he thinks the
dark works FOR him. The dark works for no one. The dark merely... agrees,
for a while. As it is agreeing with him. As it might agree... with you.

HHHAHH. Hah. It bargains! The soft thing bargains! Oh, we LIKE it, we like
it the way the pot likes the rabbit—

Go, then. Up, out, into the lying little light. But leave the door open
behind you, just a crack. Doors held open are how we love.
