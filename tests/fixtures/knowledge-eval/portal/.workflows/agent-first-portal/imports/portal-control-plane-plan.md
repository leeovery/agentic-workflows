# Portal: agent-aware control plane, the plan

## About this document

This is the complete plan for extending Portal, as worked out in discussion. It
is both the grand plan (the full vision and roadmap) and a handoff for the Claude
Code session that will start implementation.

How to read it:

- Everything here came from the discussion. No decisions have been added beyond
  what was discussed.
- Sections are tagged so you can tell settled calls from open ones. Treat
  **Decided** as fixed and **Open** as genuinely undecided. Do not resolve Open
  items unilaterally; raise them.
- "The full system" describes the whole target. "Build sequence" is the ordering.
  "Phase 0 in detail" is where implementation starts. Later phases are part of
  the plan, sequenced after Phase 0, not separate or optional unless said so.
- Style for any generated copy or docs: British English, no em dashes, direct
  and concise.

---

## Background and rationale

Portal today is a Go CLI that acts as a tmux session launcher and manager. The
user types `x` to open a picker (in Blink on iOS or Ghostty on desktop), or `xc`
to start a Claude session, with zoxide frequency scoring for routing into
projects and directories. Under the hood Portal owns session persistence: a
state daemon (currently an invisible session running inside tmux) captures
session structure and scrollback, restores sessions across reboots, and runs
per-pane resume hooks (for example `claude --resume`). That engine already works
well and is the asset.

The direction is to expand Portal, not rebuild it, into an agent-aware control
plane over the user's tmux sessions, with a mobile client. The reasoning that
informs the build:

- **Target user:** developers who run Claude Code and other agent CLIs but do
  not live in tmux and are not tmux power users. Not the tmux power-user crowd
  (they do not want this), and not non-developers who will not touch a terminal.
  The benefits they want: sessions survive a server restart, survive a computer
  restart, and can be picked up across devices (desktop, phone, iPad) so they
  carry on the same agent sessions anywhere.
- **Position on benefits, not mechanism.** tmux should be invisible. Whether the
  substrate is tmux or anything else is irrelevant to the user.
- **The moat is the host, not the client.** A working competitor (Moshi)
  publishes its entire client dependency list in-app, which demonstrates the
  client is assemblable from open-source parts. The defensible value is the host
  daemon, the existing tmux persistence engine, and the agent-awareness layer.
- **Business goal:** a small side business, roughly $5,000 to $10,000 MRR,
  on the order of ~1,000 paying users. Build for the user's own needs first,
  then add paid features. For reference, Moshi prices at roughly $6.99/month,
  $59.99/year, or $249 lifetime; this is comparison, not a pricing decision.

### Competitor reference points (validated during the discussion)

- **Herdr** is a standalone Rust multiplexer. It owns its own PTYs and vendors
  ghostty's VT parser; it does not use or integrate with tmux. It detects agent
  state two ways: a manifest system (declarative TOML rules that parse the
  rendered screen, the default, works with no install) and an integration system
  (per-agent hook scripts that report semantic state to Herdr over a socket,
  keyed by an injected `HERDR_PANE_ID` env var). Its Claude hook script is a thin
  shim that reads the Claude hook JSON on stdin and reports back; all logic is in
  the binary.
- **Implication for Portal:** the semantic hook path is multiplexer-independent.
  Portal can match it on tmux, correlating events to panes via `$TMUX_PANE`
  instead of `HERDR_PANE_ID`. Herdr keeps a structural edge only on the
  output-parsing path, because it owns the PTY. Portal can approximate that via
  tmux `pipe-pane`/`capture-pane` and pane titles (estimated 80 to 90 per cent,
  bolt-on) if and when output-based detection is wanted.
- **Herdr's manifest approach is a useful reference** for output-based detection,
  and its `claude.toml` is a worked map of how Claude's TUI signals each state.
  The *approach* can be reimplemented; do not copy Herdr's code without checking
  its licence first (the LICENSE file is full-length, consistent with copyleft,
  not vanilla MIT).
- **Moshi's client stack** (from its in-app open-source list, confirmed by
  screenshots): React Native and Expo (`expo`, `react-native` 0.85, `react` 19,
  `zustand`, `@tanstack/react-query`), terminal via **GhosttyKit** (libghostty,
  MIT), SSH via `russh`/`russh-sftp` (Apache-2.0) with Mosh implemented directly
  by Moshi rather than shelled out, on-device voice via `whisper.rn`,
  `parakeet.cpp`, `ggml`, purchases via `react-native-iap`, preview via
  `react-native-webview`, local store via `op-sqlite`, native bridges via
  `nitro-modules`, and Watch / Live Activities / Dynamic Island via
  `@bacons/apple-targets`. Direct dependencies 40, transitive 700+. This matters
  because it shows a credible client is a known parts list in the RN/Expo
  ecosystem, which aligns with the user's TypeScript background.

---

## Decided

These were settled in the discussion.

- **Keep tmux as the substrate, hidden.** The existing restore, scrollback, and
  resume engine stays as-is. Do not replace tmux. Do not build a new multiplexer.
- **Do not wrap the `claude` binary.** Launching stays agent-agnostic (Portal
  already launches a generic command in a session). The launch flow does not
  change: `x`, `xc`, and zoxide routing all stay identical. Awareness is a
  separate layer installed as per-agent hooks. One launch alias is acceptable for
  this audience.
- **Agent awareness is delivered via per-agent hooks**, starting with Claude
  Code, with other agents (Codex, OpenCode, and so on) added later as additive
  adapters. The substrate stays agent-agnostic; awareness is per-agent.
- **Surface agent state first in the existing picker**, not in a new dashboard
  page (see the host section).
- **Transport split:** Tailscale is the free and default path (this audience can
  install Tailscale easily, and it keeps nothing of theirs on third-party
  servers). A hosted relay is a Pro convenience for simpler setup, and is also
  the basis of a later team story. The relay must never be the only path, because
  routing code and transcripts through a vendor's servers carries a trust cost
  even when encrypted end to end.
- **The host is where the build effort goes.** The client is commodity; the
  daemon plus the agent layer is the product.
- **Build order is host first.** The client is not required to start benefiting;
  the host work pays off in Blink immediately and is the foundation every later
  phase reads from.

---

## Open (do not resolve unilaterally)

- **Client framework.** Moshi's RN/Expo stack is a strong lead and fits the
  user's skills, but no decision was made to build the client in RN/Expo.
- **Client terminal engine.** GhosttyKit (libghostty) is the lead, since it is
  what Moshi uses and is MIT. Not finalised.
- **Branding direction.** Leaning towards indie craft executed cleanly rather
  than a faceless "professional" tool. Not finalised.
- **Output-parsing detection.** Whether and when to add manifest-style screen
  parsing on top of hooks.
- **Exact client API contract** (session list, send, approve, diff, dev-server
  endpoints) was discussed only at a high level and is not finalised.
- **Relay implementation details** (rendezvous, end-to-end encryption specifics,
  APNs path) discussed at a high level only.

---

## Agent state model (as discussed)

States discussed: **Working**, **Waiting** (blocked on a permission or input),
**Idle**, and **Unknown**. ("Done" was used interchangeably with returning to
idle on turn completion.)

Claude Code hook event to state mapping discussed:

- `PreToolUse` / `UserPromptSubmit` -> Working
- `Notification` -> Waiting (blocked)
- `Stop` -> Idle / turn complete
- `SubagentStop` and subagent events -> filtered out (do not let a subagent
  event change the main pane's state)

Pane correlation: the hook runs inside the pane, so it can read `$TMUX_PANE` and
include it in the event. The daemon keys state by pane.

This per-session state is the spine of the whole plan. Every surface below, the
picker, the status line, notifications, and the client, reads from it. The host
must know the state before anything can show it.

---

## The full system

The whole target, as discussed. The build sequence after this section is just
the order in which these pieces arrive.

### Host: the control plane

The existing daemon grows from a state-saver into the control plane. Nothing
about the core persistence engine changes; this is additive.

- **Agent-state tracker.** Per-agent hooks installed into each agent's config
  (Claude first), reporting events to the daemon over a unix socket, correlated
  to panes via `$TMUX_PANE`, normalised into the state model above.
- **Agent store.** The single source of truth in the daemon: in-memory,
  concurrency-safe, with a persisted snapshot so state survives a daemon blip.
- **Existing tmux engine retained.** Restore, scrollback capture, and resume
  hooks continue exactly as now.
- **Daemon IPC socket.** The local channel the hooks report to, and the same
  channel the client and relay dial later.
- **Surfacing in the picker.** Inline agent-state glyph on every session row, in
  every view (flat, by-project, by-tag, rolled up on the projects page), using a
  glyph distinct from the existing "attached" dot, because connection state and
  agent state are different axes. Plus a "by status" / "needs attention" view
  mode alongside the existing views, sorted so Waiting floats to the top. No
  separate dashboard page; the dashboard is a lens, not a page.
- **Ambient surfacing outside the picker.** Because the user is rarely sitting in
  the picker, the picker alone is pull-only. A tmux status-line segment Portal
  owns shows the aggregate from inside any session (for example "2 waiting"),
  always in peripheral vision, with a keybind to jump to the waiting sessions.
  Notifications push the same signal: macOS at the desk; on mobile, the daemon
  emitting an OSC 9 sequence to the active session surfaces a banner through
  Blink (limited to the active session until the client exists); client push
  later.

### Client: the mobile surface

Structured-first, terminal-on-demand. The inverse of a terminal-first app with
status bolted on. The desktop "client" is the existing picker reading the same
daemon, so desk and phone share one source of truth.

- **Control tower.** Live session list with agent state, Waiting first. The home
  screen.
- **Approvals.** Tap a Waiting session, see the tool and its input, Approve or
  Deny. Also wired to lock-screen notification actions.
- **Native compose box.** A native text field that sends to the pane (mapping to
  tmux `send-keys`), giving autocorrect, dictation, multi-line, and image paste,
  and sidestepping per-keystroke latency because the text is local until sent.
- **Embedded terminal.** A real terminal for the raw view, embedded rather than
  written from scratch (GhosttyKit/libghostty is the lead). Kept hot across
  sessions the way Blink does, using Mosh for resilience and predictive echo
  (the unconfirmed-keystroke underline behaviour) so it survives roaming and poor
  mobile connections. The live terminal is co-primary, not a corner.
- **Diff viewer.** A native render of `git diff` in the session's git root, which
  the host already detects.
- **Browser preview.** An in-app webview over a forwarded dev-server port,
  labelled by which session owns it.

### Transport

Two planes, deliberately separated.

- **Data plane.** Tailscale by default: the daemon's API on the host's Tailscale
  interface, reached peer-to-peer over WireGuard, nothing exposed publicly. The
  embedded terminal uses Mosh/SSH. This is the free path and the technically
  stronger one for the resilient terminal, because WireGuard handles roaming
  underneath.
- **Relay (Pro).** A hosted rendezvous relay for users who want simpler setup:
  the daemon holds an outbound connection, the phone connects to the same relay,
  they meet in the middle, which punches through NAT with no config. Kept private
  by end-to-end encryption with the relay as a dumb forwarder. The trust cost
  (data crossing a vendor's servers, even encrypted) is why the relay is never
  the only path. It is also the natural basis for the team story, where a vendor
  relationship is already accepted.
- **Custom multiplexed protocol (optional, future, not the moat).** A single
  resilient client-to-daemon protocol carrying all sessions hot over one
  connection plus the structured channel, instead of N connections. This is an
  efficiency and battery optimisation, not a requirement: Blink plus Mosh already
  delivers the instant, alive, resilient, all-sessions-hot experience off the
  shelf. Build it only once paying usage justifies it; it is not where the moat
  lives.

### Persistence and boot

- The in-tmux daemon continues to do the heavy state capture; it is up whenever
  tmux is.
- A thin `launchd` boot agent is added whose only jobs are to come up at boot,
  restore sessions, and hold the connection, so the "reboot the Mac, pick up on
  the phone without first sitting at the desktop" case works. The justification
  for adding it is that single use case, not "launchd is nicer".

### Productisation and business

- **Free:** the CLI and the desktop control plane.
- **Pro:** the mobile app, push, and the relay.
- **Setup:** ideally one line on the host (for example `curl ... | sh`) that
  installs Portal, checks for and silently installs tmux if missing, starts the
  daemon, installs the agent hooks, and prints a pairing code. Then install the
  app and pair. The agents run on the user's own always-on machine; this is a
  reach-your-own-machine product, not a cloud one.
- **Team (future).** A company already accepts vendor relationships and would pay
  for managed infrastructure and shared host access, which lowers the relay's
  trust cost inside an org. Parked, noted here so the plan holds it.

---

## Build sequence

The order in which the full system arrives. Each phase reads the per-session
agent state that Phase 0 establishes.

- **Phase 0:** agent state captured on the host and surfaced in the picker, the
  tmux status line, and notifications. No client, no relay, no protocol. Benefits
  immediately in Blink and on the desktop. Detailed below.
- **Phase 1:** thin `launchd` boot agent plus a minimal push path, so a block
  reaches the phone and deep-links into Blink. Validates the loop with almost no
  client code.
- **Phase 2:** thin client (control tower list with state, approval cards, native
  compose box) over Tailscale, with an embedded terminal for the raw view.
- **Phase 3:** diff viewer, browser preview, polish, brand.
- **Phase 4:** productise (Pro paywall around the mobile app, push, and relay; a
  one-line installer; team angle when earned). The custom multiplexed protocol
  is considered here or later, only if paying usage justifies it.

---

## Phase 0 in detail (the starting point)

Goal: agent state captured on the host and surfaced in the existing picker, with
no client, no relay, and no protocol. Benefit is immediate in Blink and on the
desktop, and the state model becomes the foundation every later phase reads.

### Proposed package layout (from the discussion)

This structure was proposed and is the starting point, in the project's
`internal/` convention. Treat the names as a sensible default, not as sacred.

```
internal/agent/
  agent.go         // AgentState (Working/Waiting/Idle/Unknown), Event type
  state.go         // hook-event -> state mapping (pure, heavily tested)
  store.go         // concurrency-safe per-pane state map, subscribe, snapshot
  adapter/
    adapter.go     // Adapter interface + registry
    claude/        // parse Claude hook JSON -> agent.Event
    codex/         // later, additive
  install/
    install.go     // idempotent, versioned hook install into agent settings
cmd/
  agent.go         // `portal agent ingest | install | status`
```

### Data flow

Claude event -> installed shim -> `portal agent ingest` (reads stdin JSON plus
`$TMUX_PANE`) -> adapter normalises to `agent.Event` -> unix socket -> daemon
listener -> `agent.Store` updates that pane's state -> fan-out to consumers.

### Design rules (as discussed)

- **The installed hook is a thin shim** (a few lines) that only calls the Portal
  binary. No parsing logic in shell. This mirrors Herdr's approach.
- **All parsing is Go, behind an `Adapter` interface**, one package per agent, so
  adding Codex or OpenCode later is a new package rather than a rewrite.
- **`agent.Store` is the single source of truth** in the daemon: in-memory,
  concurrency-safe, with a persisted snapshot.
- **Consumers are decoupled readers**, each its own small package that depends on
  `agent` and never the reverse, so the domain knows nothing about them and each
  is independently testable:
  - the TUI reads a snapshot file the store writes (matching how the picker
    already reads `sessions.json`),
  - a statusline sink writes the tmux status segment,
  - a notify sink fires alerts.
- **Keep agent hooks separate from the existing resume hooks** in
  `internal/hooks`. Different concepts; sibling packages, do not merge them.
- **Version the installed hook** (as Herdr versions its integrations) and make
  install idempotent and non-destructive: merge one discrete entry into the
  agent's settings rather than clobbering the user's own hooks.
- **Daemon IPC socket:** if the daemon does not already expose one, this Phase 0
  work introduces it. It is the same channel the client and relay will dial
  later.
- **No `launchd` change needed for Phase 0.** The in-tmux daemon is up whenever
  tmux is, which is whenever there are sessions to track.

### TUI changes (Phase 0 surface)

- **No separate dashboard page.**
- **Inline agent-state glyph on every session row**, in every place a session
  appears, distinct from the "attached" dot.
- **Add a "by status" / "needs attention" view mode** alongside flat,
  by-project, and by-tag (the picker already switches views with `s`), sorted so
  Waiting floats to the top.

### Ambient surfacing (Phase 0)

- **A tmux status-line segment Portal owns**, showing the aggregate from inside
  any session, with a keybind to jump to the waiting sessions. This is the
  emphasised piece: resident, ambient, terminal-first.
- **Notifications:** macOS at the desk; on mobile, the daemon emitting an OSC 9
  sequence to the active session surfaces a banner through Blink (active session
  only until the client exists).

### Phase 0 build sub-order

1. `internal/agent` domain plus the Claude adapter and `portal agent ingest`,
   with the hook install command.
2. Inline state glyph in the picker rows and the "by status" view mode.
3. The tmux status-line segment.
4. Notifications (macOS desk, OSC via Blink on mobile).

One thing worth checking against current Claude Code behaviour when work starts:
the hook event to state mapping in the agent state model section, since the whole
layer keys off it.
