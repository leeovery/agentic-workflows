# Discovery Session 001

Date: 2026-07-17
Work unit: fumi

## Description (as of session)

A smarter macOS Stickies alternative: notes pigeonholed to specific macOS Spaces, remembering exact screen position, with titles and a full pigeon CLI/scripting surface.

## Seed

(none)

## Imports

(none)

## Map State at Start

(empty — first session)

## Exploration

Lee is building **Pigeon Notes**, a smarter replacement for the macOS Stickies app. Context was recovered from a project memory (`pigeon-notes-app`) and its originating session (`a089b04d`), captured earlier the same day when the concept and name were settled after a naming brainstorm (runner-up *Limpet Notes*; "Pigeon" carried over from a now-paused trackpad-switcher app). Repo `~/Code/pigeon-notes`, created 2026-07-17.

The work was shaped as an **epic**: it is a whole application composed of several independently substantial, shippable concerns rather than a single feature. Signals that drove the epic read — multiple distinct capabilities named in the concept, "building an app" / initiative framing, and no collapse toward one coherent topic.

Topic seeds surfaced during shaping (to be synthesised into the discovery map, not yet routed):

- **Space-aware pigeonholing** — notes belong to a specific macOS Space and restore to *their* Space, not whichever is current. The core differentiator vs. Stickies.
- **Exact screen-position memory** — notes reopen at the precise on-screen coordinates they were left at.
- **Titled notes** — notes carry titles (Stickies do not).
- **`pigeon` CLI / scripting surface** — a full command-line and scripting interface so Claude/agents can create and manage notes programmatically.
- **Core note app** — the underlying sticky-note application itself (editing, persistence, window/menu-bar shell) that the above build on.

Engineering-quality expectations for the project are on record (modern 2026-era Swift — actors, Observation, structured concurrency; correctness over speed; no shortcuts).

### Tech exploration (continued)

**Space pigeonholing is the pivotal technical problem, and it forces a distribution decision.** macOS exposes *no public API* to place a window on a chosen Space — public `NSWindow.collectionBehavior` only offers "all Spaces" or "follow to active Space", never "go to Space N". True pinning requires the private CoreGraphics / SkyLight ("CGS") Spaces APIs (`CGSAddWindowToSpace`, `CGSCopySpacesForWindows`/`CGSGetWindowSpaces`, and the persistent managed-space UUIDs macOS keeps in `com.apple.spaces`).

**Decision — distribution: Developer-ID-signed + notarized, direct download (not Mac App Store).** Private-API use is an automatic App Store rejection, so the Store is off the table; the user accepted this without reservation ("we have no choice"). Consequences to carry downstream: self-managed updates (Sparkle likely), notarization in the build/release pipeline, and defensive handling of the private APIs since they can shift across macOS releases.

**Chrome as a proof-of-concept / reference implementation (open question being explored).** User observed that recent Chrome (~last month or two) now correctly restores each profile's windows back to the Spaces they were on before an update-restart — previously it dumped everything onto the current Space (the exact Stickies flaw we're fixing). This matters because: (a) Chrome is *not* App-Store-distributed either, so it has the same private-API freedom we're choosing; (b) Chromium is open source, so its approach is directly readable; (c) it proves the feature is achievable and stable at scale (dozens of windows across 15+ Spaces). Working analysis of *how* and *why it took so long*: Chrome almost certainly records each window's managed-space UUID via the private CGS Spaces APIs at shutdown and re-places windows via the same APIs at launch. The hard part — and the likely reason for years of flakiness — is not the API call but the *launch-time sequencing/timing*: a window can only be moved to a Space that currently exists and is materialized, the move silently fails if attempted before the window is realized or the WindowServer is ready, and there's a visible-flash risk (window briefly appears on the active Space before relocating). Plus edge cases: deleted Spaces, multi-display (Space UUIDs are per-display), and fullscreen Spaces. → Flagged as the core thing the pigeonholing research thread must nail down (read Chromium's implementation for the exact API sequence and timing strategy).

**Decision — deleted-Space fallback: put the orphaned note on Space 1.** When a note's home Space no longer exists at launch, place it on Space 1 (leftmost, the Space the machine boots into) rather than a random/next-available Space, which would feel arbitrary. Space 1 is predictable and always present.

**Second reference for the pigeonholing research: Spaceman (open source, v1.23.5).** The user runs Spaceman to name/label Spaces — menu-bar badges (screenshots): `1:Personal 2:Fabric 3:FV1-91 4:Appian 5:Paragon 6:Harness MCP 7:FinderV2 8:FlowX 9:Folio 10:Workflows 11:Portal 12:Mint 13:DetailLab 14:ACOM 15:Pigeon`. Spaceman is worth reading alongside Chromium in the research thread for how it enumerates Spaces, reads/persists per-Space labels, and tracks the active Space. Note: it only offers "Rename **Current** Space", implying it maps active-space→label at rename time and keeps its own label store.

**Internal note→Space identity = the stable managed-space UUID.** Whatever else, a note remembers its home Space by the OS-level UUID (persists across reboots and Space reordering), never by ordinal position — the "15" in "15:Pigeon" is just today's position and shifts when Spaces are added/removed/reordered.

*(Correction: a prior draft of this log spun up a "how does the CLI/user address a Space by name" design fork off the Spaceman screenshot. The user did NOT request Space-name addressing — Spaceman was offered purely as an open-source research reference for how it enumerates/labels Spaces and tracks the active one. No naming/labelling feature is in scope; removed to keep the record honest.)*

**Decision — Pigeon has NO awareness of Space labels/names, and no coordination with Spaceman (now or planned).** macOS provides no native Space labels; Pigeon will not invent its own, because that would force the user to maintain labels in two apps (Spaceman already does this for them). Pigeon's only relationship to Spaces is: *a note remembers which Space it was in and returns there.* Nothing more.

**Reframe — Space-pinning is a "silent feature that just works", not THE headline.** User's framing: like the recent Chrome behaviour — notes silently pop back into the Space they lived in, across reboots. "I just want it to work." It's one feature of the product, expected to be relatively straightforward, made to feel cool but quiet. (Correcting my earlier characterisation of it as "the headline feature".)

**The agentic surface is where the product's energy is.** User is most excited about driving Pigeon from Claude — "the CLI or the MCP" — to coordinate and create notes, by default in the *current* Space.

**CLI Space-addressing (tentative, thinking-aloud):** default is "create in current Space" (no addressing). Optionally the CLI could accept an *ordinal* flag — e.g. `--space 2` — which Pigeon resolves to that Space's UUID **at call time**, then pins by UUID. Consequence the user explicitly wants preserved: once pinned, reordering Spaces (space 1 becomes space 5) must not break the note — because identity is the UUID, not the ordinal. So the ordinal is only an ephemeral input convenience, never stored. No labels — just numbers resolved to UUIDs.

**Decision — "one engine, two surfaces", designed from the start.** The note operations live once on the always-running menu-bar app (its persistence makes it a natural daemon); both the `pigeon` CLI and an MCP server are *thin clients* over that one operation core, mapping ~1:1 to the same operations. Likely the same binary (`pigeon mcp` boots a stdio MCP server Claude connects to). Sequencing: design for both from day one, ship the CLI first (trivially agent-usable via shell, easiest to test), MCP wrapper follows. Rationale user endorsed: cleaner, and you get both surfaces for nearly the cost of one when the engine is designed first and the front-ends are treated as skins. The app↔client transport (XPC / unix socket / local HTTP) is left as an implementation detail for planning/research, not decided here.

### What a note is

**Decision — note content is Markdown.** Single source of truth that serves both the human GUI and the agent surface (clean to generate/parse, unlike RTF). Rich text (RTF) rejected: it predates Markdown and offers nothing extra for this use case, while making the scripting surface awkward.

**Editing UX (soft):** by default the note renders Markdown *live, as you type* (WYSIWYG). The user can also edit **raw Markdown**, switched via a **rendered ↔ raw toggle** in the menu. A formatting bar (possibly a floating one) is wanted but its details are explicitly **deferred** — flagged, not designed here.

*Complexity flag (for research/planning, not to dive now): true live/render-as-you-type Markdown editing on macOS (Obsidian/Bear-style, hiding syntax markers around the cursor) is one of the meatier GUI pieces — more than a plain `NSTextView`. Called out so planning sizes it honestly.*

**Decision — note identity is a stable per-note UID, fixed for the note's life.** Directly parallels the Space model: UID is the durable identity; the *title* is the human-facing label layered on top. Agent addressing works the same way as Spaces: CLI/MCP accept a title as a convenience *when unambiguous*, and error with the matching UIDs when not; the reliable loop is `pigeon list` (returns UID + title + Space) → act on the exact UID, so Claude never guesses.

**Open — should titles be forced unique?** User unsure. Working recommendation (not yet confirmed): *do not* force uniqueness. Reasons: the UID already provides identity, so uniqueness buys nothing for addressing; forcing it adds friction and breaks natural patterns (a "todo" note on Personal and another on Fabric); and the ambiguity-handling above already makes duplicate titles safe. Adjacent question raised for the same thread: is a title even *required*, or optional with a display fallback (e.g. first body line / "Untitled")?

**Decision — titles are optional, with a display fallback.** Titles are first-class (beating Stickies' anonymous scraps) but not mandatory; an untitled note *displays* a fallback (first line of body, or "Untitled"), so quick throwaway notes don't force a naming step. Not forced unique (see above).

**Decision — agentic disambiguation by reasoning, not hard failure.** Because the CLI/MCP client can be an AI, ambiguity doesn't have to error out. The engine exposes `list` (UID + title + Space + tags, plus a short content preview) and a `read` operation (full or partial note content). When a human/agent says "update the Pigeon note about X" and several match, the agent *reads* the candidates and reasons which is right; only when it genuinely can't decide does it escalate to the user ("there are two — which did you mean?"). This refines the earlier addressing model: the "error with matching UIDs" behaviour becomes the *fallback / human-CLI path*, while the agent path leans on reading + reasoning. Design principle worth carrying: give the agent enough context to resolve ambiguity itself; fail to the human only as last resort.

### Taxonomy, tags, colour (emerging — largely parked for the note-model discussion)

**Tags / taxonomy wanted.** A note can carry *multiple* tags — a classification axis (examples given: personal, business, fabric, individual clients). Multi-valued, so tags are a set per note.

**Open / to sharpen — tags vs Spaces overlap.** The user's Spaces are *already* project/client-named (Personal, Fabric, FV1-91, Appian, …), and the proposed tag examples mirror those. So a real question: are tags a genuinely *different* axis from Space (Space = where the note physically lives; tag = what it's about, cross-Space), or do they largely re-encode the project the Space already represents? This determines whether tagging earns MVP status or is a later add. Parked as the next live thread.

**Colour — wanted, but unsettled (user flagged the tension themselves).** Desire for a colouring system possibly linked to projects/clients/tags. Tension: a note has *multiple* tags, so "colour = the tag's colour" doesn't resolve (which of three tags wins?). Working lean (not confirmed): colour is an *independent per-note visual property* for MVP; a "colour rules" feature that derives colour from taxonomy (with a defined precedence) is a plausible *later* enhancement. Deferred to the note-model / taxonomy discussion.

**Decision (resolves the tags-vs-Spaces question) — tags stay, as a light, cheap classification/filter axis; Spaces and tags are two *optional* organizing layers for two user styles.** The user personally wouldn't lean on tags (they organise via Spaces), but tags earn their place because: (a) they're cheap; (b) they power filtered lists ("show all notes tagged X"); and (c) they are the natural organising axis for users who *don't* use Spaces — a single-Space user organises by tag instead. So tags aren't redundant with Spaces; they're the parallel mechanism for a different user. Tags' natural home is the management UI (filter/group).

**Reframe (deepened) — Space-pinning is explicitly a *side feature*, one optional organising layer, not the product's focus.** "Some users don't even use Spaces." The user uses them and wants pin-on-reboot/relaunch, but it must not dominate design attention. The product's core is the notes + the agentic surface; Space-pinning and tags are two optional org layers layered on top.

### Note-management surface (new area)

**Wanted — a central management UI, launched from the menu bar, that goes well beyond Stickies.** The user finds Stickies "lax" for offering nothing but the notes themselves. Pigeon should provide a central place to **view a list of all notes, organise them, rename them, and filter** (naturally by tag / Space). Menu-bar app is home base; it opens a menu/panel into this.

**Architectural note — the management UI is *another client of the same engine*.** It calls the same operations as the CLI/MCP (list, read, create, rename, delete, move, pin). This extends "one engine, many surfaces" to include the GUI manager — so the note windows, the menu-bar manager, the CLI, and the MCP are all skins over one note engine. Building the engine well pays off across all four.

**Decision — management surface is two-tier.** (1) A menu-bar **quick menu** (new note, jump to a recent note, open the manager) for low-friction access; (2) a full **manager window** (searchable list of all notes, filter by tag/Space, rename, delete, and jump-to-note — bring its window forward, switching to its Space if needed). Investment goes into the window; the quick menu is the fast path. Standard macOS menu-bar-extra pattern (Spaceman behaves the same way).

**Decision (confirmed architecture principle) — four clients, one engine.** The note windows, the menu-bar manager, the `pigeon` CLI, and the MCP server are all clients of a single note engine that owns the operations (list/read/create/rename/move/delete/pin). No duplicated logic across surfaces; engine quality compounds across all four.

### Engine lifecycle — "what happens when the app isn't running" (OPEN — posed, not yet answered; conversation diverted to naming before the user responded)

> **⚠ RESUME MARKER — re-raise this with the user the moment naming concludes.** The user confirmed they never actually read this thread; it was documented from my side only. Nothing here is agreed. Re-present options #1/#2/#3 and the silent-create sub-question fresh, and get the user's real answer before treating any of it as decided.

The menu-bar app can be quit, and notes persist and reappear across relaunches anyway, so the CLI/MCP **cannot assume the engine is running** when invoked. Three options were put to the user:

1. **CLI auto-launches the app, then sends the command** — the app *is* the engine. Clean single-writer / one source of truth. Cost: cold-start latency on first command; the UI wakes up (notes may appear) even when you wanted to script quietly.
2. **Split a headless engine service from the UI** — a small always-on background service owns notes + operations; note windows, manager, CLI, and MCP are *all* clients of it. Purest "one engine", but real extra infrastructure (launch agent, XPC service).
3. **CLI writes straight to a shared store, app syncs when it runs** — simplest offline, but two writers (concurrency headaches) and storage logic lives in two places → breaks the one-engine principle. To be avoided.

**Working lean (NOT confirmed — awaiting user):** option **#1 for MVP** — the menu-bar app is the engine, set to **launch at login** so it's effectively always up, and the CLI/MCP **auto-launch** it if it's somehow not. Keeps one writer, one engine, minimal moving parts. #2 is a clean *future* refinement (for truly silent headless scripting); #3 is actively avoided.

**Sub-question also posed (open):** when an agent creates a note pinned to a Space you're *not* currently on, it should appear **silently** on that Space (non-intrusive), not yank your focus / switch you over. Lean: yes, silent create. Awaiting confirmation.

### Product-name reconsideration (open — "Pigeon Notes" in doubt)

**Why reconsider:** (1) user may rebuild the Spaceman-style Spaces app and would name *that* **Pigeonhole** — pigeonholes = labelled slots, a near-perfect fit for a Space-labelling app — which collides with "Pigeon-*" branding for the notes app; (2) user doesn't want a whole business themed around pigeons; (3) ambition is a small *suite* of macOS apps under one business, so per-app names can differ (shared quality, not shared theme). Ceding the pigeon vein to the Spaces app and giving notes its own name is clean.

**Reframe to carry into the name:** this app is more than "Stickies but better" — it's a **shared human⇄agent notes surface** (Post-it on screen + agent-created/read/updated notes + likely uses not yet explored). The name should stay open-ended, not lock to "sticky note".

**`Jot` — liked, then REJECTED.** Great as a word (noun+verb gesture, "let's jot it down", on-taste). But doubly blocked: (a) `/usr/bin/jot` is a real macOS system command (BSD "print sequential/random data") — naming the CLI `jot` shadows a shipped binary; (b) the note-app namespace is saturated (multiple existing "Jot"/"Jott"/"JotNotes"/"jottie" apps on the App Store).

**Candidates checked clear of macOS system-command collisions:** `slip`, `dit`, `squib`, `chit`, `notelet`, `tally`, `slate`, `nib` (none is an existing command). App-namespace read on **Slip**: some presence (Slips/Notepad, SlipBox) and a "slip-box = Zettelkasten" shadow — usable but slightly crowded/associated. Current leaning shortlist (undecided): **Dit** (RM slang for a yarn/note you tell — personal, distinctive, clean CLI), **Squib** (whimsy + real meaning "a short written piece"; mild "damp squib"=failure connotation), **Slip** (safe-ish, Zettelkasten shadow). Full App-Store/Homebrew clearance still to run on the front-runner(s).

**Work-unit slug stays `pigeon-notes-mvp` for now** — internal handle only; trivially renamed once the product name settles. Not blocking further design.

**Sharpened naming criteria (from user reaction):** must be a **verb AND a noun** — the point is the agentic-era imperative ("Claude, ___ this down") where the app name *is* the verb. Also: short, warm, colloquial, real meaning, ownable (no system-command collision, not a saturated App-Store name), not nautical, not bookish/abstract, not compound-techy.

**Rejected so far (hard no):** Jot (system cmd + saturated), Slip, Dit, Squib, Notelet, Slate, Nib, Chit, Gen, Chalk, Stash, Tuck, Ink, Park, Cue. Two whole seams eliminated: (a) literal "tiny note" words, (b) "put-it-away/store" words. All the new batch cleared system-command collisions but were rejected on feel.

**Next seams to mine (untried):** (1) the *writing verb itself* — e.g. Pen ("pen this"), Mark (verb+noun, and Markdown-native); (2) *message-passing* — Relay/Stamp/Post (keeps the pigeon-post "delivered between human & agent" DNA without the bird); (3) *pure evocative brand we turn into a verb* (how "Pigeon" worked — characterful, not literal). Awaiting the user's steer on which seam before generating more.

**User steer:** writing-verb seam feels overused (only "Drop" would pass there). Live seams are **message-passing** and **evocative-brand**.

**`Drop` / `Dispatch` — dead.** "Drop" was a transcription error for "Jot" (already rejected as overused); the user also finds Drop too close to Dropbox. Dispatch dropped with it.

**Refined lens (the "Nod" pattern) — a warm everyday *idiom* whose word also carries a real note/memory meaning.** Nod works for the sibling because "give it the nod" (approval) doubles with RM "Nods" (recruits). Best fresh candidates for notes on this pattern:
- **Crib** — a crib = a set of notes / cheat-sheet (British), verb "to crib". One syllable, warm, genuinely means *notes*. Noise: baby-crib / cribbage, but the crib-sheet reading dominates in context. Cleared system-command collision.
- **Jog** — "jog my memory": a note jogs your memory. Verb + noun, warm idiom. Downside: the word alone reads as *running/fitness* first, which may mislead. Cleared system-command collision.
- **Nub** — "the nub of it" = the gist / key point; a note captures the nub. Warm, British, distinctive, ownable — but noun-leaning (weak as a verb). Cleared system-command collision.
Still live alongside these: the broader **message-passing** and **evocative-brand** seams. Awaiting user reaction before a full clearance pass.

**Crib / Jog / Nub — rejected (hard no).** User asked to "think a bit deeper".

**Deeper naming thesis (what actually made the good names work):** the names the user loves — **Pigeon** and **Nod** — are *metaphors with a story*, not synonyms for the mechanic. Pigeon: homing/carrier behaviour maps onto notes returning home + messages carried. Nod: "give it the nod" (approval) doubles with RM "Nods" (recruits). Every literal/idiom candidate has failed because it *describes* the thing ("a small note") instead of *telling a story*. So the hunt should be for a metaphor, not a note-synonym. Soul to metaphorise (now pinning is a side feature): **a small message you leave for future-you or hand to your agent — waiting there when you or it come back.** Metaphor territories to pull: (A) *the messenger/carrier* — Pigeon's DNA generalised to human⇄agent (Runner [RM message-runner], Courier, Envoy, Herald); (B) *the persistent marker left in a place* (Cairn — but already rejected in the original naming session — Beacon, Marker); (C) *a fresh animal/behaviour mapping* like Pigeon (a cacher-and-rememberer). Plan: get the user's steer on a territory, then go deep on that ONE rather than spraying lists.

**User sharpened the thesis further:** the problem isn't that candidates describe the mechanic — it's that *everyone* describes the mechanic, so the good descriptive names (Jot = "a perfect name") are all taken. The strategy must be **oblique + story-driven** to find ownable ground. User greenlit all three metaphor territories (A/B/C).

**Oblique candidates — system-command check: all clear** (runner, pony, magpie, bower, blaze, jay, tally, courier, herald, postie, relay, corvid, rook). Known dev-namespace collisions to avoid: Bower (JS package manager), Pony (ponylang + ORM), Courier (courier.com notifications + font), Runner (GitHub Actions runners), Blaze (Firebase plan), Rook (k8s storage operator).

**`Magpie` — REJECTED (category collision).** Great story (corvid gathers & stashes little treasures, remembers where) but there's already **Magpie – Photos & Notes** on the Mac App Store — same word, same category.

**`Postie` — current front-runner.** Territory A (messenger), and the *human* continuation of the pigeon-post idea — the postie delivers your notes. Warm, British, colloquial — squarely in the user's register (hullo/noodle/kudos/nod). App-Store read: no "Postie" notes app found (only Post-it's own apps — a different word). Caveats: not a verb (evocative-brand, like Pigeon — verb-test relaxed in this seam); minor phonetic adjacency to "Post-it" (could read as on-category memorable, or slightly derivative). Full App-Store + Homebrew clearance still to run.

**Oblique alternates still to vet if Postie doesn't land:** Herald (A — messenger, and a genuine verb+noun: "this heralds…"), Rook / Jay (C — corvids/jays that cache-and-remember), Tally (B — tally-mark record-keeping; cmd-clear).

**Nascent-thought seam tried — mostly dead.** Idea: name what a note *is to you* (a half-formed thought caught before it's gone) rather than the mechanic. `Inkling` REJECTED (a note app named Inkling exists on GitHub; the whole "Ink-" shelf is taken — Inkdrop, Inkwell, Inkflow). `Whim` REJECTED (**WhimNotes** — a native Mac markdown scratchpad, near-identical concept). `Notion`/`Muse`/`Spark` dead (Notion app / Muse app / `spark` is a system command). `Postie` REJECTED by user (too close to "Post-it"). System-cmd-clear survivors from this seam: hunch, glimmer, wisp.

**Strategic reality (now explicit):** every warm, short, on-taste *single* word already has a Mac notes/scratchpad app on it (Jot, Slip, Magpie, Inkling, Whim all died in-category). This is the saturation the user named ("everyone describes the mechanic"). Two escape routes worth a decision:
1. **Two-word / qualified product name** — distinctive, dodges single-word saturation (this is *exactly* why "Pigeon Notes" survives where bare words don't). Product name carries a qualifier; CLI stays a short handle.
2. **Accept a cross-category name-share** — pick a word owned in a *different* category (a game, a transit app) but clear in Mac-notes + clearable on Homebrew/trademark. Bar becomes "no dominant collision in *our* category", not "globally unique".

**Question re-opened for the user — is the rename even worth it?** The whole reconsideration is premised on a *hypothetical* future Spaces app ("I *might* rebuild Spaceman, and *would* call it Pigeonhole"). Meanwhile "Pigeon Notes" is already set up, genuinely loved, has a perfect story (carrier/homing = the product), and its two-word form is *more* defensible than every single word that's dying on us. Legitimate to keep Pigeon Notes and just name the future Spaces app something other than Pigeonhole. To be put to the user.

**Surviving single-word candidate this round: `Jay`** (territory C — jays cache food in many specific spots and remember every one: the "Pigeon move", different bird). System-cmd-clear; no in-category notes app surfaced in a first search (needs full clearance). Alternates still un-vetted: Herald, Rook, Hunch, Tally.

**`Jot` — RE-EXAMINED (user still loves it, asked if it's truly impossible). Verdict: more viable than first stated.** Correction to the earlier "doubly blocked" call:
- *App-Store saturation* — the strongest original objection — **largely doesn't apply to us**, because we're distributing **Developer-ID direct + Homebrew, not the App Store** (forced by the private CGS APIs). So being one of many "Jot" App-Store apps barely touches our distribution.
- *`/usr/bin/jot` binary collision* — real but **minor**: `jot` is an obscure BSD number-sequence generator almost nobody uses; a Homebrew-installed `jot` would shadow it. Knowingly shadowing a system binary is a little ugly for a "built right" tool, but near-zero real user impact. Mitigation if it grates: keep the *product* "Jot" but name the shipped *binary* something else.
- *Trademark/distinctiveness* — "Jot" for notes is a **crowded, weak** mark (dozens of small Jots coexist → low legal risk to add another), but the cost is **distinctiveness**: undiscoverable, easily blurred with the pack. That's a brand cost, not a blocker.

**So Jot is not technically impossible — it's a judgment call.** Two clean ways to honour the user's love of it: (a) ship it as **Jot**, accept "one more Jot" + a tiny binary-shadow (fine for an indie/personal tool off the App Store); or (b) anchor a **distinctive pair on Jot** (the way "Pigeon Notes" anchors on "Pigeon") — keeps the beloved verb, becomes ownable. Awaiting user's call.

**Jot pairing (option b) tested — DEAD.** `Jotter` is itself crowded (Jotter!, Daily Jotter, a GitHub Jotter notes app, Handwriting Jotter) and "Jot it down" is an existing minimal note app. Finding: you can't pair your way out because *jot itself is the crowded root* — "Pigeon Notes" works because *Pigeon* is the distinctive half. So option (b) collapses into (a). Recommendation given: take plain Jot and win on execution (Bear/Things/Drafts all share common words), since off-App-Store distribution makes search-discoverability cost small. User: still stubborn, not settled — opened a new brainstorm seam instead.

**New seam (user's physical-desk riff):** typewriters; desktops (leaving notes on people's desks); blackboards/whiteboards, teacher⇄pupil notes; Polaroids + notes from his girlfriend clipped into a Rubik's Cube on his desk (+ kids' photo); the reMarkable beside him. Emotional truth extracted: *the best notes are ones someone leaves FOR you* — which is also the agentic story (Claude leaves notes on your desk; you leave notes for future-you).

**Candidates mined from that seam (system-cmd + in-category vetted):**
- **`Peg`** — CLEAR both checks. Pegboard above a desk; clothes-peg warmth; **verb+noun** ("Claude, peg that for me"); "peg a note to a Space" describes the pigeonholing mechanic without the bird. 3-letter CLI. Downsides: minor British slang "peg out"; common word.
- **`Billet`** — CLEAR both checks. Story-density jackpot: RM meaning (your *billet* = your assigned quarters — billeting a note to a Space IS the feature), plus *billet-doux* = a little love note (literally the girlfriend's clipped notes). Verb+noun. Downside: the note meaning is archaic/French; most people know neither meaning (Nod has the same property and it's fine).
- `Blotter` (desk blotter + police blotter = daily record; noun-only, musty) and `Ding` (typewriter bell; sound-word in the tick/hullo family; weak note-meaning) — texture, weaker.
- `Carbon` dead (dev collisions incl. a local composer binary; old Mac Carbon API).
**Peg / Billet — REJECTED hard.** Peg: fatal sexual-slang meaning (pegging) — a vetting miss on my side; slang/urban meanings must now be vetted BEFORE presenting any candidate. Billet: user finds the word gross. Also received and logged standing feedback: no superlative pitching ("cleanest/best we've found all day") — present candidates flat with honest downsides only.

**Round: Scrawl dead (existing Mac notes app by Cocoatype). Remaining vetted candidates presented flat:** `Fridge` (clear cmd + in-category; where families actually leave notes for each other — maps to the girlfriend/kids thread; whimsy-with-real-meaning register; noun-only, mildly jokey), `Minute` ("minute it" = British verb for formally noting something; verb+noun; time/meeting-app confusion risk), `Docket` (a docket = small note/label attached to a thing, + your list to handle; verb exists; bureaucratic flavour). Also offered: parking the name hunt entirely and resuming discovery (engine lifecycle first per resume marker) — the slug doesn't block anything.

**Round: Fridge/Minute/Docket — all rejected ("shit").** Creature round: **Limpet re-surfaced** (the user's original runner-up, in-category clear, home-scar story intact) — **rejected**: "limp-it" phonetics, "limp" is an ugly syllable; cheesy. Jay and Squirrel drew no interest. Read on the pattern: the user engages with characterful creature/gesture words (his own products: tick, hullo, kudos, nod, noodle) and rejects all desk-object nouns. New sub-seam opened — *human gestures from his own naming family*: **`Wink`** (gesture-word sibling to Nod — "a nod and a wink"; "tip someone the wink" = covertly pass info, which is the note-passing story; cmd clear; caveat: **WinkNotes** flashcard app exists on the App Store — adjacent-word collision, different sub-category), **`Nudge`** (a nudge IS a reminder; verb+noun; cmd clear; caveats: "Nudge" is a known Mac-admin OS-update nagware tool, and small reminder apps cluster near the word), **`Jackdaw`** (corvid that collects small treasures; cmd clear; UK-education "Jackdaw folders" resonance; two syllables, less in-family). Presented flat, awaiting reaction.

**Round: Wink/Nudge/Jackdaw — rejected.** Follow-ups vetted and self-killed before presenting: `Psst` (jpochyla/psst is a known open-source Spotify client — binary + name mindshare taken) and `Murmur` (Mumble's VoIP server daemon is literally named murmur). **~35 candidates now dead across 12+ rounds.** Observation put to the user plainly: the only two names he has ever actually loved are **Pigeon** (kept for the other app) and **Jot** — and he was already "leaning A" (ship as Jot) before the B-test collapsed; every candidate since has implicitly lost to Jot. Recommendation: stop generating; choose between (1) commit to **Jot**, (2) **keep Pigeon Notes** (the rename trigger is a hypothetical future app), or (3) **park naming**, resume discovery (engine-lifecycle resume marker first), let it breathe between sessions.

**User rejected the convergence call ("consumed the entirety of the English language?") — hunt continues.** Acknowledged the overreach; new round from untried territory (all cmd-clear, Ditty in-category clear — only prior Ditty was a defunct music-parody app):
- **`Ditty`** — Royal Navy/RM **ditty box**: the small box where sailors keep letters from home, photos, keepsakes — the exact thing the user's Rubik's Cube with his girlfriend's notes is. A ditty is also a short simple verse; adjacent to RM "spin a dit". Warm -y ending (noodle family), 5-letter CLI. Caveat: user rejected "Dit" earlier (batch context, different story); "Ditty" leans twee for some ears.
- **`Crumb`** — Hansel & Gretel breadcrumbs: small things deliberately left to find your way back — notes scattered across Spaces as a trail home. UI "breadcrumbs" adjacency is semantically supportive. Caveats: noun-only; "crumb" alone can read as insignificant/dirty-plate.
- **`Cuff`** — "off the cuff" comes from literally jotting notes on your shirt cuff — the original quick-capture-on-your-person. Verb+noun, 4 letters. Caveats: handcuffs/police reading; "cuffing season" slang; the note-origin story needs telling.
Presented flat; awaiting reaction.

**Round: Ditty/Crumb/Cuff drew no bite; Scribble/Doodle/Squiggle/Noodle all rejected** (Scribble: crowded + Apple owns "Scribble" Pencil feature; Doodle: means drawing + doodle.com + slang; Squiggle: hard to say/type; Noodle: his own, spoken-for). *Delivery incident:* two verdict messages didn't render for the user despite being persisted in the jsonl — re-sent via SendUserMessage; standing feedback logged ([[feedback-verify-before-disputing]], [[feedback-no-superlative-pitching]]). Model switched Fable 5 → Opus 4.8 mid-hunt.
- **`Locket`** — cmd clear; **no notes app** in-category. Story matches the user's own riff exactly: a locket holds a tiny kept note/photo of someone you love, close to you (his girlfriend's notes clipped in the Rubik's Cube). Caveats: cross-category collision with **Locket Widget** (popular iOS photo-sharing app) — not notes, but real mindshare; 2 syllables; not a verb.
- **`Shout`** — cmd clear; no notes app in-category. British idiom "give us a shout" = tell me / leave word; verb+noun. Caveat: very common word across other categories (stain remover, karaoke), so brand-noisy though clear in ours.
- **`Wren`** — DEAD (getwren.app is a Mac time-tracker; + Wren carbon-offset co). **`Tot`** — DEAD in-category (Iconfactory Tot is a known Mac scratchpad).

**MAJOR DIRECTION UNLOCK — user is now open to a coined / made-up word.** Sparked by riffing off the word "idiom" (→ iddy/idio/iam, all rejected, but the *realisation* stuck): the name needn't be a real word — it can be an invention that *feels like* the art of making/keeping/leaving/sharing/sticking notes. This sidesteps the whole in-category saturation problem (can't collide with a word that didn't exist). Constraint still holds from [[lee-background-naming-taste]]: warm/whimsical with a *whiff* of real meaning underneath — NOT sterile-techy (no -ly/-ify/compound). `Locket` still "interesting" (real-word option kept alive).
Coined palette, all cmd-clear + not accidental products: **Jotto** (jot + warm -o; keeps the beloved "jot" sound, ownable), **Jottle** (jot + soft -le of the words he circles — noodle/doodle), **Jotkin** (jot + British -kin diminutive: lambkin/pipkin → "a little note"), **Memmo** (memo softened/doubled; caveat: memo phonetic space is busy), **Notchy** (clear). **`Mote` DEAD** (Motes - modern notes app). Presented flat, asking which *sound/feel* is closest so the next batch iterates in that exact vein rather than scattering. Great evocative word, but (a) fails the verb test the user now prizes (can't "mustard" a note), and (b) "cuts the mustard" = *meets the standard* — a **review** meaning that fits the sibling product, not notes.

**Context — sibling product `Nod` (confirmed by user).** A human⇄agent **code-review surface** (Mac app + TUI + CLI + MCP — same multi-surface-over-one-core architecture as this app). Part of the same intended suite. Mustard was a naming runner-up there. Relevant because the two products share architecture DNA and a house naming style (short, warm, colloquial).

**NAMING — extended brainstorm (compressed status).** ~28 rounds, ~120+ candidates vetted. The Mac-notes category is brutally saturated — real words, oblique words AND coinages are all being claimed in real time by AI-notes startups (killed in-category: Jot, Slip, Magpie, Inkling, Whim, Jottle, Jottie, Nottle, Jotty, Pane, Foolscap, Loci, Eyrie, Vellum, Nota, Pyxis, Remark, Memento, Mnemo, …). Per-candidate vetting protocol: `which` (system-command collision) + in-category App-Store web search + slang check (mandatory — "Peg" failed on slang, a miss). **User's rules (from reactions):** warm/short/his register (tick/nod/hullo/pigeon/mustard/noodle); NOT cutesy-silly (rejected sprat/butty/dollop/newt/poppet); NOT random/off-subject (rejected pigments/larder/annal/sanctum — "what have they got to do with the subject?!"); MUST relate to notes/writing/keeping. Off-App-Store distribution softens crowding (brand cost, not a blocker). Present flat, no superlative pitching ([[feedback-no-superlative-pitching]]). **★ DECISION — PRODUCT NAME: `Fumi`.** (Japanese 文 = writing / letter / note — on-subject at the root.) Chosen from the shortlist after a pressure test. Reads "FOO-mee". Accepted tradeoffs: reads as a Japanese girl's name at first / Italian *fumi* = "fumes"; and a cross-category collision with **Fumi Technology** (Chinese fintech software co, trademarked) — user accepted, since it's clear in Mac-notes and on the command line.
**Ripples for later phases (NOT done yet — implementation/housekeeping):** CLI `pigeon` → **`fumi`**; README currently says "Pigeon Notes" / repo `pigeon-notes` / CLI `pigeon` — update to Fumi; bundle id + app-support path (`~/Library/Application Support/Fumi/`); Bonjour service type; the work-unit slug `pigeon-notes-mvp` can be renamed to `fumi-mvp` later (trivial, not blocking). Shortlist runners-up (dropped): Notu, Fiche, Fuda, Satsu, Ficha, Bureau, Membo.

**★ DECISION — ENGINE ARCHITECTURE (decided on merits, explicitly NOT "MVP/speed").** The engine is a single **always-running `LaunchAgent`** (`LSUIElement`, launch-at-login, does NOT quit when note windows close) that owns the data model, storage, the note windows, AND the private-CGS Space-pinning, and exposes a **local socket**. The `fumi` CLI and `fumi mcp` server are thin clients over that socket. Reasoning: (a) a persistent engine means scripting never cold-launches a GUI — one writer, one source of truth (the user's option-2 instinct, which won); (b) but a *pure* headless daemon can't own or move Fumi's own note windows — CGS window ops act on the caller's own windows, and a pre-login `LaunchDaemon` can't draw — so we do NOT split the window-owner from the engine; they are one always-on agent. Rejected: option 1 (CLI cold-launches the app on demand — wrong for a scripting-first product); option 3 (CLI writes the store directly — two writers + duplicated storage logic). **Precedent:** `yabai` (does the exact private-Spaces/SkyLight window manipulation we need; runs as a launchd service driven by a socket CLI — reference implementation for our hardest part), Ollama (Mac app + CLI over an always-on local server), Docker/Tailscale/espanso (daemon + thin clients). **Sub-decision:** agent-created notes pinned to a Space you're not on appear **silently** on that Space — never pull focus. → Engine-lifecycle RESUME MARKER (above) is now resolved. **Loved-but-blocked: `Jot`** (crowded + shadows `/usr/bin/jot`; viable off-store if user accepts). `Pigeon Notes` = OUT (user firm), `Locket` = OUT. Hunt ongoing.

### Billing / commercialization (new area)

**Framing — off the App Store means Fumi owns the entire payment + licensing stack.** No Apple IAP; licensing/activation lives in the always-on app itself. So the business model isn't a bolt-on — it can shape the app. (A Merchant-of-Record like Paddle / Lemon Squeezy is the standard solo-dev play for handling global VAT/sales-tax on direct sales — noted for later, not decided.)

**Decision — one-time purchase + paid major upgrades.** No subscription — user is firmly uncomfortable charging recurring for a utility of this class. Model: buy a major version once; pay again (discounted) for the next major version (Sketch/Bartender-style). Rationale carried: this funds the *perpetual maintenance* the private CGS/SkyLight APIs force — they shift every macOS release (flagged upstream) — without a monthly charge users would resent for a stickies-class tool. The cost structure is genuinely recurring even though the product feels one-time; paid upgrades reconcile that.

**Decision — no lifetime tier at launch.** User floated it, then doubted it ("too similar"). With a one-time base model a standard purchase already IS lifetime access to *that major version*, so "lifetime" only coheres as an "all future major upgrades free forever" tier — which is exactly the buyer you must maintain private CGS APIs for forever with no future revenue, re-opening the maintenance treadmill the paid-upgrade model just closed. Skip at launch; addable later, not cleanly removable.

**Decision — no cloud services planned (for now).** Not envisioned yet; revisit if it pans out. No sync/hosting cost to fund, which reinforces one-time over subscription.

**Decision — the licensed unit is the one always-on app; the "engine vs GUI" licensing question is moot.** Clarified by the user: Fumi is NOT a headless/terminal product — the GUI (the floating notes on screen) IS the product; without the notes there is nothing. The always-on menu-bar app and the note-window/engine are one process (already decided upstream: the window-owner can't be split from the engine). So "license the engine" and "license the GUI" are the same enforcement point. CLI and MCP are thin clients that do nothing unless that licensed app is running (they only talk to it over the socket). Consequence: the earlier "free Homebrew CLI is a piracy surface" worry **dissolves** — the CLI is inert without the running licensed app. One licence check, in the one process. What you buy: the app (menu-bar presence + on-screen notes + the CLI/MCP ability to drive it, e.g. "Claude, update my Fumi note about X").

**Decision (soft) — price ~$19 one-time (tweakable), + discounted major upgrades.** User chose "cheap & frictionless" and initially floated $9.95, but moved off it: off-store has no App-Store impulse funnel, Merchant-of-Record fixed fees (~5% + ~$0.50/txn) bite harder at low prices, a ~$5 major-upgrade isn't worth the checkout friction, and $9.95 undersells the craft. Reframe accepted: the frictionless lever is a *trial/taste*, not a rock-bottom price — so the price can sit at ~$19 and still feel low-barrier. Explicitly a tweakable number.

**Free tier / gating — PARKED (revisit after feature discovery).** Explored freemium (free-forever-limited) vs a time-boxed trial. Key tension the user surfaced and I agree with: if free = *unlimited manual stickies + Space-pinning* (my earlier lean), the tool is **too complete without Claude** — non-AI users get the whole thing free and never upgrade; only the Claude layer drives conversion, which is too narrow a wall. Root problem: the current premium set is basically just "the AI surface" — too thin to gate on. More premium-shaped features are likely to surface during feature discovery (unknown as yet), fattening the paid tier so the gate isn't AI-only and the free tier can stay genuinely good without giving the store away. → **Defer the exact free/premium boundary AND the "how generous is free" question until discovery reveals more premium candidates.** (Rejected earlier as the *primary* lever: a raw note-count cap — stingiest possible limit on a notes app; invites 1-star/uninstall, not upgrade.)

**Decision (mechanism) — taste-of-premium is USAGE-METERED, not calendar-metered (Moshi-style countdown).** Reference: Moshi (a mobile terminal app) grants full premium but with a consumption countdown (~10) that decrements on each premium-feature use; at zero it locks until you pay. Adopt this pattern as the conversion mechanism: let users *feel* premium, then *feel the pinch* when it's removed — the pain of losing it is the upgrade trigger. Why usage-metered beats a 14-day clock for Fumi: it fits an always-there ambient utility (no jarring countdown that kills the app), a light user isn't rushed, and a heavy user hits the wall exactly when most hooked. It also resolves trial-vs-freemium — the metered countdown *is* the trial, measured in value delivered rather than days elapsed. Orthogonal to the (parked) gate-axis question, so the mechanism can be locked while *what's* premium stays open. **Caveat to carry:** a countdown naturally counts *discrete actions* (agentic CLI/MCP calls fit perfectly — one op = one tick); a *passive/ambient* premium feature isn't "used" in countable events and would need a different taste mechanism (time-boxed unlock or visible-but-locked teaser). So the metered model gently biases the premium set toward action-shaped features.

**Product principle (north star) — deliver genuinely great value.** The goal is the best-in-class Stickies alternative: the most stable, clean, easy-to-use, enjoyable note system of this type. Monetization sits *on top of* a product that's actually worth it — the free tier must be good, and premium must be compelling enough to justify gating. This is *why* the cannibalization worry is real here (a great free tier is easy to build) and why the paid tier needs real depth beyond the AI layer.

### App shell — menu-bar-first, dock optional (fixes a Stickies annoyance)

**Decision — Fumi lives in the menu bar (LSUIElement), NOT the dock by default, with an option to *also* show a dock icon that the user can toggle off.** Specific Stickies gripe: Stickies occupies a dock slot for something you want present-but-unseen. Fumi should be ambient — there when needed, invisible otherwise. Dock presence is opt-in. Consistent with the LaunchAgent/LSUIElement engine decision. The menu bar surfaces config/options (the "quick menu" tier); the real product is the notes on screen, driven by GUI, CLI, or MCP.

### The note as an on-screen object (new area — the primary surface)

Framing agreed: the floating note is *the* surface — everything else (CLI, MCP, manager, menu bar) is plumbing around it. Aesthetic north-star: a note is **furniture**, not an app window — calm, unobtrusive, part of the desk, beautiful in a quiet way; never demands attention.

**Decision — existence vs visibility split; close = hide, delete = explicit; NO prompts.** A note's *existence* (in the store, listed in the manager, addressable by CLI/MCP) is independent of its *on-screen visibility*. Closing a note hides it — it still exists and is reopenable — it does NOT delete. Mirrors the standard macOS "close window ≠ quit app" pattern. The on-screen set is a *view* onto a subset of notes, not the notes themselves.

**Decision — autosave, ALWAYS (keystone).** Every keystroke persisted immediately. This is the root fix for Stickies' most-hated behaviour: Stickies uses the unsaved-document model, so closing always throws the "unsaved changes" prompt (like a dirty Word/Excel doc). Autosave means nothing is ever unsaved → close is silent, no prompt, ever. User: "really important to me." General principle: no prompts popping up. Autosave is *what makes* close=hide feel weightless.

**Decision (proposed, pending user) — delete = reversible soft-delete + "Recently Deleted" bin, NOT a confirm prompt.** Consequence of the two decisions above: with no prompts and always-autosave, `delete` is the *only* destructive action left, and its safety can't be a confirmation dialog (user hates prompts) — especially risky if delete sits one click deep in a per-note corner menu (easy accidental tap). Resolution that honours "no prompts": deleting moves the note to a Recently-Deleted bin silently, with an undo toast / restore-from-bin, purging after N days. Zero prompts *and* zero fear — the same generosity as close=hide, applied to delete. → awaiting user confirmation.

**Decision — per-note menu via a small corner icon on the note itself.** Each note carries a small menu affordance (corner icon) → per-note actions and appearance controls: font style, colour, position, size, fix-on-top, delete. This is where per-note visual settings live.

**Decision — always-on-top, per note. Standard name = "Float on Top".** Essential (user: "we should be able to fix on top"). Uses the standard macOS term **"Float on Top"** (what Stickies itself calls it) / "Keep on Top". Menu item = "Float on Top"; CLI verb = `float`. **Terminology — "pin/pinned" is REJECTED and dead across the whole product (GUI + CLI).** Origin of the confusion (owned): I used "pinned" loosely for two *different* things, neither real: (a) always-on-top (the one real feature — now "Float on Top"), and (b) "locked to a position/preset" — which is NOT a thing: presets *place* a fumi but never lock it; you drag it freely afterwards and it remembers the new spot. There is also NO "pin to a Space": a fumi is *moved* to a Space (`fumi mv --space N`) and simply remembers it. No pinning concept exists anywhere in Fumi — a fumi floats, is dragged, and presets are quick-placement shortcuts only.

**Editing = open + edit + close.** No separate save step (autosave); editing a note is just opening it, typing, and closing (hiding) it again.

**Manager (reconfirmed + extended).** Modern macOS Liquid-Glass chrome. A list of all notes: drag to organise, rename, reopen, delete. Shows each note's Space. Reopen options: open in the note's *original* Space, or open in the *current* Space. Reallocate a note's Space from the manager. Reconfirms upstream Space rules: a note lives on exactly ONE Space at a time; remembers its last Space by managed-space UUID; if that Space is gone → drops to Space 1; move-between-Spaces supported; a note appearing on a different Space is updated accordingly.

**Positioning reinforcement — Space allocation is a clean bolt-on, NOT the headline.** Sits cleanly alongside title / tag / label as just-another-nice-attribute you set on a note. Huge for the user (and other Space-users) but deliberately presented as one great feature among many, not the product's face. Consistent with the earlier "silent side feature that just works" reframe.

**New ambition — on-screen tiling / arrangement (FLAGGED, separable, likely a layer above the core note window; probably not first-cut).** Wants built-in arrangement of notes on screen: tile together, Post-it-size, stack in a corner, layer on top of each other. Specific personal want: a thin, full-height strip of notes down the left screen edge, always present. Acknowledges 3rd-party tiling managers exist but wants it built in. Two things to carry, un-designed:
- **Tension:** tiling collides with the exact-screen-position-memory decision — free-floating notes remember precise coords, whereas tiling is a *managed layout* that overrides manual position. Need to reconcile how free-position and managed-layout coexist (a *mode* you snap into, with free-float as default? what wins on conflict?).
- **Reframe:** the "thin left strip, always there" reads less like snapped stickies and more like a *distinct presentation mode* — a persistent notes **rail** down the screen edge — possibly its own surface, not just neatly-arranged Post-its.
Parked as a design thread; not core-window behaviour.

**Delete — RESOLVED (user walked the framing back and forth, landed here).** Two separable things: (1) **mechanism** — deleting a note moves it to a **Recently Deleted** section, from which the user can **restore** or **permanently delete** ("hard delete") it. Valued as a *standalone feature* (recoverability), NOT as a way to avoid a prompt. **No automatic cleanup / no auto-purge** — lightweight; notes sit there until manually cleared. (2) **prompt** — a deliberate delete SHOULD still show a **confirmation prompt**; confirming a destructive act is respectful/expected even when recoverable. Add an optional **"Don't show this again."** → Corrects my earlier "soft-delete *instead of* a prompt" framing. The refined principle: **not "no prompts ever" — rather "no *unnecessary* prompts; the everyday default is *close* (silent, autosaved); a deliberate *delete* is confirmed once (dismissible)."**

**Tiling — CORRECTION (user: my "managed-layout vs free-float tension" was wrong; retracted).** Tiling / window-management is NOT an alternative positioning model — it's a **convenience for setting a note's position + size**. The user (or Claude) picks a **preset** (built-in, and possibly user-creatable) — e.g. "far-left, full-height, ~2-inch-thick strip" — and the note is moved/resized to it. The result is an ordinary free-floating note with remembered coordinates: drag it afterwards and it remembers the new spot, exactly like any other note. It produces the *same* free-float + exact-coord-memory, just faster. Post-it-size, corner-stack, left-rail, etc. are all just named position/size shortcuts — no conflict with position-memory. **Consequence worth carrying:** presets become a first-class concept — built-in + user-creatable, ideally **addressable by name from CLI/MCP** so Claude can place notes ("put this on the left rail"). Ties the positioning system to the agentic surface. (Multi-display / per-Space resolution of a preset like "full-height left" is an implementation detail, flagged earlier.)

**Product soul — RE-SHARPENED (important). Fumi is NOT "a better Stickies."** macOS Stickies already resizes and moves notes, so "Stickies-but-nicer" is not the pitch. What the user actually wants: **annotate / label your Spaces (workspaces) with your current working context — what you're thinking about, what you're working on right now — authored by both you AND Claude.** Notes-as-workspace-labels. The "thin, always-there left rail" want is this idea made physical (persistent context down the edge of each Space). **Positioning nuance to hold, not resolve:** Space-pinning stays "one clean feature among many" for *market* positioning, but *workspace-context annotation* is the user's personal killer-use — hold both without forcing a contradiction (the session has oscillated on whether Spaces is a side-feature or the point; the reconciliation is "quiet market differentiator" ↔ "personal core use").

### Positioning / audience / use-cases (new area)

**Product principle — "does its job really f***ing well," explicitly NOT revolutionary.** Position Fumi as a clean, polished, functional tool that does its job really well — everything expected just works, pin-to-Space included (quietly, "you don't think about it"). NOT pitched as special / legendary / next-big-thing. Deliberately modest: a small tool for a relatively small subset of people; the user is happy if it only benefits them, happy with "a few hundred pounds" from a few happy users. Cool / fun / useful / important — yes; revolutionary — no. Guard the whole design/marketing against inflating anything.

**Space-pinning is deliberately de-emphasised in positioning — market hygiene, not indecision.** Over-emphasising Space-linking would alienate the (large) subset of Mac users who live in a single Space and won't care. So Spaces stays "one clean feature among many," never the product's identity. This resolves the earlier side-feature-vs-headline oscillation: the de-emphasis is an intentional inclusiveness choice.

**Positioning intent — clarified (NOT multi-vertical go-to-market).** No per-profession landing pages, no separate pitches. Intent is: (1) **research the range of use-cases / professions** so the *single* landing page can call out a few relatable example groups — enough that a student / lawyer / etc. self-identifies ("ah, this'd work for me") — without overstating; (2) more importantly, **look at the tool through different professionals' eyes to harvest design input** — their priorities differ subtly from an engineer's, and seeing those differences makes the core tool more versatile/useful for a wider audience *by design*, not by marketing. Single avatar at the centre = the user (engineer living across Spaces with Claude in the loop); everyone else is served because the core is general.

**Sharpening — the gold is the *priority differences*, not the persona list.** That's where features/defaults surface that an engineer-only lens would miss. Method examples (illustrative, not an enumeration): a **lawyer** → confidentiality first ("do my notes leave this machine?" — coincides with the no-cloud lean, so *confirms* an existing call); a **doctor** between patients → dead-fast capture over organisation; a **student** → longevity (notes that survive a semester, not a session). Each is a potential feature/default, not a market segment.

**Routing note (for harvest):** this area is research-shaped — user explicitly said "do the research." Likely routes as *research* rather than discussion at the harvest. Noted, not decided.

### Storage / backup / sync (new area — revises the earlier "no cloud" lean)

**Reopened the "no cloud services" lean — sparked by the student / non-technical persona** (they won't think about backups until they lose everything; saving them from that pain in a way that "just works" is a win). Outcome: NOT a hosted cloud, but a **file-based store with a user-chosen location**.

**Decision — Space-homing degrades across machines for FREE (no special handling).** Corrects my over-flag: a synced/restored note keeps its managed-space UUID; on a different Mac (or after an OS reinstall) that UUID simply isn't in the machine's managed-spaces set, so the **already-decided "home Space gone → Space 1" fallback** fires automatically — same code path as a locally-deleted Space. Note *content* (Markdown / title / tags) ports perfectly; Space-homing degrades quietly. On-brand (notes are the value; Spaces is the bonus). No cross-machine remap logic to build.

**Decision — storage is a single file-in-a-folder store; the user picks the folder. Backends = "drivers + settings".** Key sharpening: **iCloud Drive, Dropbox, Google Drive, and plain local folder are the SAME driver** — each is just "a folder on disk that syncs itself"; Fumi writes Markdown to a path and the service handles sync invisibly. So one file-in-a-folder store covers all of them at once, essentially free (Markdown-on-disk was already chosen). The only genuinely-separate drivers are **network backends (SFTP, hosted API)** — real transfer code — deferred. Start simple: ship the folder store (iCloud / Dropbox / Drive / local in one go); add SFTP / hosted later.

**This serves all personas + costs the dev nothing.** Student → point at iCloud (or default there): automatic backup / restore / multi-Mac on Apple's infra, zero servers. Lawyer → local / own encrypted store: confidentiality intact. Dev → runs no infrastructure, holds no one's data. Crucially it does NOT reintroduce the subscription the user rejected — "cloud" as a premium shrinks to a *convenience* (one-click "use iCloud" setup) or nothing (just a setting). Precedent: Obsidian (local Markdown, free iCloud/Dropbox sync, optional paid managed-sync only if wanted). A hosted turnkey **Fumi Sync** subscription remains a *possible deliberate later product*, not needed for a first cut, and not something the dev should run lightly (ops + liability, esp. holding confidential notes).

**Carry (do NOT solve now) — concurrency / conflict for LIVE multi-Mac.** Folder-sync + always-autosave + the always-on single-writer engine is clean for backup and single-active-machine restore. But two Macs *live* on the same synced folder = two engines writing one store across machines (the multi-writer problem again), which folder-sync services "resolve" with `note (conflicted copy).md` files. So backup/restore is safe now; a *live multi-Mac* story needs a real conflict-resolution design later. Flagged.

### Note window — appearance / material / colour (new area — the primary surface's look)

Anchored to the "furniture, not app window" north-star: a note at rest is calm, quiet, part of the desk.

**Direction — chrome is minimal / near-frameless; controls appear on hover.** No permanent heavy header (Stickies has a chunky coloured title bar with close box + fold triangle). At rest the note is just material + text; the committed controls (per-note corner menu, close) hover-reveal and recede. Plays with the earlier *titles-optional-with-first-line-fallback* decision: in the calm state there's no dedicated title bar — the first line *is* the visible title. Drag from anywhere; resize from edges (invisible hit zones). *(Proposed; not objected.)*

**Direction — default material is native macOS glass (Liquid Glass), NOT "one of five options".** Glass = the calm, native, 2026-Mac, furniture look; the manager window already uses it. So glass is the *default that expresses the product*, and solid "paper" / muted colours are variations. Confirmed feasible (current SwiftUI design language). *(Proposed; user is engaging within the glass frame — wants "chrome that matches the new Mac look with a glass effect".)*

**Decision — opacity is a user option, default effectively OFF (solid).** User personally prefers no translucency; the ghosted look (ref: "Ghosty"/Ghostty-style) is a valid minority taste, so it earns a slider but not a default. ~1–2% is usually plenty. Keep the slider; ship opaque by default.

**Decision — cut gradients.** Fiddly, rarely tasteful, pure scope. *(Proposed; not objected.)*

**Direction — split the axes: material + opacity = GLOBAL theme (chosen once); colour = PER-NOTE.** Choose "how Fumi looks" once (glass, opacity) so the wall stays coherent; per-note you pick a colour accent. Per-note *material* would make the screen a chaotic mix of glass/solid/tinted (anti-furniture), so material stays global. *(Proposed; consistent with user discussing per-note colour.)*

**Colour — TENSION RESOLVED (user was torn: wants coloured notes like real Post-Its, but doesn't want to "copy Stickies").** Resolution: **colour isn't what makes Stickies bad — taste is.** Stickies is garish/flat/dated; the problem is the *execution*, not that colour exists. So offer colour **fully, including full flood**, but expressed as **tinted glass in a muted, *designed* palette**, never a flat highlighter fill. A "yellow" Fumi note = a soft tinted-glass Post-It; a Stickies note = a fluorescent square. Same feature, opposite feel → not copying Stickies, just doing coloured notes *well* (the whole thesis). Consequences:
- **Offer both flood AND accent** (flood = whole note tinted; accent = neutral note + colour edge/corner) — no need to choose. My earlier "flood is noisy at volume" objection was mis-aimed: the noise came from *saturation*, not colour; a muted tinted-glass flood stays calm even at volume.
- **The curated palette IS the taste guarantee** — full colour freedom, but every swatch is designed, so the user literally can't make an ugly note. Choice without a settings-swamp. (Curated presets, not an open customization toolbox — taste baked in.)
- **Default note = neutral glass (calm); colour is opt-in per note.** Serves both the calm crowd and the Post-It crowd.
*(Proposed this turn; awaiting user's final nod — likely.)*

**Carry (bank now) — glass/translucency vs text legibility.** A glass/translucent note over a busy desktop or bright window can make Markdown genuinely hard to read (classic translucent-notes-app trap). Glass-by-default needs a legibility strategy — subtle scrim behind text / adaptive contrast — or it's beautiful in screenshots and useless in practice. This detail is exactly the "does it really well" line.

**Visual spike (Paper) — user-requested, done in discovery.** Spiked the note windows in a new Paper file: `https://app.paper.design/file/01KY2JBXY2MTMYVTA5ZXSR2CW9` ("Fumi — Note Window Spike"). A twilight macOS desktop with fog-glass notes. What it validated:
- **Glass reads** as calm, native, furniture-like translucency (frosted fill over a colourful wallpaper) — achievable in practice, not just in theory.
- **Muted colour ≠ Stickies — confirmed visually.** Butter/sage/blush *tinted-glass* notes read as tasteful, nowhere near fluorescent Stickies. Reinforces "the sin was saturation, not colour."
- **Flood and accent both work on one glass base** (colour notes = floods; a sky edge-stripe on neutral glass = accent) — no need to choose.
- **Near-frameless holds**: no title bar, first line acts as the title, hover-menu dots top-right stay quiet.
- **Left-rail preset** visualised (thin full-height note down the edge) — reads exactly as the user pictured.
- **Agent-authored note** ("Written by Claude · 2m ago") sells the human⇄agent surface at a glance.
- **Legibility survives the worst case**: a note over the brightest part of the wallpaper stays perfectly readable → glass-by-default is viable *if the fill does the work* (answers the legibility flag above).
Caveats: rough; the twilight/sea-glass palette is one option among many (can push warmer/cooler/more saturated); muted tints are deliberate. Not a committed design — a reaction surface.

**Spike correction (user feedback — important).** First spike over-invented: it larded the notes with chrome we never discussed, and the user rejected all of it. Corrections, now the baseline for the note surface:
- **Notes are content-only — nothing else on the surface.** No meta row, no Space labels (surfacing "Space 2 · Fabric" also *contradicted* the earlier "Fumi has NO awareness of Space labels" decision), no star glyph, no persistent "Written by Claude" byline, no "pinned" text. Just the note's text: first line as title + body.
- **Controls are hover-only; at rest a note is fully clean** — no triple-dot affordance shown at rest. This is the actual near-frameless decision (I'd claimed to follow it, then covered the notes in chrome).
- **Accent-edge variant (coloured left border) REJECTED — hard no.** Colour stays as *flood* (tinted glass) only, for now.
- **Corner radius ~12px, continuous (squircle), concentric (inner = outer − padding); tighter inner padding.** No single canonical token in SwiftUI/Liquid Glass — the convention is continuous + concentric corners ~10–12 for a small surface; pin the exact value in real design rather than guess.
- Menu bar must not surface Space names either.
- **Pinning is NOT a visible concept.** Fix-on-top is a real per-note *menu toggle* (decided earlier) but never persistent chrome; there's no "pinned" label.
Process lesson (carried to a memory): keep spikes to only what was actually discussed; don't invent product/UI detail; avoid AI tells.

### Editing / formatting / title model (new area — opened off the spike)

**Task lists → interactive checkboxes (formatting feature).** Slipped into the spike as Markdown `- [ ]` / `- [x]`; user didn't ask for it but likes it. Decision: task lists render as interactive checkboxes — falls out of Markdown rendering naturally, and is one of the formatting features Fumi offers. (Confirms the "it's all Markdown, formatting falls out" principle.)

**Title is DERIVED, not first-class.** A note is *just its Markdown body* — there is NO separate "title" field. Rendering: Markdown renders naturally (a `#` heading on the first line renders as a heading — "prominence from Markdown", the chosen option (a); no auto-title mechanism). Label (used by the manager list, the CLI/MCP `list`, and the note window's identity) = **derived**: first non-empty line, Markdown-stripped, truncated; "Untitled" if the note is empty. "Giving a note a title" is therefore not a separate action — it's writing a good first line (optionally a heading); either way the label is "the first line", the heading just also renders larger. Rationale: single source of truth (a stored title field = title-vs-first-line drift + reconciling UI), matches "it's all Markdown", and is consistent with the earlier addressing loop (`list` → UID + title + Space, where "title" is this derived label) and the earlier "titles optional, first-line fallback" decision.

**Spike spacing normalized (detail).** User flagged asymmetric padding (15px top/bottom vs 16px sides) and inconsistent title→content gaps (9–10px) and body line-heights (18 vs 21) across notes. Fixed to uniform 16px padding, 12px title→content gap, 20px body line-height. Notes now read as one consistent set.

### Note material / visual direction (refined via spike)

**Opacity is FILL-ONLY — never the text.** Confirmed visually: whole-note `opacity` fades the text along with the panel (legibility drops, esp. over a bright/varied background). Decision: the opacity/translucency option applies to the note *background* only; text stays 100%. Result — see-through glass with crisp text. (Whole-note opacity that dims text = rejected.)

**Visual direction — elevate to luminous Liquid Glass + stronger type; NOT flat frosted rectangles.** User found the first mock "a little boring"; correct diagnosis — over a dark, flat wallpaper thin frosted glass drifts to *grey*, and grey reads as boring. Target: luminous, crisp glass (a *defined* specular top edge, a sheen down the surface, layered depth shadows, vibrancy where the wallpaper colour bleeds into the material) + stronger type hierarchy (bigger, tighter titles) + composition with a focal point / scale contrast, not a uniform card grid. A "hero" note spiked to show it — reads as a clear step up from the flat notes.
**Caveat (important):** a static Paper mock CANNOT reproduce what actually makes Liquid Glass beautiful — the *live refraction / lensing* of the material reacting to motion and to content moving behind it. That only lands in the real SwiftUI build with the actual Liquid Glass API. So the spike proves *direction*, not the final shimmer — don't over-polish a static mock. Channel Apple's 2026 Liquid Glass language (shared across macOS / iOS / iPadOS) in the real build.
**Status:** direction banked. User liked it and chose to roll it out across the mock (2026-07-21): elevated luminous-glass material applied to all notes (brighter fills, top sheen, specular top edge, layered depth; coloured tints brightened); the hero's big title reduced to the standard 15px (20px felt abrasive — titles stay consistent across notes); corner radius nudged 12 → 14 for a slightly glassier feel. Reminder still holds: the final beauty (live Liquid Glass refraction) belongs to the real SwiftUI build; the mock only proves direction.

### Naming the unit / customization / tags-on-note / later mockups

**Visual direction — LOCKED (for now).** The luminous-glass note direction is good enough; locked in. Revisit after competitive/alternatives research (which may feed the looks).

**The notes are "fumis" (lean, on-brand).** Do NOT call them "stickies". Plain word = "notes"; branded term = a **"fumi"** (文 = writing/note — the app name *is* the word for a note). Reads beautifully through the CLI: `fumi new` creates a fumi, `fumi list` lists your fumis. App = Fumi; the things = fumis.

**Render customization vs enforced taste — PARKED, leaning ENFORCED.** User mused about letting users render notes however they want (square, highlighter-yellow classic stickies — "who are we to stop that?"), then countered himself: enforcing a visual/taste is very Apple and a brand *positive* — a reason to keep it locked. Same tension as the earlier "curated presets, not a toolbox". Lean (mine + user's): **enforce the taste** — for a small curated tool the value IS that the maker made the taste calls; "who are we to stop them" is backwards for a branded product. If customization ever ships, keep it to a few curated presets, never a free-for-all. Parked; competitive research may inform.

**Tags — probably shown ON the note, done carefully.** Earlier decision stands: tags' primary home is the management UI (filter/group). User now wants tags visible on the note too ("we probably should"). Reconciling with the just-made content-only rule: tags are *real user-authored data* (NOT invented decorative chrome like the rejected "Space 2" label), so surfacing them is legitimate — but tastefully: a subtle tag-chip row, shown **only when the note has tags**, muted. Open sub-question (decide when mocked): at rest vs on hover — lean at-rest-but-subtle (tags are content, not controls). Manager stays the primary tag surface.

**Later mockups (parked design tasks).** The menu-bar quick/pop-up menu, and the full manager / "command centre" UI — worth mocking, later (and once the Paper screenshot tool is behaving).

### Agent surface (CLI + MCP) — shaped; command detail deferred to discussion

North star: the agent surface is built for an AI that **lists → reads → reasons → acts on a UID**, not a human memorising commands. Confirms prior "one engine, four clients" + "CLI first, MCP (`fumi mcp`) wraps the same ops".

Shape (a *sketch* — deliberately NOT resolving command grammar in discovery):
- A fumi = a Markdown **body** + metadata (UID, space, position, tags, float-on-top, visible).
- Verbs split into: **body** (`new`, `read`, `edit` = replace body, `append`); **metadata** (`mv --space N`, `tag`, `pos <preset>`, `float`, `show`/`hide`, `rm`); **discovery** (`list`); **server** (`fumi mcp`). No `rename` (title is the derived first line → just edit the body). No `pin` (→ `float`).
- Agent-grade specifics (soft): **structured / JSON output** (agents parse it; humans get pretty; MCP returns it natively), rich enough to reason in one round-trip — UID, derived title, space, tags, float state, position, content preview, timestamps. **UID is the currency; title a convenience**; on ambiguity the agent reads candidates and reasons, escalating to the human only as last resort. `new` prints the new UID (chainable: `id=$(fumi new …)`); stdin piping (`echo … | fumi new`).

**User call — this is shaped ENOUGH for discovery; the exact command grammar (verbs, flags, output format) is DISCUSSION-phase detail, and some of it is discussion territory anyway. Do not resolve command specifics in discovery.**

**Open (flagged for the agent-surface discussion) — write-side concurrency.** What happens when Claude edits a fumi that's open on screen while the human is typing in it? The engine is single-writer (no corruption) but last-write-wins can silently clobber in-flight edits. Option space: append-only for agents (safe, limited) · full-body replace (powerful, riskier) · section/merge (richer, more to build). The meatiest real design in the agent surface — leave it for discussion.

### Remaining candidate areas — NAMED but NOT yet discussed

Correction: I raced through these solo (my overreach — discovery is collaborative). These are candidate areas only, NOT yet shaped with the user; none of my solo characterisation or routing counts. To be discussed together (briskly) before they become real seeds:
- Onboarding & permissions (incl. the Accessibility-permission question for the private CGS APIs)
- Quick capture (global hotkey)
- Manager window at scale (search / filter / bulk)
- Trial / premium mechanics
- Stickies import
- Build & release (signing / notarization / auto-update)

### Onboarding, quick-capture, main window (shaped together, briskly)

**Onboarding / first-run.** Standard permission wizard on first run — walk through the permissions, describe what/why, button to open the relevant System Settings pane. The crux the user cares about: the **permission-request + relaunch must be flawless.** macOS often forces a quit/relaunch after granting (esp. Accessibility), and apps notoriously quit-but-fail-to-relaunch — Fumi must not (user hates this). Extra wrinkle specific to Fumi: it's an always-on engine that owns live note windows, so a permission-triggered relaunch has to **restart the engine and restore every open fumi exactly as it was**, seamlessly. The canonical macOS approach (whether current macOS even needs a relaunch; how to self-relaunch cleanly; exactly which permissions the private CGS APIs trip) is an open unknown to work out. Storage-location setup + trial intro ride along as the standard parts. App must **degrade gracefully if permission is denied** (fumis still work; no Space-homing). Principle restated by the user: clean, well-structured, beautiful, and it just works — this flow is a prime instance of that.

**Quick capture.** Primary path = menu-bar icon → dropdown → "new fumi" (easy, standard). Also the app menu when the app is focused. Power users get **user-mappable keybindings** with a small default set for the basic moves (new fumi, etc.). CLI/MCP is the separate agent surface, not this. (These human entry points cluster with the menu-bar / manager control surfaces.)

**Main app window (the "command surface" / manager) — lean = ORGANISER, not editor.** The user means the *main app window* (not a Cmd-K palette). It's for browsing / organising: list all fumis, search, filter by tag/Space, sort, rename, reopen (in original or current Space), move Space, delete; the Recently-Deleted bin lives here. Editing a fumi's content happens **in the floating fumi itself** ("open, edit, close"), NOT inline in this window. User "wasn't envisioning editing fumis outside the fumi itself" — could be persuaded to a two-pane list+editor later ("see how it pans out"), but organiser-first for now. (Stickies has no central window; Notes.app is all central window; Fumi sits in between.)

### Trial mechanics, no-import, build/release, billing backend (brisk pass)

**Trial mechanics — visible counter + active upgrade path.** The metered countdown is *overt*: show premium as an upgradable/purchasable path and a live counter, e.g. "you have 10 premium uses left." Conversion-forward — the user watches the runway shrink and knows how to top it up. Knock-on to bank: a visible counter makes the parked "what's premium" decision more load-bearing — whatever is premium must read clearly as "this is a premium action," or watching the counter tick down just confuses.

**Stickies import — NO.** Not importing existing macOS Stickies. Blank slate; no legacy baggage.

**Build & release.** Mostly mechanical (the tax of going off-store): Developer-ID signing, notarization, Sparkle auto-updates. The one real *product* choice = the auto-update experience (silent background vs "update ready, relaunch when you like"). And because Fumi is an always-on engine, an update triggers the **same seamless engine-restart-with-open-fumis-restored** requirement as the permission relaunch. (User: "sounds good" — noted, not deeply shaped.)

**Billing backend — NONE needed (no Laravel app / no self-hosted backend).** A Merchant-of-Record (Paddle / Lemon Squeezy) covers hosted checkout + global tax **and** provides a built-in licensing API (key generation + activate/validate/deactivate), so licence issuance/validation isn't ours to build either. The metered trial counter is **local device state** (no server). The Sparkle update feed is a **static appcast file**. The landing page can be a static site. So the whole "backend" = MoR account + static appcast + static landing page — run no infrastructure (same posture as the file-based storage decision). A backend only becomes necessary for: custom licensing the MoR can't express, device-tracking to prevent trial resets, or **hosted cloud sync (Fumi Sync)** — all parked / out of scope. Resist building a backend just because Laravel is comfortable; it's an ops + payments/licence security surface Fumi doesn't need at this size.

**Trial-reset risk — accepted; keychain mitigation; robust fix is out of scope.** The metered counter is local device state, so it *can* be reset (delete storage / edit the value) — and no off-store, direct-download app can fully prevent client-side tampering. Calibrated stance: most users won't hunt it down, and anyone who'd reset a counter to dodge ~$19 was never going to pay; the trial is a **conversion tool, not DRM**. Robustly preventing resets requires per-device **server-side** tracking = exactly the backend we decided NOT to build → out of scope (reopening it is negative ROI at this scale). Cheap no-backend mitigation: store the trial state (and later the licence) in the **macOS Keychain** — survives app delete+reinstall (the common naive "reset"), invisible to casual pokers, zero infrastructure. Determined users can still clear it; accepted. Steer: accept the leakage, keychain for obscurity, put energy into the product not anti-piracy; revisit only if it ever becomes a real revenue problem (won't at this scale). Same philosophy applies to the paid licence itself — make honest purchase easy, casual piracy mildly inconvenient, don't fortress it.

**Licensing robustness — licence vs trial split (correction; flagged for proper investigation).** Correcting the earlier over-simplification ("accept the leakage"): the *licence* and the *trial* have opposite security properties.
- **Licence (post-purchase) works locally via crypto and IS robust — no server needed.** Standard technique: vendor/MoR signs a licence payload (email / product / date) with a **private key**; the app embeds the **public key** and verifies the signature **offline**. Unforgeable without the private key (which never leaves the vendor). A licence *server* only adds extras (activation/device limits, revocation), not base validity. Only defeatable by patching the binary — a high bar, unavoidable for any native app. (User's memory that "licenses work locally" is correct.)
- **Trial (pre-purchase) is irreducibly soft.** Nothing is signed yet — "N uses left" is just local state the app trusts, so crypto can't secure it. The ONLY reset-proof approach is remembering "this device/person already trialed" **server-side** (or gating the trial behind a login) — i.e. the backend/account otherwise avoided.
- **The fork applies only to the trial:** (a) make the licence properly signed (robust, offline, no backend) and accept a soft trial like ~every trial does — probably resolves most of the "sloppy" discomfort since the *paid artefact* is protected; or (b) harden the trial with a lightweight device/trial backend or an account-gated trial (cost: sign-up friction + running infra).
- **User is NOT comfortable shipping trivially-hackable software** and is open to building a backend / licence server → this **reopens the "no backend" stance for the *trial* specifically**, pending investigation. (Base licence validity still needs no backend.)
- **Flagged for proper investigation** (user: "this needs looking into"): signed-key schemes; what Paddle / Lemon-Squeezy licensing provides out of the box; device fingerprinting; account-gated trials; how comparable indie Mac apps do it. Not to be decided off the cuff.

## Edits

(none)

## Topics Identified

### space-homing

- Routing: research
- Why: The pivotal quiet differentiator hinges on undocumented private CGS/SkyLight behaviour and launch-time timing that must be investigated (Chromium/yabai/Spaceman).

### engine-architecture

- Routing: discussion
- Why: The always-on-engine + local-socket + four-clients foundation is largely decided; discussion ratifies it and settles the transport.

### note-model

- Routing: discussion
- Why: What a fumi is — Markdown body, UID identity, derived title, tags, colour — is a design decision space the whole product builds on.

### note-window

- Routing: discussion
- Why: The primary surface's design, interaction, material and editing — a rich, largely-known design space to work through.

### agent-surface

- Routing: discussion
- Why: The CLI/MCP operation model and the write-side concurrency question are design decisions, not unknowns to research.

### management-window

- Routing: discussion
- Why: The menu-bar quick menu + organiser window + quick capture follow known macOS patterns to be worked through.

### storage-and-sync

- Routing: discussion
- Why: The file-in-a-folder store is decided in shape; the live multi-Mac conflict question is a design call to settle.

### commercialization

- Routing: discussion
- Why: The business model (one-time + upgrades, metered freemium) is a set of decisions; what's premium stays parked.

### licensing-and-trial-integrity

- Routing: research
- Why: The user flagged it explicitly for investigation — signed-key schemes, MoR licensing, and how far to harden the trial.

### positioning-and-audience

- Routing: research
- Why: The user framed it as "do the research" — personas, priority differences, landing-page framing, competitor teardowns.

### onboarding-and-permissions

- Routing: research
- Why: The canonical macOS permission-request/relaunch approach and the exact permissions the private APIs trip are unknowns to investigate.

### build-and-release

- Routing: discussion
- Why: Off-store release plumbing is known territory; the auto-update UX is a design choice to settle.

## Conclusion

12 topic(s) added. Map now has 12 topics.
