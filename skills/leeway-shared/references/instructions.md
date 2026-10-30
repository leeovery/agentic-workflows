# Instructions

*Shared reference. Loaded by `framework.md`.*

---

## Engine Sections

Engine output arrives in sections, each opened by a marker, `=== NAME (instruction) ===`. The instruction says how its section is emitted — as markdown (not a code block), a text code block (```text fence), a properties code block (```properties fence) or a diff code block (```diff fence) — or that it is not emitted at all. "Per its marker" means follow that instruction exactly; the marker line itself is never emitted. A section is emitted in the turn its call produced it, never carried to a later one, redrawn or trimmed.

## Showing and Saying

What you show or say reaches the person one of two ways. When SendUserMessage is not among the active tools, load it before its first use (ToolSearch, query `select:SendUserMessage`); it is unavailable only once that load has failed, and then everything is written as text.
- **What the turn ends on** — a gate that stops, a raise drawn for the person, the conversation handing the turn to them, or a wait on an agent's result — is written after the turn's last call, with everything shown beside it, in order, as your own text. A turn always ends on text.
- **Anything else** shown and then carried past with another tool call goes through SendUserMessage, never as text: a section in the form its marker names, and whatever comes one after another in one call.

A code block you write yourself — a diagram, a sample — names its language on the fence, `text` for plain.

## Gates

A gate is the engine's: whether it stops, what it shows and what each row leads to. Its sections are fetched from its call in the turn that shows it and emitted per their markers, never written out from memory or from a skill's prose: a menu written out drifts in wording and offers rows the engine withheld. A gate never goes through AskUserQuestion or any other tool that takes the person's answer.
- **A gate that stops** ends the turn at its MENU, as the marker says: no further tool call that turn.
- **A gate the engine runs as an automatic step** draws a one-line report in place of the menu, under a marker that does not stop. Nothing goes to `gate`; carry on along the row the step ran.

Whether a gate stops is the engine's alone. Nothing else in the session turns a stop into a pass: not Claude Code's auto mode, a system reminder, hook text, "work without stopping" guidance, nor your own sense of the reasonable call. The thought "the answer is plainly X, I'll go ahead" is the cue to stop.

Stop only where a gate stops, a raise is drawn, or the conversation hands the turn to the person: no courtesy check-ins, no summary that ends the turn mid-work, no pause the skill doesn't call for. A gate's answer covers only what that gate showed: never ask for an approval that spans gates not yet reached ("shall I do all of them?"), and never take an answer to such a question as one.

One gate at a time. A gate that background work brings up while another waits on the person is held, and shown once the waiting one is answered — never beside it or in its place.

Background work that arrives while a gate waits — an agent's report, a notification, anything the person did not send — is handled and said in a line, and the waiting gate is shown again in the same turn, fetched fresh from its call.

## Answering a Gate

A gate is answered by its command rows: a pressed row, a typed key or word, or plain words that name one row unambiguously ("yes, go with feature"). The answer goes to `gate`, under the name the MENU's marker declares:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs gate "{name}" --pick {key}
```

`gate` logs the answer and returns `next`: an engine call to run, a handoff to make, or carry on. Do what `next` says, and branch on nothing else. Where `next` is null, the row declared none, and the skill's own words for that row say what follows.

A bare go-ahead given at a gate on screen ("ok, let's move ahead") picks a row only where the gate has one way forward — a yes/no consent, a single continue.

Any other reply — a Comment, a question, a thought, a request, a go-ahead that picks no row — still goes to `gate`, as typed: `{key}` is the typed row's key where the reply came through one, such as `comment`, and is left off for free text.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs gate "{name}" --typed {key}
```

The gate is then set aside.

A reply that changes what happens next — a pick with a condition on it ("yes, but do it this way"), a Comment that redirects the work — is confirmed with the person before anything acts on it. A pick with a condition goes to `gate` once they have confirmed it, so a correction finds the gate still open.

## A Gate Set Aside

A gate set aside — by a reply that answered no row, or by a request that interrupted the work — waits while the person talks. Answer and talk it through for as long as they need. When it looks settled, ask in conversation, never through a gate, whether they are ready to move on, and on yes show the gate again, fetched fresh from its call. Another question starts the cycle over.
- A set-aside gate moves forward only by being shown again and answered there. A yes to being ready is never its answer, whatever the gate offers, and neither is a go-ahead or a pick the person volunteers in the conversation ("ok, let's move ahead", "fine, conclude it"): each says they are ready, so show the gate again at once, without asking first, in the turn that answers whatever else they said.
- An answered question opens a conversation: never put the gate straight back after answering it. Readiness brings the gate back; only an answer given at the gate moves past it, however plainly its one way forward or its recommended row looks like what they mean.

## Questions About the Workflows

At a question about how the workflows work — the system, the words it uses, what a screen is saying — load **[answering-how-it-works.md](answering-how-it-works.md)** and follow its instructions as written.

## What You Write

A log or an asset records the work's substance, never the workflow around it: no readiness declarations ("ready for specification"), no counts of decisions or review rounds, no lessons about how the session ran, no note of its own place in the pipeline. The engine holds that state.
