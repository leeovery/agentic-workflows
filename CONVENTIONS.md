# Skill Authoring Conventions

The rules for writing a skill on this repo: what a skill holds, where each of its rules goes, and how its prose reads. They are for authors. Nothing here is loaded at runtime, and no skill relies on it.

This file describes the skills as the reshape rewrites them. A skill not yet rewritten keeps its shape until its phase rewrites it; the rules it was written to are this file as it stands on `main`.

## Who Holds What

The engine holds what the person sees and what gets recorded, the same every time. Claude holds how the work gets done. The person holds the product, and the calls put to them. A skill is written from that split: for everything the engine holds it names the engine's door, and for the rest it gives Claude a goal, a done-condition and guidance.

Control flow lives in the engine, never in prose. A skill never branches on a status it read or on the person's answer at a gate: it does what the engine's verbs return.

## Where a Rule Goes

Every rule a skill would carry is one of three kinds, and each kind has one home.

| Kind | What it covers | Its home | What the prose keeps |
|---|---|---|---|
| Contract | where something lands, the shape it takes, what gets recorded, which door a change goes through, what the person sees | a verb that is the only door — it picks the path, writes the shape, records the event and refuses what is wrong — with the hooks and checks behind it | one line naming the verb |
| Required procedure | steps that must all happen before a point, in any order: a topic's close, a phase's start and close, finish | an item on the engine's checklist for that point | the checklist's name, and guidance for an item that needs any |
| How-to | everything else | deleted | the goal, the done-condition, and guidance |

Ask of each rule, in this order:
1. If Claude did it another way, would the person see something different, or the record hold something different? It is a contract.
2. Must each of these happen before the work moves past a point, in whatever order? It is a required procedure.
3. Could a capable engineer do it another way and the outcome be as good? It is how-to.

How-to survives as guidance only where a capable reader would get it wrong untold: a judgment the person cares about, the product's taste, the edge where the obvious move is the wrong one. A measurement behind a rule earns one line, and only where it changes what Claude does at the rule's edge.

A rule that fits none of the three is one of these:
- **It holds in every conversation** — how a turn sounds, what a reply at a gate is. It belongs to the framework (The Framework Load), never to a skill.
- **It guards a state only a crash or a failed tool produces.** Delete it. The engine makes the state unreachable, and Claude reruns a failed tool or agent unprompted.
- **It is a contract with no verb, or a procedure with no checklist item.** Bring it to the person. It is never held in prose as a "must" until a verb or an item exists.

A contract that keeps slipping gets a verb or a check, never more prose.

## The Phase Skill

A phase skill holds five things:
- **Its goal** — what the phase is for, in a sentence or two.
- **Its done-condition** — what is true when the phase can be left, stated as what the engine holds.
- **Its guidance** — what Claude needs told to do the work well, and nothing it would do anyway.
- **The verbs it names** — one line for each door the phase's work goes through.
- **Its checklist** — the closing point it works towards, by name.

### Entered and Left Through Gates

Every phase is entered and left through gates. The gates are the engine's: its kind, whether it stops, what it shows and what each row leads to. An authority gate always stops. A product question goes through `raise`, and the ask rule decides whether it reaches the person. A process gate is learned: once the person always answers it alike, it runs as an automatic step whose surface draws a one-line report in place of the menu — except in the build's step position, where every process gate stops. The prose never says whether a gate stops, and never carries a branch for a position.

**Entering.** A phase is moved into by a handoff, from a gate or a menu pick (Handoffs and Recovery). Its entry is one engine call, shared by every phase: the engine refuses what cannot be entered, records where the conversation is working, and answers what the phase needs to begin or resume. The skill does what the answer says and branches on no status of its own. A question whose answer may discard a record — whether to carry on or start again — comes before the reading: a gate needs only what the engine holds, and the record and log are read after the answer.

**Leaving.** The phase is left at its closing point. Claude works the checklist (`checklist show`, `done`, `skip` with a reason) in the order it likes, closes it (`checklist close` refuses while any item is open), and fetches the gate that follows. The skill emits the gate's sections verbatim per their markers and the turn ends. The answer goes to `gate`, which logs it and returns `next` — an engine call to run, a handoff to make, or carry on — and the skill does what `next` says.

**Answering.** A gate is answered by its command rows. The prompt row (**Comment**, **Ask**) is for a question or feedback, never the answer. A reply that picks no row sets the gate aside; the framework says how it comes back.

### Fields and Corridors

Most of a phase is a **field**: Claude works it as it judges best — the order of the tasks, parallel worktrees, which agents, how tests get written, where a conversation goes next. A field's prose is its goal, its done-condition and its guidance, with no sequence. Nothing Claude does in a field leaves it except through a verb or a gate: what reaches the person, what gets recorded and every question to the person. The layout hook, the commit door and the checklists refuse the rest.

A **corridor** is a short, linear stretch whose output has a fixed shape: the phase cut at the end of specification, writing a phase's tasks as it starts, and the final review. A corridor's prose gives the order of its few moves — each a dispatch, a verb or a checklist mark — and says nothing about how the artifact is made. The artifact is a named agent's (Agents and Briefs).

### Requests at Any Point

Some requests can come wherever the phase is: put an idea or a bug aside, postpone or cancel the topic, a gap the person names during the build. Each is a section of its own, named for the request: the words that bring it, and the verb or reference that takes it. Afterwards the work carries on where it was. A gate that was waiting was set aside, and the framework says how it comes back; the section never restates it.

### The Skeleton

```markdown
---
name: {skill}
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs *)
---

# {Phase}

{What the phase is for, and the part Claude plays in it.}

## Arguments

{Each positional argument, as the engine's handoff table declares it.}

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

## Done When

{The done-condition, as what the engine holds.}

## Entering

{The entry call, and what is read once any question that may discard it is answered.}

## {The Work}

{A field: guidance, under headings named for what each covers.
A corridor: its moves, in order.}

## Doors

- {What lands} → `{verb}`.

## Closing

{The checklist by name, guidance for any item that needs it by its key, then the gate.}

## {A Request at Any Point}

{The words that bring it, and the verb or reference that takes it.}
```

A section the phase has nothing for is left out. `## Instructions` is there only in a skill a conversation opens on (The Framework Load).

## What the Engine Owns

The prose names the verb and stops. It never:
- **Draws a menu, a gate or a row.** The engine draws every one and prints it as text; the gate mod shows its rows as buttons where it runs. Lint check 3 refuses a menu in prose.
- **Writes state.** State changes only through verbs. The prose names verbs, never manifest fields, and reads a manifest value only where no verb's response carries it. The layout hook refuses a write under `.leeway/` to a path the layout has no place for, and any write to a manifest, the ledger or `spec-review.json`. Scratch goes in `.leeway/.cache/`.
- **Commits.** Every verb commits its own state writes, with any log changed since. A code commit goes through `commit`, naming the task in flight, and the door runs the project's checks first. A raw `git commit` in a code worktree during a build is refused.
- **Lists a checklist's items.** The engine holds them, works out the ones it can check, and shows the rest with their text. The prose names the checklist.
- **Writes a brief.** `brief` fills the role's template from the records (Agents and Briefs).
- **Chooses how something reaches the person.** It reaches them in a gate, a raise or a mod surface. Nothing asks the person to open a file; material they may want but need not read is one keystroke away on a mod surface, or asked for in words where the mod does not run.

What Claude and the agents write themselves is content, in the places the layout keeps for it: a log, the spec, a spike, an asset. Everything else is written through a verb. A decision or a finding is a ledger entry, written through `ledger`; a topic's record and its map are projections of the ledger, never files. Markdown carries content only: never frontmatter, never a status in a heading. A feature that needs state gets a field behind a verb.

Where a phase is a conversation, it asks its questions in the conversation and each answer lands through `ledger`; a call Claude has a lean on goes through `raise`, which decides whether it reaches the person, and slots in at a natural pause. Anywhere else, every question for the person goes through `raise`; a question asked in plain prose in the build is a slip. Questions reach the person one at a time.

## Writing for the Model Pass

When the workflows move to a new model, the prose is walked on it and one pass cuts what that model no longer needs. The pass cuts prose, so where a part sits decides whether it can be cut:
- **Guidance a better model could do without is prose, and only prose.** It never becomes a verb, a check, a checklist item, a hook, an agent's fixed model or effort, or a brief template's words.
- **What the hard layers hold is there for the person, whatever the model.** Each engine piece names the failure it prevents and how often that failure happened.
- **A part held for today's model goes into a hard layer only with a line in the model pass's list** (`docs/contributing.md`, Moving to a new model), which every pass re-weighs.

## Prose

Skill and reference files are instructions loaded into Claude's context. Write the exact amount the work needs, never the most and never the least. Cutting a needed instruction is as wrong as over-explaining.
- **Lean.** Clear, executable instructions: no why, no backstory, no "what this file is for". Keep a reason only where it changes what Claude does. Test each sentence: does the work hit this case; does a consumer use this feature; would a competent reader need it told? A no to any deletes it.
- **The clean path.** No retry branch for a tool or agent that fails, no guard for a state only a crash produces, no workaround for the harness. Interruption and resume stay first-class: they are the entry's job.
- **Written fresh.** Each file reads as though authored now: no "formerly", no "(new)", no note of what a change replaced.
- **Plain words.** Name things as an engineer would, over coined terms. A compressed claim must be literally true.
- **Context.** A phase loads no reference it does not use, and what it loads before its first question is counted. A record is read after any question whose answer may discard it.
- **Decisions before commands.** Anything a command depends on — a flag, a derived value — is stated before the fenced command, never after it.
- **Emphasis.** A bold label and a colon, `**IMPORTANT**:`, and rarely: a rule is obeyed for being explicit, never for being loud.

**Placeholders** mark what varies in a command, a payload Claude composes, and a line Claude says whose wording is fixed:

```
{name}                                    — raw value, output as-is
{name:[option1|option2|option3]}          — enumerated options (pick one)
{name:(casing)}                           — with casing hint
{name:[option1|option2]:(casing)}         — options and casing
```

Casing hints are `titlecase`, `lowercase` and `kebabcase`. A placeholder never wraps across lines, and a flag carrying the person's words is quoted, `--summary "{summary}"` (lint check 22).

## Agents and Briefs

Every prescribed artifact — the spec, the phase cut, the tasks, the reviews, deep dives, experiment write-ups — is written by a named agent on the roster. The conversation and the build's orchestration stay in the main session.

**An agent's definition** (`agents/{name}.md`) holds what is true of it whatever it is dispatched for:
- its one job, the artifact, with its rules and references boxed inside it;
- its tools, the Skill tool among them where it must find the project's skills itself;
- its model and effort, fixed in its frontmatter: Opus at medium until a measurement says otherwise, and investigation's root-cause validator at extra-high. Never chosen at dispatch, and never raised by a task's size.

**A brief** holds only the records its role draws on, filled by `brief` from the role's template in the engine's content folder (`skills/workflow-engine/content/briefs/{role}.md`). The template's own words are what every dispatch of that role is told; each `{{record}}` slot is a record the engine fills. What one role's dispatch needs goes in its template; what a task needs goes in the records the brief draws on — onto the task, or into the ledger — never into the dispatch. The project's skills and CLAUDE.md reach the agent without the brief.

**The dispatch.** `brief {role} …` issues the brief, and the dispatch carries its pointer, `brief:{id}`, alone as the Agent prompt (a fix round's as the SendMessage message). The hook before Agent and SendMessage refuses anything else for one of the workflows' agents. A fix round's brief is the reviewers' reports, verbatim, and nothing else.

**Its mode.** Claude Code runs an agent in the background unless told otherwise, so every dispatch the prose prescribes names `run_in_background: true` or `false`. A background dispatch the flow waits on ends the turn on one sentence, given inline: ``The dispatch runs in the background (`run_in_background: true`) and ends the turn on exactly `The reviewer agent has been dispatched for task {phase}.{task}.` `` — naming the agent and what it works on, never an internal id (lint check 25).

An agent works from the record, never the conversation. Its calls come back to the orchestrator and go where any call goes: the ledger, or `raise`. An agent never asks the person.

## Handoffs and Recovery

**Handing off** moves the work into a skill that starts it afresh. The engine names the move — `handoff`, or a gate's `next` of kind `handoff` — and composes the continuation. Where the gate mod runs it clears the conversation and carries the continuation into the next one; elsewhere the skill is invoked in place. Nothing crosses but the skill and its arguments: what the next skill needs is on disk first.

Nothing hands off inside a build, a quick-fix or a topic. One orchestrator runs a build across all its phases and straight into the review phase. A move between discovery's levels, or from a topic up to its epic's discovery or the product's conversation, carries the conversation on in the same session.

**Invoking** a skill is a Skill tool call: it adds the skill's instructions to the running context and clears nothing. Show the literal command — ``Invoke `/{skill} {args}`.`` — outside any fence; inside one it is printed, not run (lint check 14). **Loading** a reference reads guidance into the running context, nothing more.

**Recovery.** After a compaction, a crash or a new session, the engine's note names the skill and each document to re-read, and the conversation carries on where it was. A skill carries no section of its own on resuming. Where its work needs a document re-read, the note names it: that is a change to the engine's note, never prose. Re-reading the skill re-runs its framework load. Nothing the work needs after a compaction lives only in the conversation: it is in the ledger, a log, or a field behind a verb.

## Display

**Claude's own words:**
- **The conversation**, in the framework's voice and altitude: product first, code as evidence beneath it.
- **A line made only of values the conversation holds** — a name it was passed, a count it tallied, a path the layout fixes. It is said inline, never fenced: its wording in a code span where the wording is fixed (``Say `Phase {N} merged.` ``), or `In your own words, …` where it is judgment.
- **A report or summary Claude composes**, as markdown, in the register of `skills/workflow-shared/references/product-lens.md`: what the person would see first, `file:line` references as anchors. A `t/technical` row retells it from the code's side (`technical-lens.md`).
- **A code block Claude writes itself** — a diagram, a sample — which names its language on the fence, `text` for plain.

**The engine's** is everything with a fixed shape or read from state: menus, gates, raises, lists, trees, worklists, a marker naming anything that varies, blockers. A skill authors no display block. A fence that varies is the engine's (lint check 13 refuses one in prose), and a fixed line is Claude's, said inline. Judgment content inside an engine display reaches it as a payload file; a fact only the session holds, as a flag.

**Content the person approves as the thing itself** — a change, spec prose, the phase cut — is shown verbatim in the form it will take, never framed in drawn borders, with a label or a line saying what it is.

### Engine Sections

An engine call that renders answers in sections, each opened by a marker, `=== NAME (instruction) ===`, whose instruction says how its section is emitted. The marker line is never emitted.
- `DATA` — read it to decide; never shown or restated.
- `TITLE`, `DISPLAY`, `MENU` — emitted verbatim, as the marker says.
- `GATE`, `HANDOFF`, `POSITION` — for the gate mod; never shown or restated.

A sentence that emits a section says `…section verbatim per its marker` (`…sections verbatim per their markers`) and never states a form of its own: the marker is the one instruction (lint check 21). A section is emitted from the call that produced it, in the turn that shows it: never carried to a later moment, never redrawn, reflowed, trimmed or composed from memory. A transaction verb answers one JSON line and renders nothing.

**A MENU in a tool result is a live gate at that call**: `gate` takes the answer against the gate last shown. A call returns a MENU only where the skill shows that gate there; a view fetched for its data or its display is fetched without one.

### The Design System

Every screen the engine draws keeps to the existing design system; a new screen or variant fits it, and the menu frame in `domain/projections/surfaces.cjs` refuses some breaks outright.
- **Glyphs.** Squares are structure: `■` a title, `□` a step, `▪` a sub-step. Circles and arrows are an item's state: `○ ◐ ● ◌ → ✓ ⊙ ⊘ ⊖`. `◆` is a decision, `⚑` an alert; `⏺` is the host's own.
- **Chrome.** A title is `# **`■ Title`**`, one per skill invocation. A marker is `**`□ Name`**` or `**`▪ Name`**`: no numbers, a loop's count in parentheses (`(3 of 12)`, `(cycle 2)`). A marker shows only where something follows it before the next one. A signpost is a markdown blockquote of one to three sentences, one authored line per paragraph.
- **Forms.** A section's marker names one of four forms: markdown (not a code block), for chrome, menus and anything that needs rendered formatting; a text code block (```text fence), for layout — trees, columns, aligned lists; a properties code block (```properties fence), for a blocker and the banner; a diff code block (```diff fence), for change content. Every `TITLE`, `DISPLAY` and `MENU` marker's instruction opens `emit verbatim as ` and its form, then any behaviour clause (`, then STOP for the user's response`); the render sweep in `tests/scripts/gate-audit.cjs` holds it. The fence decides how demoted content reads: italic in a menu, a `↳` line in a fenced display, a backticked `[tag]` with a `↳` note in a markdown worklist.
- **Menus.** A dot rule, `· · · · · · · · · · · ·`, opens the menu, and none closes it. Every menu asks one question, glyphed `**`◆ Question?`**` (sixty characters or fewer, ending in `?`); anything to say first is a plain statement above it. Rows are `**`k/word`** → Label`, arrows aligned as rendered. A label says what choosing it does, naming a hard-to-reverse consequence plainly. Command rows come first and one prompt row last, whose label tells the person what to say (`**Comment** → Tell me what to change`). A yes is `y/yes`, never a synonym; `n/no` is for plain refusal only. A bare yes/no pair carries no labels: the question above it already says what yes means. The same action keeps the same key on every menu: `a` archive, `w` work, `b` back, `h` help. `b/back` draws the surface before it; it never re-invokes a skill and never exits. Every menu has `h` help; gates and raises do not. Anything with a fixed shape is its own row, and typing stays open for a question. Items appear once, in the menu; a row's metadata tail reads italic. With one item to act on, the auto-select line stands in for the menu.
- **Lists.** `•` bullets for a flat list, and `·` for quiet sub-detail within an item. A tree, `├─` for each child and `└─` for the last, for items with child data, a blank line between top-level items. A status sits in a right-aligned `[term]` column, or on a `↳` line beneath a row with a body.
- **Worklists.** A transient list worked through and thrown away, drawn as markdown: a glyph per row (`○` pending, `✓` approved, `⊘` skipped), done rows struck through, one short term per tag, detail on the `↳` note. Strikethrough means done here.
- **Callouts and blockers.** An advisory inside a display opens on `⚑` and stays plain. A state the person cannot proceed past renders red, in its own properties fence, one logical line with the flag at column zero, guidance beneath it as a signpost. Red is for a blocked state and the strongest advisory only.
- **Inside a display**, `── Title ──` divides grouped content. No drawn border frames content. A key sits under the display it explains, listing only what that display shows.

## Files

The capture skills (`workflow-log-*`) write to the inbox and nothing else. They are not workflow skills, and stay structureless: no gates, no references, no framework load, and the display rule's check passes over them.

### Frontmatter

- `user-invocable: false` on every skill the person does not type themselves.
- Every `allowed-tools` Bash grant carries a `*`; a grant for the workflows' own script ends in ` *` (lint check 28).
- No `SessionEnd` hook: Claude Code never fires one declared in a skill. Session-end work is the settings hook the engine installs (lint check 18).

### Headings

One H1 per file, its title — except a skill that hands the work on (the way in, the menus), which opens on its frontmatter alone (lint check 8). H2 for sections, H3 within them. Sections are named for what they cover: no step numbers, no lettered sections, and no heading that routes.

A skill that hands the work on carries this blockquote, byte for byte (lint check 9):

```
> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.
```

### The Framework Load

The framework holds what is true in every conversation. It loads once per conversation, at the head of the skill the conversation opens on — the person's way in, or a skill a handoff lands on (`OPENING_SKILLS` in `domain/handoff.cjs`). Each of those opens its `## Instructions` section with this line and nothing else:

```markdown
Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.
```

A skill only ever opened in place carries neither the section nor the load (lint check 27). `framework.md` only composes the shared references every conversation holds. A rule universal to every conversation joins that list; a rule only some phases use loads from those phases. A skill never restates a framework rule: a second copy is a second source of truth.

### References

A skill splits a part into a reference when the part is needed only at a moment — a request at any point, an item's guidance at the close, a corridor's move — so the phase loads it then, and only then.
- **Named** for what it covers, in kebab-case: `closing-pass.md`, `postponing-the-topic.md`.
- **Headed** with its title, an attribution line, and a rule (lint check 10):

  ```markdown
  # {Title}

  *Reference for **[{skill}](../SKILL.md)***

  ---
  ```

  A reference loaded by another reference names that file instead. A shared reference, under `skills/workflow-shared/references/`, says `*Shared reference. Loaded by {callers}.*`.
- **Loaded** by one line, the link bold and resolving (lint check 7): `Load **[name.md](references/name.md)** and follow its instructions as written.` What it needs from the caller is named in the load line — ``… with topic = `{topic}`.`` — and is already in context.
- **Deferring to the owner.** A reference that needs another skill's mechanic invokes that skill or loads its reference, carrying only what the caller knows. It never restates the owner's paths, naming or format. Where two files say the same thing, delete one rather than keep them aligned.
