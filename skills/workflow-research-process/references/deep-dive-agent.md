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

Ensure the cache directory exists:

```bash
mkdir -p .workflows/.cache/{work_unit}/research/{topic}
```

Determine the next set number by checking existing files:

```bash
ls .workflows/.cache/{work_unit}/research/{topic}/ 2>/dev/null
```

Use the next available `{NNN}` (zero-padded, e.g., `001`, `002`).

Compose a research brief for the agent. The brief must be self-contained — the agent has no conversation history. Include:
- What to investigate and why
- Relevant context from the research so far (constraints, findings that inform this thread)
- Specific questions to answer if applicable
- Boundaries — what's in scope and what isn't

**Agent path**: `../../../agents/workflow-research-deep-dive.md`

Dispatch **one agent** via the Task tool with `run_in_background: true`.

The deep-dive agent receives:

1. **Research brief** — the self-contained investigation brief
2. **Research file path** — `.workflows/{work_unit}/research/{topic}.md` (for background context)
3. **Output file path** — `.workflows/.cache/{work_unit}/research/{topic}/deep-dive-{NNN}-{thread}.md`
4. **Frontmatter** — the frontmatter block to write:
   ```yaml
   ---
   type: deep-dive
   status: pending
   created: {date}
   set: {NNN}
   thread: {thread name}
   findings: []   # sub-agent populates with F1/F2/... IDs
   surfaced: []
   announced: false
   ---
   ```

The sub-agent writes finding entries with stable IDs (`F1`, `F2`, …) into the `findings:` list. See `agents/workflow-research-deep-dive.md` for the schema.

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

**Concurrency**: Before dispatching, count files matching `deep-dive-*.md` with `status: pending` in their frontmatter in the cache directory. Limit to 3-4 in flight at once. If the limit is reached, note the thread for later dispatch.

---

## C. Check and Surface

Delegate all check-for-results and presentation behaviour to the shared surfacing protocol. Deep-dive reports are substantive and prone to wall-of-text dumps — the protocol's never-dump rules are especially important here.

→ Load **[background-agent-surfacing.md](../../workflow-shared/references/background-agent-surfacing.md)** with agent_type = `deep-dive`, cache_dir = `.workflows/.cache/{work_unit}/research/{topic}`, cache_glob = `deep-dive-*.md`, findings_key = `findings`.

**Promoting to a research file** (epic work type only): If during presentation the user engages with findings substantial enough to warrant their own research file — and agrees or requests it — promote them:

1. Create a new research file at `.workflows/{work_unit}/research/{thread}.md`
2. Synthesise the deep-dive findings into the file (don't copy the cache file verbatim — organise for the research document context)
3. Register in the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.research.{thread}
   ```
4. Commit: `research({work_unit}): add {thread} research from deep dive`

For feature work types, deep-dive findings fold into the existing research file — there is only one research topic per feature.

**Findings the user deflects**: If the user doesn't want to engage with a finding Claude raised, note it in the Open Questions section of the research file.
