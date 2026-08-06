# Rerouted Concerns

*Shared reference. Loaded by the session wrappers of `workflow-discussion-process` and `workflow-research-process`; the session loops enter **A. Check** from their triage check each iteration.*

---

Surfaces the current topic's triage queue — concerns rerouted here from other topics, one engine-numbered file each, shape pinned in [triage-landing.md](triage-landing.md) — one at a time, through conversation. A concern leaves the queue only after it has been raised with its full context, worked with the user, folded into the topic's content as the record of that discussion, and absorbed under its own commit. An empty queue is a no-op. The conclusion gate backstops the whole protocol: the topic cannot conclude while its queue holds entries, so nothing is lost however freely the user moves.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit. Always present.
- `topic` — the current topic, whose queue is surfaced.
- `phase` — `discussion` or `research`. Selects the artefact and the fold shape.

## A. Check

List the topic's triage queue:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic queue {work_unit} {phase} {topic}
```

Route on the response and the session's state — first match wins. The opt-in and the live concern are conversation state: a context refresh loses both — re-offer, never re-assume.

#### If `count` is `0`

Nothing queued. No output.

→ Return to caller.

#### If a raised concern is still under discussion

The conversation owns it — its outcome routes through **D. Fold**, and the user moving on parks the queue. A parked concern is not under discussion: it waits for the natural-break branch below. Nothing to do here.

→ Return to caller.

#### If the opt-in is standing

The previous concern's absorb is the natural break.

→ Proceed to **C. Raise One Concern**.

#### If this is the session's first consult

**If the sitting resumed existing work** (the artifact predates this session — a resume or reopen; after a context refresh, treat the sitting as resumed):

Queued concerns may bear on the ground the session is about to build on: the offer precedes any session output — render it now, before the first question or thread.

→ Proceed to **B. Offer**.

**If the sitting began at initialization** (a first start or restart — this session created the artifact):

The topic has no conversational ground yet, and an agenda of other topics' concerns would seed the session away from its own material. Announce without offering — one line, count only, no titles:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render triage-announce {work_unit}.{phase}.{topic}
```

Emit its `DISPLAY: triage announce` section verbatim as a code block, then open the session from its own material. The first offer waits for a genuine break in the session's own thread — or the user asking for the queue; the natural-breaks checklist's just-opened signal never satisfies this deferral.

→ Return to caller.

#### If at a natural break

A concern landed mid-session, the user chose `later` earlier, or the sitting opened fresh with the queue announced. Consult the natural-breaks checklist — a recent `later` defers the re-offer until the conversation has genuinely moved on.

→ Proceed to **B. Offer**.

#### Otherwise

Mid-thread — never interrupt. The next iteration's check reconsiders.

→ Return to caller.

## B. Offer

Read the first two lines only of each queue file — the `### {title}` heading and the `*From: {origin} · {from_phase} · {from_date}*` provenance line. Never a body here. Write the agenda payload to `.workflows/.cache/{work_unit}/{phase}/{topic}/triage-offer.json` with the Write tool — one item per queue file, keyed by its basename:

```json
{"items": [{"file": "{NNN-slug}.md", "title": "…", "origin": "…", "from_phase": "…", "from_date": "…"}]}
```

Render the offer:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render triage-offer {work_unit}.{phase}.{topic} --file .workflows/.cache/{work_unit}/{phase}/{topic}/triage-offer.json
```

**If the response is `ok: false`** — the queue moved beneath the payload (a peer session landed a concern): re-run **A. Check**'s queue command, rebuild the payload over the fresh queue, and render again.

Emit its `DISPLAY: triage agenda` section verbatim as a code block, then its `MENU: triage offer` section verbatim as markdown (not a code block).

**STOP.** Wait for user response.

**If `discuss`:**

The opt-in now stands — it authorises surfacing each remaining concern in turn, never agreement to any concern's content, and the user can park the queue at any point by saying so.

→ Proceed to **C. Raise One Concern**.

**If `later`:**

No opt-in. The check re-offers at a later break; the conclusion gate holds regardless.

→ Return to caller.

## C. Raise One Concern

Take the lowest-numbered concern still queued — or whichever the user asks for. Read its queue file — `.workflows/{work_unit}/{phase}/.triage/{topic}/{NNN-slug}.md` — with the Read tool. The entry is your brief, never the user's display: it reaches the conversation only through your breakdown, and the raw entry is shown only when the user asks.

**If `phase` is `discussion`, arm the Discussion Map before presenting** — the map tells the truth while the concern is live, and routing a correction needs the body just read. Read the subtopic states:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion.{topic} subtopics
```

Route on the ground the concern reopens — the subtopic its title names (`{title:(kebabcase)}`), or, for a correction whose title names no subtopic, the subtopic whose recorded content it corrects — noting its prior state for the fold:

- Not on the map — new ground. Add it, then arm it:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map add {work_unit} {topic} {title:(kebabcase)}
  node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {title:(kebabcase)} exploring
  ```

- `decided` or `deferred` — settled ground is reopening — or `pending` — open ground coming under discussion. Arm it:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {title:(kebabcase)} exploring
  ```

- `exploring` or `converging` — already live. Leave it.

Present the concern in your own voice — name its origin in a sentence, then break it down. The reopened ground may be days old and the reader cold — the entry is the record, the breakdown is what makes it workable: what the concern actually asks of this topic, how it sits against what this topic already decided, and a concrete rendering of the problem — a worked example in the topic's own terms, a small diagram where shape or flow helps, a before/after. Every substantive point in the entry surfaces before the concern folds — the user decides from the substance, never from the title. An entry carrying one ask surfaces whole. An entry carrying several distinct asks — points the user could accept or reject independently — is walked one ask at a time: open with a one-line map of what the entry brings (titles only), then break down the first unresolved ask alone — on a fresh raise that is the first ask; on a re-raise of a half-walked entry, the first its earlier walk left open; each later ask waits for the one before it to resolve and gets its own full breakdown when its turn comes. Keep it simple and engineer-level, sized to the ask on the table, and vary the shape across a multi-concern queue — identical breakdowns read as a template, not a colleague. The breakdown covers this concern alone — for a walked entry, this ask alone: no other queued concern, open item, or finding rides along; a gap you spot while preparing the breakdown is your finding, not the entry's — it parks as a tangent (below), never joins the raise. The closing question spans nothing the user hasn't seen. The test: the user can picture the problem before the first question arrives. End in a single opening question.

**STOP.** Wait for user response.

Then discuss it as real session material: engage, challenge, connect it to what this topic has already decided. Control belongs to the conversation — this may take one exchange or many, and the loop's other machinery (documenting, commits, dispatch checks) runs as normal around it — the dispatch check's triage-queue box holds while entries remain, so no review launches mid-walk. The concern on the table is the session's only subject and the only thing the user's agreement can cover: a tangent it surfaces is parked — on the Discussion Map as `pending`, or bookmarked in the research file — and picked up after the queue empties, and no question or proposal spans another queued concern, however the user phrases their steer.

**If the discussion reaches an outcome** — a decision, a direction, or the user explicitly parking it as a deferred thread; for a walked entry, when its last ask resolves (earlier asks' outcomes are documented and committed by the loop's machinery as they land):

→ Proceed to **D. Fold**.

**If the user moves on without engaging it** — they bounce to another subtopic, another concern, or the main thread:

The concern stays queued and the opt-in is cleared — a half-walked entry keeps its unresolved asks, and its re-raise resumes at the first of them. Follow them; the check re-offers at a later break, and the conclusion gate holds until the queue is empty.

→ Return to caller.

## D. Fold

Record the discussion in the topic's content. An outcome that re-decides ground this topic didn't introduce — it names an entity, field, rule, or classification this topic's artifact didn't define — requires the sibling consult before it is recorded: follow **G. Sibling consult at cross-topic decision points** in **[knowledge-usage.md](../../workflow-knowledge/references/knowledge-usage.md)** — query or cite, and carry the `Sibling check:` line in the recorded decision.

A cross-topic correction tempts you to write guidance about the documents themselves. Do not: never write rules for how documents cite, edit, or point at each other, and never write lessons about how the topics drifted apart. The fold records only what changed and why, in the topic's own terms.

#### If `phase` is `discussion`

Write the outcome into the document:

- **A pure correction** (the outcome is only that cited material is out of date — nothing new was decided): amend the affected sites in place, each amendment a dated note naming the superseding decision — e.g. *(Amended {date} — this cited {thing}; {origin} retired it on {date})* — striking or rewriting the stale text as each site needs. No dedicated section and no Context block: the dated amendments and the absorb commit are the concern's record.
- **The concern's own ground** (the subtopic exists only because raising this concern added it — this raise's `add`, or an earlier raise of it the user moved on from): create a `## {title}` section whose `### Context` opens with a provenance line (`*From: {origin} · {from_phase} · {from_date}*`) followed by the concern's body, then document what the discussion concluded in the section's usual shape.
- **Pre-existing subtopic**: append the provenance line and the concern's body to that subtopic's existing `### Context` — never a new heading of your own. A map entry whose section was never written has nothing to append to: create the `## {title}` section exactly as the branch above prescribes.

Then set the map state — the fold corrects the record, it never advances the session's own open ground:

- **The concern's own ground** → wherever the concern's own discussion landed — `decided` with a fully written section when the outcome is a decision.
- **Reopened settled ground** (was `decided` or `deferred` before the concern's first raise): the re-decision lands as a dated entry on the block per the template's revision convention → set `decided`. An outcome that re-parks previously-`deferred` ground → set `deferred` — the one fold that may write that state: the raise showed the user exactly what is being set aside, and the fold notes the thread in Summary → Open Threads as the defer gate would. If the discussion left the ground genuinely open, leave it `exploring`.
- **The session's own open ground** (was `pending`, `exploring`, or `converging` before any raise of this concern): leave it where the arming put it — never `decided` from a fold, however settled the exchange felt. Deciding the session's ground is its own work after the queue empties.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {title:(kebabcase)} {state}
```

→ Proceed to **E. Absorb**.

#### If `phase` is `research`

Fold the concern into the freeform body as a `### {title}` thread opening with the provenance line, followed by the body and what the discussion made of it.

→ Proceed to **E. Absorb**.

## E. Absorb

Absorb the concern — one engine transaction deletes its queue file and commits the fold action-scoped under its name, bracketing the concern's life in history with the delivery commit that landed it. The response answers `remaining` — route on it; never recap the absorbed concern on either branch:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic absorb {work_unit} {phase} {topic} --file {NNN-slug}.md -m "{phase}({work_unit}/{topic}): absorb {NNN-slug} (from {origin})"
```

**If `remaining` is non-zero:**

Emit nothing here — no recap, no pause for permission. The absorb is the next raise's natural break: re-enter the check now, in this same turn, and the standing opt-in routes it straight to the next raise.

→ Return to **A. Check**.

**If `remaining` is `0`:**

Emit the clear line and nothing else — no recap of the walk:

> *Output the next fenced block as a code block:*

```
Triage queue clear — every rerouted concern is folded in.
```

The session continues wherever the map and conversation point: parked tangents, open threads, or conclusion if everything is settled.

→ Return to caller.
