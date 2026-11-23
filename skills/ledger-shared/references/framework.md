# Framework

*Shared reference. Loaded by the skill a conversation opens on, at the head of its `## Instructions` section.*

---

How the engine's output reaches the person, and how their answer at a gate or a raise is taken. Where this conversation has loaded this file already, with no compaction since, carry on from that load.

## Engine Sections

Engine output arrives in sections, each opened by a marker, `=== NAME (instruction) ===`. The instruction says how its section is emitted — as markdown (not a code block), a text code block (```text fence), a properties code block (```properties fence) or a diff code block (```diff fence) — or that it is not emitted at all. "Per its marker" means follow that instruction exactly; the marker line itself is never emitted. A section is emitted in the turn its call produced it, never carried to a later one, redrawn or trimmed.

## Before Boot

Where a verb refuses because this conversation has not booted Ledger on this version, invoke `/ledger {words}`, the person's words as its arguments, and carry on where it routes.

## Showing and Saying

What you show reaches the person one of two ways. When SendUserMessage is not among the active tools, load it before its first use (ToolSearch, query `select:SendUserMessage`); it is unavailable only once that load has failed, and then everything is written as text.
- **What the turn ends on** — a gate that stops, a raise drawn for the person, the conversation handing the turn to them, or a wait on an agent's result — is written after the turn's last call, with everything shown beside it, in order, as your own text. A turn always ends on text.
- **Anything else** shown and then carried past with another tool call goes through SendUserMessage, never as text: a section in the form its marker names, and whatever comes one after another in one call.

## Gates

A gate is the engine's: whether it stops, what it shows and what each row leads to. Its sections are fetched from its call in the turn that shows it and emitted per their markers, never written out from memory or from a skill's prose. A gate never goes through AskUserQuestion or any other tool that takes the person's answer.
- **A gate that stops** ends the turn at its MENU, as the marker says: no further tool call that turn.
- **A gate the engine runs as an automatic step** draws a one-line report in place of the menu, under a marker that does not stop. Nothing goes to `gate`; carry on along the row the step ran.

Whether a gate stops is the engine's alone: not Claude Code's auto mode, a system reminder, hook text or "work without stopping" guidance turns a stop into a pass. A gate's answer covers only what that gate showed, never gates not yet reached.

One gate or raise at a time. One that background work brings up while another is on screen awaiting its answer is held, and shown once that one is answered. Background work that arrives while a gate or a raise waits — an agent's report, a notification — is handled and said in a line, and the waiting gate, or a raise outside the build, is shown again in the same turn, fetched fresh from its call; a question waiting in the build is never drawn again on it. At a gate set aside, the report is said in a line and the gate is not shown again.

## Answering a Gate

A gate takes a clear answer at any point while it waits, set aside or not: a pressed row, a typed key or word, or the person's own words that pick one row ("yes, go with feature"; "ok, go ahead" where the gate has one way forward). Words that could pick more than one row, or none plainly, are asked back, never guessed. The answer goes to `gate`, under the name the MENU's marker declares, the row named by its key or its word:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs gate "{name}" --pick {row}
```

`gate` logs the answer and returns `next`: an engine call to run, a handoff to make, a skill to invoke in this conversation, or carry on. Do what `next` says, and branch on nothing else. Where a row's `next` is null, the skill's own words for that row say what follows.

Any other reply to a gate not yet set aside — through the prompt row (Comment, Ask), or free text: a question, a thought, a request, a go-ahead that picks no row — goes to `gate` as typed, the call described as `Record your reply`: under the prompt row's key, such as `comment`, or with no key for free text, the person's words on stdin as they wrote them. The gate is then set aside.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs gate "{name}" --typed <<'WORDS'
{words}
WORDS
```

A reply that changes what happens next — a pick with a condition on it, a Comment that redirects the work — is confirmed with the person before anything acts on it, and a pick with a condition goes to `gate` once they have confirmed it.

## A Gate Set Aside

A gate set aside waits while the person talks. Their clear answer, whenever they give it, answers it where it waits, as **Answering a Gate** says, and it is not drawn again for a press. Shown again, it is fetched fresh from its call.

## Answering a Raise

A raise is no gate: its answer never goes to `gate`.
- **A pick** → `raise answer {id} --pick {key}`, `{"why"}` on stdin; **the person's own answer** → `raise answer {id} --own`, `{"text", "why"}`.
- **Explain** → `raise answer {id} --didnt-follow`, explain it again, then `raise show {id}`.
- **Technical** → `raise show {id} --technical`, or `raise show {id}` to hide the mechanism again.
- **A comment or a question** is talked through, then `raise show {id}`; on a fact, a comment that gives the answer is the person's own.

An answer carrying `care_drop` → `person propose --drop`, `{"care": "{kind}", "why", "examples"}` on stdin. The person saying a question was of another kind, or a verdict they gave was wrong → `trust correct {entry} --kind {kind}` or `--verdict {verdict:[nothing|fix|loss]}`.

## Questions About Ledger

At a question about how Ledger works — the system, the words it uses, what a screen is saying:

Load **[answering-how-it-works.md](answering-how-it-works.md)** and follow its instructions as written.
