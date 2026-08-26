# Adversarial review — findings ledger

Five parallel reviews were run against the plan set on 2026-08-26: **intent fidelity**,
**technical ground truth** (verified against the codebase), **scope/sequencing**,
**coverage** (a 54-item inventory of the product's user-facing experience joined against
the plans), and **sufficiency** (per-phase buildability). Load-bearing ground-truth claims
were independently spot-verified before amendment (presence phases, prose-menu corpus,
section-envelope semantics, `lib.cjs` surface, manifest-owned spec sources and discussion
subtopics, `engine task`, roadmap origin grammar).

Every finding below was accepted unless marked otherwise. **Fixed in** names where the
amendment landed.

## Ground truth (all confirmed against code)

| # | Finding | Fixed in |
|---|---|---|
| G1 | "Byte-for-byte engine menus" is a convergence target — 43 reference files still carry prose-authored menus; parse contract is the option grammar | phase-2 §2 |
| G2 | `=== MENU ===` demarcation never reaches the assistant stream — but the tool-result stream of bridge sessions carries it byte-exact (the strictly better source) | phase-2 §2 |
| G3 | Presence heartbeats exist for research + discussion only (`presence.cjs PHASES`) | phase-2/6, README, UPSTREAM #2 |
| G4 | Open gates are not durable state anywhere → needs-you queue must be two-tier (manifest flags + live bridge asks) | phase-2 §6, README |
| G5 | Lanes live in report markdown, not the agent store; names are per-caller; in-session promotion is invisible to file watching | phase-3 §1 |
| G6 | Template headings stable only for investigation/review/brief; discussion + spec structure is manifest-owned ("a guide, not a form") | phase-4 §1 |
| G7 | The engine read surface is `lib.cjs` in-process + `manifest.json`, not JSON-over-CLI; gateway DATA text is model-oriented | phase-0 §2 |
| G8 | Engine renders are terminal-width-sensitive; byte-identity holds only at a pinned width | phase-0 §2, phase-1 §4 |
| G9 | Headless presence identity + SessionEnd hooks depend on harness env — verify by spike, compensate bridge-side | phase-2 §1 |
| G10 | Adapter "reading surfaces" are prose for the model; loop telemetry needs no adapter (`engine task` is manifest-side); Linear access is session-MCP-only | phase-5 premise, §1, §3 |
| G11 | Capture is bare files + a validated `roadmap add` origin token grammar; session indirection is a stated choice, and UI parks need an agreed token | phase-6 §3, UPSTREAM #3 |

## Intent fidelity

| # | Finding | Fixed in |
|---|---|---|
| I1 | Lane mapping misstated the protocol — batch screens are session-blocking STOPs; "silent disposition" would either auto-answer or strand sessions | README intent 3, phase-3 premise |
| I2 | Existence-based ping suppression starves every gate after the first | phase-3 §2 (time-based + roll-up) |
| I3 | Commits on the spine = the banned firehose + duplicated status | phase-1 §2, README intent 5 |
| I4 | Claim re-run affordance: untraceable scope, unsound safety premise (also raised by scope review) | phase-4 §3 — cut; copy button |
| I5 | "Derived, never invented" overclaims — lanes cover only background findings; laneless gates ran on undeclared rules | README intent 3, phase-3 §1 (the gate-type table) |
| I6 | Phase 6 ownership was enforcing in one paragraph, advisory in another; terminal answers undefined | phase-6 §2 (routing-not-authority, "answered outside the UI") |
| I7 | Phase 7 answer tool bypassed ownership/audit | phase-7 §1 (authenticated as a named human) |
| I8 | Never-auto list drifted across three documents and would silently rot | README constraint 4, phase-2 §3 (single-sourced enumeration, suspicious→typed-confirm default) |
| I9 | `roadmap add` as a direct capture surface forked the product's capture path | phase-6 §3 |
| I10 | Per-finding walk pushes fragment one seated conversation into interrupt spam | phase-3 §1 (push once per drain) |

## Scope & sequencing

| # | Finding | Fixed in |
|---|---|---|
| S1 | Security boundary opens at Phase 2, unowned until Phase 6 | phase-2 §7 (local trust boundary) |
| S2 | Install/config/API-keys/cost story unowned | phase-0 §5, phase-2 risks |
| S3 | Version coupling to the moving product unowned (incl. pending-migration repos) | phase-0 §4 |
| S4 | Queue durability silently depended on the deferred gate outbox | phase-2 §1/§6 (gates as session projections; restart done-bullet) |
| S5 | Pre-channel work had no surface; Phase 2's done-criterion started at "capture" | README (project lobby), phase-2 §4 |
| S6 | Lane-data premise overstated (with G5) | phase-3 §1 |
| S7 | Two incompatible cursor kinds, keyed by a not-yet-existing identity | phase-0 §8 (both tables + human sentinel) |
| S8 | Adapter reading = hidden re-implementation subproject | phase-5 §3 |
| S9 | Replay fixture ≠ test strategy; CI never built; recording harness unowned | phase-0 §6/§7, per-phase test additions |
| S10 | Phase 0 and 2 estimates ≥2× light | both re-estimated (2–3, 4–5 wks) |
| S11 | Freezing the schema in week 1, before any consumer | README checkpoints (freeze moved to end of Phase 2) |
| S12 | Error/crash UX + bridge observability unowned | phase-0 §7, phase-2 §3 (session health) |

## Coverage (54-item inventory; 47 modeled)

| # | Gap | Fixed in |
|---|---|---|
| C1 | Project-level tier unmodeled: roadmap (browse/pull/genesis), baseline, inbox, start overview | README (lobby), phase-1 §1, phase-2 §4, phase-4 §4 |
| C2 | Channel identity across reshaping (pivot / absorb / quick-fix promotion / spec promotion) undefined | README channel model (tombstone rules) |
| C3 | Pre-durability discovery conversation had no home | README lobby, phase-2 §4 |
| C4 | Consult references missing from the spec sign-off surface (engine blocks on them) | phase-4 §1/§3 |
| C5 | Knowledge-gate not-ready state invisible in the UI | phase-1 §1 |
| C6 | Background agents invisible (no lifecycle events) | phase-0 §3, phase-5 §5 |
| C7 | Bridge reads on pre-migration repos unaddressed | phase-0 §4 |

Deliberately terminal-by-design (accepted as-is): API-key entry, tmux labels.

## Sufficiency

Verdicts: Phases 0 and 2 **not buildable without a spec pass**; 1, 3–7 buildable with
gaps. Resolution: the five pre-code specification artifacts are now a named entry
criterion (README "Spec pass before code"; `ui/plans/specs/` to hold them):
gate-card schema + lifecycle · session lifecycle · EVENTS.md (payloads + derivation +
historical-spine function) · replay fixture format · needs-you ordering + attention
policy. Individual gaps (spine reconstruction, ask-detection precedence, session-id
persistence, ownership defaults, comment storage, exit-decision criteria, checksum
mitigation dropped as unimplementable) were folded into their phases.

## Rounds 2–4 (post-spec): consistency, sufficiency-2, FMEA, walkthrough, upstream

Five further reviews ran after the specs were written (2026-08-26): spec↔plan
**consistency + ground truth** (13 findings), **sufficiency round 2** (15 gaps; EVENTS.md
judged not buildable without revision), **FMEA/concurrency** (14 findings, 4 critical),
a two-persona **scenario walkthrough** (12 findings), and an **upstream-impact** review
of the five proposals. Verified-clean claims and the "attacked and survived" lists are
in the reports; every accepted finding is folded into the revised specs/plans:

- **Event identity & the stream** — discriminants defined per event with the introducing
  commit sha (occurrence-unique; reopen→recomplete yields distinct ids); an explicit
  two-layer model (durable commit-derived stream vs ephemeral live layer, never
  sequence-numbered); a persistent sequence counter and a **stream epoch** detecting
  history rewrites/branch switches/shallow clones; net-effect spine semantics stated
  honestly; `workunit.removed` added (tombstone trigger); `spec_blocked`/`dep-blocked`
  re-sourced to the engine's `lib.cjs` derivations. *(EVENTS.md rewritten.)*
- **Gate identity & detection** — re-keyed to `bridgeSessionId` + ask ordinal +
  operationally-defined `normalizedBody` (NBSP, section extent); the **session journal**
  introduced as the re-derivation source; ask eligibility now requires a STOP
  instruction (auto-mode "do not stop" sections were phantom gates); batch-screen
  recognition pinned to the `finding batch` surface pair; a surface→gateType mapping
  added; never-auto entries given match keys; state transitions serialized (CAS,
  two-tab and TOCTOU races resolve visibly). *(gate-card-schema.md, session-lifecycle.md.)*
- **Sessions & operations** — the per-project **bridge lease** (second bridge =
  read-only mirror); allowlist generated from skill frontmatters with a defined
  permission-prompt fallout; `CLAUDE_PID` restored to the env with the hook-id
  reconciliation spike; stall clock suppressed during in-flight tool calls; invocation
  model pinned (one query per turn via resume); shaping-thread end affordance +
  idle-timeout. *(session-lifecycle.md, phase-2.)*
- **Fixtures** — the Phase 0/2 recorder circularity resolved (v0 converts a
  terminal-driven session; live recorder is Phase 2); adopt-mode SDK-resume demoted to
  [spike] with fresh-session re-priming primary and **path-safety rules** (a replay can
  never write the real repo); `--moment` restricted to quiesced turn boundaries with a
  dirty-file overlay; the authored-adversarial corpus carve-out; two-menus-per-turn
  reclassified valid. *(fixture-format.md, phase-0.)*
- **Attention & multiplayer** — `report-pending` durable queue kind (the overnight
  case); walk push moved to report-landing; two-level activity + thread-scoped focus +
  navigation grace; quiet hours with morning roll-up; one-escalation-per-attendance;
  durable push ledger (restarts re-push nothing); durable `since` from commit time;
  ENOENT-vs-unparseable distinction; stage 0 for lobby rows; ownership default
  precedence (session-driver first); stuck-owner surfacing; comment ceremony (badge +
  confirm-control indicator, never push); capture failure as a durable retry row;
  mixed-stage density defined per-thread; the bridge watchdog; claim-chip signposting.
  *(needs-you-ordering.md, phase-3/4/6, README.)*
- **MCP** — typed-confirm gates require SEP-1865 user-gesture attestation (a model tool
  call cannot synthesize a never-auto confirmation); negative parity test added.
  *(phase-7.)*
- **Upstream** — UPSTREAM.md rewritten per the impact review: propose-now (broader
  presence; a read-only currency verb — the strongest un-made proposal; the never-auto
  `STAYS_GATED_SURFACES` export), propose-later (lane recording at `agent ack`; the
  render journal replacing the outbox shape), withdrawn (park origin token — the
  existing grammar and inbox fallback suffice; `engine tasks` — against the product's
  format-blind charter).

Notable rejections this round: none outright; two findings were accepted with narrowed
scope (walkthrough #12's claims-verification badge is best-effort only; consistency #12's
bootstrap-ask wording resolved by making spec 5 authoritative rather than rewriting
phase 3's table).

## Round 5: the design contract vs the intent metrics

Spec 6 (components and layouts) was written against the intent baseline with an explicit
traceability rule, then adversarially reviewed against the same metrics (2026-08-26).
Fourteen findings, all accepted (one narrowed); the spec was revised in place:

- **Traceability made per-element** — an intent column on the catalog, citations on
  every visual rule; the cut rule is now enforceable (finding 1).
- **The batch screen got its surface** — `BatchScreenCard`, plus `PassThroughAsk` so a
  pass-through queue row opens the thread tail, never a fabricated card (2, 10).
- **Duplication discipline written down** — one interactive card at a time; badges are
  derived, never counted separately; lobby digests suppress their waiting section; the
  S5 rail replaces the frame's context panel; the what-moved column became an overlay
  chip with a 60ch minimum measure for the Read lens (3, 5, 11, 12).
- **The mobile story specified** — cards as sheets over their threads, drain mode's
  small-screen behaviour, breakpoint ownership assigned (4).
- **The keyboard model added** — typed option keys answer a focused card; initial focus
  on the free-text input, never an option (pre-selection by focus ring); focus survives
  card resolution mid-drain (6).
- **The thread-model fork closed** — threads never expand inline; density lives on S4;
  the spine set aligned with spec 3 by adding the unit-status-change `SpineItem` (7, 8).
- **`BridgeBanner` gained the live-only cause and a closed-list rule; `TombstoneCard`
  split from `ArchiveCard` with the archived view defined** (9, 14).
- Narrowed, not cut: `ClaimChip`'s verification badge is explicitly sourced from the
  work unit's review-report artifact only — never bridge-side execution (13; the
  reviewer's cut-it option declined because the badge's source already existed in
  phase 4's wording, which the spec now mirrors).

The review's survived list confirmed the state machines match specs 1–2 exactly, the
gold reservation has no leaks, and the commits-exiled spine holds in letter and spirit.

## Round 6: Phase 0 implementation review (2026-08-26)

Three parallel reviewers ran against the Phase 0 build after its done-means passed:
**plan/spec fidelity**, **intent baseline**, and **code quality + security posture**.
Every finding was verified against the code before acceptance. Dispositions:

**Defects (all fixed, with tests where the path was uncovered):**

| # | Finding | Fix |
|---|---|---|
| P0-1 | Default bridge state dir sat inside `.workflows/.cache/` — a write to `.workflows/` (out of scope), leakable into fixture overlays via `snapshotWorld` | Out-of-tree default (`~/.cache/workflow-bridge/{slug-hash}`); overlay capture excludes any legacy `.bridge-state`; smoke test asserts `.workflows/` untouched |
| P0-2 | Boot-time epoch mismatch marked every `artifact_read_ref` history-rewritten unconditionally (live path did the real reachability check) | One shared `gitReachable` used by both epoch-change paths |
| P0-3 | Live-layer diff could race the HEAD poll on a branch switch and emit the removal burst spec 3 forbids | `liveDiff` defers whenever HEAD has moved; `pollHead`/rebaseline re-baseline the live layer |
| P0-4 | Live-only (shallow-clone) mode seeded the commit-space baseline with a tree-space snapshot and never wrote `project_meta`, breaking durable persistence after restart | Live-only watcher mode: no durable emission at all — HEAD movement re-baselines the live layer (the durable layer genuinely doesn't exist there) |
| P0-5 | Debug console rendered `bannerReasons` (repo-derived text incl. git tags) via `innerHTML` — reflected XSS from a hostile repo | `textContent`/`createElement` |
| P0-6 | Recording the fixture surfaced four replay/watcher defects (final-boundary semantics, mixed hash spaces, `head: null` seeds, chokidar ready-gap) | Fixed pre-round in the fixture commit, with tests |

**Gaps (closed):** config schema was decorative — now loaded from
`~/.config/workflow-bridge/config.json` with argv overrides (width pin and port flow
from it); graft/partial-clone detection added beside shallow (README no longer
overclaims); `cli.ts` had zero test coverage — smoke test boots the CLI on a
pending-migration repo and asserts the read-only contract end-to-end;
`answers.json` was empty and `assertAnswer` coverage synthetic-only — offline answers
are now **derived from the recorded turns by the harness** (`deriveAnswers`,
`regen-answers.ts`); engine host calls gained a timeout (a wedged target-project
derivation can no longer stall the bridge); cross-origin POSTs to mutating routes
refused (localhost-daemon CSRF).

**Nits (fixed):** `MENU: finding choice` added to the never-auto enumeration
(verified against `render.cjs`'s `AUTO_OVERRIDE_LINE` call sites — the consult and
spec-sign-off surfaces are prose-rendered today and stay with the Phase 2 sweep);
`gate.opened` payload is the card itself, not a `{card}` wrapper; `commit.landed`
id/scope construction single-sourced (`eventId` + exported `commitScope`); dead
adapter read methods removed; engine-host method table given a null prototype;
`restoreWorld` refuses absolute/`..` overlay entries (spec 4 path safety);
`T_stuck`/`T_grace` pinned in the notification config.

**Spec amendments this round** (deviations resolved into the specs, per the rules of
engagement): spec 1's turn definition clarified — a turn is a *human input*;
tool-result submissions ride user-role API messages but are not turns. EVENTS.md's
identity preamble now states the `artifact.updated` content-keyed exception the table
always carried.

**Accepted as-is:** the `workunit.removed` successor inference stays a documented
best-effort heuristic (EVENTS.md prescribes no algorithm); replay `assertAnswer`
still no-ops on a missing key (the derived answers file makes absence an authored
choice, not an accident).

**Survived attack (reviewers' clean lists):** the two-layer seq discipline, the
occurrence-unique id rules and epoch behaviour, every EVENTS.md table row's
derivation, G7/G8 (in-process `lib.cjs`, width pinning), spec-blocked/dep-blocked
sourced exclusively from the engine's own derivations, no UPSTREAM verb assumed, the
provisional (unfrozen) schema labelling, commits exiled from the spine set, the
SQLite surface incl. the S7 tables and human sentinel, parameterized SQL throughout,
no shell-string command construction, localhost-only binding, CI running exactly the
declared lanes.

## Rejected / amended findings

- Sufficiency's "SQLite schema has no consumers in Phase 0 — defer it": **rejected** in
  favour of pinning now (S7 showed deferral causes rework); the schema implements the
  spec docs, so it is no longer invented.
- Scope's "cut fixture to one stage": **amended** — fixture v0 is one stage, the
  three-stage set grows with the phases that need it, and the recorder makes regrowth
  cheap.
