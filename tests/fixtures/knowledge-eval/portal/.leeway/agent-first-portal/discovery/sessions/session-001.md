# Discovery Session 001

Date: 2026-06-26
Work unit: agent-first-portal

## Description (as of session)

Reposition Portal as an agent-first tool — internal multi-agent session
resume, an in-tmux pop-up overlay, a mobile companion app, and push
notifications for remote agent handoff.

## Seed

(none)

## Imports

- imports/portal-control-plane-plan.md

## Map State at Start

(empty — first session)

## Exploration

The user wants to deliberately reverse Portal's standing design stance.
Portal has been agent-agnostic on purpose — its resume mechanism is
generic and its UI/messaging never names Claude (or any tool). The user
now wants to lean *into* agents, making Portal agent-first. They were
explicit that this is an intentional foundational shift, not a tweak.

Two stated motivations: (1) adoption — "agent-first" is a popular framing
right now and likely draws more users; (2) honesty — the user's own
practically-exclusive use of Portal is as a Claude Code session manager /
remote-handoff tool (a tmux wrapper), so the agnostic framing understates
the real use case. Multi-agent, not Claude-only, was emphasised.

Several distinct capability seeds surfaced from one description, and the
user's own framing ("a lot of moving parts") signalled multi-topic scope.
The seeds cluster into a local in-tmux story and a remote story:

- Internal multi-agent resume — fold the agent-session resume system into
  Portal so it's managed for the user, rather than relying on an
  externally-registered hook the user wires up themselves. Spans multiple
  agents, not just Claude Code.
- Portal-as-overlay — a Portal pop-up accessible from inside tmux while an
  agent runs, for actions like detach/quit and renaming sessions/windows/
  panes. Would replace the user's current Alt+M tmux overlay tool. The
  user does not want Portal to reimplement all of tmux — just to surface
  the relevant Portal/tmux actions as a clean overlay.
- Mobile companion app — a terminal app wrapping the Ghostty lib that
  communicates with Portal cleanly, for remote use.
- Push / lock-screen notifications — alerts to the phone when an agent
  needs the user's input or attention.
- Agent-first repositioning — the connective spine: shift Portal's
  product thesis and messaging from agnostic to agent-first.
- (Uncertain) Portal surfaced from inside the agent itself — the user
  floated this and flagged it as "not sure if that's a good idea."

The work-type read converged on an epic — several independently-shippable
features sharing one vision — and the user confirmed it. Topic synthesis
and per-topic routing are deferred to the discovery session loop.

After the epic was created, the user retroactively imported a substantial
handoff document (imports/portal-control-plane-plan.md) — the output of a
prior discussion that frames the whole initiative as growing Portal into
an "agent-aware control plane over tmux sessions, with a mobile client."
It is far more developed than the opening conversation and reshapes the
map. Major surfaces it names (recorded as shape, not as settled topic
decomposition — synthesis is still deferred):

- Agent-state model — Working / Waiting / Idle / Unknown, the spine every
  other surface reads from; captured on the host via per-agent hooks
  (Claude first, multi-agent later) correlated to panes by $TMUX_PANE.
- Host control plane — the existing in-tmux daemon grows an agent-state
  tracker, an agent store (single source of truth), and a daemon IPC
  socket; agent state surfaces inline in the existing picker rows plus a
  "by status / needs attention" view mode.
- Ambient surfacing — a Portal-owned tmux status-line segment and
  notifications (macOS at desk; OSC 9 banner via Blink on mobile).
- Mobile client — structured-first surface: control tower list, approval
  cards, native compose box, embedded terminal (GhosttyKit lead), diff
  viewer, browser preview.
- Transport — Tailscale as the free/default data plane, a hosted relay as
  a Pro convenience (never the only path), an optional future custom
  multiplexed protocol.
- Persistence/boot — a thin launchd boot agent for the reboot-then-pick-
  up-on-phone case.
- Productisation — free CLI + desktop control plane; Pro = mobile app,
  push, relay; one-line installer; parked team story.

The document also carries a build sequence (Phase 0 = host-side agent
state + picker/status-line/notification surfacing; Phases 1–4 = launchd +
push, thin client, diff/preview/brand, productise) and an explicit
Decided / Open split. The document's internal decisions and phasing are
the user's prior work; they inform the shape here but topic synthesis,
routing, and any planning/phasing remain for the downstream phases.

Two surfaces from the opening conversation are NOT in the import plan;
the user confirmed both are in scope for this epic:

- In-tmux Portal pop-up overlay — a Portal overlay accessible while an
  agent runs, for rename/detach/quit of panes·windows·sessions; replaces
  the user's current Alt+M tmux overlay tool. Not a full tmux reimpl —
  just the relevant Portal/tmux actions surfaced cleanly.
- Auto-registering the resume hook — making the resume-hook registration
  internal/managed by Portal rather than hand-wired by the user. Distinct
  from the plan's versioned installer for the agent-awareness hooks (the
  plan keeps the resume engine itself "as-is").

The user confirmed everything sketched — the import plan's full system
plus these two surfaces — is in scope. Endpoint reached; ready to
synthesise topics.

## Edits

(none)

## Topics Identified

### agent-state

- Routing: discussion
- Why: the import has the host-side architecture largely designed; the one open thread (verifying Claude hook→state mapping; non-Claude signalling) can be a research spike inside the discussion.

### agent-state-surfacing

- Routing: discussion
- Why: extends the existing picker/TUI and tmux status line; clear shape, existing decision space.

### session-control-overlay

- Routing: discussion
- Why: clear UX shape over existing tmux ops; replacing a known tool the user already uses.

### resume-hook-internalisation

- Routing: discussion
- Why: mechanism is fairly clear (reuse the versioned hook-install machinery); the question is ownership, not feasibility.

### mobile-client

- Routing: research
- Why: client framework and terminal engine are explicitly open in the import (RN/Expo and GhosttyKit are leads, not decided).

### transport

- Routing: research
- Why: relay implementation, end-to-end encryption specifics and the APNs path were discussed only at a high level — open feasibility.

### productisation

- Routing: discussion
- Why: mostly deciding posture (Free/Pro split, installer, pricing stance, positioning); competitor research already done in the import.

## Conclusion

7 topics added. Map now has 7 topics.
