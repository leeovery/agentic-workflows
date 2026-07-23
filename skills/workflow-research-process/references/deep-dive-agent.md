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

## A. Offer Deep Dive

#### If user-initiated

Skip the offer — the user already asked.

→ Proceed to **B. Dispatch**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
{Thread description} looks like it could use a deep dive.
Want me to spin up a background investigation while we keep going?

- **`y`/`yes`** — Dispatch a deep-dive agent
- **`n`/`no`** — Skip, we'll cover it in conversation
· · · · · · · · · · · ·
```

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

Record the dispatch — the engine allocates the id and answers with the content-file path; no file is created (the file's later existence is the completion signal):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent dispatch {work_unit} research {topic} --kind deep-dive --label {thread:(kebabcase)}
```

**Agent path**: `../../../agents/workflow-research-deep-dive.md`

Dispatch **one agent** via the Task tool with `run_in_background: true`.

The deep-dive agent receives:

1. **Research brief** — the self-contained investigation brief
2. **Research file path** — `.workflows/{work_unit}/research/{topic}.md` (for background context)
3. **Output file path** — the `file` from the dispatch response. The agent writes its completed report there — pure markdown with one `## {ID}` section per finding (`F1`, `F2`, …), never frontmatter.

> *Output the next fenced block as a code block:*

```
Deep-dive dispatched: {thread description}.
Results will be surfaced when available.
```

The deep-dive agent returns:

```
STATUS: complete
THREAD: {thread name}
FINDINGS_COUNT: {N}
SUMMARY: {1-2 sentences}
```

The research session continues — do not wait for the agent to return.

**Concurrency**: Before dispatching, count the `deep-dive` ids in `agent scan`'s `in_flight` list. Limit to 3-4 in flight at once. If the limit is reached, note the thread for later dispatch.

---

## C. Check and Surface

Delegate all check-for-results and presentation behaviour to the shared surfacing protocol. Deep-dive reports are substantive and prone to wall-of-text dumps — the protocol's never-dump rules are especially important here.

→ Load **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** with agent_type = `deep-dive`, work_unit = `{work_unit}`, phase = `research`, topic = `{topic}`.

**Promoting to a research file** (epic work type only): If during presentation the user engages with findings substantial enough to warrant their own research file — and agrees or requests it — promote them through the shared topic-creation core, so the new topic lands on the discovery map with validated naming and provenance:

1. Derive a one-line `summary` and a paragraph or two of `description` from the deep-dive findings.

2. → Load **[create-discovery-topic.md](../../workflow-shared/references/create-discovery-topic.md)** with work_unit = `{work_unit}`, proposed_name = `{thread}`, phase = `research`, routing = `research`, source = `research-split:{topic}`, summary = `{summary}`, description = `{description}`.

3. **If `result` is `cancelled`:** the promotion was dropped — the findings stay in the cache file. Otherwise create the research file at `.workflows/{work_unit}/research/{created_topic}.md` and synthesise the deep-dive findings into it (don't copy the cache file verbatim — organise for the research document context), then commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "research({work_unit}): add {created_topic} research from deep dive"
   ```

For feature work types, deep-dive findings fold into the existing research file — there is only one research topic per feature.

**Findings the user deflects**: If the user doesn't want to engage with a finding you raised, note it in the Open Questions section of the research file.
