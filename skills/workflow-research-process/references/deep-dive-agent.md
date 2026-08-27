# Deep-Dive Agent

*Reference for **[workflow-research-process](../SKILL.md)***

---

These instructions are loaded into context at the start of the research session but are not for immediate use. Deep-dive agents investigate specific threads independently in the background — competitor analysis, API exploration, technical feasibility, market landscapes. Apply the dispatch and results processing instructions below when the time is right.

**Trigger conditions** — offer a deep-dive agent when:

- A research thread is substantial enough to warrant independent investigation (not a quick lookup)
- The thread is independent of the current conversation (exploring it won't block or depend on what's being discussed right now)
- The investigation would benefit from dedicated tools (web search, source code review, documentation analysis)

Two dispatch paths:

1. **User-initiated** — the user explicitly asks for a deep dive ("can you look into X while we keep going?"). No offer needed — proceed directly to dispatch.
2. **Orchestrator-offered** — you identify a thread that fits the criteria above. Offer to dispatch.

Signals that suggest offering a deep dive:
- A competitor or product is mentioned but not yet investigated
- Technical feasibility is assumed but not verified
- An API or service is referenced with uncertain capabilities
- A market segment or user need is hypothesised but not validated
- The review agent flagged a substantial gap that warrants dedicated investigation

Do not fire for quick lookups, single searches, or questions that inform the next conversational turn — those stay in the main thread.

---

## Lanes

Deep-dive findings are all walked — no batch lanes. Raises render under the heading `Needs Investigation`.

Most deep-dive findings are knowledge, not asks — research surfaces material and holds decisions for discussion — so a raise here usually closes by saying nothing needs a call from the user and offering the pause. A finding that converges on a design call records the options and the lean as material for the discussion phase rather than asking the user to settle it now; the raise's genuine question is reserved for what only the user holds — their expectations, their environment, their intent for the product.

## A. Offer Deep Dive

#### If user-initiated

Skip the offer — the user already asked.

→ Proceed to **B. Dispatch**.

#### Otherwise

Write the offer payload to `.workflows/.cache/{work_unit}/research/{topic}/deep-dive-offer.json` with the Write tool (`{"thread": "…"}` — the thread description as it should open the offer), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render deep-dive-offer {work_unit}.research.{topic} --file .workflows/.cache/{work_unit}/research/{topic}/deep-dive-offer.json
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `no`:**

Continue the research session without dispatching.

→ Return to caller.

**If `yes`:**

→ Proceed to **B. Dispatch**.

---

## B. Dispatch

Compose a research brief for the agent. The brief must be self-contained — the agent has no conversation history. Include:
- What to investigate and why
- Relevant context from the research so far (constraints, findings that inform this thread)
- Specific questions to answer if applicable
- Boundaries — what's in scope and what isn't

Record the dispatch — the engine allocates the id and answers with the content-file path; no file is created (the file's later existence is the completion signal). Labels are slash- and dot-free: drop any dots the thread name carries.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent dispatch {work_unit} research {topic} --kind deep-dive --label {thread:(kebabcase)}
```

Read the topic's dismissed grounds — the user's standing rulings on what not to report. Empty output means none:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.research.{topic} dismissed_grounds
```

**Agent path**: `../../../agents/workflow-research-deep-dive.md`

Dispatch **one agent** via the Task tool with `run_in_background: true`.

The deep-dive agent receives:

1. **Research brief** — the self-contained investigation brief
2. **Research file path** — `.workflows/{work_unit}/research/{topic}.md` (for background context)
3. **Output file path** — the `file` from the dispatch response. The agent writes its completed report there — pure markdown with one `### {ID}: {label}` section per finding (`F1`, `F2`, …), never frontmatter.
4. **Dismissed grounds** — the list read above, verbatim. Omit this input entirely when the list is empty.

> *Output the next fenced block as a code block:*

```
Deep-dive dispatched: {thread description}.
Results will be surfaced when available.
```

The deep-dive agent returns:

```
STATUS: complete
THREAD: {thread name}
FINDINGS: {F1,F2,… — every id in the report; omit when none}
FINDINGS_COUNT: {N}
SUMMARY: {1-2 sentences}
```

The research session continues — do not wait for the agent to return.

**Concurrency**: Before dispatching, count the `deep-dive` ids in `agent scan`'s `in_flight` list — excluding rows an earlier session dispatched (those agents are dead; incorporate them instead of counting them). Limit to 3-4 in flight at once. If the limit is reached, note the thread for later dispatch.

---

## C. Check and Surface

Delegate all check-for-results and presentation behaviour to the shared surfacing protocol. Deep-dive reports are substantive and prone to wall-of-text dumps — the protocol's never-dump rules are especially important here.

→ Load **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** with agent_type = `deep-dive`, work_unit = `{work_unit}`, phase = `research`, topic = `{topic}`.

**Promoting to its own topic** (epic work type only): If during presentation the user engages with findings substantial enough to warrant their own topic — and agrees or requests it — deliver them into that topic's triage queue, where its own session works them in context:

1. Name the `target` — an existing topic when one owns the ground, otherwise a kebab-case name derived from `{thread}` and confirmed with the user. Judge `landing_phase` per **Judging the Landing Phase** in **[triage-landing.md](../../workflow-shared/references/triage-landing.md)**; findings are research-stage material, so `research` is the norm.

2. Build the `concern` from the findings themselves — the full substance, never a pointer. The cache report is ephemeral, purged when the work unit closes, so the queue file has to carry everything the target needs.

3. → Load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{target}`, concern = `{concern}`, origin = `{topic}`, phase = `research`, landing_phase = `{landing_phase}`, date = `{today}`.

4. **If `result` is `cancelled`:** the delivery was dropped — the findings stay in the cache file. Otherwise the concern landed in `{landed_topic}`'s `{landing_phase}` queue and the engine committed it; the target's own session builds its artifact when it starts.

For feature work types, deep-dive findings fold into the existing research file — there is only one research topic per feature.

**Findings the user rejects**: nothing lands in the research file either way — **Rejecting a raise** in **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** owns both exits, dropping a *not now* and recording a dismissal's ground on the topic.
