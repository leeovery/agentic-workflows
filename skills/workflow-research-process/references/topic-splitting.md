# Topic Splitting

*Reference for **[epic-session.md](epic-session.md)***

---

**Never decide for the user.** Even if the answer seems obvious, flag it and ask.

Threads in the current file could be their own research topics — they have different scopes, stakeholders, or timelines.

Offer to extract them:

> *Output the next fenced block as a code block:*

```
I've noticed distinct threads emerging that could be their own research topics:

  • {thread_1} — {brief description}
  • {thread_2} — {brief description}

Want to split these into separate research files?
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Split them out
- **`n`/`no`** — Keep everything together for now
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If yes

For each split topic, in order, run steps 1–4 below. After all accepted threads have been processed, run step 5 once.

**1. Propose and validate the new topic name.**

Pick a kebab-case name reflecting the thread's content (e.g. `image-moderation`, `kitchen-utensils`). Surface it to the user for confirmation before continuing. Then validate:

→ Load **[topic-name-validation.md](../../workflow-shared/references/topic-name-validation.md)** with work_unit = `{work_unit}`, proposed_name = `{new_topic}`.

Branch on `result`:

- `collision-active` — rejection already rendered by the reference. Re-prompt the user for an alternative name and re-validate. Loop until `ok` or `matches-dismissed`, or the user abandons this thread.
- `matches-dismissed` — the name was previously removed via refinement. User-explicit spawns bypass the dismissed list, so proceed; the dismissed entry is pulled in step 4.
- `ok` — proceed.

**2. Extract content into the new research file.**

- Create `.workflows/{work_unit}/research/{new_topic}.md` using **[template.md](template.md)**.
- Move content verbatim from the source file — reword only for flow and readability, no summarisation.
- Remove the extracted content from the source file.

**3. Capture a one-line summary.**

Propose a one-sentence framing of the extracted content (drawn from the thread itself). Ask the user to confirm or refine. This becomes the inception item's `summary` field, used in map renders.

**4. Write manifest items — research first, then inception.**

If the validation returned `matches-dismissed`, pull the name from the dismissed list before the inception writes:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs pull {work_unit}.inception dismissed "{new_topic}"
```

Then write both phase items:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.research.{new_topic}
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.inception.{new_topic}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{new_topic} routing research
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{new_topic} summary "{one-line summary}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{new_topic} source "research-split:{parent_topic}"
```

The inception item carries `routing: research` (this split is firing inside a research session, so research is where the new topic enters the pipeline) and `source: research-split:{parent_topic}` (provenance is historical; the parent's later state changes don't cascade).

→ Loop back to step 1 for the next accepted thread. When all accepted threads have been processed, proceed to step 5.

**5. Commit (once, after all threads).**

Single commit covering the manifest writes and the new research files:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/research/
git commit -m "research({work_unit}/{parent_topic}): split into {N} topic(s)"
```

Then offer the user a choice of which topic to continue with:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which topic would you like to continue with?

@foreach(topic in available_topics)
**{N}. {topic:(titlecase)}** — {status:[in-progress]}
@endforeach

Select an option (enter number):
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Return to caller.

#### If no

→ Return to caller.
