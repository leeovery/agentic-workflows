# Background Agent Surfacing

*Shared reference for workflow skills with background agents (review, perspective/synthesis, deep-dive).*

---

This reference defines how to surface findings from background agents without dumping walls of text. It is loaded by agent reference files with parameters for the specific agent type. All lifecycle state lives in the engine's agent store — never in the content files, whose markdown is the report and nothing else.

**Parameters** (provided by caller via Load directive):

- `agent_type` — `review` | `synthesis` | `deep-dive` — human-readable name used in user-facing messages, and the row kind this invocation surfaces
- `work_unit`, `phase`, `topic` — the agent store address

## The Core Rules

**Never dump findings.** Three hard rules govern every surfacing interaction:

1. **Two-phase surfacing.** First acknowledge the report exists (micro-menu, no content). Only after the user opts in, start raising findings one at a time.
2. **One finding per turn, then exit.** Each invocation of this protocol does at most one thing and hands control back. Never expect the protocol to "resume" after the user has engaged with a finding — the next session-loop check will pick up the next one at the next natural break.
3. **Mid-thread protection.** If you are mid-Q/A with the user, defer the announce menu until the next natural break. A one-line parenthetical is acceptable, but only the first time.

Natural-break detection is guidance, not hard-enforced.

→ Load **[natural-breaks.md](natural-breaks.md)** and follow its instructions as written.

## LLM Turn Semantics (IMPORTANT)

This protocol runs as a turn-level check, not a long-running state machine. Each invocation runs one `agent scan`, does at most one thing with its answer (a parenthetical, a menu, or one raised finding), and exits back to the session loop. Once you raise a finding, control belongs to the conversation. The user engages naturally — it may take five turns or fifty. Do NOT wait "inside the protocol" for that engagement to finish. The next iteration of the session loop's check will re-enter here and scan again; the row lists say exactly where things stand (the response's `next` is a default that ignores your `agent_type` — the kind filter below decides).

**The engine store is the only state.** Never track surfacing progress in conversation memory, and never write it anywhere else.

## A. Check for Results

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} {phase} {topic}
```

Consider only rows whose `kind` matches `{agent_type}` (other kinds belong to their own loaded reference; perspective rows are synthesis inputs and are never surfaced here).

#### If no matching row is `pending` or `acknowledged`

Nothing to surface.

→ Return to caller.

#### If a matching row is `pending`

→ Proceed to **B. First Read** with that row.

#### If a matching row is `acknowledged`

The report was first-read on an earlier iteration; the row carries `announced`, `surfaced`, and `remaining`.

→ Proceed to **C. Decide Action** with that row.

## B. First Read

Read the row's content file completely — `.workflows/.cache/{work_unit}/{phase}/{topic}/{id}.md`. The finding ids come from the agent's returned status block (its `FINDINGS:`/`TENSIONS:` line — the author's own declaration); when that message is no longer in context, fall back to the file's `### {ID}:` section headings. Cross-check the count either way.

#### If the report has no findings (zero-gap case)

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent ack {work_unit} {phase} {topic} {id} --clean
```

The engine incorporates the row. No menu needed — append this single line at the end of your current turn:

> *Output the next fenced block as a code block:*

```
Background {agent_type} returned — nothing new beyond what we've already covered.
```

→ Return to caller.

#### Otherwise

Record the findings on the row:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent ack {work_unit} {phase} {topic} {id} --findings {F1,F2,…}
```

→ Proceed to **C. Decide Action** with the response's row.

## C. Decide Action

The row's `remaining` list is the unsurfaced set; `announced` and `surfaced` route what happens now.

#### If NOT a natural break

Consult the natural-breaks checklist. Route on the row's `announced` flag.

**If `announced` is `false`:**

Append this one-line parenthetical at the end of your current turn, then record it:

> *Output the next fenced block as markdown (not a code block):*

```
*(Background {agent_type} just returned — I'll raise it when we pause.)*
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent announce {work_unit} {phase} {topic} {id}
```

→ Return to caller.

**If `announced` is `true`:**

The user already knows the report is waiting. Silent return — no output. The next natural break will pick it up.

→ Return to caller.

#### If a natural break

Route on the row's `surfaced` list: empty means the user has not yet opted in; non-empty means they picked `now` on a prior iteration and more findings remain.

**If `surfaced` is empty (first time at a break):**

Render the announce menu. Do not describe findings, do not summarise, do not preview — just the count and the menu.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Background {agent_type} returned — flagged {N} area(s).

- **`n`/`now`** — Walk through them one at a time
- **`l`/`later`** — Keep pulling on the current thread, I'll raise them at the next pause
· · · · · · · · · · · ·
```

After rendering the menu, record the announce:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent announce {work_unit} {phase} {topic} {id}
```

**STOP.** Wait for user response.

**If `now`:**

→ Proceed to **D. Raise One Finding**.

**If `later`:**

Nothing surfaced yet, so the next natural break re-renders this menu.

→ Return to caller.

**If `surfaced` is non-empty (user already opted in, more findings remain):**

Do not re-ask. The user has already committed to walking through the set.

→ Proceed to **D. Raise One Finding**.

## D. Raise One Finding

This section runs once per invocation and then exits. It never waits in-protocol for the user to finish engaging — that's the conversation's job.

1. Pick the single most contextually relevant finding from the row's `remaining` — never from `scan.next`, which may belong to another row. **Contextual relevance outranks the list order.** When engaging the previous finding built a scene — a worked scenario, a diagram, one corner of the document — prefer remaining findings that live inside it, and exhaust them before opening a new corner: the reconstruction is already paid for. Otherwise, if the current conversation has just touched on a related area, prefer that finding; if nothing is particularly relevant, pick the one with the broadest implications.
2. Record it — the response confirms what remains, and raising the last finding incorporates the row automatically:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs agent surface {work_unit} {phase} {topic} {id} {finding}
   ```
3. Digest the finding from the content file — never read it out — and compose the raise in three beats. A findings walk is a series of cold starts — each raise lands in a corner of the document the user last held fully hours or days ago — so the first beat rebuilds that context rather than referencing it:
   - **Present** — scene reconstruction before any assessment: say where it came from (the background {agent_type}) and what it observed — for a synthesis, the two positions in tension — then rebuild the scene as **Setting the scene** below prescribes. Restate any term borrowed from another subtopic or an earlier decision; never reference it bare. Never use a bare id (`F5`, `T2`) as a label in conversational prose — name the finding by its report title on first mention, or describe it by what it is; ids belong in commit subjects (`(review-003 F5)`) and in-document markers (`(resolves review-003 F5)`), not in the conversation. When earlier findings from this set have been raised, open with a one-line bridge: what the previous one settled — or simply that it was raised, when that engagement predates this session — and how many follow this one (the surface response's `remaining`; `findings` is the full set).
   - **Position** — your read, only where you genuinely have one: verified it holds, narrower than framed, already covered by a decision made since the report. Skip the beat rather than manufacture a verdict.
   - **Move** — sized to how open the decision is as much as how cold the context: a clear resolution — propose it and name what it costs ("this creates X and Y; I don't see another approach"), never an option survey; genuinely open — sketch the option space in a sentence or two; needs investigation — suggest research or a deep-dive.
4. Raise it in the current turn, ending in a single question — or, for a finding with one defensible resolution, a stated proposal awaiting the user's response. Either way the turn ends and control returns: one finding per invocation regardless of how settled, and the user's agreement is never licence to roll into the next. No bundled follow-ups, no menu.

**Setting the scene** — an example over a description, every time. A reader who can picture the failure can judge the fix; a reader parsing a mechanism description is still building the picture when the ask arrives.

- **The arc**: establish the normal scenario as a concrete instance — the topic's own terms or the product's, named actors, actual values, a real sequence — and show it resolving fine. Then adjust the scenario so it breaks: the adjustment *is* the finding. Technical depth comes after the instance lands, and only as deep as the finding needs.
- **The devices**: a worked example grounded in the topic or the product, a small ASCII diagram where shape or flow helps, a before/after list, a short step-by-step walkthrough. Pick what fits this finding, and vary across the walk — twenty identically shaped raises read as a template, not a colleague.
- **The weight**: structure the raise so it scans — a light heading, a short list, a diagram breaking up the prose — never an unbroken wall of text. Softly shaped, never boilerplate.
- **The cheap path**: within a scene already rebuilt this session, or when the finding set was visible moments ago, a bridge clause replaces the reconstruction.
- **The test**: the user can picture the problem before the ask arrives.

After this, control belongs to the conversation. The user will engage (or deflect, or redirect) naturally. Handle their response as normal discussion — not as protocol-driven routing. An outcome that re-decides ground this topic didn't introduce — it names an entity, field, rule, or classification this topic's artifact didn't define — requires the sibling consult before it is documented: follow **G. Sibling consult at cross-topic decision points** in **[knowledge-usage.md](../../workflow-knowledge/references/knowledge-usage.md)** — query or cite, and carry the `Sibling check:` line in the documented decision. When the engagement's outcome is documented and committed — resolved or deflected — the commit subject carries `({id} {finding})`, e.g. `(review-003 F2)`.

**Coverage guarantee**: the goal is natural flow during engagement AND eventual coverage of every finding. The store ensures nothing is forgotten across turns — every session-loop iteration re-enters this protocol, and at each natural break the next unsurfaced finding is raised. When all findings have been raised, the engine incorporates the row.

→ Return to caller.

## Never-Dump Checklist

Before producing any surfacing output, verify:

- □ Raising AT MOST one finding this turn — the rest of the set appears as a count, never as content
- □ Asking AT MOST one question this turn
- □ The finding itself is stated, self-contained, before any position or proposal
- □ The user can picture the problem before the ask arrives — scene rebuilt, not referenced
- □ No bare id (`F5`, `T2`) as a label in prose — named by report title or described
- □ Not reading the content file verbatim

If any box is unchecked, stop and reframe.
