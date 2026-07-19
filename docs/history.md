# History

The repo's first commit is dated 2025-11-23. The same day it gained a skill called `technical-planning` ("document-plan-implement workflow") and, about ninety minutes later, a rename to `technical-discussion` with a three-phase shape: discuss, plan, implement. That is the whole origin: a couple of markdown files teaching Claude Code to write a discussion document before writing a plan, and a plan before writing code.

Everything since has been the same idea deepened and hardened: **documents drive phases, and the quality of the artifact chain determines the quality of the code**. What changed along the way is *who does the bookkeeping*.

## The prose era (Nov 2025 – Feb 2026)

Through December the `technical-*` family filled out: review (Dec 8), specification (Dec 14), research (Dec 17). Everything lived in prose. Skills described state in sentences, Claude derived progress by reading directories, and every dashboard was hand-drawn ASCII re-derived from instructions each session.

January and February were structural: commands took the `workflow:` prefix (Jan 14), cross-topic dependencies, multi-source specs, and progress tracking arrived, and February landed the unified entry point with the work-type architecture: one front door, five pipeline shapes. Install moved to the agntc CLI (Feb 24). The system already had its philosophy; it was carrying it entirely in Claude's head.

## State finds a home (Mar – Apr 2026)

March was the biggest month in the repo's history (948 commits) and its pivotal move was the **manifest CLI** (Mar 2): work-unit state got a JSON file and a dot-path read/write surface, and skills stopped narrating state into markdown. The processing skills renamed from `technical-*` to `workflow-*-process` (Mar 13), the inbox capture system landed, and the first release tag (`v0.1.0`, Mar 22) marked the system as installable product rather than personal config.

April added memory. The [knowledge base](knowledge-base.md) shipped in seven staged PRs (#243–#256): completed artifacts became a retrieval index with provenance and confidence tiers, and phases gained the ability to ask "have we settled this before?".

## Deep discovery (May 2026)

May reworked the front of the funnel. An "inception phase" idea (May 4) became the universal first phase: shape the work conversationally, settle its type, and for epics build a manifest-backed **discovery map** with routing, provenance, and self-healing analyses. It landed as a stacked batch of ~18 PRs in one day (May 22) and was renamed to **discovery** a week later (#293, May 28). This was also where the system's firmness gradient was articulated: discovery is soft, discussion hardens, the spec is golden.

## The bug that built the engine (Jun 2026)

The engine era began with a rendering bug. Resuming an epic, two of nine topics in the hand-drawn discovery map wrapped past their gutter and snapped the tree in half. The diagnosis (recorded in the design log `ideas/deterministic-tree-and-menu-renderer.md`, which grew into the full engine design record): skill prose told Claude to wrap summaries at 65 characters and *also* to prefix each line with a 7-character gutter, so "short enough to never break" silently became 72 columns. The fix was easy. The conclusion was not: layout fully determined by data should be computed by deterministic code and emitted verbatim, "wrong by default, correct only when babysat" is not a rendering strategy.

A survey found the pattern everywhere: 15 files hand-drawing trees, ~176 hand-counted signposts, ~326 dotted gates, menus label-matched back to routes. The design sessions of June 10–12 then reframed the renderer as the first module of something bigger, with an economic argument at the centre: an all-code orchestrator calling an LLM API was ruled out (the subscription model makes Claude-as-driver the better deal), so the architecture inverted. **Claude stays the orchestrator; code becomes the thing Claude consults.** From that came the three-ring engine (kernel, domain, gateway), the two doors (CLI for writes, library for reads), the DATA/DISPLAY/MENU contract, and the ruling that typed state lives in the manifest while markdown keeps the knowledge: judgment decides, code records.

## The re-platforming (Jun 12 – Jul 19, 2026)

What followed was a 57-PR stacked re-platforming, built and reviewed in waves: the engine skeleton and the epic-dashboard beachhead first, then write transactions, boot, per-phase migrations (research, discussion, specification, planning, review, discovery), the `task` verbs for the implementation loop, lifecycle transactions (pivot, absorb, promote), manifest absorption into the engine, and conversational knowledge-base setup. Each wave was validated by live sandbox campaigns against a real project copy, and the endgame ran successive adversarial review rounds (five-fleet, certification, a pre-existing-defect hunt, and a final re-review) that fixed everything from a credential-leaking error path to a cross-task counter contamination, closing with the log's own verdict: *the stack is complete and certified*.

The [timeline](timeline.md) has the dated, PR-numbered version of this arc. The through-line worth keeping: every era moved one more class of work from "Claude re-derives it in prose" to "code answers, Claude consults", and at no point did the conversation stop being the driver. That balance, not any single subsystem, is the design.

---

*Next: the dated arc, [timeline](timeline.md).*
