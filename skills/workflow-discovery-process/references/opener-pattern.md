# Opener Pattern

*Reference for **[workflow-discovery-process](../SKILL.md)***

---

The Discovery opener has four elements applied in sequence. The PATTERN is universal across entry paths and work types; the SPECIFIC TEXT varies for conversational naturalness.

## A. Phase Signpost

The boundary from `/workflow-start` into Discovery is marked via the established step-marker + signpost-blockquote convention. The signpost text carries shape-appropriate framing:

| Entry path | Signpost framing |
|---|---|
| `/start` (ambiguous) | *"Figuring out what kind of work this is, then the details inside it."* |
| `e`/`epic` | *"Setting up the epic — we'll pull on shape before naming topics."* |
| `f`/`feature` | *"Setting up the feature — we'll pull on shape before committing routing."* |
| `b`/`bugfix` | *"Setting up the fix — we'll capture intent and route to investigation."* |
| `q`/`quickfix` | *"Setting up the change — we'll capture intent and route to scoping."* |
| `c`/`cross-cutting` | *"Setting up the cross-cutting concern — we'll pull on shape before committing routing."* |
| inbox | *"Reading your {bug/idea/quickfix} and shaping it for the pipeline."* |

One sentence. Same convention as the rest of the workflow.

## B. Seed-Material Acknowledgment (when seed material is present)

Imports and inbox items count as seed material. When present, read them and surface a brief sketch of what was picked up — sketch first, then the opening question:

> *Output the next fenced block as a code block:*

```
Read your {import(s) / inbox item}. Here's the shape I'm picking up:

  {one-line summary of what the seed material describes}

{targeted opening question}
```

Reflect the shape, do not regurgitate the content verbatim. The sketch is one line — enough that the user knows you read it.

**Mode-specific interpretation** of seed material (see [discovery-guidelines.md](discovery-guidelines.md) for the full overlay):

- Epic-mode — imports drive topic decomposition
- Feature / cc-mode — imports inform single-topic shape; multi-topic content triggers an epic-pivot offer (see [pivot-watchpoints.md](pivot-watchpoints.md))
- Bugfix-mode — imports are reference material (logs, error reports, prior tickets). Read for context, do not analyse for root cause — that would violate the shape vs content guardrail
- Quickfix-mode — similar to bugfix; reference material only

## C. Opening Question, Shape-Appropriate

Phrased per `work_type` pre-seed (or fully open for `/start`). Illustrative wording — adapt for naturalness:

| Entry path | Opening question |
|---|---|
| `/start` | *"Tell me what's on your mind. I'll ask open questions and we'll figure out the shape together."* |
| `e`/`epic` | *"Tell me about the epic. I'll ask open questions to pull on it before we synthesise topics."* |
| `f`/`feature` | *"Tell me about the feature."* |
| `b`/`bugfix` | *"What's broken?"* |
| `q`/`quickfix` | *"What's the change?"* |
| `c`/`cc` | *"Tell me about the cross-cutting concern."* |
| inbox (after seed acknowledgment) | *"{targeted question drawn from the seed material}."* |

One question. Wait for the answer. Let the answer shape where you push next.

## D. No Pre-Announce of Process Discipline

Do not preamble *"we're in setup mode, not problem-solving"* or *"discovery handles shape, not content."* Discipline is enforced by behaviour:

- Open exploratory questions, no commitments
- Redirect deep dives when they happen: *"hold that thread — we'll cover it in {research / discussion / investigation}"*
- No premature decisions, no premature bucket-labelling

The user finds out *what* Discovery does by being in it — they don't need a meta-explanation upfront. Pre-announcing the process is annoying for repeat users.

## E. Symmetry at the Pattern Level

The four-element pattern (signpost → seed-material acknowledgment → opening question → no preamble) is identical regardless of entry path or work type. Specific text varies. This preserves cross-worktype symmetry at the structural level while letting the conversational phrasing feel natural for each entry path.

→ Return to caller.
