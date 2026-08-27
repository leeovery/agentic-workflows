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

## Round 7: Phase 1 implementation review (2026-08-27)

Three parallel reviewers against the mirror (plan/spec fidelity, intent baseline,
quality + security) after its done-means passed. Dispositions:

**Defects (fixed, each with a pinning test):**

| # | Finding | Fix |
|---|---|---|
| P1-1 | Every epic channel 500'd — the bridge assumed `buildDiscoveryMap` returns an array; it returns `{map, summary, needs_sequencing}` (both fidelity and intent reviewers, independently; the untyped `as any[]` cast hid it) | Read `.map`; epic materialised into the API test world |
| P1-2 | Percent-encoded traversal in the `wu` route segment (`%2e%2e%2f` survives URL parsing, decoded after routing) reached `channelView`'s manifest read, the artifact walker, and the engine host — arbitrary manifest/markdown read | `validUnitName` gate after decode, both routes; vector tests |
| P1-3 | A committed `.md` symlink served its target — arbitrary file read on the host through the SPA's own links | realpath containment in `artifactView`; the walker skips symlinks; symlink test |
| P1-4 | Lobby roadmap/baseline re-derived bridge-side from the raw manifest while the engine's own `roadmapState`/`baselineState` sat unused in the same payload — the plan's named "re-implementing displays by accident" risk, plus two answers for one fact | Engine values only; horizons render as rows with engine totals |
| P1-5 | `durableRows` double-counted one staleness hop (reconcile flag + the same item's stale sources are one fact) | Reconcile suppresses that item's stale-source rows; dedup test |

**Gaps (closed):** the firmness gradient was inert (identical serif classes, an
unconsumed variable) — now visible chrome: research airy and unruled, discussion
lightly ruled, specification firmly ruled with tighter leading, pinned by an
artifact-screen test; `SpineItem` gained its fourth catalog variant (the gold
gate ref — renderer complete, producers arrive with Phase 2); `warn` moved off
the gold hue (an amber warn would teach readers gold means "degraded" before
gold means gate) and the degraded banner sits on neutral ground; mermaid's
`securityLevel: 'strict'` pinned with a load-bearing comment; the single-topic
channel no longer prints the unit status twice; `attachDerived` parallelised.

**Accepted as-is / noted:** the S1 START-row annotation tension (the spec's
P2/P6 tag vs the plan's explicit P1 list — code follows the plan, the more
specific document); per-request `epicDetail` derivation is uncached (fine at
P1 scale; revisit if Phase 2's churn makes lobby refetch hot); `pending`
source rows count as durable waiting until Phase 2's queue spec refines them.

**Survived attack:** zero writes anywhere (API 405s non-GET; no fs writes in
the app or API path), no UPSTREAM assumption, commits exiled to the drawer in
every rendering, SSE debounced (no firehose), the motion rule (no spinners,
`transition: none` global), provenance typography consistent, steel blue on
navigation only, badges single-derivation (rail = lobby counts = the future
queue's rows), threads never expand inline, S5 rail replaces the context panel,
`serveStatic` traversal-safe, all `execFileSync` array-form, CI runs the app
lane.

## Round 8: Phase 2 implementation review (2026-08-27)

Three reviewers: plan/spec fidelity (×2, run independently) and a combined
intent-baseline + security-posture pass (this phase opens the write/session
attack surface). Every finding verified against the code before folding.

**A process note first.** One fidelity fork, dispatched read-only, observed the
working tree mid-fold (this session was applying the other reviewers' fixes) and
misread those in-flight edits as "unauthorized" and the round-8 provenance notes
as "fabricated". They are neither: the edits are this session's own review folds,
made under the rules of engagement ("fold confirmed fixes"), and **round 8 is the
correct ledger number** — rounds 6 and 7 were Phases 0 and 1. No revert; the
observation is recorded here for the audit trail. Review forks stayed read-only;
the main session did the edits.

**Security defects (all fixed, with tests):**

| # | Finding | Fix |
|---|---|---|
| S8-1 | **CRITICAL** — the Bash allowlist was a naive `startsWith`; `git diff && curl evil` passed | `bashCommandAllowed`: rejects command/process substitution, splits on every shell control operator, requires EVERY segment allowlisted; injection-vector tests |
| S8-2 | `WebFetch` unconditionally allowed though no skill declares it (SSRF/exfil) | Removed from the canUseTool allow set — denied by default |
| S8-3 | Write/Edit containment was lexical only — a symlinked component escaped (round-7 P1-3 unmirrored to the write path) | `writeWithinProject` realpaths the deepest existing ancestor; `notebook_path` covered; symlink-escape test |
| S8-4 | Bearer token compared with `===` (timing side-channel) | `crypto.timingSafeEqual` |
| S8-7 | The generated allowlist's Write/Edit entries were dead code — the "one generated allowlist" story overclaimed for file tools | Allowlist is Bash-only; file/read basics named in canUseTool; comments corrected |
| S8-8 | The full bridge env (non-Anthropic secrets) rode into every session and persisted to the journal | `sessionEnv` redacts secret-shaped vars, keeps ANTHROPIC_* |

Hardening also folded: origin-check duplication on `/replay/step` removed (single-sourced in auth.ts); the broad-localhost origin trust is documented as accepted for the local prototype (Phase 6's OAuth narrows it).

**Fidelity/intent defects (fixed, with tests):**

| # | Finding | Fix |
|---|---|---|
| F8-1 | Batch-screen cards showed no findings — the `DISPLAY: finding batch` was discarded | detectAsk pairs the sibling DISPLAY into context; new `BatchScreenCard` renders findings above the approve/veto row (queue overlay + thread) |
| F8-2 | `MENU: cancel gate` (work-unit/topic cancel) wasn't never-auto — a misclick cancelled a unit | Added to `NEVER_AUTO_SURFACES`; `confirmMode` now scans context text too; the dead `/cancel .*--cascade/` regex fixed |
| F8-3 | Prompt-fallout didn't flip health to `errored` | Sets errored on denial; preserved past a trailing pass-through, cleared by a real gate |
| F8-4 | Read-only-mirror banner never surfaced in the SPA | `causesFromHealth` derives it from `bannerReasons` |
| F8-7 | Injected answer turns weren't tagged with the gate id | `gateId` on the user journal record + schema |
| F8-8 | `out-of-scope-bank` durable queue kind unimplemented | durable.ts scans review items' `out_of_scope` |
| F8-13 | `SURFACE_GATE_TYPES` omitted incoherence-held-doc / resurface-gate | Both added, plus cancel/signoff |
| F8-16 | `stale-source` scanned only `sources.*`, not `consult_references.*` | Both scanned |
| I8-1 (N3) | A truncated/malformed menu classified as `stop-notice` (a card), not pass-through | detectAsk routes option-markup-that-failed-to-parse to pass-through |
| I8-2 (N1) | The lease wrote into `.workflows/.cache` (in-tree, leakable to fixtures) | Moved out of tree to a deterministic `~/.cache/workflow-bridge/{slug-hash}/lease`; spec 2 amended |

**Gaps closed:** one-live-session-per-address enforced bridge-side (not just in the SPA); the 4h idle-timeout sweep; `buildOrderPos` populated from the epic's spec `order` and joined in the queue; the NEEDS YOU lobby strip (P2); channel thread rows link to their session (S4); the `bridge record-moment` recorder (spec 4's Phase 2 snapshot half — the journals were always teed; this pairs one with a world snapshot); a visible `resuming…` state for answer-while-dead; `BASE_BASH` gained the spec-named cache `rm`/`mv`; allowlist and policy test lanes added; an n=2 restart test.

**Accepted as-is (recorded, not fixed):** adopt-from-replay stays `[spike]` per spec 2; the continue-row two-turn entry mode is the deliberate "session's own start overview carries the routes — no second routing source" choice; `walk-raise` detection waits with the consult surfaces (prose-rendered, no engine section to key on); the `ended` short-circuit in detectAsk is a harmless guard (the pipeline always passes `ended:false`); "WS handshake" in the plan text is stale terminology — the transports are SSE+HTTP and correctly auth-gated; the `detected` gate state is a schema value the machine never dwells in. The broad-localhost origin allowlist is an accepted prototype posture.

**Survived attack:** zero writes into `.workflows/` from the session/gate/API path (answers are only SDK resume turns); the journal-is-source / ledger-is-audit separation; gate identity and its resume-invariance; the answer mutex (two-tab race → one injection, visible resolved-externally); the lease's atomic O_EXCL with no TOCTOU; every mutation and the event stream token-gated behind the Host/Origin boundary; no ping anywhere (Phase 3 boundary holds); no activity theater; React-escaped rendering (no XSS in the new surfaces). The surface sweep test pins `NEVER_AUTO_SURFACES` over every `AUTO_OVERRIDE_LINE` site in the live engine.

## Round 9: Phase 3 implementation review (2026-08-27)

Two reviewers (plan/spec fidelity + intent baseline combined; quality + security).
Both converged on one structural truth: **the pure policy functions were correct
and well-tested, but the coordinator wiring that feeds them live data was broken
in several places and had no test.** The fold overhauled the coordinator and added
a coordinator-level test suite. Dispositions:

**Defects (fixed, with coordinator-level tests):**

| # | Finding | Fix |
|---|---|---|
| R9-1 | Queue `escalated` hardcoded `false` — spec 5's #1 sort key and the escalation chip were dead | `buildQueue` takes an `isEscalated` predicate; the coordinator joins `EscalationTracker`; the API passes it |
| R9-2 | Digest `next` always `null` — "what's next" never rendered | The coordinator calls the engine's own `renderWorkUnitStatus`/`renderEpicDashboard`, verbatim |
| R9-3 | The notifier conflated a quiet-hours-deferred push with a batch `digest` — batch screens could ride the morning OS push ("never pings" violated) | Quiet-hours accrual moved OUT of the pure `apply()` INTO the notifier (a `quietHours` arg); a batch `digest` now never accrues and never pushes |
| R9-4 | An escalation could be swallowed by the T_roll collapse and never delivered; the T_roll roll-up only fired once a day | Escalations are exempt from the roll-up collapse (always fire); an intraday `maybeRollup` drains accrued bursts past T_roll |
| R9-5 | The morning-rollup day guard mixed a UTC date with the local hour → fired twice daily outside UTC | Local-date `dayKey`; a coordinator test pins once-per-local-day |
| R9-6 | The report rowKey dropped the phase and hashed only lane counts → cross-phase reports suppressed each other | Phase in the rowKey; the content hash includes the file path; a test pins two distinct ledger rows |
| R9-7 | The activity heartbeat was unconditional and always `appConnected:true` — a backgrounded tab silenced pushes and re-armed escalation every 60s | The heartbeat is visibility-gated and carries `interaction:false`; only a real pointer/key event (or navigation) re-arms escalation; navigation grace wired from focus changes |
| R9 gate-1 | `gateCeremony`'s engaged→none rows were dead code (identical ternary arms; `'none'` dropped from the type) | `'none'` restored to `Ceremony`; engaged conversational asks return it; the notifier delivers nothing for it |
| R9 blocks | `blocksWithNothingElse` checked only the session's own gate | Now checks no OTHER open gate anywhere (single-user: the sentinel owns all) |

**Hardening:** the artifact-view `git rev-parse` is cached ~2s (no per-GET shell-out on the event loop); the report scan skips files over 2MB and evicts `seenReports` when a work unit's cache is gone; the dead web-push subscription query removed. **Nits:** the `morningHour` config field added; `QueueRowData` declares `escalated`/`stuck`/`buildOrderPos` (the `as any` cast gone).

**Accepted as-is (recorded):** `stream_cursors` stays defined-but-unread — the badges are needs-you-row counts (which the components spec actually prescribes: "a channel badge = that channel's queue-row count"), and per-human unread-delta cursors are a Phase 4/6 concern; the watchdog is an in-page visibility+heartbeat timer, not a service worker (a closed tab's alarm needs the web-push transport, which is prototype-stubbed — documented as the phase's stated push-delivery risk); the consult/replan push branch stays reachable-but-unfired until the Phase 2 surface sweep names those prose-rendered surfaces (the commit's "delivered" claim was corrected here to "wired, awaiting surface names").

**Survived attack:** the lane extractor (apply/decide/route vs walk vs ENOENT); push-once-per-report-landing; the durable ledger's restart-re-pushes-nothing; quiet-hours-window midnight wrap; the lobby TODAY strip not duplicating NEEDS YOU (waiting suppressed server-side); no per-finding pushes, no email; every mutation and the event stream token+Host/Origin gated; `/api/activity` gated the same; no XSS in the new surfaces.

## Round 10: Phase 4 implementation review (2026-08-27)

Two reviewers (plan/spec fidelity + intent; quality + security). The security
fork observed the working tree mid-fold and confirmed the fixes landing there.

**Defects (fixed, with tests):**

| # | Finding | Fix |
|---|---|---|
| R10-1 | Epic discussion structure was empty — the topic derivation only handled the nested `{phase}/{topic}/{file}.md` layout, not the FLAT `{phase}/{topic}.md` (discussion, investigation), so an epic's subtopic rail silently degraded | Derive the topic from both layouts (flat → basename sans .md); verified live on payments-epic's billing-model |
| R10-2 | The Roadmap read nonexistent `pulled_to`/`shipped` fields — every item rendered "waiting" forever, no work-unit link — a "state renders from engine" violation | Reads the engine's own `state`/`work_unit` roadmapState rows; `in-flight` key corrected |
| R10-3 | The read-ref was recorded on EVERY GET — a background SSE refetch silently marked an artifact "read" moments after a change, breaking "what moved" | The GET no longer records; a `POST /api/artifact/:wu/read` advances the ref only on a genuine focused view (mount / becomes-visible) |
| R10-4 | The VerdictBanner keyword-sniffed the first 8 lines (a `**Plan**: {slug}` or prose "blocked"/"fail" flipped a passing review) | Matches the template's stable `**Verdict**: Pass\|Fail` line; buckets link from the report's own headings |
| R10-5 | Roadmap items naming an unknown horizon vanished (the loop iterated only known horizons); `orphaned` count unshown | Renders known horizons then any extra an item names; orphaned surfaced |
| R10-6 | BriefCard's "session log is the record" link was dead (`onAnchor('top')`, no such element); panels were positional | Links to the session-log artifact route; panels label-matched (soft decisions / rejected paths / open questions) |

**Gaps closed:** the claim-verification badge is now wired — sourced ONLY from the work unit's review report (never bridge execution, round-5 #13); the spec rail carries its claim chips and the review shows verdict + buckets (S5 table); baseline docs colour their observed/stated/open layers; the 60ch minimum measure + rail-collapses-first (the rail hides below `lg`, the body holds `min-w-measure`); a status-less source defaults to `pending` (engine fail-safe); gate deep-links scroll+highlight the section they concern.

**Hardening:** `/api/history` uses the same realpath containment as the artifact route; the artifact read is size-capped (4MB); `history.ts` rejects leading-dash paths and non-hex refs before any git call (defence-in-depth — the `--` separators already neutralise the pathspec vector).

**Accepted as-is (recorded):** full docked-card floating interaction is the deep-link's richer form — the scroll+highlight ships, the floating dock is deferred (the mutual-exclusion rule with what-moved holds trivially while only one floating layer, the ribbon, exists); the session-log link assumes `session-001.md` (the common case; a brief pointing at a later session is a Phase 6 refinement).

**The Phase 4 exit decision (live discussion map):** kept CLOSED. The named
evidence — "did anyone drive a discussion from the browser during dogfooding
and want the rail live?" — does not exist in this build: the dogfooding was
driven through the fixture world's API, not a sustained human discussion, and
no one asked for a live rail. The manifest-sourced rail (rebuilt on each SSE
refetch) is live enough; a bespoke live-map channel stays unbuilt until real
use asks for it.

**Survived attack:** no ReDoS in the extractors; no `dangerouslySetInnerHTML`
(diff/commit text is React-escaped); the roadmap route relays only engine
fields; structure sourced from the manifest (never session cache); claim chips
copy-only (no re-run); the what-moved epoch-break `lost` state; out-of-scope
discipline (no browser editing, no artifact-embedded execution, no Phase 5
creep).

## Round 11: Phase 5 implementation review (2026-08-27)

One combined reviewer (fidelity + intent + quality/security; the phase is small
and read-only). Findings verified against the real manifest and format sources.

**Defects (fixed, with tests):**

| # | Finding | Fix |
|---|---|---|
| R11-staging | `staging` was always empty — the real shape is `staging.{cycle}.tasks.{n}=<decision>` (nested), not the array CLAUDE.md's shorthand implied | Flatten each cycle's task decisions; verified live (caught pre-emptively from the prompt) |
| R11-1 | The full Delivery section inlined into the channel scroll created the conversation/telemetry seam the spec forbids ("density lives on S4") | The heavy detail (consolidation, plan graph) now lives behind each topic's collapsed TelemetrySurface toggle — the channel stays density-neutral |
| R11-3 | `planFormatOf` returned the FIRST planning topic's format, not the requested one — an epic mixing adapters could render one topic's plan with another's format | Resolves the specific topic's `format`; `/api/plan` passes the topic |
| R11-4 | The plan DAG reader followed symlinks and had no size cap (the round-10 hardening wasn't mirrored) | Skips symlinks (Dirent.isFile), caps at 1MB; symlink test |
| R11-5 | `countAgents` keyed by topic only → a stale discussion/review agent inflated an unrelated impl topic's chip; also duplicated the watcher's phase-aware scan | Scoped to the implementation phase for the per-topic chip; a channel-wide `countAgentsAllPhases` powers the header chip |

**Gaps closed:** the background-agent chip is now channel-wide (research/discussion deep-dives and perspectives show in the header, not only implementation — deliverable 5's own examples); the plan-DAG cycle case degrades honestly (a banner, not a confidently-wrong graph); task ids sort naturally.

**Doc nits fixed:** the source inventory now documents the real `staging.{cycle}.tasks.{n}` shape and that "blocked" is a derived join, not a status value; the plan records the @xyflow→CSS-layout correction and names `PlanDAG` (catalog).

**Accepted as-is (recorded honestly):** the S4 telemetry thread-MODE (deliverable-2 wording) is not a separate surface — the per-topic TelemetrySurface behind its toggle carries the telemetry, and threads-as-previews on S3 never show conversation, so the seam the rule guards against does not occur; a fuller S4 integration is deferred. The **review board** (deliverable 4) ships as the artifact lens's verdict + linked buckets (Phase 4) plus the out-of-scope bank as a durable queue row (Phase 2) — the dedicated columns-by-bucket board with provenance links is deferred, not built. **tick DAG** returns `[]` (the CLI isn't installed in the prototype) so the "byte-equal from local-markdown AND tick" done-means is met only for local-markdown; the reader exists so the branch is honest. No **`delivery-running` fixture** was recorded — the done-means was verified LIVE against the real completed quick-fix (which carries a full implementation item, a 2-task local-markdown plan, and a gated consolidation), which is stronger evidence than a synthetic fixture; recording the fixture is deferred.

**Survived attack:** every telemetry datum traces to the source inventory (nothing scraped); dep-blocked from the engine's own render-time join; the ConsolidationCard is read-only (no answer path — decisions ride the session's gate); no loop control, no task-tracker writes; no new spine event types (updates replace, never append); no animation; `validUnitName` blocks traversal on both `wu` and `topic`.

## Round 12: Phase 6 implementation review (2026-08-27)

Three parallel adversarial reviewers — plan/spec fidelity, code-quality/security,
intent/UX — over the multiplayer build (auth, gate ownership, capture, presence,
comments). Every finding verified against the code before folding.

**Deviation recorded in place** (phase-6 §1): the auth deliverable ships the
**identity + member-check contract** (server-side cookie sessions, a real
fail-closed GitHub push-access check, membership enforced UI-side) but **not**
better-auth's OAuth redirect flow, which is deployment wiring. Two honest
consequences until it lands: identity is **attribution, not authentication** (a
holder of the shared bearer token can assert any login — it grants no privilege,
so the exposure is forged attribution only), and the Phase 2 **bearer token is
not swapped** — it stays the transport boundary with identity layered on top.
(The reviewer's flag that the code cited "REVIEW.md round 12" before it existed
was a forward reference to *this* entry — the same in-flight pattern as round 8;
the entry now exists, the reference is valid.)

**Security defects (fixed, with tests):**

| # | Finding | Fix |
|---|---|---|
| CQ1 | A capture **retry that failed again** orphaned the original row AND added a new one — the lobby grew one duplicate per click, unbounded | `retry` discards the original BEFORE re-running, so a repeat failure leaves exactly one fresh row; test covers retry-fails-again |
| D2 | **Membership never gated participation** — a non-member ("watcher" by push access) could claim, answer sign-offs, comment, capture | github-mode mutations now refuse a non-member (403, read-only watcher) — UI-side routing, the engine still enforces nothing; single-user (sentinel member) is unaffected |
| CQ4/N3 | Capture had no concurrency cap (a POST burst → unbounded SDK subprocesses); and was handed the **full** session allowlist | A 4-slot semaphore queues excess captures; the capture turn gets a capture-scoped `Bash(mkdir -p)` allowlist (Write rides canUseTool containment) |
| CQ2 | A non-member login set the auth cookie then returned a cosmetic 403 (a working session behind a rejection) | A successful login is 200 — a non-member is authenticated as a watcher, the `member` flag + warning carry the truth |

**Correctness defects (fixed, with tests):**

| # | Finding | Fix |
|---|---|---|
| G1 | `externallyResolvedAt` keyed a sign-off off the **topicless** `workunit.status-changed`, so any unit cancel/reactivate falsely resolved EVERY open sign-off card on the unit | Sign-off resolves only on the topic-addressed `phase.completed`; `workunit.status-changed` stays the signal for a unit-level lifecycle gate; regression test added |
| G2 | "Answered outside the UI" was joined only on the channel spine — a watcher on the **session thread** (the natural answer surface) saw the card hang open | The external-resolution join moved into `gateWithOwnership`, so thread, queue, and channel all flip the card |
| G4 | The queue overlay built its card from the **un-enriched** `/api/sessions` openGate — no owner badge, no watcher read-only, no unread block on that surface | `/api/sessions` now enriches openGate with ownership + unread + external-resolution |
| G3 | The **inferred-sessions** presence kind read a `presence` file that only exists for research/discussion — so for every OTHER phase it was **always empty** (dead deliverable) | Infers from the topic's cache `state.json` mtime (the lock signal the plan names); **verified live** — a touched spec cache now surfaces an `inferred` row |
| G5 | Capture dropped the **"who"** on the happy path (author never stamped) and had no message-level gesture | The route stamps the authenticated author onto provenance; a **capture-from-message** affordance rides each thread message with `{source, author, messageSeq}`; `messageSeq` now lands in the body. **Verified live** — the idea body reads "Captured via the workflow bridge by You" |
| G6 | Spec 5's default queue view is "mine + unowned + stuck"; the build returned ALL rows | github-mode filters out others'-owned-non-stuck live rows (single-user keeps everything) |

**Intent/UX (fixed):** the ownership badge (and whole overlay) is suppressed in single-user mode — identity stays invisible, zero-config (intent-1); artifact comment threads now render on the Artifact screen (deliverable 5's "gates AND artifacts"); a **claim** affordance is wired into the session thread, not only the queue; option rows are disabled (not dead) for a watcher / comment-blocked card; the gold reserved for gates no longer leaks onto comment/capture chrome (recolored to warn/nav); failed-capture rows show the error so a persistent failure isn't opaque; `whoami` sends the real repo (was a dead ternary).

**Accepted as-is (recorded honestly):** the **comment ceremony blocking all gate kinds** uniformly (not just sign-offs) is deliberate — the trigger is "a human bothered to comment," not the gate type, and clearing it is one click (opening the thread), so the friction is proportional to *someone raised a concern*, which is exactly when the answerer should look. The **comment-read→answer race** (a submit beating the mark-read round-trip can 409) self-corrects on retry and the local "seen" clears the block immediately; left as a minor. The **dual-human OAuth done-means walkthrough** is not automatable here (no two live GitHub identities, no live paid SDK sessions) — verified at the model/API level (backend + UI tests: ownership precedence, watcher-blocked/owner-allowed/stuck-claim, ceremony 409, capture success/failure/retry, external-resolution) and **live** for the single-user capture gesture (real inbox idea + provenance) and the presence/ownership/comment routes.

**Survived attack:** routing-never-authority holds (all ownership state is bridge SQLite; the engine is never touched; a terminal answer bypasses it and resolves the card externally); comments never push and quote-to-draft is explicit, never implicit injection; no SQL injection (prepared statements, fixed WHERE clauses, regex-pinned gate ids), no XSS (React text children; no new dangerouslySetInnerHTML), no token leak (`GITHUB_TOKEN` stripped by sessionEnv, never in argv/responses/logs); the capture payload is a prompt under the same containment as any session, not a shell string; out-of-scope respected (single-driver sessions, only owner/watcher, no process-side enforcement).

## Round 13: Phase 7 implementation review (2026-08-27)

Two parallel adversarial reviewers — fidelity/scope and security/quality — over
the MCP Apps distribution (workflow MCP server, card/queue `ui://` resources,
the answer round-trip). Both confirmed the two things that matter most:
**scope discipline holds** (no second card-logic implementation — the resources
render the frozen `shared/` schema and never recompute recommended/typed/owner;
no artifact lenses, telemetry, or channels leaked; not an SPA-in-an-iframe) and
**XSS is clean** (every interpolation in the `ui://` HTML is `esc()`-escaped,
attributes included). Findings folded:

**Defects (fixed, with tests):**

| # | Finding | Fix |
|---|---|---|
| F1 | The `ui://` resources were display-only shells — no script producer, so the option buttons and queue rows were inert and the gesture-attestation path had no originator | A feature-detected host-bridge `<script>` (OpenAI Apps `callTool` / MCP-UI postMessage) wires a real click → a host tool call; tap gates and queue-row-open now work; typed-confirm stays read-only (never originated from the widget) |
| S2 | `runStdio` grew its stdin buffer without bound (the HTTP path caps at 1MB; stdio had no guard) — a newline-less peer → memory exhaustion | 4MB cap; an over-long un-terminated frame is dropped and the parser resyncs |
| S3 | The typed-confirm attestation guard keyed off `holder.openGate?.id === gateId`, so the `bridgeSessionId` fallback branch skipped it (not exploitable — `sessions.answer` rejects a mismatched tail — but fragile) | `confirmModeOf` looks the gate's confirm up BY id (live card or the ledger's stored card), so the guard is independent of how the holder resolved |
| S4 | Every MCP answer was written to the ledger as `via: 'ui'` — the audit trail couldn't tell an MCP-host answer from an in-app one, and the `'mcp'` union value was dead | The MCP client sends `via: 'mcp'`; the route threads it into the ledger. The parity test now asserts identical answers/ledger-resolution but **differing provenance** (provenance ≠ parity) |
| F2 | `resources/list` advertised the gate-card resource but `resources/read` returned `-32602` for it | `resources/read` serves a gate-card template placeholder — list and read agree |

**Nits (fixed):** `initialize` now echoes the client's requested protocolVersion (MCP negotiation); an unknown-method **notification** (no id) gets no response (JSON-RPC forbids replying to notifications); the MCP client `encodeURIComponent`s the gateId (defense-in-depth — it's exported and self-validates nothing); `bridge mcp` warns when a github-mode deployment has no `WORKFLOW_BRIDGE_COOKIE` (fail-safe, but the refusals were opaque).

**Honest residual risk (S1, documented not "fixed"):** the typed-confirm attestation rests on the host setting `_meta['ui-gesture']` only from a real gesture — the bridge **cannot verify** that (`_meta` is a plain params field). The code comment now says so plainly instead of claiming "the model cannot forge it." The guarantee the server actually provides: a plain model tool call carries no attestation → rejected; the shipped widget renders typed-confirm read-only, so weakening it needs **both** a mis-implementing host **and** a prompt injection, not either alone. This is the best achievable given the MCP-host-mediated architecture; it is the same trust-boundary honesty as the round-12 OAuth deviation.

**Accepted as-is:** the positive parity test feeds the same literal down both paths (adequate — the load-bearing coverage is the negative rejection on the real server and the A-owns-refuses-B ownership test); a bridge-down tool call returns a `-32603` JSON-RPC error rather than a friendly `isError` (a valid degradation).

**Survived attack:** no unauthenticated answer path; secrets (bearer + cookie) come from env not argv, and never reach logs, responses, or the `ui://` HTML; the attestation is the single enforcement point (proven by the real-server negative test, gate stays `open`); the JSON-RPC loop handles malformed lines, missing params, and unknown methods without wedging.

## Rejected / amended findings

- Sufficiency's "SQLite schema has no consumers in Phase 0 — defer it": **rejected** in
  favour of pinning now (S7 showed deferral causes rework); the schema implements the
  spec docs, so it is no longer invented.
- Scope's "cut fixture to one stage": **amended** — fixture v0 is one stage, the
  three-stage set grows with the phases that need it, and the recorder makes regrowth
  cheap.
