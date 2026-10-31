# Naming: the merged phase and the product

The exploration of 2026-10-20 with the person (Lee), recorded so it can be picked up again. The phase's name is ruled. The product's name is open, and nothing here is off the table unless the person said no to it.

## The merged phase: discussion (ruled 2026-10-20)

Research and discussion merged into one phase in the reshape. The design record called it "decision" as a placeholder. It is now **discussion**. The person:

> "I think let's lock in discussion as that first phase. I think it's simple. It is what it is. We are discussing. Yes, we're making decisions… You can have a discussion. You can be in discussion. You can't be in workshop. That implies a place rather than a verb… Research is just part of the discussion process now. Experiment is a separate skill that is invoked from discussion. We splinter off, we do the experiment, then we come back to discussion, and we discuss the results… As a result of discussion, we make decisions."

What else was considered, and what happened to it:

| Name | Outcome |
|---|---|
| deliberation | Rejected 2026-10-13: wrong for what the phase is |
| design | Rejected 2026-10-13: confused with visual design |
| refinement | Rejected 2026-10-13: "We are getting to details, but we go wide and then get to detail. There's nothing to refine at first." |
| decision | The placeholder, never liked: "we really do need a better name for that phase" (2026-10-14) |
| workshop | Held open, then dropped 2026-10-20. It names a place, not something you are in, and "you workshop something, you're sort of throwing the idea around" |
| shaping, groundwork, inquiry, settling | Offered 2026-10-20 and not taken up |

## The product's name (open)

The person, 2026-10-20: "these have grown now into an actual product. They're not just a set of skills, they're a real product, a real way of developing software." It may also stay "the workflows": "I would like to give it a name, but we can safely come back to that."

### What the name is for

The method, in the person's words:

> "It's the cone of collaboration, it's deciding upfront with Claude collaboratively, but using intelligent AI models to facilitate moving relatively quickly, leveraging the intelligence, and adapting a system that grows over time. Where Claude will make decisions on your behalf, but learned from your taste. And then as the process moves to the right, the user is needed less and less, unless under special circumstances… a framework within which to operate for the purposes of software engineering with Claude Code."

### Tests a name has to pass

- **Easy to say, even if said wrong.** "It has to be pronounceable, and it has to be easily pronounceable. Even if it's pronounced wrong, it has to be easily pronounceable."
- **It works where the person says "the workflows"**: "I use the workflows… I've got great ideas for my workflows." With a name, that becomes "I've got a great idea for Sumi."
- **A description can sit beside it**, as a tagline ("an agentic workflow", or better). The tagline describes the product plainly and never leans on the name's hidden meaning: "no one knows what Sumi means. I'd be careful about leaning into that a little too hard."
- **A name already in use elsewhere is no bar**: "I don't really care if it's taken. If I want to use Sumi, then I will."

### Where it stands

- **Decided 2026-10-26: Leeway**, with the tagline "agentic workflows for Claude Code" ("I think I'd like to go ahead and call it Leeway"). The rename goes all the way down with the reshape; the repository is renamed around the release (spec §28.1).
- **Leeway** was liked and parked first (round 12, 2026-10-22): "I like leeway, park it." Remit was a maybe. After round 17: "I think Leeway might be the one, but I don't want to commit just yet."
- **Sumi** was the closest before it: "Sumi is the best of a bad bunch, is what I'm feeling."
- **The direction that came closest** is "someone who acts for you" (round 10). Round 11 dug into it: "Some are definitely a no, some are a maybe. Nothing particularly jumps out." The person hasn't yet marked which. Round 12 turned it round, naming what you give the one who acts for you rather than the person.
- **How deep a rename goes** is decided with the name. The product, the repository, the docs and help are cheap to rename. The rest follows the name: the install (`leeovery/agentic-workflows`), the command typed (`/workflow-start`, which could become `/leeway`), the `workflow-*` skill names, each project's `.workflows/` folder, the state branch `workflows-state` (spec 4.9.1), `~/.config/workflows/` and the `WORKFLOWS_*` environment variables. Before the reshape's build these cost a word: its migration already moves every project's `.workflows/` onto the new state branch and its skills are rewritten. After the release they are a second migration of every project.
- **An observation, not a ruling:** the person's other tools are named for an everyday thing doing the tool's job: Switchboard, Turnstile, Mint, Tick, Portal, SitRep, and Fumi ("note"). The early rounds chased the method's philosophy instead.

### Every option, round by round

"No" means the person said no to it. "No reaction" means it was shown and not commented on, so it is still open.

**Round 1: building to a plan; a way of developing; the partnership.** The person: "I don't really like any of those names. The Japanese angle is of interest."

| Name | Meaning | Outcome |
|---|---|---|
| Keel | the first thing laid; keeps the vessel on course | No |
| Wright | a maker who builds to a plan | No |
| Plumb | true and level | No |
| Michi (道) | the way, the path | No |
| Kata | a form practised until it's how you work | No |
| Tandem | two working together | No |
| Atelier | a master's studio | No |

**Round 2: Japanese, and printing.** The person: "Dandori and Sumi are of interest. Let's keep exploring."

| Name | Meaning | Outcome |
|---|---|---|
| Dandori (段取り) | arranging the steps before the work; "preparation is eight parts, the work two" | Of interest |
| Sumi (墨) | ink; the carpenter's ink line marked before any cut | Of interest |
| Shuhari (守破離) | follow the form, break it, leave it | No (round 3) |
| Nemawashi (根回し) | preparing the roots before a tree is moved; groundwork before a decision | No reaction |
| Tōryō (棟梁) | the master carpenter who designs, marks and directs | No reaction |
| Kaji (舵) | rudder: you steer, Claude rows | No reaction |
| Ryū (流) | a school or style of practice | No reaction |
| Forme | type locked in its frame before the press runs | No reaction |
| Stet | the proofreader's "let it stand" | No reaction |

**Round 3: the cone and learned taste.** The person: "I don't think any of those are right." On pronunciation: Anbai, Shitate and Aun can't be pronounced on sight; Omakase "maybe".

| Name | Meaning | Outcome |
|---|---|---|
| Omakase (お任せ) | "I'll leave it to you": the chef chooses from your taste | No |
| Aun (阿吽) | partners in tune without a word | No (unpronounceable) |
| Shuhari (守破離) | the cone, stage by stage | No |
| Anbai (塩梅) | seasoning, "just right" | No (unpronounceable) |
| Shitate (仕立て) | tailoring, made to measure | No (unpronounceable) |
| Kata (型) | a form practised | No |
| Mise | from mise en place | No |

**Round 4: two syllables, easy on sight.** The person: "No. Those don't really work… why don't we try some names outside of Japanese wording?"

| Name | Meaning | Outcome |
|---|---|---|
| Hanko (判子) | the personal seal; handing it over lets another sign for you | No |
| Kumi (組) | a crew; to assemble | No |
| Waza (技) | technique | No |
| Kiso (基礎) | foundation | No |
| Tenon | the joint that fits its mortise exactly | No |
| Scribe | a joiner's marked line; a record-keeper | No |

**Round 5: English words.** The person: "none of those are right. Steward is maybe the closest, but I don't really like it."

| Name | Meaning | Outcome |
|---|---|---|
| Sous | the sous chef who learns the chef's taste and runs the line | No |
| Steward | trusted to act for you | No, but the closest |
| Reins | loosened as trust builds | No |
| Trellis | a frame that growth follows | No |
| Bench | the workbench | No |
| Gauge | sets the measure | No |
| Cairn | stones marking the chosen way | No |
| Quill | what writes the record | No |
| Score | written in full before it's played | No |

**Round 6: Sumi's sound, Steward's meaning.** The person: "They're all shit."

| Name | Meaning | Outcome |
|---|---|---|
| Seny | Catalan: sound judgement | No |
| Gusto | Italian: taste | No |
| Senno | Italian: judgement | No |
| Modo | Italian: way, method | No |

**Round 7.** The person: "I'm still liking Sumi."

| Name | Meaning | Outcome |
|---|---|---|
| Sumi | also 済み, "settled, done", as stamped on a confirmed form; sumi-e strokes can't be corrected | Still the lean |
| Konomi (好み) | taste, preference | No reaction |
| Kaname (要) | the fan's pivot where every rib converges; "the essential point" | No reaction |

**Round 8: the workshop idea.** The person: "I don't know. Naming things is so hard." Later: "A workshop could be what the whole thing is… But it doesn't quite feel right either. You wouldn't say, 'Let's use the workshop'."

| Name | Meaning | Outcome |
|---|---|---|
| Workshop | the place things are made | Doesn't quite fit |
| Kobo (工房) | a craftsman's workshop | No reaction |
| Bottega | the Renaissance master's workshop, assistants painting in the master's style | No reaction |

**Round 9: an everyday thing doing the job.** The person: "no".

| Name | Meaning | Outcome |
|---|---|---|
| Jig | the guide that holds the work so every cut follows the design | No |
| Jacquard | the loom whose pattern is set on cards before it weaves | No |

**Round 10: the wide net.** The person: "Nothing there really jumps out at me as right. The only ones that got close were the group of someone who acts for you." No reaction to any single name; all stay open.

- **Soft two-syllable names:** Nami (wave), Tomo (companion), Kibo (hope), Tane (seed), Ito (thread), Mori (forest), Kumo (cloud), Kodo (heartbeat), Suji (a line; "it adds up"), Lumo (light, Esperanto), Pluma (pen), Tinta (ink), Vela (sail), Nido (nest), Brio (verve), Alma (soul), Ruta (route).
- **Ink and the written plan:** Nib, Plume, Vellum, Sepia, Stylus, Inkwell, Rubric (the red instructions for running the service), Redline, Snapline (the carpenter's chalk line), Blueline (the printer's proof).
- **The workshop:** Kerf (the width of a saw cut), Datum (the line every measurement is taken from), Dovetail, Mortise, Lathe, Vise, Anvil, Kiln, Awl, Chisel, Bevel, Mitre, Dowel, Trestle, Whetstone.
- **Building to a plan:** Keystone, Formwork (the mould concrete takes its shape from), Scaffold, Lintel, Plinth, Corbel, Footing, Span, Arch.
- **Steering while others row:** Helm, Tiller, Bearing, Heading, Lodestar, Waypoint, Sextant, Fathom (to sound the depth; to understand).
- **Conducting:** Baton, Tempo, Cadence, Downbeat, Motif, Coda, Fugue, Refrain, Segue, Tutti.
- **The kitchen:** Brigade (the crew system cooking the chef's menu), Pass (where the chef checks every plate), Palate, Roux, Larder, Prep.
- **Someone who acts for you** (the group that came close): Deputy, Envoy, Squire, Aide, Regent, Reeve, Proxy, Second, Understudy, Herald, Concierge, Factor.
- **Understanding without being told:** Tacit, Nous, Rapport, Accord, Knack, Hunch, Grain, Instinct.
- **Narrowing to a point:** Apex, Vertex, Crux, Taper, Iris, Aperture, Funnel, Distil, Spire, Focal.
- **A way of working:** Praxis, Method, Craft, Canon, Groove, Ritual, Regimen, Rite, Mode.
- **British, and settled:** Sorted, Bespoke, Shipshape, Squared, Proper, Spruce, Tidy.
- **Birds:** Heron (studies the water, then strikes once), Wren, Rook, Kestrel, Osprey, Magpie, Owl, Raven.
- **Myth:** Minerva (wisdom and crafts), Daedalus, Talos, Ariadne, Mimir, Hermes, Vulcan.
- **One syllable:** Deft, Hone, Whet, Weft, Ply, Rig, Splice, Peg, Notch, Tack, Hew, Pith, Gist, Zest, Verve, Lode, Vane.

**Round 11: someone who acts for you, dug deeper.** The person: "There's some interesting ones there. Some are definitely a no, some are a maybe. Nothing particularly jumps out." Which are which is still to mark.

- **The role, in English:** Deputy, Envoy, Squire, Aide, Regent, Reeve, Proxy, Second, Understudy, Herald, Concierge, Factor, Delegate, Emissary, Legate, Liaison, Attaché, Vicar, Proctor, Trustee, Warden, Keeper, Provost, Purser, Chamberlain, Seneschal, Majordomo, Adjutant, Marshal, Retainer, Surrogate, Factotum (does everything for you), Locum (the doctor who stands in for yours), Lieutenant ("place-holder"), Intendant (the king's agent running a province), Ward (Old English "keeper", the root of steward).
- **The role, in another language:** Banto (番頭, the head clerk who ran a merchant house for its owner), Wakili (Swahili: the agent or advocate who acts for you), Wakil (Arabic: one entrusted to act for another), Vizier, Diwan (the minister who ran a state for its ruler), Munshi (the trusted secretary and scribe), Mantri (Sanskrit: counsellor), Fattore (Italian: estate steward), Castaldo (medieval Italian estate steward), Meier (German manor steward), Vogt (German steward, bailiff), Vilicus (Latin: ran the farm while the owner was away), Procurator, Legatus (an envoy with full powers), Proxenos (Greek: looked after another city's interests; the root of "proxy"), Oikonomos (Greek: the household's steward; the root of "economy").
- **A person who plays the role:** Jeeves, Friday, Mentor (Odysseus left his household in his care), Nestor (Homer's counsellor; Haddock's butler), Sancho, Passepartout, Bunter, Samwise, Watson, Hudson, Carson, Alfred.

**Round 12 (2026-10-22): what you give the one who acts for you.** Claude decides more on your behalf as it learns your taste, so the name is the room it is given. The person: "I like leeway, park it. remit is a maybe. brief is too general and common."

| Name | Meaning | Outcome |
|---|---|---|
| Leeway | the freedom to act on someone's behalf, and how much of it is earned; also "Lee's way", never leaned on | Liked, parked |
| Remit | what someone has been given to decide and do for you | Maybe |
| Brief | what an architect or barrister is handed before acting for you | No: too general and common |
| Mandate | the authority to act for someone | No reaction |

**Round 13 (2026-10-22): the room given, and sailing (leeway is a sailing word).** The person: "We're finally dialled into some space… I'm not sure any of those are quite right, but they're definitely good directionally." Out-of-the-box names that land on something cute are welcome: "It's kind of that out-of-the-box thinking that I quite like, which could cause us to land on a cute name."

| Name | Meaning | Outcome |
|---|---|---|
| Headroom | the room left before a limit: how much Claude may decide before it must ask | No reaction |
| Latitude | the freedom to act on your own judgement | No: "that is a festival near where I live, so it doesn't ring right to me" |
| Purview | the range of what someone has authority over | No reaction |
| Headway | a ship's progress forward, the partner of leeway | "Headway is cool" |
| Sea room | open water enough to manoeuvre safely, away from the rocks | Made the person laugh: "I'm not saying it's right, but it's directionally correct" |

**Round 14 (2026-10-22): sailing, leaning cute.** The person: "Not really keen on the nautical theme." Bosun (runs the deck crew for the captain), Slipway (where a ship is built and launched), Spinnaker (the sail flown when the wind is behind you), Underway, Fair Wind: no, for the theme.

**Round 15 (2026-10-22): everyday words, no sea.** The person: "no, try some more." Shorthand (what collaborators develop: less needs saying), Legwork (the work done for you while you decide), Wavelength (understanding without spelling it out), The Usual (what the barman pours a regular), Wiggle Room (Leeway's cheekier cousin): no.

**Round 16 (2026-10-22): the authority handed over, everyday English.** The person: "These are drifting slightly off-centre now. Need to course correct a little way back." Behalf (decide and build on your behalf), Upfront (the person's own word for the method), Forethought, Sway ("holds sway"), Instead (the wildcard): off-centre, none taken. The centre is round 13's: the room given and the way made, as Leeway and Headway are.

**Round 17 (2026-10-22): back to the room given and earned.** The person: "no." Clearance (permission and room, earned in levels), Allowance (pocket money that grows as you prove yourself), Runway (where speed is gathered before lifting off), Elbow Room, Headstart: no.

### Facts found along the way

- **Sumi is in use** by a Claude Code design plugin (github.com/phazurlabs/sumi, started with `/sumi:start`) and by a dictation app, Sumi Voice. The person isn't bothered.
- **Names in the same space:** Kiro (AWS's spec-driven IDE), GitHub's Spec Kit, Tessl.
