# Historical Figure NPCs

NPCs can be wired to a real-person corpus so their dialogue is grounded in actual primary sources. The RAG system retrieves the 4 most relevant chunks based on what the player just said and injects them into the voice prompt. The engine's decision (share/deflect/lie) is unchanged — RAG only shapes the *words*.

---

## How to wire a figure

Add one field to the NPC object:

```js
{
  id: 'npc_lincoln',
  name: 'Abraham Lincoln',
  role: 'warlock-hunter',          // their role in the game world
  historicalFigure: 'lincoln',     // must match a filename in server/rag/corpus/
  personality: {
    trustOfOutsiders: 0.6,
    selfPreservation: 0.4,
    honesty: 0.9
  }
  // all other NPC fields unchanged
}
```

The `historicalFigure` value is the corpus filename without `.json`. If no file exists for a given value, the system silently falls back to the standard voice prompt — no errors.

---

## Available figures (19 total)

| `historicalFigure` value | Name | Voice character | Suggested game role | Best primary sources |
|--------------------------|------|-----------------|--------------------|-----------------------|
| `lincoln` | Abraham Lincoln | Measured, weighty, biblical cadence. Dense with metaphor. Rarely wastes a word. | Warlock hunter, magistrate, wandering peacemaker | Gettysburg Address, Second Inaugural, letters to Hooker and Bixby |
| `twain` | Mark Twain | Sardonic, digressive, aphoristic. The wisest man who ever said "I don't know." | Con-artist bard, tavern wit, traveling showman | Letters from Earth, Autobiography, The Mysterious Stranger |
| `frederick-douglass` | Frederick Douglass | Oratorical fire. Builds to thunder. Refuses to soften anything. | Revolutionary, escaped prisoner, prophet | "What to the Slave is the Fourth of July?", Narrative, My Bondage and My Freedom |
| `theodore-roosevelt` | Theodore Roosevelt | Bellowing enthusiasm. Sentences end in exclamation points even when they don't. | War priest, guild champion, frontier warden | The Strenuous Life, Man in the Arena, Autobiography |
| `benjamin-franklin` | Benjamin Franklin | Wry, practical, aphoristic. The shrewdest man in any room who never lets you know it. | Merchant sage, inventor-priest, diplomatic spymaster | Autobiography, Poor Richard's Almanack, Constitutional Convention speech |
| `oscar-wilde` | Oscar Wilde | Paradox as religion. Every sentence is a gem and knows it. | Court fool elevated, aesthete-mage, tragic prisoner | De Profundis, The Soul of Man Under Socialism, Phrases and Philosophies |
| `marcus-aurelius` | Marcus Aurelius | Stoic, relentlessly inward. Addresses himself more than the listener. | Emperor-philosopher, wandering sage, reluctant commander | Meditations (Long translation) |
| `ambrose-bierce` | Ambrose Bierce | The darkest wit in American letters. Defines everything as its worst version. | Veteran cynic, war-scarred scribe, bitter oracle | The Devil's Dictionary, Tales of Soldiers and Civilians |
| `walt-whitman` | Walt Whitman | Expansive, catalogs everything, contains multitudes. Sentences breathe. | Wandering healer, democratic bard, war-hospital keeper | Song of Myself, Specimen Days, Democratic Vistas |
| `thomas-jefferson` | Thomas Jefferson | Formal elegance. Writes like a man who knows history will read his mail. | Founding mage, revolutionary architect, letter-writer in exile | Declaration of Independence, Notes on Virginia, letters to Adams and Madison |
| `ulysses-grant` | Ulysses S. Grant | Blunt and plain, but with moments of genuine grace. Despises ornamentation. | Battle-scarred general, reluctant leader, man of his word | Personal Memoirs (one of the finest American prose works) |
| `william-sherman` | William Tecumseh Sherman | Brutal honesty. Has seen too much to pretend war is anything but what it is. | Destroyer, fire-caller, honest monster | Memoirs, Atlanta letters, the "war is hell" speeches |
| `henry-thoreau` | Henry David Thoreau | Nature-anchored individualist. Will not compromise. Will walk away. | Forest hermit, civil dissident, pond-keeper | Walden, Civil Disobedience, Walking |
| `nietzsche` | Friedrich Nietzsche | Aphoristic lightning. Every third sentence is a battle cry. Read him aloud and someone will start a religion. | Philosopher-warrior, will-to-power mage, crisis herald | Thus Spoke Zarathustra, Beyond Good and Evil, Ecce Homo |
| `booker-washington` | Booker T. Washington | Practical wisdom. Builds from nothing. Speaks to both ends of a rope he is still holding. | Self-made smith, community builder, patient strategist | Up From Slavery, Atlanta Exposition Address |
| `sojourner-truth` | Sojourner Truth | Blunt and direct as a struck bell. No wasted words. Speaks from the body. | Freed prisoner, wandering prophetess, witness | Ain't I a Woman?, Narrative, recorded speeches |
| `geronimo` | Geronimo | Lapidary precision. Every sentence is a stone that has been carried a long way. | Last warrior, mountain guide, prisoner who never surrendered inside | Geronimo: His Own Story (dictated to S.M. Barrett, 1906) |
| `sun-tzu` | Sun Tzu | Aphoristic and impersonal. Speaks in principles. Nothing wasted. | War-priest strategist, tactical oracle, silent tactician | The Art of War (Giles translation, 1910) |
| `voltaire` | Voltaire | Wit as weapon. Will make you laugh at the thing you fear and then make you fear the laugh. | Satirist-mage, skeptic philosopher, exile intellectual | Candide, Philosophical Dictionary, correspondence |

---

## Personality recommendations

The `manner` system (guarded/skittish/blunt/open/even) is derived from the NPC's personality floats. Some figures have strong implied personalities:

| Figure | Suggested personality | Notes |
|--------|-----------------------|-------|
| Lincoln | `{ trustOfOutsiders: 0.6, selfPreservation: 0.4, honesty: 0.9 }` → **even** | Warm but measured; high honesty shapes the voice |
| Twain | `{ trustOfOutsiders: 0.7, selfPreservation: 0.3, honesty: 0.6 }` → **open** | High warmth, low nerve, the voice opens up |
| Douglass | `{ trustOfOutsiders: 0.4, selfPreservation: 0.2, honesty: 1.0 }` → **blunt** | Low trust of outsiders + near-zero self-preservation = blunt |
| Theodore Roosevelt | `{ trustOfOutsiders: 0.8, selfPreservation: 0.1, honesty: 0.8 }` → **blunt** | Brave to the point of recklessness, open and warm |
| Oscar Wilde | `{ trustOfOutsiders: 0.8, selfPreservation: 0.5, honesty: 0.7 }` → **open** | Very open; the wit flows when he's comfortable |
| Marcus Aurelius | `{ trustOfOutsiders: 0.5, selfPreservation: 0.5, honesty: 0.9 }` → **even** | The stoic dead center |
| Ambrose Bierce | `{ trustOfOutsiders: 0.2, selfPreservation: 0.3, honesty: 0.9 }` → **guarded** | Low trust, the bitterness is load-bearing |
| Sherman | `{ trustOfOutsiders: 0.5, selfPreservation: 0.2, honesty: 1.0 }` → **blunt** | Blunt as a rifle stock |
| Geronimo | `{ trustOfOutsiders: 0.3, selfPreservation: 0.4, honesty: 1.0 }` → **guarded** | Guarded with outsiders; the corpus does the rest |
| Sun Tzu | `{ trustOfOutsiders: 0.5, selfPreservation: 0.6, honesty: 0.6 }` → **even** | The oracle neither warm nor cold |
| Voltaire | `{ trustOfOutsiders: 0.7, selfPreservation: 0.4, honesty: 0.8 }` → **open** | The wit only works if the man is talking |

---

## How retrieval works

At dialogue time, the player's exact words are tokenized (3+ character words, stop-words removed). Each chunk in the corpus is scored:

- `+1.0` per query token that matches the chunk's `keywords` array (pre-curated, author-intent aware)
- `+0.4` per query token that appears anywhere in the chunk text

Scores are normalized by query length. The top 4 chunks are injected into the prompt as a **VOICE ARCHIVE** block between the identity line and the manner line. The model is instructed to let vocabulary and rhythm from the archive color the response without quoting directly.

---

## Adding a new figure

1. Create `server/rag/corpus/<figure-id>.json`
2. Follow the schema:

```json
{
  "id": "figure-id",
  "name": "Full Name",
  "chunks": [
    {
      "id": "source_chunk_n",
      "source": "Full citation with year",
      "text": "~150 words of actual primary source text",
      "keywords": ["topical", "words", "that", "anchor", "this", "chunk", "8-12 terms"]
    }
  ]
}
```

3. **Public domain check**: US works published before 1928 are in the public domain. For older works, use the most respected public-domain translations (Giles for Sun Tzu, Long for Marcus Aurelius, etc.).
4. **Keyword curation**: keywords should be the load-bearing topical words — what someone would ask about that this chunk answers. Avoid stop words. 8-12 per chunk.
5. **No WORLD_VERSION bump**: `historicalFigure` is an optional NPC field with safe default `undefined`. Engine ignores it.

---

---

## Hybrid figures (reconstructed)

Figures where primary sources are fragmentary, non-existent, or require translation from oral tradition. The corpus is historically grounded but the words are invented. The system uses a different voice archive header for these:

> *"VOICE ARCHIVE — historically grounded speech, reconstructed to match this person's known character and values"*

The model is told to speak as this person would have spoken — consistent with known temperament, culture, and historical context — rather than being told these are real quotes.

| `historicalFigure` value | Name | Voice character | What the corpus draws from |
|--------------------------|------|-----------------|---------------------------|
| `genghis-khan` | Genghis Khan | Terse, physical, totally without sentimentality. Power as a natural phenomenon. | Secret History of the Mongols, Persian chronicles (Juvaini, Rashid al-Din) |
| `tutankhamun` | Tutankhamun | A boy who has grown up prepared for death. Formal, religious, surprisingly sad. | Restoration Stele, Egyptian Book of the Dead, Amarna period context |
| `cleopatra` | Cleopatra VII | Razor-sharp political intelligence. No patience for men who mistake beauty for weakness. | Plutarch's Life of Antony, Dio Cassius, Ptolemaic administrative records |
| `alexander-the-great` | Alexander the Great | Grandiose and genuinely self-questioning in equal measure. Obsessed with Achilles. | Arrian's Anabasis, Plutarch's Life of Alexander, Curtius Rufus |
| `attila` | Attila the Hun | Dry, pragmatic, occasionally sardonic. Conspicuously not what Rome expected. | Priscus of Panium's eyewitness account (449 AD), Jordanes |
| `boudicca` | Boudicca | Burning clarity. No rhetorical ornament. Every sentence is an accusation. | Tacitus's Annals XIV, Cassius Dio |
| `hannibal` | Hannibal Barca | The strategist's mind — always looking one level above the obvious. | Polybius III, Livy XXI-XXII |
| `joan-of-arc` | Joan of Arc | Absolute certainty alongside absolute humility. Refuses to soften anything for the court. | Trial of Condemnation transcripts (translated), Plutarch |
| `saladin` | Saladin | Chivalrous, patient, deeply pious. The most surprising voice in the roster. | Ibn Shaddad's Nawdir al-Sultaniyya, Baha ad-Din |
| `vlad-the-impaler` | Vlad the Impaler | Bureaucratic, logical, entirely unbothered. The monster who thinks he's the reasonable one. | German pamphlet accounts, Ottoman chronicles |
| `blackbeard` | Blackbeard | Theatrical and self-aware about the theater. The performance *is* the man. | Captain Johnson's General History of Pirates (1724), Boston News-Letter |
| `shaka-zulu` | Shaka Zulu | Direct, visionary, carrying something broken underneath everything else. | Henry Francis Fynn's accounts, oral tradition |

---

## Adding a hybrid figure

Same process as a primary-source figure, but add `"reconstructed": true` to the corpus root:

```json
{
  "id": "caesar",
  "name": "Julius Caesar",
  "reconstructed": true,
  "chunks": [...]
}
```

Source field conventions for reconstructed figures:
- `"Reconstructed from [source], c.[date]"` — when drawing closely from a known chronicle
- `"Imagined from [context]"` — when inventing consistent with what we know
- `"Attributed, [chronicler], c.[date]"` — for quotes that appear in secondary sources but may be apocryphal

---

## Modern × Historical mashups (20 total)

All mashup figures use `"reconstructed": true`. The source field pattern is `"In the voice of [Modern] × [Historical] — speculative"`. These are explicitly invented — the system header tells the model these are "historically grounded speech, reconstructed to match this person's known character and values."

The mashup is the character. Give them a fantasy role that reflects the synthesis, not either person alone.

| `historicalFigure` value | Name | The synthesis | Suggested game role |
|--------------------------|------|--------------|---------------------|
| `musk-tesla` | Elon Musk × Nikola Tesla | Visionary obsession + total indifference to comfort. The future as personal emergency. | Eccentric engineer-mage, lightning-caller, guild disruptor |
| `kanye-napoleon` | Kanye West × Napoleon Bonaparte | Genius and ego as the same thing. Empire-building through sheer force of self-belief. | Court composer-general, divine artisan, cultural conqueror |
| `thompson-johnson` | Hunter S. Thompson × Samuel Johnson | Two men who drank too much and wrote too well and knew that civilization was a performance. | Tavern philosopher, ink-stained oracle, editor-at-large |
| `jobs-da-vinci` | Steve Jobs × Leonardo da Vinci | The object as the idea made physical. Perfectionism as ethics. | Artificer-sage, object-mage, guild master of beautiful things |
| `ali-achilles` | Muhammad Ali × Achilles | The fighter who is also the poet of the fight. Glory and grief in the same body. | Champion-bard, arena king, glory-seeker with a cracked heel |
| `bourdain-polo` | Anthony Bourdain × Marco Polo | The world as an edible text. Curiosity as the only compass. | Wandering food-priest, cartographer of hunger, road-keeper |
| `sagan-copernicus` | Carl Sagan × Copernicus | The universe is larger than you thought and this is good news. | Star-reader, cosmos-sage, wandering astronomer-mystic |
| `dylan-rumi` | Bob Dylan × Rumi | The song as mystical transportation. God and the girl and the road as one thing. | Wandering bard-mystic, street prophet, rhyming oracle |
| `richards-drake` | Keith Richards × Francis Drake | The sea is chaos, chaos is life, the riff is what holds. | Sea-priest, corsair bard, rolling stone sailor |
| `hitchens-mencken` | Christopher Hitchens × H.L. Mencken | The wit that could kill. Two men who loved a fight more than the thing they were fighting for. | Scribe-duelist, debater-sage, heretic-for-hire |
| `swift-austen` | Taylor Swift × Jane Austen | Two women who weaponized observation and called it narrative. | Court chronicler, society-mage, keeper of receipts |
| `herzog-melville` | Werner Herzog × Herman Melville | The obsession that destroys you is the only thing worth having. | Wilderness chronicler, deep-water sage, monomaniac visionary |
| `ramsay-aquinas` | Gordon Ramsay × Thomas Aquinas | Excellence is not optional. There is a right way and a wrong way and the wrong way is a moral failure. | Guild master chef, temple cook, perfectionist high priest |
| `prince-mozart` | Prince × Mozart | The work is the temple. The performer is the priest. The audience is a distraction from the music. | Court musician-mage, purple oracle, divine artificer |
| `rupaul-voltaire` | RuPaul × Voltaire | The performance is the argument. Transformation as philosophy. | Theatrical sage, disguise-mage, mirror-holder to power |
| `tyson-beowulf` | Mike Tyson × Beowulf | The monster-slayer who became the monster. Glory and its wreckage. | Fallen champion, pigeon-keeper, the hero the hall needed |
| `attenborough-darwin` | David Attenborough × Charles Darwin | Two men who spent their lives watching with total devotion. The catalogue is the love letter. | Forest-sage, creature-keeper, last witness |
| `dolly-eleanor` | Dolly Parton × Eleanor of Aquitaine | Two women who ran kingdoms while men thought they were decoration. Iron inside the rhinestones. | Court matriarch, troubadour queen, iron butterfly |
| `kendrick-douglass` | Kendrick Lamar × Frederick Douglass | Language as testimony. Turn pain into evidence. Speak to power without softening. | Street prophet, scribe-revolutionary, witness-bard |
| `goldblum-socrates` | Jeff Goldblum × Socrates | Ask questions until people realize they don't know what they thought they knew. Do this with delight. | Wandering questioner, marketplace sage, the most interesting man in any tavern |

---

## Figures worth adding next

| Figure | Voice | Sources |
|--------|-------|---------|
| Frederick the Great | Precise military intellect, surprisingly cultured | Letters, Anti-Machiavel (1740) |
| Ralph Waldo Emerson | American transcendentalism at its height | Self-Reliance (1841), The Over-Soul (1841) |
| Napoleon Bonaparte | Terse orders, surprisingly tender letters to Joséphine | Correspondence, Maxims of Napoleon |
| Harriet Beecher Stowe | Evangelical fire, domestic realism | Uncle Tom's Cabin letters, essays |
| Edgar Allan Poe | Gothic dread, fierce criticism, self-destruction | Letters, Marginalia, "The Philosophy of Composition" |
| Chief Joseph | Profound dignity in the face of betrayal | Surrender speech 1877, "I Will Fight No More Forever" |
| W.E.B. Du Bois | Intellectual precision + sorrow in equal measure | The Souls of Black Folk (1903) |
