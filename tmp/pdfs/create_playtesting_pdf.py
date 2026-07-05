from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)
from reportlab.pdfbase.pdfmetrics import stringWidth

OUT = "output/pdf/immortal-engine-ai-playtesting-guide.pdf"


PAGE_W, PAGE_H = letter
MARGIN_X = 0.62 * inch
MARGIN_TOP = 0.62 * inch
MARGIN_BOTTOM = 0.58 * inch
FRAME_W = PAGE_W - (2 * MARGIN_X)
FRAME_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM


PALETTE = {
    "ink": colors.HexColor("#172033"),
    "muted": colors.HexColor("#5B6578"),
    "paper": colors.HexColor("#F3F0E7"),
    "paper2": colors.HexColor("#E8E1D1"),
    "line": colors.HexColor("#BAC3B7"),
    "blue": colors.HexColor("#244C73"),
    "green": colors.HexColor("#3F6B4A"),
    "red": colors.HexColor("#8E342E"),
    "gold": colors.HexColor("#A16E28"),
}


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(PALETTE["line"])
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_X, 0.44 * inch, PAGE_W - MARGIN_X, 0.44 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(PALETTE["muted"])
    left = "Immortal Engine - AI Playtesting Guide"
    right = f"{doc.page}"
    canvas.drawString(MARGIN_X, 0.27 * inch, left)
    canvas.drawRightString(PAGE_W - MARGIN_X, 0.27 * inch, right)
    canvas.restoreState()


def make_doc():
    doc = BaseDocTemplate(
        OUT,
        pagesize=letter,
        rightMargin=MARGIN_X,
        leftMargin=MARGIN_X,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
    )
    frame = Frame(MARGIN_X, MARGIN_BOTTOM, FRAME_W, FRAME_H, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])
    return doc


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        "TitleBig",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=31,
        textColor=PALETTE["ink"],
        alignment=TA_LEFT,
        spaceAfter=10,
    )
)
styles.add(
    ParagraphStyle(
        "Deck",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=12.5,
        leading=17,
        textColor=PALETTE["muted"],
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        "H1x",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=PALETTE["ink"],
        spaceBefore=4,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        "H2x",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12.4,
        leading=15,
        textColor=PALETTE["blue"],
        spaceBefore=8,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        "Bodyx",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.4,
        leading=12.5,
        textColor=PALETTE["ink"],
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        "Smallx",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.1,
        leading=10.5,
        textColor=PALETTE["muted"],
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        "Callout",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=10.2,
        leading=13.5,
        textColor=PALETTE["ink"],
        backColor=colors.HexColor("#E8E1D1"),
        borderColor=PALETTE["line"],
        borderWidth=0.7,
        borderPadding=8,
        spaceBefore=6,
        spaceAfter=9,
    )
)
styles.add(
    ParagraphStyle(
        "Label",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=PALETTE["blue"],
        spaceAfter=2,
    )
)
styles.add(
    ParagraphStyle(
        "CenterSmall",
        parent=styles["Smallx"],
        alignment=TA_CENTER,
    )
)


def P(text, style="Bodyx"):
    return Paragraph(text, styles[style])


def section(title):
    return [Spacer(1, 2), P(title, "H1x")]


def bullets(items, style="Bodyx"):
    out = []
    for item in items:
        out.append(P(f"<b>-</b> {item}", style))
    return out


def colored_box(title, body, color="blue"):
    data = [[P(title, "Label")], [P(body, "Bodyx")]]
    t = Table(data, colWidths=[FRAME_W])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F7F3EA")),
                ("BOX", (0, 0), (-1, -1), 0.8, PALETTE[color]),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return t


def simple_table(headers, rows, widths=None, header_color="blue"):
    widths = widths or [FRAME_W / len(headers)] * len(headers)
    data = [[P(h, "Label") for h in headers]]
    for row in rows:
        data.append([P(cell, "Smallx") for cell in row])
    table = Table(data, colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DEE8E0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), PALETTE[header_color]),
                ("GRID", (0, 0), (-1, -1), 0.35, PALETTE["line"]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


story = []

story.append(P("Immortal Engine", "Deck"))
story.append(P("AI Playtesting Guide", "TitleBig"))
story.append(P("What the current state of the art can do, what it cannot replace, and how Tim should playtest a voice-first tabletop RPG.", "Deck"))
story.append(Spacer(1, 0.25 * inch))
story.append(colored_box(
    "The thesis",
    "Use AI to find broken plumbing at scale. Use humans to judge whether the table feels alive. A green automated harness can prove coherent behavior. It cannot prove magic.",
    "green",
))
story.append(Spacer(1, 0.22 * inch))
story.append(simple_table(
    ["Layer", "Who should own it", "What good looks like"],
    [
        ["Crash, determinism, save/load, invariant failures", "Automated tests and scripted agents", "Runs constantly, cheap, boring, zero drama."],
        ["State/prose contradictions", "Deterministic oracles plus LLM judge as triage", "Narration never claims state the engine did not commit."],
        ["Exploration coverage and weird player inputs", "AI goal players, persona players, fuzzers", "Hundreds of seeds expose repeatable seams."],
        ["Fun, trust, desire, fear, pacing, first 20 minutes", "Humans, especially Tim plus naive testers", "The game makes someone want the next turn."],
    ],
    [1.7 * inch, 1.55 * inch, 3.35 * inch],
))
story.append(Spacer(1, 0.2 * inch))
story.append(P("Prepared June 27, 2026. Uses public AI-playtesting research plus Immortal Engine's own playtest protocol, harness notes, DM Test, and invariants.", "Smallx"))
story.append(PageBreak())

story += section("1. The SOTA, in plain English")
story.append(P("AI playtesting is no longer a toy, but it is not a replacement for human play. The mature pattern is layered: deterministic checks for hard truth, scripted or learned agents for coverage, LLM agents for language-shaped exploration, and human sessions for experience.", "Bodyx"))
story.append(P("The research direction is consistent. Automated agents can increase coverage, discover crashes, find exploits, and reproduce narrow failures. LLMs add planning and natural-language action generation, which matters for Immortal Engine because the input surface is prose. But the more the target depends on taste, social meaning, and player trust, the less an AI result should be treated as authority.", "Bodyx"))
story.append(P("What changed recently is not that AI became a perfect tester. It became cheap enough to run many imperfect testers, then aggregate the failures.", "Callout"))
story.append(simple_table(
    ["Technique", "Best use", "Failure mode"],
    [
        ["Scripted regression agents", "Replay known bad paths: open chest, read letter; light pallet, wait; ask who is in room.", "Only covers what you already imagined."],
        ["Random/fuzz agents", "Bang on parsers, movement, object interaction, save/load, impossible actions.", "Finds noise unless oracles are sharp."],
        ["RL/MCTS agents", "Explore mechanics-heavy state spaces, combat, exploits, pathing, balance.", "Needs a reward function. Reward misspecification is real."],
        ["LLM goal players", "Try human-like prose, paraphrases, stubbornness, curiosity, role personas.", "Can hallucinate goals, miss visual issues, and overfit prompt wording."],
        ["LLM judges", "Triage quality: did the DM resolve the intent, stay grounded, avoid filler?", "Not ground truth. Use evidence-anchored rubrics and keep humans in charge."],
        ["Human playtests", "Taste, fun, pacing, comprehension, emotional belief, delight, frustration.", "Expensive and noisy, so spend them after the plumbing is clean."],
    ],
    [1.2 * inch, 2.45 * inch, 2.95 * inch],
))
story += bullets([
    "For ordinary games, the frontier is coverage plus exploit discovery.",
    "For LLM-driven games, the frontier is coherence: did the text, state, rules, memory, map, and consequences stay aligned?",
    "For Immortal Engine, the central test is still THE_DM_TEST: would a competent human DM say or do this at the table?"
])

story += section("2. What AI can replace")
story.append(P("AI can replace a lot of the repetitive labor around finding broken paths. It should be treated like an army of cheap, weird interns with clipboards. Great for volume. Not great for final judgment.", "Bodyx"))
story.append(simple_table(
    ["AI can own", "How to use it in Immortal Engine"],
    [
        ["Seed sweeps", "Run many worlds through the same goals: leave room, inspect objects, talk to first NPC, start trouble, recover from errors."],
        ["Paraphrase coverage", "For every bug, generate 10 ways a player might say it. Lock the intent, not the phrase."],
        ["Known-bug replay", "Every live bug becomes a deterministic transcript test before it becomes a fix."],
        ["State-desync detection", "Compare narration claims against committed world state: fire exists, NPC arrived, letter remains readable, room occupants are real."],
        ["Persona stress", "Rules-lawyer, chaos player, newbie, lore-hound, cautious explorer, speedrunner, malicious parser-bender."],
        ["Quality triage", "Use LLM judges to flag likely DM Test failures, then have a human accept/reject the finding."],
    ],
    [1.9 * inch, 4.7 * inch],
))
story.append(P("A good AI test says: 'On seed tallow, turn 7, the DM said Elske was coming, but no occupancy/event state changed, and wait contradicted it.' That is useful. 'The game seems boring' from an LLM is not useful unless backed by exact transcript evidence.", "Callout"))

story += section("3. What AI cannot replace")
story.append(P("AI cannot tell you whether Immortal Engine is becoming a product. It can tell you whether the machinery is failing. Humans tell you whether the experience is worth caring about.", "Bodyx"))
story += bullets([
    "<b>Fun.</b> AI can produce engagement-shaped words. It cannot feel the itch to keep playing.",
    "<b>Trust.</b> A human notices the moment they stop believing the DM. This matters more than most bugs.",
    "<b>Learning curve.</b> AI does not feel embarrassment, confusion, or the social cost of not knowing what to type.",
    "<b>Voice UX.</b> Humans reveal latency, awkward pauses, interruptions, mishearing, and whether speaking to the game feels natural.",
    "<b>Meaning.</b> AI can score coherence. It cannot tell you if Elske mattered.",
    "<b>Taste.</b> The first 20 minutes need judgment. Does the ordinary morning pull the player forward, or does it feel like a tech demo wearing a cloak?",
])
story.append(colored_box(
    "Do not waste humans on broken plumbing",
    "If the chest forgets the letter, if fire is prose-only, if NPCs leak their want on first sight, if DM text is invisible, do not ask a human tester whether the game is fun. You already know the session is contaminated.",
    "red",
))
story.append(PageBreak())

story += section("4. The right stack for Immortal Engine")
story.append(P("Immortal Engine is not primarily a graphics game. It is a truth-maintenance game with a DM interface. That changes what playtesting means. The hardest failures are not crashes. They are betrayals of reality.", "Bodyx"))
story.append(simple_table(
    ["Layer", "Question", "Owner", "Gate"],
    [
        ["Tier 0", "Does it crash, corrupt saves, break determinism, or violate invariants?", "Node tests, playtest:quick, worldHash tests", "Must be green before handoff."],
        ["Tier 1", "Did the engine commit what the DM claimed?", "Deterministic oracles", "State/prose contradictions are hard failures."],
        ["Tier 2", "Would a real DM say this?", "LLM quality judge plus human triage", "Discovery signal, not auto-fix authority."],
        ["Tier 3", "Can a human understand and want the next turn?", "Tim and naive testers", "Product judgment."],
        ["Tier 4", "Does voice-first feel like tabletop, not command-line parser?", "Live human voice sessions", "Only humans can answer."],
    ],
    [0.75 * inch, 2.2 * inch, 2.05 * inch, 1.6 * inch],
))
story.append(P("The project's existing docs already point this way. PLAYTEST_PROTOCOL says tests prove logic, only playing proves the game. HUMAN_PLAYTEST_HARNESS says the harness gates 'playable', never 'fun'. THE_DM_TEST says the DM resolves intent in fiction. IMMORTAL_INVARIANTS say narration never mutates canon. These are the right principles.", "Bodyx"))

story += section("5. The bug taxonomy to track")
story.append(P("Stop treating bugs as one-off weirdness. Bucket them. Each bucket gets an oracle, a persona, and a replay seed.", "Bodyx"))
story.append(simple_table(
    ["Bug class", "Example from recent play", "What should catch it"],
    [
        ["Prose-only state", "Fire is narrated but look-around ignores it.", "State-desync oracle: claim requires committed hazard/furniture/env state."],
        ["Promised event lost", "Elske is coming, then waiting says no sign of her.", "Pending-event or occupancy oracle."],
        ["Object persistence", "Chest reveals letter, then read denies letter.", "Revealed-object regression."],
        ["Visibility leak", "Who is in the room lists whole town.", "LOS/occupancy tests."],
        ["Private-state leak", "NPC want printed before trust is earned.", "NPC reveal-policy test."],
        ["Invisible UI", "DM text in DOM but clipped off-screen.", "Live browser screenshot plus layout-contract test."],
        ["DM dead-end", "Intent bounced back as mechanics/UI prompt.", "THE_DM_TEST quality gate."],
    ],
    [1.45 * inch, 2.55 * inch, 2.6 * inch],
))
story.append(PageBreak())

story += section("6. Human playtesting, the correct way")
story.append(P("Human playtesting should be structured, but not sterile. You are not trying to make the human behave like a unit test. You are trying to observe what breaks belief.", "Bodyx"))
story.append(simple_table(
    ["Stage", "Who", "Goal", "Stop condition"],
    [
        ["Self-test", "You or agent", "Verify the exact feature visibly works in v1.html.", "Screenshot plus no console errors."],
        ["Naive first 20", "One fresh human", "Can they begin, understand, and care without coaching?", "They ask 'what am I supposed to do?' twice."],
        ["Tabletop pressure", "TTRPG-literate tester", "Do they accept the DM as a DM?", "They say 'a DM would not do that'."],
        ["Chaos session", "Mischievous tester", "Can the world absorb weird intent?", "State/prose contradiction appears."],
        ["Return session", "Same human, later", "Do they remember NPCs, goals, and consequences?", "They do not care what happens next."],
    ],
    [1.05 * inch, 1.2 * inch, 2.75 * inch, 1.6 * inch],
))
story.append(P("During human sessions, do not explain the game. Watch. Let the tester think aloud. Write down exact inputs, exact outputs, and the moment their belief breaks. After the session, classify each break into a bug class. Then automate the repeatable part.", "Callout"))
story += bullets([
    "Ask after the session: What did you think you could do? What did you want to do next? When did the DM feel wrong? What did you remember about the NPCs?",
    "Do not ask: Was it fun? People are polite and the answer is mush.",
    "Do ask: Would you keep playing for ten more minutes if I left the room?"
])
story.append(PageBreak())

story += section("7. A practical cadence")
story.append(P("Use a loop that protects human attention. Humans should see fewer broken builds and more meaningful decisions.", "Bodyx"))
story.append(simple_table(
    ["Cadence", "Action", "Output"],
    [
        ["Every change", "Run narrow regression, adjacent tests, and the relevant harness.", "No known breakage."],
        ["Every playtest handoff", "Full proof ladder from PLAYTEST_PROTOCOL, including visible v1.html walkthrough.", "A build worth playing."],
        ["Daily while building", "AI persona sweep across 3-5 seeds: newbie, chaos, lore, rules lawyer, cautious explorer.", "Fresh bug list grouped by seam."],
        ["Twice weekly", "Human 20-minute session, no coaching.", "Comprehension and desire notes."],
        ["Weekly", "Review bug taxonomy, pick top 1-2 systemic seams, kill them completely.", "Less repeated pain."],
        ["Milestone", "Run saturation harness plus 3 human sessions.", "Playable verdict, not just green tests."],
    ],
    [1.25 * inch, 3.4 * inch, 1.95 * inch],
))
story.append(P("One important product rule: do not run broad human playtests until the first-room loop is coherent. In a tabletop game, the first contradiction poisons everything after it. The player stops treating the world as real and starts testing the machine.", "Callout"))

story += section("8. How to judge a session")
story.append(P("Separate hard failures from product signal. A hard failure is any contradiction, crash, impossible UI, or DM Test violation. Product signal is whether the tester felt agency, curiosity, pressure, and trust.", "Bodyx"))
story.append(simple_table(
    ["Metric", "How to read it"],
    [
        ["Time to first meaningful action", "How long until the player does something they chose, not something the UI forced?"],
        ["Belief breaks", "Count exact moments the tester says or implies 'that makes no sense'."],
        ["Parser friction", "How often do they rephrase because the DM did not understand?"],
        ["State trust", "Do they expect the world to remember fire, letters, NPC promises, injuries?"],
        ["NPC attachment", "Can they name one NPC and what that NPC seems to want without being shown a quest log?"],
        ["Next-turn desire", "After 20 minutes, what do they want to try next? If nothing, that is the product problem."],
    ],
    [1.9 * inch, 4.7 * inch],
))
story.append(P("For Immortal Engine, the north-star human metric is not 'did they finish a quest'. It is: did they believe the DM enough to form a plan?", "Callout"))

story += section("9. The 30-day playtesting plan")
story.append(simple_table(
    ["Week", "Focus", "Done when"],
    [
        ["1", "First-room truth. Objects, fire, letter, NPC visibility, DM text, no private want leaks.", "No known contradiction in the cottage loop."],
        ["2", "First NPC. Approach, talk, ask, press, help, refuse. Wants reveal only when earned or desperate.", "One NPC feels like a person, not a dispenser."],
        ["3", "Consequence chain. Cause trouble, call for help, wait, flee, return.", "The world remembers and reacts."],
        ["4", "Naive human sessions. Three fresh people, 20 minutes each, no coaching.", "You know whether the first 20 minutes pull."],
    ],
    [0.7 * inch, 3.25 * inch, 2.65 * inch],
))
story.append(P("The build should earn a human tester. That is the whole discipline.", "Callout"))

story += section("10. Source notes")
story.append(P("External research used for this guide:", "Bodyx"))
refs = [
    "Zhao and Tang, 'Towards LLM-Based Automatic Playtest' (2025), arXiv: https://arxiv.org/abs/2507.09490",
    "Bergdahl et al., 'Augmenting Automated Game Testing with Deep Reinforcement Learning' (2021), arXiv: https://arxiv.org/abs/2103.15819",
    "Ariyurek, Betin-Can, and Surer, 'Automated Video Game Testing Using Synthetic and Human-Like Agents' (2019), arXiv: https://arxiv.org/abs/1906.00317",
    "Callison-Burch et al., 'Dungeons and Dragons as a Dialog Challenge for Artificial Intelligence' (2022), arXiv: https://arxiv.org/abs/2210.07109",
    "Zhu, Osgood, and Callison-Burch, 'First Steps Towards Overhearing LLM Agents' (2025), arXiv: https://arxiv.org/abs/2505.22809",
    "Google Cloud / Harris Poll developer survey, reported by PC Gamer (2025): https://www.pcgamer.com/software/ai/87-percent-of-game-developers-are-already-using-ai-agents-and-over-a-third-use-ai-for-creative-elements-like-level-design-and-dialogue-according-to-a-new-google-survey/",
    "Live Science summary of D&D Agents at NeurIPS 2025 (2026): https://www.livescience.com/technology/artificial-intelligence/how-well-can-ai-and-humans-work-together-scientists-are-turning-to-dungeons-dragons-to-find-out",
]
story += bullets(refs, "Smallx")
story.append(P("Internal project docs used: docs/PLAYTEST_PROTOCOL.md, docs/HUMAN_PLAYTEST_HARNESS.md, docs/THE_DM_TEST.md, docs/IMMORTAL_INVARIANTS.md.", "Smallx"))
story.append(P("Caution: industry survey numbers are directional, not a substitute for product truth. For Immortal Engine, local transcripts beat broad trend data every time.", "Smallx"))


if __name__ == "__main__":
    doc = make_doc()
    doc.build(story)
    print(OUT)
