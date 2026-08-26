# Phase 6 — Multiplayer

**Goal:** the collaboration half of the intent. Multiple humans in a channel with
unambiguous decision routing, capture from anyone, and presence — without changing the
workflow system's single-decider assumptions underneath. Ownership is **UI-side routing,
never process authority**: the workflow record has no concept of which human answered, and
the UI must not invent one that can disagree with it.

**Duration:** ~2 weeks.

## Deliverables

1. **Auth** — better-auth with GitHub OAuth, swapping the Phase 2 bearer token. The access
   rule, concretely: push access to the project's origin repo = member; checked via the
   GitHub API at login, cached per auth session. Single-user mode remains zero-config
   (the Phase 0 sentinel human).
2. **Gate ownership (routing, not authority)** — every gate is addressed to a named
   decider. Default precedence (the walkthrough caught first-to-open disabling the
   driver of a live session): **a gate raised by a session a named human launched or is
   driving belongs to that human**; otherwise the channel default — first authenticated
   human to open the channel — claimable and reassignable per gate and per channel.
   Stuck-owner handling per spec 5: an escalated gate with no owner activity for 24h
   enters everyone's default queue view with a "stuck — claim?" chip. In the UI, the owner's
   submit is enabled and watchers are read-only; the *process* enforces nothing. A gate
   answered from the terminal (or any path the UI doesn't mediate) resolves the card as
   **"answered outside the UI"** — outcome shown, ledger row unattributed. Notification
   policy targets the owner; watchers get digests.
3. **The capture gesture** — any human parks any channel message or text selection as an
   inbox item, via an **ephemeral headless session invoking the capture skill** with the
   payload as its single turn. Acknowledge optimistically, reconcile on completion; a
   **failed capture lands as a durable lobby row** ("1 capture failed — retry") with the
   payload retained UI-side until it succeeds or is discarded — never a vanishing toast. Roadmap
   parks are offered only once an agreed origin token exists upstream
   ([UPSTREAM.md](UPSTREAM.md) #3) — until then the roadmap-shaped capture lands in the
   inbox with a note, because `roadmap add`'s origin grammar is a validated token, not a
   free-text field. Message-level provenance (who, which message) lives in the UI ledger
   and the captured file's body — never in workflow state fields.
4. **Presence strips** — two kinds, rendered distinctly and honestly labelled: humans
   viewing (UI presence — this also replaces Phase 3's provisional activity signal) and
   sessions working (workflow heartbeats — **research/discussion only**; other phases
   show best-effort activity from lock mtimes and commits, marked as inferred).
5. **Comments, with ceremony** — channel-native threads on gates and artifacts (the
   Phase 0 `comments` table). A comment on an **open gate** badges the card and its queue
   row and renders an unread-comments indicator **on the confirm control** — a sign-off
   cannot be finalised without passing it (the walkthrough caught a blocking concern
   being signed over unseen). Comments never push. A quote affordance on each comment
   inserts it into the owner's answer draft; the bridge never injects bystander text
   implicitly.

## Explicitly out of scope

- Multi-human simultaneous conversation in one live session. One session, one voice.
- Roles beyond owner-or-watcher. No approval chains, no admin console.
- Any ownership enforcement in the process itself.

## Done means

- Two humans, one epic: A owns a spec sign-off; B comments and captures an idea from a
  message with one gesture; A signs off after typed confirm. The record shows the
  decision; the inbox shows B's capture with provenance in its body; the UI ledger
  attributes both; and the terminal view of the same repo agrees with all of it.
- The same sign-off answered from a terminal session instead renders "answered outside
  the UI" on A's card within one watcher cycle — no error, no stale open card.

## Risks

- **Ownership creep toward authority.** The moment a UI check blocks something the
  process would allow, the UI has forked the product. The routing/authority line above is
  the review gate for every ownership feature.
- **Capture-session latency.** An ephemeral session per gesture is seconds, not
  milliseconds; the gesture must acknowledge instantly (optimistic toast) and reconcile
  on completion.
