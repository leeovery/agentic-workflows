# Deep-Dive Agent

*Reference for **[workflow-research-process](../SKILL.md)***

---

These instructions are loaded into context at the start of the research session but are not for immediate use. A deep dive is the phase's learning instrument: a background agent that answers a brief and reports material the session folds into the research file. Nothing it returns is a finding to walk, accept, or dismiss. Apply the offer, dispatch, and fold below when the time is right.

**Kinds** — the brief names one:

- `survey` — how N implementations do X
- `read` — a source, import, or document against the thread's questions
- `feasibility` — can the platform do X, from its documentation and code
- `landscape` — what exists, what it costs, where the gaps are
- `verify` — a claim, against sources — never by running it

**A dive never measures.** Nothing is run against the product or the environment. Where the answer is a number a decision would rest on, the dive reports the measurement it would take under its Opened list, and the session makes the laboratory offer.

Two ids appear below: `{id}` is the row id the dispatch answers (`deep-dive-{NNN}-{label}`), what every `agent` verb takes; `deep-dive-{NNN}` — the id without its label — is what the register's origin and the fold's commit subject carry.

## A. Offer

Offer a dive where the conversation reaches a question neither party can answer from the room and the answer is worth more than a lookup — a substantial thread, independent of what is being discussed right now, that dedicated tools (web search, source code, documentation) would serve. Quick lookups, single searches, and questions that inform the next conversational turn stay in the main thread.

The register is the anchor: the offer names a thread. A question new to the register is added first — origin `user` when the user raised it, `conversation` otherwise:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs research-threads add {work_unit} {topic} {slug} --question "{the question, as asked}" --origin {user|conversation} [--parent {slug}]
```

#### If the user asked for the dive

Skip the offer — the user already asked.

→ Proceed to **B. Dispatch**.

#### Otherwise

Write the offer payload to `.workflows/.cache/{work_unit}/research/{topic}/deep-dive-offer.json` with the Write tool (`{"thread": "…"}` — the thread's question as it should open the offer), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render deep-dive-offer {work_unit}.research.{topic} --file .workflows/.cache/{work_unit}/research/{topic}/deep-dive-offer.json
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `no`:**

The thread stays on the register as it stands — the conversation covers it.

→ Return to caller.

**If `yes`:**

→ Proceed to **B. Dispatch**.

## B. Dispatch

Count the rows in flight first, excluding rows an earlier session dispatched (dead — **C. Land and Fold** closes them). Three to four in flight is the limit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} research {topic}
```

#### If the limit is reached

Say so in a line; the thread stays `open` on the register and the offer fires again once a dive lands.

→ Return to caller.

#### Otherwise

Compose the brief — self-contained, the agent has no conversation history:

- **The thread** — its question, why it matters to this topic, and the product question it serves
- **The kind** — one of the five above
- **Questions** — the specific questions to answer, when the brief carries any (a survey, read, or landscape brief may carry none)
- **Known ground** — what the research already holds that bears on the thread: constraints, findings, positions
- **Boundaries** — what is in scope and what is not
- **The standing rule** — nothing is measured or run against the product or the environment; a number a decision would rest on is reported as the measurement it would take

Record the dispatch — the engine allocates the id and answers with the content-file path; no file is created (the file's later existence is the completion signal). The label is the thread's slug:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent dispatch {work_unit} research {topic} --kind deep-dive --label {slug}
```

Mark the thread:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs research-threads set {work_unit} {topic} {slug} digging
```

**Agent path**: `../../../agents/workflow-research-deep-dive.md`

Dispatch **one agent** via the Task tool with `run_in_background: true`.

The deep-dive agent receives:

1. **The brief** — composed above
2. **Research file path** — `.workflows/{work_unit}/research/{topic}.md` (for background context)
3. **Output file path** — the `file` from the dispatch response. The agent writes its completed report there — pure markdown in its definition's report contract, never frontmatter.

> *Output the next fenced block as a code block:*

```
Deep dive dispatched on {the thread's question}. It folds in when it lands.
```

The deep-dive agent returns:

```
STATUS: complete
THREAD: {slug}
ANSWERED: {n} of {m}
OPENED: {k}
SUMMARY: {one sentence}
```

The research session continues — do not wait for the agent to return.

→ Return to caller.

## C. Land and Fold

Entered from the session loop's check at natural breaks — a thread's pause, a synthesis moment, the user's done-signal, and the first loop iteration of a resumed session — and from the in-flight gate's wait at conclusion. Read the store:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} research {topic}
```

#### If a row is `in_flight` and its `created` predates this session

No agent can still be running — the dive is dead. Close the row and return its thread to `open`, so the offer can fire again:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent incorporate {work_unit} research {topic} {id}
node .claude/skills/workflow-engine/scripts/engine.cjs research-threads set {work_unit} {topic} {slug} open
```

→ Return to **C. Land and Fold**.

#### If no row is `pending`

Nothing has landed.

→ Return to caller.

#### Otherwise

Take the lowest-numbered `pending` row and fold it — one transaction of judgment:

1. **Read the report in full** — `.workflows/.cache/{work_unit}/research/{topic}/{id}.md`. It is never pasted into the conversation.

2. **Write the section** into the research file — `## {question} — deep-dive-{NNN}, {date}` — the Answers first, then the Material, sources kept inline.

3. **Mark the thread learned** and close the row — a report carries material, never findings to surface:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs research-threads set {work_unit} {topic} {slug} learned
   node .claude/skills/workflow-engine/scripts/engine.cjs agent ack {work_unit} research {topic} {id} --clean
   ```

4. **Judge each Opened line.** A question this topic will carry becomes a thread — origin the dive's id, parent the folded thread (or, when that thread is itself a child, its parent — two levels, like the map):

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs research-threads add {work_unit} {topic} {slug} --question "{the question}" --origin deep-dive-{NNN} --parent {parent slug}
   ```

   A line the file already covers, or one another topic owns, is folded as a note in the section instead — an epic's off-topic route carries an owned concern to its home when the session judges it worth sending. A measurement line is the laboratory's cue — hold it for the offer below.

   Then commit the fold — the section, the thread's move, and the opened threads in one write, nothing unrelated, the dive's id in the subject:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic research/{topic} -m "research({work_unit}/{topic}): fold {the thread, in a few words} (deep-dive-{NNN})"
   ```

5. **Speak to the user** — markdown prose, one authored line per paragraph, never a fence and never a menu. When the brief asked questions, the Answers verbatim — they are what was asked. Otherwise a digest: what was asked, what came back in three to five lines, what it opened. A question only the user holds — their environment, their intent for the product — is asked here, once, with your lean beside it; anything wanting a decision or more digging is a thread on the register, never a question in the room.

6. **Render the register:**

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs render research-threads {work_unit}.research.{topic}
   ```

   Emit the call's DISPLAY section verbatim per its marker.

**If step 5 put a question to the user:**

The turn ends on it; a further landed dive folds at the next break.

**STOP.** Wait for user response.

→ Return to caller.

**If an Opened line named a measurement:**

Make the laboratory offer now, through the session wrapper's **F. The Experiment Offer** — its exits return to the session loop.

→ Return to caller.

**Otherwise:**

The next landed dive folds in the same pass.

→ Return to **C. Land and Fold**.
