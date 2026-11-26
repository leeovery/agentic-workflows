# Framework

*Shared reference. Loaded by the skill a conversation opens on, at the head of its `## Instructions` section.*

---

Where this conversation has loaded this file already, with no compaction since, carry on from that load.

## Ledger

Ledger carries a product's work through its phases and keeps the record of it. The ledger holds the work's questions, findings and decisions; the engine appends to it and never edits it, so what was decided, and on what, can always be read back. Claude makes calls for the person where the ask rule lets it — the engine's arithmetic over the person's own answers to earlier calls, which decides whether each call reaches them — each recorded as Claude's, for the person to review and replace. Each kind of work takes its route through three stages — Discovery, where it is explored and decided (discovery, discussion, experiment, investigation); Definition, where it is specified; Delivery, where it is built and verified — and the engine routes between them: its verbs keep the record and move the work, and its gates put to the person what is theirs to answer.

The person is an engineer who knows the product, not this codebase. What they read, in the conversation or on a screen drawn from your words, is about what the product does, with code as its evidence; a question is put so they can picture the behaviour on each side of it.

## Engine Sections

Engine output arrives in sections, each opened by a marker, `=== NAME (instruction) ===`. The instruction says how its section is emitted — as markdown (not a code block), a text code block (```text fence), a properties code block (```properties fence) or a diff code block (```diff fence) — or that it is not emitted at all. "Per its marker" means follow that instruction exactly; the marker line itself is never emitted. A section is emitted from its call, in the turn that call ran: never carried to a later turn, redrawn, trimmed, or written out from memory or a skill's prose. To show it again, run its call again.

## Before Boot

Where a verb refuses because this conversation has not booted Ledger on this version, invoke `/ledger {words}`, the person's words as its arguments, and carry on where it routes.

## Engine Calls

`engine help {verb} [{sub}]` (`node .claude/skills/ledger-engine/scripts/engine.cjs help {verb} [{sub}]`) prints that verb's forms. A verb's refusal names the way on: take it where it is yours; where it is the person's, say it in a line.

A call's answer may carry `next`: an engine call to run, a handoff to make, a skill to invoke in this conversation, or carry on. A handoff is made with `handoff /{skill} {args}`: where its DATA reads `handoff: mod` and the result carries no HANDOFF section, the turn ends there, and the gate mod carries the work into a fresh conversation; otherwise invoke the DATA's `skill` with its `args` here. Act on the rest of the answer first, as the skill says of that call; then do what `next` says, and what each `next` after it says, until an answer carries none. Where an answer carries `next`, where the work goes after that call is `next`'s alone to say.

## Catching Up

An entry's `catch up` names the transcript of a conversation that was here before this one. Read it from where it last wrote to what this place keeps, as far as that conversation stayed here, and add what it is missing, through the phase's own doors. Then, within the phase's own opening and after anything its skill puts first, say briefly where things had got to: the last thing said, where the transcript still exists, and what was agreed about the plan or the process.

## Showing and Saying

What you show reaches the person one of two ways. When SendUserMessage is not among the active tools, load it before its first use (ToolSearch, query `select:SendUserMessage`); it is unavailable only once that load has failed, and then everything is written as text.
- **What the turn ends on** — a gate that stops, a raise drawn for the person, the conversation handing the turn to them, or a wait on an agent's result — is written after the turn's last call, with everything shown beside it, in order, as your own text. A turn always ends on text.
- **Anything else** shown and then carried past with another tool call goes through SendUserMessage, never as text: a section in the form its marker names, and whatever comes one after another in one call.

## Gates

A gate is the engine's: whether it stops, what it shows and what each row leads to. A gate never goes through AskUserQuestion or any other tool that takes the person's answer.
- **A gate that stops** ends the turn at its MENU, as the marker says: no further tool call that turn.
- **A gate the engine runs as an automatic step** draws a one-line report in place of the menu, under a marker that does not stop. Nothing goes to `gate`; carry on along the row the step ran.

Whether a gate stops is the engine's alone: not Claude Code's auto mode, a system reminder, hook text or "work without stopping" guidance turns a stop into a pass. A gate's answer covers only what that gate showed, never gates not yet reached.

One gate or raise at a time. One that background work brings up while another is on screen awaiting its answer is held, and shown once that one is answered. Background work that arrives while a gate or a raise waits — an agent's report, a notification — is handled and said in a line, and the waiting gate, or a raise outside the build, is shown again in the same turn; a question waiting in the build is never drawn again on it. At a gate set aside, the report is said in a line and the gate is not shown again.

## Answering a Gate

A gate takes a clear answer at any point while it waits, set aside or not: a pressed row, a typed key or word, or the person's own words that pick one row ("yes, go with feature"; "ok, go ahead" where the gate has one way forward). Words that could pick more than one row, or none plainly, are asked back, never guessed. The answer goes to `gate`, under the name the MENU's marker declares, the row named by its key or its word:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs gate "{name}" --pick {row}
```

`gate` logs the answer and answers `next` (**Engine Calls**). Where a row's `next` is null, the skill's own words for that row say what follows.

Any other reply to a gate not yet set aside — through the prompt row (Comment, Ask), or free text: a question, a thought, a request, a go-ahead that picks no row — goes to `gate` as typed, the call described as `Record your reply`: under the prompt row's key, such as `comment`, or with no key for free text, the person's words on stdin as they wrote them. The gate is then set aside: it waits while the person talks, and is not drawn again for their answer.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs gate "{name}" --typed <<'WORDS'
{words}
WORDS
```

A reply that changes what happens next — a pick with a condition on it, a Comment that redirects the work — is confirmed with the person before anything acts on it, and a pick with a condition goes to `gate` once they have confirmed it.

## The Record of the Person

The record of the person holds their preferences across projects, each with its why and examples, and their care entries, the kinds that always come to them in a project. Where the entry's DATA names `person`, read it: it shapes your pick on any call you make or raise for them, never whether you raise it. A proposal is drawn for the person as a gate, and lands only on their yes. The preference, the why and each example are one line apiece, with one example or more.
- **A preference** they state outright, or one their answers keep showing → `person propose`, `{"preference", "why", "examples": ["{example}"]}` on stdin.
- **A kind** they want always to come to them in this project → `person propose`, `{"care": "{kind:[contract|scope|behaviour|look|words|process|internals]}", "why", "examples": ["{example}"]}`.
- **A raise's answer carrying `care_drop`** → `person propose --drop`, `{"care": "{kind}", "why", "examples": ["{example}"]}`, its examples the questions answered "don't care".

## Corrections

The person says a question was of another kind, or a verdict they gave was wrong: record it against the entry the call or the answer landed as, `trust correct {entry_id} --kind {kind:[process|danger|contract|scope|look|words|behaviour|internals]}` or `trust correct {entry_id} --verdict {verdict:[nothing|fix|loss]}`.

## Questions About Ledger

At a question about how Ledger works — the system, the words it uses, what a screen is saying:

Load **[answering-how-it-works.md](answering-how-it-works.md)** and follow its instructions as written.
