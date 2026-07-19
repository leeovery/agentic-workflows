# Research and Discussion

Two conversational phases with different jobs. Research explores: feasibility, options, market and technical unknowns, no decisions required. Discussion decides: options weighed, trade-offs argued, rationale captured. A topic routed to research flows into discussion afterwards; a topic whose shape is already clear starts at discussion directly. For features and cross-cutting concerns research is optional; for epic topics the [discovery map's](discovery.md#the-discovery-map) `routing` field records the intent per topic.

Both phases share a spine: a live conversation, an artifact file updated at natural pauses and committed on every write, background agents that critique the work while it happens, and two mandatory quality passes before conclusion. Completed artifacts index into the [knowledge base](knowledge-base.md), and both phases open with a contextual query against it, so ground already covered by a sibling topic or an earlier work unit is pulled in rather than re-trodden.

## Research

Claude acts as a research partner with the session anchored to one file: `research/{topic}.md`. The file is freeform, structure emerges from content. The rhythm is a funnel: broad probes first, specifics later, one question at a time, and engagement over collection. React to answers, challenge assumptions, connect threads, and synthesize periodically ("so what I'm hearing is..."). At natural pauses the file gets the substance, not a transcript, and every write commits: the history is the safety net across context compaction.

### Background review

After each meaningful commit, a dispatch check runs against a trigger checklist: real content landed, no prior review still undrained, not the first commit, a few exchanges since the last dispatch. When it passes, a [review agent](agents.md) reads the research with a clean slate in the background and returns coverage gaps, shallow areas, and unvalidated assumptions. Blocking on undrained reviews is deliberate: a fresh review over findings still being explored would critique a version the user is already extending, and the block is self-healing since the next meaningful commit re-fires the trigger.

### Deep dives

When a thread deserves dedicated investigation (a competitor mentioned but not examined, feasibility assumed but not verified, an API with uncertain capabilities), the session offers a deep-dive agent: an independent background investigation with a self-contained brief, running while the conversation continues. Three to four can run concurrently. On an epic, findings substantial enough for their own file can be promoted to a new research topic; the topic lands on the discovery map with `source: research-split:{parent}` provenance. On a feature there is one research topic, so findings fold into it.

### Findings never get dumped

All background results flow through one shared surfacing protocol (`workflow-shared/references/background-agent-surfacing.md`) with three hard rules:

1. **Two-phase surfacing.** First a micro-menu acknowledging results exist, count only, no content. Findings start flowing only after the user opts in.
2. **One finding per turn.** Each finding is digested and reframed as a single concrete question tied to the current context, never read out verbatim, never bundled into a list.
3. **Mid-thread protection.** Mid-Q&A, the announcement waits for a natural break; at most a one-line parenthetical, once.

The protocol is a turn-level check, not a state machine held in memory: each cache file's frontmatter (`status`, `surfaced`, `announced`) is the only state, so surfacing survives compaction and every finding is eventually raised, engaged with or deflected. Deflected findings land in the file's Open Questions rather than vanishing.

### Drift and splitting

Epic research watches its own scope. When off-topic material accumulates across multiple exchanges, the session offers to split the drifted threads into their own research files, each landing on the discovery map as a new topic. Never silently: the user confirms every split.

## Discussion

Claude acts as an expert architect, and the conversation is organic. What keeps it navigable is the **Discussion Map**: typed state in the manifest (`phases.discussion.items.{topic}.subtopics`), written through the engine, rendered on demand. Subtopics move through five states:

| State | Meaning |
|---|---|
| `pending` | Identified, not yet explored. Tangents, agent findings, and new concerns land here. |
| `exploring` | Actively discussed. One or two at a time, the conversation is linear. |
| `converging` | Options clear, trade-offs understood, a decision is close. |
| `decided` | Decision reached with rationale. The file gets a full Context → Options → Journey → Decision section. |
| `deferred` | Deliberately set aside at conclude-anyway time, noted in the Summary's open threads. |

The state calls are Claude's judgment; recording them is the engine's:

```bash
engine discussion-map add {wu} {topic} {subtopic} [--parent {parent}]
engine discussion-map set {wu} {topic} {subtopic} {state}
```

Each `set` answers with `all_decided` and `unresolved_count`, so the session always knows how far from convergence it is without a follow-up read. Subtopics nest two levels: a parent can be `exploring` while a child is already `decided`. The decision knowledge lives in the discussion file; the map state lives in the manifest only, never written into the file.

### Perspective agents

At a decision point with genuine ambiguity (multiple defensible approaches, known competing paradigms, or the user saying "they both seem fine"), the session offers a pair of perspective agents. Pairs come from a polarity table keyed on the decision's domain, deliberate counterweights so the angles are orthogonal: Formal Systems ↔ Incentive Realist for contract design, Common Path ↔ Tail-Risk for failure handling, Ship Now ↔ Strategic Timing for release questions, Assumption Destroyer ↔ First-Principles as the default. Each agent argues its lens in the background; before arguing, it must restate the decision through its lens (the Problem Restate Gate). When both complete, a synthesis agent reconciles them into a tradeoff landscape of tensions. If the restatements diverge on what the decision even *is*, synthesis records that framing mismatch as the first tension, so wrong-question failures surface before the user acts on the answers. Tensions surface one at a time through the same never-dump protocol, and engaged tensions become new `pending` subtopics.

### Off-topic concerns

A concern that belongs to a *different* topic is not this discussion's to resolve. The heuristic: a detail informing a decision within the current topic is a subtopic (keep it); a concern owned by another topic gets rerouted. On an epic, the reroute lands the concern, with full context, in the target topic's `## Triage` section, where that topic's next session drains it; the target can be an existing topic or a new map item created on the spot with `source: reroute:{origin}`. Single-topic work has no sibling to route to, so the choices become: log it to the [inbox](inbox-and-capture.md), [pivot](lifecycle-tools.md#pivot-feature--epic) the feature to an epic so the concern can be a topic, or note it and move on.

### Convergence and conclusion

Discussion concludes when every subtopic is `decided` or `deferred` and **at least one review cycle has run**. The review-cycle floor is enforced: if the user signals conclusion with zero cycles, a review agent is dispatched in the foreground and its findings surface before wrapping up. Concluding with unresolved subtopics is allowed but explicit: the map renders, the undecided items are listed, and confirming defers each one by name. A final gate checks for in-flight background agents (wait, or conclude and leave results in cache).

## The two closing passes

Both phases run the same pair of mandatory checks before concluding, covering complementary failure modes:

- **The review agent catches topical gaps**: areas that should have been explored and weren't. A sub-agent can do this because it reads the artifact cold.
- **Document review catches conversational gaps**: only the orchestrator can, because it was in the conversation. It re-reads the artifact in full and reconciles it against the session on three dimensions: undocumented substance (discussed but never written, the most common failure as long sessions crowd out early exchanges), hallucinated content (claims that trace back to nothing actually said), and accuracy drift (tentative leans written as decisions, softened user views, firmness inflated). Gaps get added, hallucinations removed, drift rewritten, and the corrections committed.

Conclusion then marks the phase item complete (`engine topic complete`), which indexes the artifact into the knowledge base for every later phase and sibling work unit to query.

## Self-healing the map

Two analyses keep an epic's discovery map honest, running not inside any session but at the epic's entry points: the [dashboard's](how-it-fits-together.md#the-epic-dashboard) boot housekeeping and the [bridge's](how-it-fits-together.md#the-bridge) between-phase enrichment.

- **Research analysis** reads all completed research files, cross-references themes across them, and stages follow-up topics with `source: research-analysis:{parent}` provenance.
- **Discovery gap analysis** reads completed research *and* completed discussions holistically, hunting four gap types: cross-artifact themes no artifact owns, research themes no discussion addressed, emergent topics from deferred threads, and integration gaps where separate decisions interact but nothing covers the seam.

Both are checksum-cached against their input files (`engine cache stamp`), so they re-run only when completed-artifact content actually changes. Neither writes to the map directly. Candidates already on the map merge silently (provenance accumulates on the existing item); dismissed names are skipped silently (dismissal means "don't re-propose"); genuinely new candidates go through a per-topic approval gate where the user accepts, edits, or declines each one. The map grows, but only ever with consent.

---

*Next: decisions become a buildable contract in [specification](specification.md).*
