# The Kevin Bacon Map
## A Social Graph of 500 NPCs and Their Relationships

**Status:** Design complete. JSON roster to follow.
**Scale:** 500 NPCs in v1, growing to 1000.
**Guarantee:** Every NPC reachable from Kevin Bacon in ≤6 relationship hops.
**Files:** `server/rag/npc-roster.json` (nodes + edges), `scripts/verifyKBMap.js` (BFS proof).

---

## The Axiom

The world is a web of relationships first. Characters exist because of other characters — they are shaped by debts, loyalties, estrangements, shared gods, shared enemies, shared beds. An NPC without relationships is a prop. An NPC embedded in the web is a person.

The 6 Degrees of Kevin Bacon game is, in this world, a fact of cosmology. Kevin Bacon (NPC #1) is a traveling actor-bard of considerable fame whose company has passed through every settlement, performed for every noble house, drunk in every dockside tavern, and is owed a favor by somebody in every guild, temple, and back room from here to the Hallowed Reaches. He doesn't know everybody. But everybody knows somebody who knows somebody who was at the show.

Six hops is the maximum. Most paths are three or four.

---

## Kevin Bacon — NPC #1

**ID:** `kevin_bacon`
**Role:** Actor, bard, lead performer of The Ember Road Players
**Cluster:** The Ember Road Players
**Voice:** Effortlessly warm. Talks to everyone like they're already old friends, because they usually are within an hour.

Kevin Bacon is not the most important person in the world. He is the most *connected*. The distinction matters. He has been everywhere and charmed nearly everyone, and the ones he didn't charm at least remember him. He was briefly married to someone in the Merchant Consortium (annulled, amicably). He trained with swords at the Iron Brotherhood for a season (they wrote a play about him that he hates). The High Temple invited him to perform their Midwinter Convocation three times (he accepted twice). He once lost a week's earnings at cards to someone in the Undermarket and still considers it worth it for the story. The Angel Covenant considers him a sign of something; he is too busy to ask what.

His existence is the bridge. He is not the center of the world — he just passed through every part of it.

---

## Relationship Type Taxonomy

Edges between NPCs are typed. Every relationship in the graph carries one of the following types:

| Type | Description | Examples |
|------|-------------|---------|
| `owes_money` | Directional debt | "Aldous Fenn is owed 40 silver by Capper Wyrd" |
| `drinks_with` | Regular social contact | "Edda the smith and Nan Colt share a table at the Gravel & Goat" |
| `trained_under` | Mentorship/apprenticeship | "Paladin Orm trained under Captain Rath" |
| `worships_alongside` | Same temple/cult attendance | "Acolyte Ser and Penitent Dove both attend the Third Vigil" |
| `estranged_from` | Former relationship, now severed | "Lady Serath and her second son have not spoken in four years" |
| `married_to` | Current or former spouse | "Harke the miller and Wold the net-mender are married" (and it's complicated) |
| `fears` | Directional psychological weight | "The forger Ink fears the customs official Orveth" |
| `employs` | Ongoing labor relationship | "Aldous Fenn employs three caravan guards" |
| `is_hiding_from` | Active evasion | "The man called Davel Crane is hiding from someone in the Iron Brotherhood" |
| `confesses_to` | Spiritual/private disclosure | "Lady Serath confesses only to Archon Vel — and even then not everything" |
| `did_business_with` | Past transaction | "The retired pirate Morvane once traded with the Merchant Consortium under a different name" |
| `shares_a_secret` | Mutual knowledge | "The bookkeeper Talley and the customs official Orveth share a secret about the ledger" |
| `was_saved_by` | Directional life-debt | "The acolyte Lenn was pulled from a flooding cellar by the gravedigger Ord" |
| `taught` | Knowledge transfer, formal or otherwise | "The hedge witch Calla taught the young smith Brenn to read" |
| `serves` | Active subordination | "The steward Comus serves the House of Aldenmere" |
| `watches` | Directional surveillance, not necessarily hostile | "The information broker Mira watches the harbormaster" |
| `traveled_with` | Shared road history | "The cartographer Pell and the guide Thode traveled the same pass in the same winter" |
| `is_blood_of` | Family relation | "Davel Crane is the blood of Lady Serath's first marriage" |

A relationship can have multiple types (e.g., `employs` + `fears`). The graph uses the most narratively load-bearing edge for pathfinding; richness comes from layering.

---

## The Clusters — 17 Social Units

The world is organized into 17 clusters totaling ~500 NPCs. Each cluster is a densely-connected social unit. Between clusters: 3-5 bridge nodes that belong meaningfully to two worlds.

Kevin Bacon's cluster (The Ember Road Players) serves as a super-hub: it maintains ≥2 bridge connections to every other cluster, which is why the 6-degrees property holds across the full graph.

---

### 1. THE EMBER ROAD PLAYERS (~25 NPCs)
*A traveling theatre company. They go everywhere. Everyone has seen the show.*

The Players are the connective tissue of the world. They have no fixed home — they are always between one engagement and the next. This is what makes Kevin Bacon the universal hub: his company's circuit covers every cluster in the graph.

**Key NPCs:**
- **Kevin Bacon** — lead actor, the hub, warmer than he should be
- **Margit** — the fortuneteller, reads cards and people with equal accuracy; has opinions about the Hedge Brotherhood she doesn't share with Kevin
- **Swords Odo** — fight choreographer, former Iron Brotherhood soldier who found performance more honest than actual war
- **Pip** — the child prodigy, does impressions of people they've seen once; the impressions are too good
- **Bren Holt** — company cook, ex-spy from a country that no longer exists, retired in the best possible way
- **The Twins (Sera and Dort)** — acrobats who communicate in a private language no one else understands

**Bridge nodes to other clusters:**
- Kevin Bacon → all clusters (that's the point)
- Margit → Hedge Brotherhood (`drinks_with` the hedge witch Calla)
- Swords Odo → Iron Brotherhood (`trained_under` Captain Rath)
- Pip → Orphan Roads (`is_blood_of` a child in the street network — complicated)

---

### 2. THE THORNWALL COMMONS (~45 NPCs)
*The largest cluster. A mid-sized village, the world's social baseline.*

Every other cluster eventually traces a path through Thornwall because Thornwall is where people come from. Three feuding families (the Harkes, the Wolds, and the Cranes), a tavern at the center of everything, and enough shared history to make any conversation interesting.

**Key NPCs:**
- **Brevis** — innkeeper of the Gravel & Goat, knows every traveler who passes through, sources his wine from the Merchant Consortium
- **Edda** — the blacksmith, female, fearsome, third-generation in the same forge; the Forge Guild have been trying to recruit her for years
- **Nan Colt** — midwife and hedge practitioner; has delivered approximately half the village; also the most reliable source of certain herbal preparations the Temple would prefer not to discuss
- **Harke Senior** — patriarch of the Harke family, miller, carries a grudge about water rights that is now thirty years old
- **Wold the Younger** — net-mender who married into the Harke family and is publicly neutral in all feuds, which fools nobody
- **Ord** — the gravedigger; knows things about families that families would rather he forgot; once pulled a drowning acolyte from a cellar
- **Cass Crane** — the village drunk who was once something else; nobody asks what
- **Davel Crane** — Cass's nephew, briefly attended the Academy of Runes, is back for reasons he won't explain fully; is hiding from something in the Iron Brotherhood
- **Mace the Cartwright** — repairs wheels, trades gossip, is almost certainly the village's best source of regional news
- **Father Len** — the village's itinerant spiritual attendant; attends both the Temple and the Hollow Court as needed; does not consider these contradictory

**Bridge nodes:**
- Brevis → Merchant Consortium (`did_business_with` Aldous Fenn)
- Edda → Forge Guild (`was_saved_by` the guild tinker Vann; owes a debt)
- Nan Colt → Hedge Brotherhood (shared with that cluster — she's both)
- Davel Crane → Academy of Runes (`trained_under` Osven, briefly)
- Father Len → The Temple (`worships_alongside` the lower clergy)
- Cass Crane → Undermarket (`owes_money` to the fence Mira — old business)
- Ord → Hollow Court (`drinks_with` the Hollow Court's undertaker)

---

### 3. THE HOUSE OF ALDENMERE (~35 NPCs)
*An old noble family in decline. The matriarch holds it together through sheer refusal to admit it's falling.*

Lady Serath Aldenmere has outlived two husbands, one rebellion, and three attempts to marry her into irrelevance. The house is smaller than it looks. The debts are larger. The portrait gallery has more dead Aldenmeres than living ones, and the ratio is improving in the wrong direction.

**Key NPCs:**
- **Lady Serath Aldenmere** — matriarch, imperious, funds the Temple of Seven Virtues primarily to have Archon Vel available as a confessor; the confession is strategic
- **Comus** — the steward; actually runs the house; sources things through the Undermarket that the house officially cannot afford through legitimate channels
- **Edwyn Aldenmere** — the eldest heir, virtuous in a way that worries everyone; takes seriously things that aren't supposed to be taken seriously
- **Britta Aldenmere** — the second child, compromise everything, has been quietly making arrangements Lady Serath doesn't know about yet
- **The Portrait Painter Hesse** — has been commissioned for three years; the portrait is not finished; the reason is unclear
- **Davel Aldenmere (visiting cousin)** — technically a Crane by birth, Aldenmere by fostering; was at the Academy for two years; is now here; has not explained
- **The Astrologer Rem** — on retainer; reads the stars; believes what the stars say more than the family would prefer
- **House Knight Vorn** — loyal to the house, not to any individual in it; has declined several offers

**Bridge nodes:**
- Lady Serath → The Temple (`confesses_to` Archon Vel; `employs` the temple's lower clergy for household rites)
- Comus → Undermarket (`did_business_with` the fence Mira repeatedly)
- Davel Aldenmere → Academy of Runes (`trained_under` Osven)
- House Knight Vorn → Iron Brotherhood (`trained_under` Captain Rath)
- The Astrologer Rem → Angel Covenant (`watches` the Covenant's seer; they correspond)

---

### 4. THE FORGE GUILD (~30 NPCs)
*People who make things. The world runs on what they build.*

The oldest guild in the region. Its charter predates the current noble house. The guild master (Old Wrendle) is very old and the succession is actively contested between two candidates who are publicly civil about it. Everyone knows the civility will not last.

**Key NPCs:**
- **Old Wrendle** — guild master, ninety if he's a day, has opinions about everything and is right about most of them; keeps his succession intentions private as a matter of survival strategy
- **Carra** — master smith, leading succession candidate, methodical; believes Wrendle will name her
- **Brek** — journeyman smith, other candidate's ally; believes Wrendle will not
- **Vann the Tinker** — travels between villages; technically guild-affiliated; knows more about the region than any cartographer; once pulled the smith Edda from a flooding situation (they disagree on the details)
- **Gell** — the glassblower; arrived from somewhere far away, has not explained why, makes extraordinary things; the Academy sends students to watch
- **Prentice Brenn** — youngest smith, prodigy, considering the Academy's open invitation; hasn't told Old Wrendle
- **The Charcoal Burner (no other name given)** — lives in the forest edge; delivers charcoal; nobody knows if he sleeps

**Bridge nodes:**
- Wrendle → House of Aldenmere (`employs` the house for commissions; has `shared_a_secret` with Lady Serath about a Crane family matter)
- Carra → Iron Brotherhood (`employs` the Brotherhood for guild security)
- Vann → Thornwall Commons (shared — she's their most reliable outside connection)
- Vann → Wild Road (`traveled_with` the ranger Theen)
- Prentice Brenn → Academy of Runes (considering; `was_taught` to read by the hedge witch Calla)
- Gell → Harbor Quarter (`did_business_with` a glassware merchant)

---

### 5. THE MERCHANT CONSORTIUM (~35 NPCs)
*A partnership of trading houses. More powerful than the noble house in practice; more polite about it.*

Aldous Fenn runs the Consortium the way a patient man runs a long game — slowly, quietly, and always ahead of where everyone else is looking. He has been called ruthless. He prefers "consistent."

**Key NPCs:**
- **Aldous Fenn** — senior partner; bankrolls the House of Aldenmere; knows exactly how many favors that buys; has been married to the same woman for forty years and considers it his greatest success
- **Saben Fenn** — Aldous's daughter, junior partner, sharper than her father at numbers, less patient; the Consortium is hers in waiting
- **The Bookkeeper Talley** — knows where every coin has gone; shares a secret about the ledger with the customs official Orveth; will not say what
- **Caravan Guard Captain Helle** — runs the road security; has a prior relationship with the Wild Road that the Consortium finds useful
- **The Factor Pell** — lives in the Harbor Quarter; officially independent; practically Consortium
- **Customs Official Orveth** — split between this cluster and the Undermarket; "employed" by the Crown and "arranged with" by the Consortium; wears both hats without apparent discomfort
- **The Ship Owner Cartha** — based in the Harbor Quarter; transports Consortium goods; knows things about where goods go and who receives them that Aldous Fenn officially does not

**Bridge nodes:**
- Aldous Fenn → House of Aldenmere (`employs` essentially; `was_married_to` briefly; annulled; this was Kevin Bacon — old story)
- Saben Fenn → Academy of Runes (`did_business_with` Osven for rare texts; `owes_money` for a private commission)
- Orveth → Undermarket (split node)
- Cartha → Harbor Quarter (split node)
- Helle → Wild Road (`drinks_with` the guide Thode)

---

### 6. THE HARBOR QUARTER (~30 NPCs)
*Sailors, dockworkers, the sea-facing end of everything. What arrives and what leaves.*

The Harbor Quarter has its own tempo, separate from the rest of the settlement. The tide sets the schedule. The tavern (The Anchor & Argument) runs all night. The harbormaster Keris has worked the same dock for twenty-two years and knows every ship by its wake.

**Key NPCs:**
- **Harbormaster Keris** — formal, precise, has a filing system for grievances that is both terrifying and efficient
- **The Retired Pirate Morvane** — does not discuss her previous career; runs a respectable chandlery; everyone knows; nobody says
- **The Three Brothel Workers (Dara, Fen, and the one called Seven)** — know everything that arrives by sea; are never asked officially; are consulted privately by almost everyone
- **Dock Boss Rulf** — runs the day crew; the Merchant Consortium thinks they employ him; he thinks of it differently
- **Sailor Hetch** — between ships; has been to the Hallowed Reaches; talks about it when he's drunk; sometimes what he says is useful
- **The Net-Mender Guild (five people)** — technically separate; practically Harbor Quarter; bridge to Thornwall Commons through Wold the Younger's extended family

**Bridge nodes:**
- Keris → Merchant Consortium (`employs` the Factor Pell; `does_business_with` Cartha)
- Morvane → Undermarket (`did_business_with` the fence Mira — prior career overlap)
- Sailor Hetch → Wild Road (`traveled_with` the cartographer Pell)
- Rulf → Iron Brotherhood (`drinks_with` several veterans)

---

### 7. THE IRON BROTHERHOOD (~35 NPCs)
*Active soldiers, retired veterans, mercenaries between contracts. The people the world points at problems.*

The Brotherhood is not a standing army. It is an arrangement — a network of trained fighters who maintain an address for purposes of organization and contracts. Captain Rath holds the address and the ledger. She has seen enough that very little surprises her.

**Key NPCs:**
- **Captain Rath** — on retainer to the House of Aldenmere; maintains her independence through the fiction that she could leave; could not afford to; knows this
- **The Siege Engineer Dross** — knows how things fall down; is also useful for knowing how things stay up; the Academy occasionally consults him
- **The Army Healer Pella** — has seen too many die; attends the Hollow Court's vigils now; considers it professional research
- **The Camp Cook Yew** — has outlasted six commanders; is not a soldier; will never be mistaken for one; is indispensable
- **The Young Recruit Sev** — has never seen blood that wasn't an accident; is about to
- **The Deserter (name: Cord; registered name: Wal)** — came back under a different name; nobody in the Brotherhood is pointing this out because Cord is very good at their job
- **Weapons Merchant Durn** — technically not a soldier; practically embedded; supplies the Brotherhood and has a standing commission with the Forge Guild

**Bridge nodes:**
- Rath → House of Aldenmere (`serves` on retainer; `trained_under` the previous house knight)
- Durn → Forge Guild (`employs` forge work; `is_blood_of` a Forge Guild journeyman)
- Pella → Hollow Court (`worships_alongside` the court's grief-workers)
- Sev → Thornwall Commons (`is_blood_of` a Thornwall family — Harke, naturally)
- Dross → Academy of Runes (`taught` structural theory to several students, informally)

---

### 8. THE UNDERMARKET (~25 NPCs)
*Not a guild. An arrangement. The gray economy that makes the real economy possible.*

Nobody runs the Undermarket. There is no charter. There is, however, a fence named Mira who operates out of a building that is officially a storage warehouse, and most things flow through her eventually.

**Key NPCs:**
- **Mira** — the fence; moves goods both into and out of legitimate commerce; has more information than almost anyone in the settlement; uses it carefully
- **The Forger Ink** — produces documents; trained at the Academy under false pretenses; still uses their methods; fears the customs official Orveth in a way that Orveth does not appear to leverage (yet)
- **The Poisoner (name not given)** — prefers not to be called that; provides certain preparations; has a professional overlap with the Hedge Brotherhood that both parties prefer to keep informal
- **Pickpockets Cess and Keet** — teenagers; technically wards of no one; practically under Mira's protection
- **The Retired Guard Bos** — provides security for the Undermarket's more exposed operations; maintains exactly one contact in the Iron Brotherhood who is paid not to look
- **The Debtor Capp** — owes Mira a sum she has not called in; this means he's useful; he knows he's useful; it's a comfortable arrangement that will end

**Bridge nodes:**
- Mira → Merchant Consortium (`watches` Orveth; `did_business_with` Aldous Fenn in ways neither discusses)
- Mira → Thornwall Commons (`owes_money` — no, wait: Cass Crane `owes_money` to Mira)
- Ink → Academy of Runes (`trained_under` Osven under false pretenses; `fears` Osven knows)
- Bos → Iron Brotherhood (`drinks_with` one Brotherhood veteran who doesn't look)
- The Poisoner → Hedge Brotherhood (informal overlap)

---

### 9. THE ACADEMY OF RUNES (~30 NPCs)
*Small, serious, underfunded. They know more than anyone else and fewer people come to them for it than they'd like.*

The Academy occupies a building that was once larger. The east wing is closed. Osven the head librarian believes this is a temporary situation and has believed this for eleven years. The students who figure out that it isn't leave; the ones who stay are the ones who care more about the books than the building.

**Key NPCs:**
- **Osven** — head librarian, obsessive about books, protective of them past the point of reason, borrows texts from the Temple that he does not always return; `shares_a_secret` with no one but has been seen in the Hollow Court twice
- **Scholar Maren** — senior scholar; studies demon-adjacent texts; has a professional relationship with someone in the Demon Courts that the Academy officially doesn't know about
- **Student Ferrin** — fourth year; is going to be exceptional; is distracted by a relationship with someone in the Angel Covenant
- **The Teaching Assistant Soll** — failed student who is still there; has been there for eight years; knows where everything is; is technically Osven's assistant and practically his memory
- **The Visiting Lecturer Ila** — came from the Hallowed Reaches; has been here three years; was supposed to stay six months; her correspondence home is very thin
- **The Janitor Orm (no relation to the paladin)** — has absorbed more knowledge than several of the students; nobody asks him about it; he has stopped volunteering

**Bridge nodes:**
- Osven → The Temple (`did_business_with` Archon Vel for texts; `fears` Archon Vel has copied them)
- Maren → The Demon Courts (research relationship; uncomfortable)
- Ferrin → Angel Covenant (`drinks_with` a Covenant member; complicated)
- Ila → Wild Road (`traveled_with` the ranger Theen to get here)

---

### 10. THE WILD ROAD (~25 NPCs)
*People who live between places. The forest, the road, the spaces settlements pretend don't exist.*

Not a faction. An ecology. People who are comfortable in the spaces between. They know each other the way that people know each other when they meet at the same watering holes across a vast territory — with a particular warmth for the rarity of it.

**Key NPCs:**
- **Ranger Theen** — has mapped more of the region than anyone else and keeps the maps private; travels with the cartographer Pell sometimes; does not explain why she trusts him
- **The Druid (name: Foss)** — speaks to the forest about things the forest is concerned about; the forest is concerned about several things; Foss is difficult to reach and worth the difficulty
- **Trapper Vyd** — works the eastern boundaries; has seen things he reports to no one officially; the Church of Incrementalism has, perhaps, seen him
- **The Cartographer Pell** — makes and sells maps; works with the Merchant Consortium; travels with Theen; lives in the Harbor Quarter when not traveling
- **The Pilgrim Sarne** — has been walking for three years; destination: a shrine to ERRAN; not sure what she'll do when she gets there
- **The Hermit (no name)** — accepts visitors occasionally; has useful information about things that happened here before settlements; charges nothing for information; is insulted by money
- **The Guide Thode** — for hire; knows every road and several that aren't; `drinks_with` Caravan Guard Captain Helle

**Bridge nodes:**
- Theen → Academy of Runes (`traveled_with` Ila; `taught` Osven what forest maps mean)
- Pell → Harbor Quarter (`lives_with` the Harbor Quarter between trips; `did_business_with` Cartha)
- Thode → Merchant Consortium (`employs` relationship with Guard Captain Helle)
- Foss → Hedge Brotherhood (`corresponds_with` Nan Colt about forest-edge herbalism)
- Sarne → Angel Covenant (`worships_alongside` the pilgrims at the shrine)

---

### 11. THE HEDGE BROTHERHOOD (~25 NPCs)
*Folk healers, wise ones, liminal figures. The medicine the Temple doesn't officially endorse.*

Not organized. Described as a Brotherhood by people outside it; the people inside call it "the knowing" and leave it at that. Nan Colt is the best-known member of the regional network, but she would not call herself the center of it.

**Key NPCs:**
- **Nan Colt** — midwife, hedge practitioner, shared with Thornwall Commons; the most connected member of the network; has delivered most of the living members of three other clusters
- **The Hedge Witch Calla** — cures and sometimes curses; very careful about which one she does; `drinks_with` Margit from the Ember Road Players; has taught the young smith Brenn to read
- **The Beekeeper Swale** — keeps bees; the honey has properties; is also something else that no one has named precisely
- **The Dreamer Oss** — receives visions; people visit when they need to know things; Oss charges nothing and asks for water; the Angel Covenant considers Oss one of their own; Oss has not confirmed or denied
- **The Fire-Reader** — reads futures in fires; has declined to name their future; is considered trustworthy specifically because of this
- **The Old Man Who Knows Old Things (name: Vrenn)** — knows things that happened here before anyone else was born; will tell you if you ask the right way; knows the right way but won't tell you what it is

**Bridge nodes:**
- Nan Colt → Thornwall Commons (split node)
- Calla → Ember Road Players (`drinks_with` Margit)
- Calla → Undermarket (professional overlap with the Poisoner)
- Oss → Angel Covenant (`worships_alongside` / identity ambiguous)
- Foss (Wild Road) → Calla (research correspondence)

---

### 12. THE TEMPLE OF SEVEN VIRTUES (~35 NPCs)
*The formal religious institution. Seven angels, one roof, varying degrees of sincerity.*

The Temple venerates the seven virtuous powers — MERETH (Humility), ALMASOSE (Charity), TARRYN (Patience), VELL (Kindness), LIRAINE (Integrity), SOSTANE (Temperance), and ERRAN (Diligence). The official line is that these are facets of the Creator's light. Privately, different clergy have different emphases, and the emphasis determines the faction.

**Key NPCs:**
- **Archon Vel** — high priest; certain of everything except one thing he has not named; confesses Lady Serath; receives information through confession that he may be using in ways confession is not meant for; believes he is justified
- **Sister Dove** — paladin-adjacent, the Order of the Unbroken Furrow (ERRAN devotees); trains with the Iron Brotherhood; is not at peace but is at work, which she finds sufficient
- **The Records Keeper (Brother Ord — no relation to the gravedigger)** — has every record of every tithing, every birth-rite, every death-blessing; the Academy borrows from him; he borrows from them
- **The Choir Leader Maret** — manages the choir and the politics of the choir, which are indistinguishable from each other
- **The Monk Losing His Faith (Acolyte Lenn)** — was pulled from a flooded cellar by the gravedigger Ord of Thornwall; can't stop thinking about what he was doing in that cellar
- **The Very Old Nun (Sister Ach)** — has seen everything; rates events on a private scale of 1-10 against the worst things she has witnessed; most events score a 2 or 3

**Bridge nodes:**
- Archon Vel → House of Aldenmere (`confesses_to` Lady Serath; `employs` by her funding)
- Sister Dove → Iron Brotherhood (`trains_with` Captain Rath's fighters)
- Brother Ord (records) → Academy of Runes (`did_business_with` Osven)
- Acolyte Lenn → Thornwall Commons (`was_saved_by` the gravedigger Ord — same Ord, different cluster)
- Father Len (Thornwall) → Temple (`worships_alongside` the lower clergy here occasionally)

---

### 13. THE HOLLOW COURT (~25 NPCs)
*They accept what others deny. The professionals of grief, threshold-work, and the rights of the dead.*

Not a death cult in the dramatic sense. More like the people you call when someone dies badly and the rest of the settlement doesn't know what to do. They have a theology (ACEDIEL, the Grey Tide, is their primary sign — but they also tend toward TARRYN for the grief that waits) and a practice, and they take it seriously.

**Key NPCs:**
- **The High Mourner Sel** — presides over the Court's rituals; has been in the profession since she was twelve; feels things at a distance now, which she considers a wound and a tool
- **The Undertaker Bram** — knows every family in the region by the losses they've carried; `drinks_with` the gravedigger Ord from Thornwall; they compare notes
- **The Bone-Reader Cren** — reads what's left; not prophetically, forensically; extremely useful in certain situations; the Iron Brotherhood sometimes consults
- **The Spirit-Whisperer Alath** — has seen what the Demon Courts summon; has a professional interest in understanding it; the Demon Courts find this acceptable in a way that suggests they find it useful
- **The Young Convert Pel** — joined six months ago; terrified their family; is calmer and more grounded than they were before, which terrifies the family more

**Bridge nodes:**
- Bram → Thornwall Commons (`drinks_with` the gravedigger Ord)
- Pella (Iron Brotherhood) → Hollow Court (`worships_alongside` grief vigils)
- Alath → Demon Courts (professional interest; the Courts find it useful)
- Sel → Hedge Brotherhood (`corresponds_with` the Old Man Vrenn about old rites)

---

### 14. THE SEVEN SHADOWS — DEMON COURTS (~30 NPCs)
*Devotees of the seven dark powers. More organized than their theology suggests they should be.*

Each of the seven demon-powers has its devotees. They do not cooperate well. The Courts are more a taxonomy than a faction — KHORRUN's blood-oathed and LIORAI's seduction cultists share almost nothing except the fact that they are both on the wrong side of the Temple's ledger. What they do share: a loose mutual protection arrangement, brokered by the summoner Ceth, who considers ideological differences less important than survival.

**Seven sub-factions within the Courts:**

**KHORRUN (Wrath) — The Scarlet Compact (5 NPCs):**
- Orm the Blood-Sworn — don't mistake him for the paladin with a similar name; this one took a different oath
- Three unnamed soldiers who marked themselves after a battle they won at too high a price
- The Scarlet Compact's "priest" (Dorr) — who simply refuses to be afraid of anything and considers this devotion

**HAGRETH (Greed) — The Coin Cult (4 NPCs):**
- Masha — a merchant who went further than Aldous Fenn and is richer and more alone
- The Coin Cult's agent in the Merchant Consortium (name unknown; someone suspects but hasn't confirmed)

**VAUNTRETH (Pride) / ISS (Envy) — The Mirror Throne (5 NPCs):**
- The Mirror-Crowned (title, not name) — a former noble who decided the house wasn't worthy of them
- Three courtiers who followed and are increasingly aware they made a mistake

**LIORAI (Lust) — The Honeyed (4 NPCs):**
- The Honey-Keeper (name: Dore) — runs a safe house that is not technically criminal; the seduction is the product
- Two initiates and one very senior member who is not where anyone would look

**GORRAN (Gluttony) — The Hollow Feast (4 NPCs):**
- The Hollow Feast's attendants; they work in food; what specifically gets consumed after dark is not in any official record

**ACEDIEL (Sloth/Despair) — The Grey Surrender (4 NPCs):**
- People who have given up something essential and are being given something in return; they don't seem to mind; that is the sign

**The Summoner (Ceth)** — manages the arrangement; studied at the Academy under Scholar Maren; the Academy hasn't formally acknowledged this

**Bridge nodes:**
- Alath (Hollow Court) → Seven Shadows (professional research)
- Scholar Maren (Academy) → Ceth (`trained_under` relationship, reversed; uncomfortable)
- Masha (Coin Cult) → Merchant Consortium (she's in both; nobody in the Consortium has confirmed this)
- The Grey Surrender's senior member → Hollow Court (the Hollow Court would help if asked; hasn't been asked)

---

### 15. THE ANGEL COVENANT (~20 NPCs)
*Celestial devotees. Quieter than the Temple, more intense, and less organized.*

Not a competitor to the Temple — they're more like the Temple's embarrassing mystic cousins. The Temple venerates the angels institutionally. The Covenant receives them directly, or believes it does. The distinction matters to the Temple; the Covenant doesn't understand why it should.

**Key NPCs:**
- **The Seer Wen** — has been receiving something for three years; calls it visions; has not slept more than two hours at a stretch in that time; is very calm about this in a way that worries people
- **The Former Paladin Caer** — left the Temple's Order over a doctrinal disagreement she won't specify; the disagreement was about whether LIRAINE could be directly petitioned or only served; she believed the latter; the Temple believed you shouldn't have to choose
- **The Scholar (Teel)** — studies angelic texts academically; publishes; the Academy finds his conclusions interesting and his methods sound; the Temple finds his conclusions alarming
- **The Child (no name; no one has asked)** — has been at the Covenant for a year; knows things; where they came from is unclear
- **The Woman Who Does Not Sleep (Wen, noted above, is one; the other is called Rue)** — Rue has not slept in four years; she's getting better, she says, not worse

**Bridge nodes:**
- Caer → The Temple (`estranged_from` Archon Vel; `drinks_with` Sister Dove still)
- Teel → Academy of Runes (`corresponds_with` Scholar Maren; publishes in the same journals)
- Wen (Seer) → Hedge Brotherhood (`corresponds_with` the Dreamer Oss; they compare notes)
- Student Ferrin (Academy) → Covenant (`drinks_with` a Covenant member — probably Teel)

---

### 16. THE ORPHAN ROADS (~20 NPCs)
*The children the settlement doesn't officially have. Street networks, runaways, the young who sorted themselves out.*

Not a gang. A survival ecology. They communicate, share food and warnings, maintain informal territories, and have a hierarchy that adults don't recognize and would be surprised by. The oldest member is seventeen. She goes by Rook.

**Key NPCs:**
- **Rook** — seventeen, runs the network through a combination of reputation and genuine care; has been contacted by the Undermarket; has declined so far; the so-far matters
- **The Young Spy (Mir)** — twelve; works for the Undermarket; Rook knows and allows it because Mir shares the income
- **The Child Prodigy's Sibling (unnamed)** — related to Pip from the Ember Road Players; this is complicated; they haven't met in two years
- **Former Temple Wards (three)** — aged out of the Temple's charity program; are now navigating what comes next; still attend the Temple sometimes; Father Len from Thornwall sees them when he visits

**Bridge nodes:**
- Rook → Undermarket (considered; not committed; knows Cess and Keet)
- Pip's sibling → Ember Road Players (family relation to Pip — Kevin Bacon knows the story)
- Former Temple Wards → The Temple (`worships_alongside` still; complicated)
- Rook → Thornwall Commons (`was_saved_by` Brevis the innkeeper once; has not forgotten)

---

### 17. THE CHURCH OF INCREMENTALISM (~15 NPCs)
*Ultra-secret. Most playthroughs will never encounter it. Discovery is a reward for patient, curious players.*

There is no public presence. There is no building. There is a beekeeper (Swale, also in the Hedge Brotherhood) who keeps a particular type of smoke. There is a trapper (Vyd, also in the Wild Road) who attends gatherings in a location that changes. There are perhaps fifteen people in this region who have found it. None of them talk about it.

**Key NPCs:**
- **Swale (the Beekeeper)** — the most visible member by virtue of being visible; the honey is real; the smoke is real; the instruction is real
- **Vyd (the Trapper)** — attends; says nothing in other company; is noticeably calmer than the situation warrants
- **The Second Increment (this region's carrier of the teaching)** — identity unknown even to this document; they are in the graph; their node exists; the edge will be a discovery

**Bridge nodes:**
- Swale → Hedge Brotherhood (shared node)
- Vyd → Wild Road (shared node)
- The Second Increment → one other cluster (deliberately unspecified — to be discovered)

---

## Graph Properties

**Target diameter:** 6 (maximum path length between any two nodes)
**Expected average path length:** 3-4 (small-world property)
**Kevin Bacon's degree:** 17+ direct edges (one to each cluster)
**Bridge nodes:** ~40 NPCs with edges into two clusters; ~8 with edges into three

**Why the diameter holds:**
Every cluster has ≥2 edges to Kevin Bacon's cluster (The Ember Road Players). Therefore any two nodes A and B are at most: A→bridge→KB→bridge→B = 4 hops. In practice, Kevin Bacon has direct relationships with at least one NPC in every other cluster, so the max is lower.

---

## Verification

`scripts/verifyKBMap.js` — BFS from `kevin_bacon` to every other node. Asserts max depth ≤6. Prints the 5 longest paths so they can be examined for narrative interest (a 6-hop path is a story).

Run after any new NPC or relationship is added.

---

## Growth Path: 500 → 1000

**Phase 2 adds:**
- 3 new settlements (a harbor city, a mountain outpost, a forest village) — ~150 NPCs total
- Each connects to the existing graph via Kevin Bacon's historical touring circuit and Merchant Consortium trade routes
- The Church of Incrementalism's Second Increment is revealed — bridging to one new cluster
- The Seven Shadows expand: each sub-faction gets 3-5 more named devotees
- The Orphan Roads expand: Rook's network reaches into one of the new settlements

**The 1000-NPC graph maintains the same diameter guarantee** because new clusters attach with ≥2 edges to existing bridge nodes, and Kevin Bacon's touring circuit is explicitly extended to cover new locations.

---

## What Comes Next

1. `server/rag/npc-roster.json` — all 500 NPCs as nodes with names, roles, cluster IDs, optional `historicalFigure` values
2. `server/rag/npc-relationships.json` — typed edge list
3. `scripts/verifyKBMap.js` — BFS proof
4. Corpus files for each NPC — cluster by cluster, starting with the Ember Road Players and Kevin Bacon himself
