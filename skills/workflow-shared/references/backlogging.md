# Backlogging

*Shared reference. Loaded by the `## Backlogging` section on the research, discussion, investigation, scoping, specification, planning, implementation, and review processing skills.*

---

The caller provides `work_unit`, `topic`, and `phase` (the session's own). The user has said to put an idea aside — "roadmap it", "inbox it", "backlog that", "push it back". The idea is already theirs and already said: take it from the conversation rather than shaping it further.

From inside a phase the park is one verb. The roadmap skill is the product session and is never invoked here.

## A. Which Backlog

Two backlogs, and the user's own words usually name one: the roadmap holds what they place, the inbox what they leave unplaced.

#### If the words name a horizon

A label already on the map, or a new one in their own words — "under Next", "that's a v2 thing".

→ Proceed to **C. Park**.

#### If the words place it without naming a horizon

"next", "after this", "on the roadmap".

→ Proceed to **B. The Horizon**.

#### If the words leave it unplaced

"inbox", "log it", "someday", "maybe never".

→ Proceed to **D. Capture**.

#### Otherwise

The instruction says put it aside and no more — "backlog it", "later", "not now". Only the user can say which backlog, so ask. Write `{"idea": "…"}` — the idea's short title — to `.workflows/.cache/{work_unit}/{phase}/{topic}/backlog.json` with the Write tool, then render the gate:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render backlog-gate {work_unit}.{phase}.{topic} --file .workflows/.cache/{work_unit}/{phase}/{topic}/backlog.json
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `roadmap`:**

→ Proceed to **B. The Horizon**.

**If `inbox`:**

→ Proceed to **D. Capture**.

## B. The Horizon

The horizon is the user's, never yours to pick. They have not named one, so the map decides how to ask for it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap state
```

#### If `horizons` is non-empty

Render the pick over them:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render horizon-pick
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If the answer is a number:**

That is the horizon.

→ Proceed to **C. Park**.

**If the answer is `n/new`:**

The user names one instead: ask in prose which horizon it belongs to — a name is content, not a choice — and **STOP.** Wait for user response.

→ Proceed to **C. Park**.

#### Otherwise

There is no roadmap yet, or it holds no horizons, so there is nothing to pick from. Ask in prose which horizon it belongs to, in the user's own staging words — launch, v1, someday.

**STOP.** Wait for user response.

→ Proceed to **C. Park**.

## C. Park

**The item** — a kebab-case `{name}` and a one-line `{summary}`, both at capability grain: one capability the user would move around a roadmap as one thing, said in the product's terms rather than this phase's mechanism.

**The source** — the record this session is writing, relative to `.workflows/`:

| `{phase}` | `{source}` |
| --- | --- |
| `research`, `discussion`, `investigation` | `{work_unit}/{phase}/{topic}.md` |
| `planning` | `{work_unit}/planning/{topic}/planning.md` |
| `scoping`, `specification`, `implementation`, `review` | `{work_unit}/specification/{topic}/specification.md` |

**The confirm** — it states the item and its summary, the horizon (flagged new when the map does not hold it), the roadmap's own birth when there is none, and the source. A refusal means the name is already on the roadmap: derive another and render again.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render park-gate --name {name} --horizon "{horizon}" --summary "{summary}" --source {source}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `yes`:**

Park it — the verb validates, births the map and any new horizon, and self-commits, so no commit call follows:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap add {name} --horizon "{horizon}" --summary "{summary}" --origin park:{work_unit} --source {source}
```

Note the park where the phase keeps a running record — the discussion's Summary, the file a research or investigation session is writing. The other phases keep none: the item's own origin and source are its provenance. Tell the user in one line what was parked and where.

→ Return to caller.

**If `no`:**

Nothing is recorded. Say so in one line.

→ Return to caller.

**If comment:**

The comment names what to change — the name, the horizon, or the summary. Take it as the instruction and build the park again; what it does not name stands.

→ Return to **C. Park**.

## D. Capture

The idea goes to the inbox as a note, unconfirmed as every capture is. Invoke the matching capture skill: `/workflow-log-bug` for something broken, `/workflow-log-quickfix` for a small mechanical change, `/workflow-log-idea` for anything else and whenever it is unclear. The capture skill writes the inbox file but does not commit it, so commit it now:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --inbox -m "workflow(inbox): capture {slug}"
```

Note it where the phase keeps a running record — the discussion's Summary, the file a research or investigation session is writing; the other phases keep none. Tell the user in one line that it is in the inbox.

→ Return to caller.
