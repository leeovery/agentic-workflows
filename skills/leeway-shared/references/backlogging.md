# Backlogging

*Shared reference. Loaded by the `## Backlogging` section on the investigation, specification, implementation, quick-fix and review processing skills, by the build's `outside-the-plan.md`, and at **D. Capture** by discovery's Putting Something Aside.*

---

The caller provides `work_unit`, `topic`, and `phase` (the session's own). The user has said to put an idea, a bug or a fix aside — "roadmap it", "inbox it", "backlog that", "push it back". It is already theirs and already said: take it from the conversation rather than shaping it further.

From inside a phase the park is one verb, and the roadmap is never opened.

## A. Where It Waits

The roadmap holds what the user has decided to do, waiting under a horizon; the inbox holds what is not decided yet. Their own words usually say which, and a word can be a horizon's name, so read the map's horizons first:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs roadmap state
```

#### If the words name a horizon

A label in `horizons`, or a new one in their own words — "under Next", "that's a v2 thing".

→ Proceed to **C. Park**.

#### If the words place it without naming a horizon

"next", "after this", "on the roadmap", "someday".

→ Proceed to **B. The Horizon**.

#### If the words leave it undecided

"inbox", "log it", "maybe", "not sure", "maybe never".

→ Proceed to **D. Capture**.

#### Otherwise

The instruction says put it aside and no more — "backlog it", "later", "not now", none of them a label in `horizons` (a horizon called Later makes "later" a placement under the first branch). Only the user can say where it waits, so ask. Write `{"title": "…"}` — its short title — to `.leeway/.cache/{work_unit}/{phase}/{topic}/backlog.json` with the Write tool, never a shell heredoc or redirect, then render the gate:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render backlog-gate {work_unit}.{phase}.{topic} --file .leeway/.cache/{work_unit}/{phase}/{topic}/backlog.json
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `roadmap`:**

→ Proceed to **B. The Horizon**.

**If `inbox`:**

→ Proceed to **D. Capture**.

## B. The Horizon

Name the item first, as **C. Park** says.

→ Load **[choosing-a-horizon.md](choosing-a-horizon.md)** with names = `{name}`.

→ On return, proceed to **C. Park**.

## C. Park

**The item** — a kebab-case `{name}`, a one-line `{summary}`, and its `{kind}`: `bug` for something broken, `quick-fix` for a small mechanical change, `idea` for anything else. An idea is at capability grain — one capability the user would move around a roadmap as one thing; a bug or a quick-fix is the one fix it is. Either way it is said in the product's terms rather than this phase's mechanism.

**The source** — the record this session is writing, relative to `.leeway/`:

| `{phase}` | `{source}` |
| --- | --- |
| `investigation` | `{work_unit}/topics/{topic}` |
| `specification`, `implementation`, `review` | `{work_unit}/spec.md` |

A source is recorded only once it is on disk. Before this session's record exists (a specification session before its first write), the park carries none: leave `[--source {source}]` out.

Park it — the verb validates, births the map and any new horizon, and self-commits, so no commit call follows:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs roadmap add {name} --kind {kind} --horizon "{horizon}" --summary "{summary}" --origin park:{work_unit} [--source {source}]
```

A refusal means the name is already on the roadmap: derive another and park it again. Once it lands, say the line its response's `said` holds, then note the park where the phase keeps a running record — the log an investigation session is writing. The other phases keep none: the item's own origin and source are its provenance.

→ Return to caller.

## D. Capture

It goes to the inbox as a note, unconfirmed as every capture is. Write it from the conversation as an H1 title over a short prose body; its kind is `bug` for something broken, `quick-fix` for a small mechanical change, and `idea` for anything else and whenever it is unclear. Capture it with the text on stdin, and emit its section verbatim per its marker:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs inbox capture {kind:[idea|bug|quick-fix]} <<'ITEM'
{text}
ITEM
```

Then note it where the phase keeps a running record — the log an investigation or a discovery session is writing; the other phases keep none.

→ Return to caller.
