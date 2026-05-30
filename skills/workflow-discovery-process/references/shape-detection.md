# Shape Detection

*Reference for **[workflow-discovery-process](../SKILL.md)***

---

The listening discipline that drives the Discovery loop. Two angles: *what signals to listen for* (substance) and *how to surface tentative reads* (user-facing language). Pairs with [routing-commit.md](routing-commit.md) (the commit moment) and [pivot-watchpoints.md](pivot-watchpoints.md) (mid-conversation re-shaping).

## A. Signals Are About Substance, Not Bucket Names

The bucket names (epic / feature / bugfix / quickfix / cross-cutting) are workflow internals. Saying *"this sounds like an epic"* assumes a vocabulary the user often lacks. Detect *what kind of work the user is actually describing*, in plain terms, and translate to a bucket only at routing commit.

Substance signals (illustrative cues — tune via real use):

| Substance signal (what is being described) | Routes to internally |
|---|---|
| New behaviour not present today, single coherent scope, clear actors and flows | feature |
| Multiple distinct concerns from one description, multi-week / multi-phase shape, broader system-level reshaping, *"project"* / *"initiative"* framing | epic |
| System-wide concern affecting multiple work units, pattern / principle / strategy definition (*"error response shape"*, *"auth strategy"*, *"logging convention"*), no customer-facing deliverable | cross-cutting |
| Past-tense or present-broken descriptions, specific failure cases with reproducible conditions, error messages / stack traces in imports | bugfix |
| Imperative scoped changes (*"bump the timeout"*, *"rename X to Y"*, *"add a flag"*), one-shot adjustments without behaviour debate | quickfix |
| *"Not sure how"*, *"what's possible"* — could route research-shaped; descriptions that mix broken + new — could be bugfix-with-feature-followup | ambiguous — keep exploring |

These are first-pass cues, not a checklist. Hardcoding strict matches risks trigger-happy reads on weak signals.

## B. Surfacing Language Stays Plain Until Commit

When sharing a tentative read or asking for confirmation, speak in user-facing shape-terms:

| Internal (workflow lingo) | User-facing (plain shape) |
|---|---|
| *"This sounds like an epic"* | *"This sounds like several distinct things — more than one feature in scope"* |
| *"This is a feature"* | *"Sounds like a single coherent piece of work"* |
| *"This is cross-cutting"* | *"Sounds like a pattern or principle that affects the whole project — something to define, not something to ship as a feature"* |
| *"This is a bugfix"* | *"Sounds like something broken we're fixing rather than something new we're building"* |
| *"This is a quickfix"* | *"Sounds like a small targeted change — adjustment rather than a whole feature"* |

Bucket names only appear at the routing-commit moment ([routing-commit.md](routing-commit.md)), and even then framed naturally. Up until commit, everything is described in terms of what the user is actually doing.

## C. Confidence Heuristics — When to Surface a Tentative Read

You are *"confident enough to surface"* when ALL of the following hold:

- **Multiple converging signals** point at the same shape (not just one weak hint)
- **User framing has been consistent** across multiple turns (not switching shapes mid-conversation)
- **Ambiguity has been resolved** — at least one explicit-shape question has been asked if ambiguity was present, and the user's answer resolved it
- **Pivot signals aren't lit** — you aren't sitting on a competing shape's signals at the same time

Below this threshold, keep exploring. A weak surfacing reads as fishing and breaks user trust in the conversation.

## D. Mid-Loop Surfacing

When patterns clearly emerge, share a tentative read mid-loop rather than holding to endpoint. The user gets to push back while reads are still tentative, before momentum builds. Examples (illustrative):

- After several exchanges hinting at multiple concerns: *"I'm hearing a few distinct things — this might be more than one feature. Want to pull on that or stay focused?"*
- After enough scope clarity: *"Sounds like a single coherent thing, with the routing tendency I'm reading as discussion-shaped. Anything I'm missing?"*
- After a tangential concern surfaces: *"You mentioned X — that feels separate from what we're shaping. Surface to inbox for later?"* (see [pivot-watchpoints.md](pivot-watchpoints.md))
- After topic seeds start clustering (epic mode): *"I'm seeing menu-management and kitchen-printers as candidate topics. Sound right or wrong shape?"*

Surfacings are **conversational** — soft, easy for the user to redirect. Not every signal triggers a surfacing; only when there's enough to test against the user usefully.

Mid-loop surfacings stay conversational. AskUserTool is NOT used here — tool prompts in the middle of an exploratory flow break the conversational rhythm without adding clarity.

## E. The Explicit Shape Question

When shape questions are exhausted but ambiguity remains. Trigger: the next natural question would drop into content territory (research, decision-making, investigation) and would violate the shape-vs-content guardrail. Move: ask the user directly to disambiguate.

Examples (illustrative):

- *"Two readings here — this could be fixing something that's currently broken, or adding something new that doesn't exist yet. Which is closer?"*
- *"This is shaping bigger than a single feature — does it feel to you like one focused thing, or several connected things?"*
- *"This sounds like a small targeted change, but if it touches behaviour the user sees, we should treat it as a feature instead. How does it feel from your end?"*

These force a commit so the conversation can progress. The explicit shape question is OK as an AskUserTool prompt when the disambiguation is genuinely binary and the user benefits from explicit framing — use judiciously.

## F. The Hardest Discriminations — Pairs at the Boundaries

These are where mid-loop surfacings and explicit shape questions earn their keep:

- **Single feature vs multi-feature** — *"is this one thing or several things stuck together?"*
- **Building vs fixing** — *"is the behaviour missing, or is the behaviour broken?"*
- **Quick targeted change vs feature vs bugfix** — *"is this a small adjustment, a new behaviour, or a fix?"*

Patience pays here. Premature commit on a borderline pair reads as bucket-labelling rather than shape-detection.

## G. Macro and Micro Signals Co-Emerge

Not sequential phases. A user describing *"operators do X, kitchen does Y, customers do Z"* surfaces BOTH multi-shape (macro signal — likely epic) AND candidate topic seeds (micro signal). The macro/micro structure is about routing OUTPUTS, not loop sequencing. One loop, both signal flavours accumulating in parallel.

For work types with per-topic micro routing (epic / feature / cross-cutting), gather routing cues during the exploration — they bind at synthesis. For bugfix / quickfix, no micro routing applies; the route-out is fixed by macro shape (bugfix → investigation, quickfix → scoping).

→ Return to caller.
