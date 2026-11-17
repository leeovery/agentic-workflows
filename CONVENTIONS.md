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
1. If Claude did it another way, would a fixed thing the person sees change — a screen, a gate, an output, the process — or would the record take a different kind of entry, in another place or another shape? It is a contract. Claude's own wording, in a conversation or inside an entry, is not.
2. Must each of these happen before the work moves past a point, in whatever order? It is a required procedure.
3. Could a capable engineer do it another way and the outcome be as good? It is how-to.

How-to survives as guidance only where a capable reader would get it wrong untold: a judgment the person cares about, the product's taste, the edge where the obvious move is the wrong one. A measurement behind a rule earns one line, and only where it changes what Claude does at the rule's edge.

A rule that fits none of the three is one of these:
- **It holds in every conversation** — how a turn sounds, what a reply at a gate is. It belongs to the framework (The Framework Load), never to a skill.
- **It guards a state only a crash or a failed tool produces.** Delete it. The engine makes the state unreachable, and Claude reruns a failed tool or agent unprompted.
- **It is a contract no door can refuse** — a question for the person asked in plain prose in the build, an extra review round. It stays a line of prose.
- **It is steps around a field's work that the spec puts in prose** — what is read before a topic's opening, discovery's re-read of its log before each move. They stay in prose, in the field's entry or close (Fields and Corridors).
- **It is a contract the spec names no verb for, or a procedure with no checklist item.** Bring it to the person. It is never held in prose as a "must" until a verb or an item exists. A verb the spec names that is not built yet is built by its phase, never brought to the person.

A contract that keeps slipping gets a verb or a check, never more prose.

## The Phase Skill

A phase skill holds five things:
- **Its goal** — what the phase is for, in a sentence or two.
- **Its done-condition** — what is true when the phase can be left, stated as what the engine holds.
- **Its guidance** — what Claude needs told to do the work well, and nothing it would do anyway.
- **The verbs it names** — one line for each door the phase's work goes through. Each verb's contract for its caller is in `docs/engine/commands.md`.
- **Its checklists** — each closing point it works towards, by name, where it has any: discussion's decided, at a topic's close; specification's ready to build; the build's phase start and phase close, for each phase of its cut; and the review phase's finish. Discovery, experiment and investigation have none. Two types move them:
  - **A feature's** discussion closes into its spec with no gate, once nothing of the person's is open and the closing pass has run; specification then works decided and ready to build together, on one screen.
  - **A quick-fix's** finish is the close of its own session, and finish's checklist runs there; it reaches the review phase only when the person asks.

### Entered and Left Through Gates

Every phase is entered and left through gates, each the engine's. The prose never says whether a gate stops, and never carries a branch for a position.

**Entering.** A phase is moved into by a handoff, from a gate or a menu pick, except a move between discovery's levels, which carries the conversation on (Handoffs and Recovery). Its entry is one engine call, shared by every phase. The skill does what the answer says and branches on no status of its own. A question whose answer may discard a record — whether to carry on or start again — comes before the reading: a gate needs only what the engine holds, and the record and log are read after the answer.

**Leaving.** The phase is left at its closing point. Claude works the checklist (`checklist show`, `done`, `skip` with a reason) in the order it likes, closes it, and fetches the gate that follows, where one does — a phase's start in the build has none.

**Answering.** The framework holds how a gate is answered.

### Fields and Corridors

Most of a phase is a **field**: Claude works it as it judges best — the order of the tasks, parallel worktrees, which agents, how tests get written, where a conversation goes next. A field's prose is its goal, its done-condition and its guidance. It may order the steps around the work — its entry and its close, what is read before a topic's opening — never the work itself. In the build, nothing Claude does in the field leaves it except through a verb or a gate: what reaches the person, what gets recorded and every question to the person; the layout hook, the commit door and the checklists refuse the rest. In a phase that talks, the conversation itself reaches the person in plain prose; what gets recorded still goes through a verb, or into a log the layout keeps.

A **corridor** is a short, linear stretch whose output has a fixed shape: the phase cut at the end of specification, writing a phase's tasks as it starts, and the final review. A corridor's prose gives the order of its few moves — each a dispatch, a verb or a checklist mark — and says nothing about how the artifact is made. The artifact is a named agent's (Agents and Briefs); whether the agent runs the corridor's verb, or the skill runs it on the agent's output, is as that phase's section of the spec says, or as its rewrite decides where the spec is silent.

### Requests at Any Point

Some requests can come wherever the phase is: put an idea or a bug aside, postpone or cancel the topic, a gap the person names during the build. Each is a section of its own, named for the request: the words that bring it, and the verb or reference that takes it. Afterwards the work carries on where it was, except where the request moves it:
- a topic cancelled or postponed from its own session hands off to a menu: an epic's topic to the epic's menu, any other to the start menu;
- an experiment spawned now hands off to the laboratory;
- a move up to the epic's discovery leaves the topic, in the same conversation;
- a quick-fix that needs a decision beyond a quick call moves to a feature or a bugfix, which changes the work.

A gate that was waiting was set aside, and the framework says how it comes back; the section never restates it.

### The Skeleton

```markdown
---
name: {skill}
description: Ledger's {phase} phase. Reached only through a Ledger handoff, never invoked directly; work comes into Ledger through /ledger.
user-invocable: false
allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs *)
---

# {Phase}

{What the phase is for, and the part Claude plays in it.}

## Arguments

{Each positional argument, as the engine's handoff table declares it.}

## Instructions

Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.

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

{Each checklist by name, where its closing point falls; guidance for any item that needs it, by its key; then the gate.}

## {A Request at Any Point}

{The words that bring it, and the verb or reference that takes it.}
```

A section the phase has nothing for is left out. `## Instructions` is there only in a skill a conversation opens on (The Framework Load).

## What the Engine Owns

The prose names the verb and stops. It never:
- **Draws a menu, a gate or a row.** The engine draws every one and prints it as text; the gate mod shows its rows as buttons where it runs. Lint check 3 refuses a menu drawn in prose.
- **Writes state.** State changes only through verbs. The prose names verbs, never manifest fields, and reads a manifest value only where no verb's response carries it. The layout hook refuses a write under `.ledger/` to a path the layout has no place for, and any write to a manifest, the ledger or `spec-review.json`. Scratch goes in `.ledger/.cache/`.
- **Commits.** Every verb commits its own state writes, with any log changed since. A phase whose content no verb commits — the spec, a review report, a task's account, a summary, an asset, a spike — adds the route to the engine in the same phase. A code commit goes through `commit`, naming the task in flight, and the door runs the project's checks first. A raw `git commit` in a code worktree during a build is refused.
- **Lists a checklist's items.** The engine holds them, works out the ones it can check, and shows the rest with their text. The prose names the checklist.
- **Writes a brief.** `brief` fills the role's template from the records (Agents and Briefs).
- **Chooses how something reaches the person.** It reaches them in a gate, a raise or a mod surface. Nothing asks the person to open a file; material they may want but need not read is one keystroke away on a mod surface, or asked for in words where the mod does not run.

What Claude and the agents write themselves is content, in the places the layout keeps for it: a log, the spec, a spike, an asset. Everything else is written through a verb. A decision or a finding is a ledger entry, written through `ledger`, and the person's answer to a raise through `raise answer`, which also logs who moved whom; a topic's record and its map are projections of the ledger, never files. Markdown carries content only: never frontmatter, never a status in a heading. A feature that needs state gets a field behind a verb.

In discussion, questions are asked in the conversation and each answer lands through `ledger`. Until a topic's shape is agreed, Claude makes no call of intent or taste alone: it works each through in the conversation, putting ideas forward or setting out how it sees the thing working for the person to pull apart, never in set phrases. Once the shape is agreed, a call Claude has a lean on goes through `raise`, which decides whether it reaches the person, and slots in at a natural pause; its answer lands through `raise answer`, never `ledger`. In discovery nothing is decided: what the person says is input, kept in discovery's log, and only what is observed in the code lands, as findings saying how they are known. In the build, every question for the person goes through `raise`; a question asked in plain prose in the build is a slip. Questions reach the person one at a time.

## Writing for the Model Pass

When Ledger moves to a new model, the model pass is a session entering each phase by hand on it, at the efforts Ledger dispatches; what it finds the model no longer needs is cut. The pass cuts prose, so where a part sits decides whether it can be cut:
- **Guidance a better model could do without is prose.** It stays in the skill, where the pass can cut it.
- **What the hard layers hold is there for the person, whatever the model.** A new engine piece is proposed with the failure it prevents and how often that failure happened; one with no failure behind it is brought to the person as a cut.
- **A hard-layer part held for today's model** — a checklist item, a brief template's words, a hook's entry, the model or effort of a call the engine makes itself — **needs its line in the model pass's list** (`docs/contributing.md`, Moving to a new model), which every pass re-weighs. An agent's model and effort need none: they sit in its definition, which the pass edits in place.

## Prose

Skill and reference files are instructions loaded into Claude's context. Write the exact amount the work needs, never the most and never the least. Cutting a needed instruction is as wrong as over-explaining.
- **Lean.** Clear, executable instructions: no why, no backstory, no "what this file is for". Keep a reason only where it changes what Claude does. Test each sentence: does the work hit this case; does a consumer use this feature; would a competent reader need it told? A no to any deletes it.
- **The clean path.** No retry branch for a tool or agent that fails, no guard for a state only a crash produces, no workaround for the harness. Interruption and resume stay first-class: they are the entry's job.
- **Written fresh.** Each file reads as though authored now: no "formerly", no "(new)", no note of what a change replaced.
- **Plain words.** Name things as an engineer would, over coined terms. A compressed claim must be literally true.
- **Context.** A phase loads no reference it does not use, and what it loads before its first question is counted.
- **Decisions before commands.** Anything a command depends on — a flag, a derived value — is stated before the fenced command, never after it.
- **Emphasis.** A bold label and a colon, `**IMPORTANT**:`, and rarely: a rule is obeyed for being explicit, never for being loud.

**Placeholders** mark what varies in a command, a payload Claude composes, and a line Claude says whose wording is fixed:

```
{name}                                    — raw value, output as-is
{name:[option1|option2|option3]}          — enumerated options (pick one)
```

A placeholder never wraps across lines, and a flag carrying the person's words is quoted, `--summary "{summary}"` (lint check 22).

## Agents and Briefs

Every prescribed artifact — the spec, the phase cut, the tasks, the reviews, deep dives, experiment write-ups — is written by a named agent on the roster. The conversation and the build's orchestration stay in the main session.

**An agent's definition** (`agents/{name}.md`) holds what is true of it whatever it is dispatched for:
- its one job, the artifact, with its rules and references boxed inside it;
- its tools, the Skill tool among them where it must find the project's skills itself;
- every skill reference or engine script it names, written as installed, from the project root (`.claude/skills/…`); a brief template that names one does the same;
- its model and effort, fixed in its frontmatter: Opus at medium until a measurement says otherwise, and investigation's root-cause validator at extra-high. Never chosen at dispatch, and never raised by a task's size.

**A brief** holds only the records its role draws on, filled by `brief` from the role's template in the engine's content folder (`skills/ledger-engine/content/briefs/{role}.md`). The template's own words are what every dispatch of that role is told; each `{{record}}` slot is a record the engine fills. What one role's dispatch needs goes in its template; what a task needs goes in the records the brief draws on — onto the task, or into the ledger — never into the dispatch. The project's skills and CLAUDE.md reach the agent without the brief.

**The dispatch.** `brief {role} …` issues the brief and answers with its agent and its pointer. The Agent call's `subagent_type` is that agent, and its prompt the pointer, `brief:{id}`, alone (a fix round's is the SendMessage message). The hook before Agent and SendMessage keys on the agent, and refuses anything else for one of Ledger's agents. A phase whose skill dispatches an agent `brief` has no role for adds the role, its template and its records to the engine in the same phase. A fix round's brief is the reviewers' reports, verbatim, and nothing else.

**A refusal.** When a door refuses what an agent made, the skill dispatches the agent again, with a fresh brief carrying the refusal; Claude never edits the agent's work itself. Where the role's template has no slot for a refusal, the phase that builds the corridor adds one.

A dispatched agent runs in the background and hands back when it is done. A skill names no dispatch mode. The work goes on meanwhile where it can — discussion's reviews and deep dives run while the conversation carries on, their results taken up at a natural pause — and waits only where it needs the agent's result.

An agent works from the record, never the conversation. Its calls come back to the orchestrator and go where any call goes: the ledger, or `raise`. An agent never asks the person.

## Handoffs and Recovery

**Handing off** moves the work into a skill that starts it afresh. The engine names the move — `handoff`, or a gate's `next` of kind `handoff` — and composes the continuation. Where the gate mod runs it clears the conversation and carries the continuation into the next one; elsewhere the skill is invoked in place. Nothing crosses but the skill and its arguments: what the next skill needs is on disk first.

Nothing hands off inside a build, a quick-fix or a topic. An experiment's spawn leaves the topic: the laboratory opens in a clean conversation, by a handoff. One orchestrator runs a build across all its phases and straight into the review phase. A move between discovery's levels, or from a topic up to its epic's discovery or the product's conversation, carries the conversation on in the same session.

**Invoking** a skill is a Skill tool call: it adds the skill's instructions to the running context and clears nothing. Show the literal command — ``Invoke `/{skill} {args}`.`` — outside any fence; inside one it is printed, not run (lint check 14). **Loading** a reference reads guidance into the running context, nothing more.

**Recovery.** After a compaction, a crash or a new session, the engine's note names the skill and each document to re-read, and the conversation carries on where it was. A skill carries no section of its own on resuming (lint check 38). Where its work needs a document re-read, the note names it: that is a change to the engine's note, never prose. Re-reading the skill re-runs its framework load. What the verbs record outlasts a compaction. A log may lag the conversation — how often Claude writes it is Claude's — and after a compaction it is caught up from the transcript of the conversation that wrote it: a topic's log names the conversations that wrote it, and in discovery the note names the log's transcript.

## Display

**Claude's own words:**
- **The conversation**, in the framework's voice and altitude: product first, code as evidence beneath it.
- **A line made only of values the conversation holds** — a name it was passed, a count it tallied, a path the layout fixes. It is said inline, never fenced: its wording in a code span where the wording is fixed (``Say `Phase {N} merged.` ``), or `In your own words, …` where it is judgment.
- **A line or a payload Claude writes for a report** is in the product's terms, in the framework's register (`altitude.md`, `voice.md`), and the engine draws the report. A `t/technical` row retells it from the code's side (`technical-lens.md`).
- **A code block Claude writes itself** — a diagram, a sample — which names its language on the fence, `text` for plain.

**The engine's** is everything with a fixed shape or read from state: menus, gates, raises, lists, trees, a marker naming anything that varies, blockers. A skill authors no display block: anything that varies is the engine's, and a fixed line is Claude's, said inline. Judgment content inside an engine display reaches it as a payload file; a fact only the session holds, as a flag.

**Content the person approves as the thing itself** — a change, spec prose — is shown verbatim in the form it will take, never framed in drawn borders, with a label or a line saying what it is.

### Engine Sections

An engine call that renders answers in sections, each opened by a marker, `=== NAME (instruction) ===`, whose instruction says how its section is emitted. The marker line is never emitted.
- `DATA` — read it to decide; never shown or restated.
- `TITLE`, `DISPLAY`, `MENU` — emitted verbatim, as the marker says.
- `GATE`, `HANDOFF`, `POSITION` — for the gate mod; never shown or restated.

A skill never says how a section is emitted: the framework follows each marker, and the marker is the one instruction. A sentence that names a section never states a form of its own (lint check 21). A section is emitted from the call that produced it, in the turn that shows it: never carried to a later moment, never redrawn, reflowed, trimmed or composed from memory. A transaction verb answers one JSON line, then the sections of the receipt or the screen it draws, where it draws one.

**A MENU in a tool result is a live gate at that call**: `gate` takes the answer against the gate last shown. A call returns a MENU only where the skill shows that gate there; a view fetched for its data or its display is fetched without one.

### The Design System

Every screen the engine draws keeps to the existing design system; a new screen or variant fits it. Its menus, lists and displays are drawn by `domain/projections/surfaces.cjs`, whose header holds their rules, and whose menu frame refuses some breaks outright.
- **Glyphs.** Squares are structure: `■` a title, `□` a step, `▪` a sub-step. Circles and arrows are an item's state: `○ ◐ ● ◌ → ✓ ⊙ ⊘ ⊖`. `◆` is a decision, `⚑` an alert; `⏺` is the host's own.
- **Chrome.** A title is `# **`■ Title`**`, one per skill invocation. A marker is `**`□ Name`**` or `**`▪ Name`**`: no numbers, a loop's count in parentheses (`(3 of 12)`, `(cycle 2)`). A marker whose text varies — a count, a position — is the engine's; a fixed one Claude says itself, inline. A marker shows only where something follows it before the next one. A signpost is a markdown blockquote of one to three sentences, one authored line per paragraph.
- **Forms.** A section's marker names one of four forms: markdown (not a code block), for chrome, menus and anything that needs rendered formatting; a text code block (```text fence), for layout — trees, columns, aligned lists; a properties code block (```properties fence), for a blocker and the banner — the product's name drawn in ASCII art at the head of the start menu; a diff code block (```diff fence), for change content.
- **Callouts and blockers.** An advisory inside a display opens on `⚑` and stays plain. A state the person cannot proceed past renders red, in its own properties fence, one logical line with the flag at column zero, guidance beneath it as a signpost. Red is for a blocked state and the strongest advisory only.

## Files

The capture skills (`ledger-log-*`) write to the inbox and nothing else. They run no flow, and stay structureless: no gates, no references, no framework load, and the display rule's check passes over them.

### Frontmatter

- `user-invocable: false` on every skill the person does not type themselves.
- A `description` is all Claude sees of a skill until it is invoked. The start skill's opens with its trigger, short: what Claude reaches for Ledger on, and what goes straight through. Every other skill a handoff lands on (`HANDOFF_TARGETS`) says it is reached only through a Ledger handoff, never invoked directly (lint check 37). Invocability stays as it is: without the gate mod, a handoff invokes the next skill in the same conversation.
- No `effort:` and no `model:`: the conversation runs at the person's own effort. An agent's definition fixes its own.
- Every `allowed-tools` Bash grant carries a `*`; a grant for Ledger's own script ends in ` *` (lint check 28).

### Headings

One H1 per file, its title — except the skills that only hand the work on, the start skill and the menus of the epic and the roadmap, which open on their frontmatter alone (lint check 8). Discovery is a phase that talks: it takes an H1, and lint check 8's sets change with its rewrite. H2 for sections, H3 within them. Sections are named for what they cover: no step numbers, no lettered sections, and no heading that routes.

### The Framework Load

The framework holds what is true in every conversation. It loads once per conversation, at the head of the skill the conversation opens on — the person's way in, or a skill a handoff lands on (`HANDOFF_TARGETS` in `domain/handoff.cjs`). Each of those opens its `## Instructions` section with this line and nothing else:

```markdown
Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.
```

An opening skill met later in a conversation — without the mod, a handoff invokes the next skill in the same one — carries on from the load already made. A skill only ever opened in place carries neither the section nor the load (lint check 27). `framework.md` only composes the shared references every conversation holds. A rule universal to every conversation joins that list; a rule only some phases use loads from those phases. A skill never restates a framework rule: a second copy is a second source of truth.

### References

A skill splits a part into a reference when the part is needed only at a moment — a request at any point, an item's guidance at the close, a corridor's move — so the phase loads it then, and only then.
- **Named** for what it covers, in kebab-case: `closing-pass.md`, `sending-a-message.md`.
- **Headed** with its title, an attribution line, and a rule (lint check 10):

  ```markdown
  # {Title}

  *Reference for **[{skill}](../SKILL.md)***

  ---
  ```

  A reference loaded by another reference names that file instead. A shared reference, under `skills/ledger-shared/references/`, says `*Shared reference. Loaded by {callers}.*`.
- **Loaded** by one line, never mid-sentence, the link bold and resolving (lint checks 7, 7b): `Load **[name.md](references/name.md)** and follow its instructions as written.` What it needs from the caller is named in the load line — ``… with topic = `{topic}`.`` — and is already in context.
- **Deferring to the owner.** A reference that needs another skill's mechanic invokes that skill or loads its reference, carrying only what the caller knows. It never restates the owner's paths, naming or format. Where two files say the same thing, delete one rather than keep them aligned.
