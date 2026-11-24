# Skill Authoring Conventions

The rules for writing a skill on this repo: what a skill holds, where each of its rules goes, and how its prose reads. They are for authors. Nothing here is loaded at runtime, and no skill relies on it.

A skill not yet rewritten to this file keeps its shape until its rewrite.

## The Aim

Get out of Claude's way, and explain clearly. A skill says what Claude cannot know untold — what each thing it names is for (Where a Rule Goes) — so Claude does the work well by its own judgment. Explaining is not prescribing: it orders no step, and a skill may grow to explain. It is as terse as clarity allows, and unambiguous: an ambiguity costs Claude thinking on every turn that meets it, so it is removed, never left for Claude to resolve. A method is prescribed only with cause: a hard edge, where leaving it to Claude has been shown to go wrong; a corridor, where the outcome must be the same every time (Where a Rule Goes, Fields and Corridors). A line is judged by whether it equips Claude or constrains it, never by its length.

## Who Holds What

Ledger is mostly field, with a few corridors (Fields and Corridors). The engine holds the structure, the same every time: the state, the verbs that are the only way to change it, their refusals, and the screens and gates the person sees. The person holds the product and the calls put to them. Claude works everything else by its own judgment.

Control flow lives in the engine, never in prose. A skill never branches on a status it read or on the person's answer at a gate: it does what the engine's verbs return.

## Where a Rule Goes

Every rule a skill would carry is one of three kinds, and each kind has one home.

| Kind | What it covers | Its home | What the prose keeps |
|---|---|---|---|
| Contract | where something lands, the shape it takes, what gets recorded, which door a change goes through, what the person sees | a verb that is the only door — it picks the path, writes the shape, records the event and refuses what is wrong — with the hooks and checks behind it | one line naming the verb |
| Required procedure | steps that must all happen before a point, in any order: a topic's close, a phase's start and close, finish | an item on the engine's checklist for that point | the checklist's name |
| How-to | everything else | deleted | nothing |

Ask of each rule, in this order:
1. If Claude did it another way, would a fixed thing the person sees change — a screen, a gate, an output — or would the record take a different kind of entry, in another place or another shape? It is a contract. Claude's own wording, in a conversation or inside an entry, is not.
2. Must each of these happen before the work moves past a point, in whatever order? It is a required procedure.
3. Anything else is how-to, and deleted.

These sit outside the table:
- **What a thing is for** — the phase and where it sits, a record and who reads it, a tool, a door. It is explanation, not a rule (The Aim), and stays wherever it informs Claude's judgment. What Ledger is, the framework says once for every skill (The Framework Load); a phase skill says what its own phase is and where it sits.
- **A corridor's moves** — what works, prescribed precisely, in a corridor alone (Fields and Corridors).
- **A contract the spec names no verb for, or a procedure with no checklist item.** Bring it to the person. It is never held in prose as a "must" until a verb or an item exists. A verb the spec names that is not built yet is built by its phase, never brought to the person.
- **A rule that holds in every conversation, and that the engine's structure needs** — how a reply at a gate is taken. It belongs to the framework (The Framework Load), never to a skill.
- **A hard edge no door can refuse** — a question for the person asked in plain prose in the build, an extra review round, a place use showed the obvious move is the wrong one. It stays a line of prose.

A behaviour Ledger gets wrong is fixed by deleting the prose that causes it, never by a counter-rule. A contract that keeps slipping gets a verb or a check, never more prose.

## The Phase Skill

A phase skill fences its field and gives its corridors' moves (Fields and Corridors), and nothing else. Outside a corridor it never says how Claude converses, the order a conversation takes, its pacing, what Claude reads — the entry's DATA names what there is, and Claude reads what the work needs — or when Claude writes the record (lint check 39 catches the pacing it can decide). Its fence:
- **Which phase and which piece of work this is** — its arguments, as the engine's handoff table declares them.
- **Its goal** — what the phase is for, and where it sits: what feeds it, and what reads what it leaves.
- **Its done-condition** — what is true when the phase can be left, stated as what the engine holds.
- **What it leaves in the record** — the content it writes, in the places the layout keeps for it.
- **Its tools** — what it holds for Claude to reach for when the work needs it, such as research or a background agent, a line each saying what it is for.
- **The verbs it names** — one line for each door that keeps the record or moves state, saying what it is for. A door line is complete: the call's form, its stdin payload, its quoting, and any field of its answer the skill must use or say. The rest of each verb's contract is in `docs/engine/commands.md`, which no skill loads. A refusal is the framework's to take; a door line adds to it only where the way on is not the one the refusal names.
- **Its checklists** — each closing point it works towards, by name, where it has any: discussion's decided, at a topic's close; specification's ready to build; the build's phase start and phase close, for each phase of its cut; and the review phase's finish. Discovery, experiment and investigation have none. A feature's discussion closes into its spec with no gate, and specification works decided and ready to build together, on one screen; a quick-fix's finish runs at the close of its own session, and it reaches the review phase only when the person asks.
- **Its hard edges** — what the engine can't enforce, a line each, where it has any.

### Entered and Left Through Gates

Every phase is entered and left through gates, each the engine's. The prose never says whether a gate stops, and never carries a branch for a position.

**Entering.** A phase is moved into by a handoff, from a gate or a menu pick, except a move between discovery's levels, which carries the conversation on (Handoffs and Recovery). Its entry is one engine call, shared by every phase; the skill does what the answer says.

**Leaving.** The phase is left at its closing point. Claude works the checklist (`checklist show`, `done`, `skip` with a reason) in the order it likes, closes it, and fetches the gate that follows, where one does — a phase's start in the build has none.

**Answering.** The framework holds how a gate is answered.

### Fields and Corridors

A **field** is where Claude works by its own judgment: where a conversation goes next, what it reads, when it writes the record, how a piece of code is built and tested. A field is fenced, never open: its fence is what the phase skill gives Claude (The Phase Skill), and its prose orders nothing inside it. A tool in a field is reached for when the work needs it, never fired on a schedule.

A field is sized by its phase. Widest first:
- **The product's discovery** — talk. It is not where decisions are made, though none is banned.
- **A topic's discussion** — talk, with tools to reach for when needed, such as research and background agents.
- **The build** — the smallest. Its plan is written a set way, followed and marked off, and its agents are orchestrated a set way; how each piece is built is Claude's.

In the build, nothing Claude does in the field leaves it except through a verb or a gate: what reaches the person, what gets recorded and every question to the person; the layout hook, the commit door and the checklists refuse the rest. In a phase that talks, the conversation reaches the person in plain prose; what gets recorded still goes through a verb, or into a log the layout keeps.

A **corridor** is where what works is prescribed, in enough detail to be followed the same way every time: answering a gate or a menu, the cut of the spec into phases, writing a phase's tasks and plan, marking work off, the build's orchestration of its agents, the final review. A corridor's prose is precise — the order of its moves, each a dispatch, a verb or a checklist mark — and that precision belongs there and nowhere else. It says nothing about how an artifact is made: that is the named agent's (Agents and Briefs). Whether the agent runs the corridor's verb, or the skill runs it on the agent's output, is as the spec says, or as the corridor's rewrite decides where the spec is silent.

### Requests at Any Point

Some requests can come wherever the phase is: put an idea or a bug aside, postpone or cancel the topic, a gap the person names during the build. Each is a section of its own, named for the request: the words that bring it, and the verb or reference that takes it. Afterwards the work carries on where it was, unless the verb's answer moves it. A gate that was waiting was set aside, and the framework says how it comes back; the section never restates it.

### The Skeleton

````markdown
---
name: {skill}
description: Ledger's {phase} phase. Reached only through a Ledger handoff, never invoked directly; work comes into Ledger through /ledger.
user-invocable: false
allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs *)
---

# {Phase}

{What the phase is for, and where it sits.}

## Arguments

{Each positional argument, as the engine's handoff table declares it.}

## Instructions

Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.

## Done When

{The done-condition, as what the engine holds.}

## Entering

{The entry call.}

## {The Work}

{A field: its tools, what it leaves in the record, and any hard edge, under headings named for what each covers.
A corridor: its moves, in order.}

## Doors

- {What it is for}:

  ```bash
  node .claude/skills/ledger-engine/scripts/engine.cjs {verb} {args} <<'{TAG}'
  {payload}
  {TAG}
  ```

## Closing

{Each checklist by name, where its closing point falls; a hard edge for any item that has one, by its key; then the gate.}

## {A Request at Any Point}

{The words that bring it, and the verb or reference that takes it.}
````

A section the phase has nothing for is left out. `## Instructions` is there only in a skill a conversation opens on (The Framework Load).

## What the Engine Owns

The prose names the verb and stops. It never:
- **Draws a menu, a gate or a row.** The engine draws every one and prints it as text; the gate mod shows its rows as buttons where it runs. Lint check 3 refuses a menu drawn in prose.
- **Writes state.** State changes only through verbs. The prose names verbs, never manifest fields, and reads a manifest value only where no verb's response carries it. The layout hook refuses a write under `.ledger/` to a path the layout has no place for, and any write to a manifest, the ledger or `spec-review.json`. Scratch goes in `.ledger/.cache/`.
- **Commits.** Every verb commits its own state writes, with any log changed since. A phase whose content no verb commits — the spec, a review report, a task's account, a summary, an asset, a spike — adds the route to the engine in the same phase. A code commit goes through `commit`, naming the task in flight, and the door runs the project's checks first. A raw `git commit` in a code worktree during a build is refused.
- **Lists a checklist's items.** The engine holds them, works out the ones it can check, and shows the rest with their text. The prose names the checklist.
- **Writes a brief.** `brief` fills the role's template from the records (Agents and Briefs).
- **Chooses how something reaches the person.** It reaches them in a gate, a raise or a mod surface. Nothing asks the person to open a file; material they may want but need not read is one keystroke away on a mod surface, or asked for in words where the mod does not run.

What Claude and the agents write themselves is content, in the places the layout keeps for it: a log, the spec, a spike, an asset. Everything else is written through a verb. A topic's record and its map are projections of the ledger, never files. Markdown carries content only: never frontmatter, never a status in a heading. A feature that needs state gets a field behind a verb.

Where each kind of record lands:
- **A decision or a finding** — a ledger entry, through `ledger`.
- **A call Claude would make for the person** — through `raise`, which decides whether it reaches them; their answer through `raise answer`, which also logs who moved whom, never `ledger`. In the build, every question for the person goes through `raise`.
- **What is said in discovery** — kept in discovery's log; only what is observed in the code lands on the ledger, as findings.

## Writing for the Model Pass

When Ledger moves to a new model, the model pass is a session entering each phase by hand on it, at the efforts Ledger dispatches, and cutting what the model no longer needs:
- **A hard edge in prose** the new model no longer needs is cut.
- **What the hard layers hold is there for the person, whatever the model.** A new engine piece is proposed with the failure it prevents and how often that failure happened; one with no failure behind it is brought to the person as a cut.
- **A hard-layer part held for today's model** — a checklist item, a brief template's words, a hook's entry, the model or effort of a call the engine makes itself — **needs its line in the model pass's list** (`docs/contributing.md`, Moving to a new model), which every pass re-weighs. An agent's model and effort need none: they sit in its definition, which the pass edits in place.

## Prose

Skill and reference files are loaded into Claude's context. How-to and voice are cut freely, and come back only for a problem met in use. An engine instruction, a route, a payload or a corridor's move is cut only after the removal check.
- **The removal check.** Before a line goes, list every engine feature it fed — a verb, a flag, a payload field, a field of an answer it used or said, a line of the DATA it read — and confirm each still has a caller in the skill or its references. One left with none keeps its line, or is brought to the person as a cut.
- **Lean.** What a thing is for is explanation (Where a Rule Goes); a method gets no why. No backstory, and no line about the file itself. A sentence for a case the work never hits, a feature no consumer uses, or a move Claude would make untold is deleted.
- **One action, one form.** An action takes the same form wherever a skill and its references name it. Two doors for one trigger get a line that decides between them.
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

Every prescribed artifact — the spec, the phase cut, the tasks, the reviews, deep dives — is written by a named agent on the roster; an experiment's report is the laboratory session's own. The conversation and the build's orchestration stay in the main session.

**An agent's definition** (`agents/{name}.md`) holds what is true of it whatever it is dispatched for:
- its one job, the artifact, with its rules and references boxed inside it;
- its tools, the Skill tool among them where it must find the project's skills itself;
- every skill reference or engine script it names, written as installed, from the project root (`.claude/skills/…`); a brief template that names one does the same;
- its model and effort, fixed in its frontmatter: Opus at medium until a measurement says otherwise, and investigation's root-cause validator at extra-high. Never chosen at dispatch, and never raised by a task's size.

**A brief** holds only the records its role draws on, filled by `brief` from the role's template in the engine's content folder (`skills/ledger-engine/content/briefs/{role}.md`). The template's own words are what every dispatch of that role is told; each `{{record}}` slot is a record the engine fills. What one role's dispatch needs goes in its template; what a task needs goes in the records the brief draws on — onto the task, or into the ledger — never into the dispatch. The project's skills and CLAUDE.md reach the agent without the brief.

**The dispatch.** `brief {role} …` issues the brief and answers with its agent and its pointer. The Agent call's `subagent_type` is that agent, and its prompt the pointer, `brief:{id}`, alone (a fix round's is the SendMessage message). The hook before Agent and SendMessage keys on the agent, and refuses anything else for one of Ledger's agents. A phase whose skill dispatches an agent `brief` has no role for adds the role, its template and its records to the engine in the same phase. A fix round's brief is the reviewers' reports, verbatim, and nothing else. A skill names no dispatch mode.

**A refusal.** When a door refuses what an agent made, the skill dispatches the agent again, with a fresh brief carrying the refusal; Claude never edits the agent's work itself. Where the role's template has no slot for a refusal, the phase that builds the corridor adds one.

An agent works from the record, never the conversation. Its calls come back to the orchestrator and go where any call goes: the ledger, or `raise`. An agent never asks the person.

## Handoffs and Recovery

**Handing off** moves the work into a skill that starts it afresh. The engine names the move — `handoff`, or a gate's `next` of kind `handoff` — and composes the continuation. Where the gate mod runs it clears the conversation and carries the continuation into the next one; elsewhere the skill is invoked in place. Nothing crosses but the skill and its arguments: what the next skill needs is on disk first.

Nothing hands off inside a build, a quick-fix or a topic. An experiment's spawn leaves the topic: the laboratory opens in a clean conversation, by a handoff. One orchestrator runs a build across all its phases and straight into the review phase. A move between discovery's levels, or from a topic up to its epic's discovery or the product's conversation, carries the conversation on in the same session.

**Invoking** a skill is a Skill tool call: it adds the skill's instructions to the running context and clears nothing. Show the literal command — ``Invoke `/{skill} {args}`.`` — outside any fence; inside one it is printed, not run (lint check 14). **Loading** a reference reads it into the running context, nothing more.

**Recovery.** After a compaction, a crash or a new session, the engine's note names the skill and each document to re-read, and the conversation carries on where it was. A skill carries no section of its own on resuming (lint check 38); a document its work needs re-read is named by the engine's note, never by prose. Re-reading the skill re-runs its framework load. What the verbs record outlasts a compaction. A log may lag the conversation, and after a compaction it is caught up from the transcript of the conversation that wrote it: a topic's log names the conversations that wrote it, and in discovery the note names the log's transcript.

## Display

**Claude's own words** are the conversation, and:
- **A line made only of values the conversation holds** — a name it was passed, a count it tallied, a path the layout fixes — said inline, never fenced, its wording in a code span where the wording is fixed (``Say `Phase {N} merged.` ``).
- **A line or a payload Claude writes for a report**, which the engine draws.
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

The keep skill (`ledger-keep`) keeps what is said, in any conversation, through the doors its map names. It runs no flow, and stays structureless: no gates or references of its own, and no framework load. A migration owed runs through the start skill's boot reference and its review, which the keep loads.

### Frontmatter

- `user-invocable: false` on every skill the person does not type themselves.
- A `description` is all Claude sees of a skill until it is invoked. The start skill's opens with its trigger, short: what Claude reaches for Ledger on, and what goes straight through. Every other skill a handoff lands on (`HANDOFF_TARGETS`) says it is reached only through a Ledger handoff, never invoked directly (lint check 37). Each stays invocable: without the gate mod, a handoff invokes the next skill in the same conversation.
- No `effort:` and no `model:`: the conversation runs at the person's own effort. An agent's definition fixes its own.
- Every `allowed-tools` Bash grant carries a `*`; a grant for Ledger's own script ends in ` *` (lint check 28).

### Headings

One H1 per file, its title — except the skills that only hand the work on, the start skill and the menus of the epic and the roadmap, which open on their frontmatter alone (lint check 8); discovery, a phase that talks, takes one. H2 for sections, H3 within them. Sections are named for what they cover: no step numbers, no lettered sections, and no heading that routes.

### The Framework Load

The framework loads once per conversation, at the head of the skill the conversation opens on — the person's way in, or a skill a handoff lands on (`HANDOFF_TARGETS` in `domain/handoff.cjs`). Each of those opens its `## Instructions` section with this line and nothing else:

```markdown
Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.
```

An opening skill met later in a conversation — without the mod, a handoff invokes the next skill in the same one — carries on from the load already made. A skill only ever opened in place carries neither the section nor the load (lint check 27).

The framework holds only what is true in every conversation and that Claude would not do untold: a short paragraph on what Ledger is, with no phase's detail; and what it needs to work the engine's structure, such as how a gate is answered and the one line on taking a refusal, where the engine's own output does not already say it. It never holds how Claude sounds, thinks, decides or follows instructions, and a rule only some places use is held where it is used. `framework.md` composes the shared references that hold it, each loaded from there alone (lint check 29); when it has nothing left to hold, it and its load go. A skill never restates a framework rule: a second copy is a second source of truth.

### References

A part goes inline or into a reference by two weights: how often and how early its trigger comes, against its size and what its signpost must say.
- **Inline** — what every turn needs, and the opening. A part of a line or two is inline wherever its trigger comes: it costs less than its signpost.
- **A reference** — a part needed only at a rare or late moment — a request at any point, a closing, a once-a-project step, a corridor's move — loaded then and only then, even where the signpost and the file come to more words than the part would inline: until its moment, it stays out of the context.
- **Standing guidance stays in SKILL.md.** A reference holds a procedure that runs to its end at its trigger. What holds across turns is in SKILL.md, which a compaction keeps and a loaded reference does not; SKILL.md opens on what matters most, all of it inside what a compaction keeps of it (Claude Code keeps an invoked skill's first 5,000 tokens).

A reference is:
- **Named** for what it covers, in kebab-case: `closing-pass.md`, `sending-a-message.md`.
- **Headed** with its title, an attribution line, and a rule (lint check 10):

  ```markdown
  # {Title}

  *Reference for **[{skill}](../SKILL.md)***

  ---
  ```

  A shared reference, under `skills/ledger-shared/references/`, says `*Shared reference. Loaded by {callers}.*`. A reference over 100 lines lists its sections below the rule.
- **Loaded** by one line, never mid-sentence, the link bold and resolving (lint checks 7, 7b): `Load **[name.md](references/name.md)** and follow its instructions as written.` What it needs from the caller is named in the load line — ``… with topic = `{topic}`.`` — and is already in context. A reference whose instructions apply only where state says so has no Load line: the engine names it in the entry's DATA, with what it covers and when it applies, and its header reads `*Shared reference. Loaded where an entry's DATA names it.*`
- **One level deep.** Every load is signposted from SKILL.md; a reference never loads another reference, the framework's composition aside (The Framework Load). A reference that needs another's procedure names the SKILL.md section that loads it.
- **Deferring to the owner.** A single call of another skill's mechanic is a door line, written inline. A part that needs more of it invokes that skill or loads its reference from SKILL.md, carrying only what the caller knows. What is never restated is the owner's procedure, paths, naming and format. Where two files say the same thing, delete one rather than keep them aligned.
