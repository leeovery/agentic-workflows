# Topic Splitting

*Reference for **[epic-session.md](epic-session.md)***

---

**Never decide for the user.** Even if the answer seems obvious, flag it and ask.

The current research file has been accumulating off-topic content over multiple exchanges — material that doesn't fit under this topic's name. Drift is the trigger here: when the file's scope no longer matches what's being written into it, the off-topic material likely wants its own file.

Offer to extract:

> *Output the next fenced block as a code block:*

```
This session has drifted off-topic over multiple exchanges. The
following threads have accumulated alongside the original scope:

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

For each split topic:

1. Pick a kebab-case name from the thread's content (e.g. `image-moderation`, `kitchen-utensils`). Surface it to the user for confirmation. Then validate:

   → Load **[topic-name-validation.md](../../workflow-shared/references/topic-name-validation.md)** with work_unit = `{work_unit}`, proposed_name = `{new_topic}`.

   On `collision-active`, re-prompt for an alternative and re-validate — loop until `ok` or `matches-dismissed`, or the user abandons this thread. On `matches-dismissed`, proceed (the dismissed entry is pulled in step 4). On `ok`, proceed.

2. Create `.workflows/{work_unit}/research/{new_topic}.md` using **[template.md](template.md)**. Move content verbatim from the source file — reword only for flow and readability, no summarisation. Remove the extracted content from the source file.

3. Generate a one-sentence summary of the extracted content (drawn from the thread itself). This becomes the discovery item's `summary` field, used in map renders. Generate a paragraph or two of richer context in the same turn — this becomes the `description` field, loaded by entry skills as opening context when the user later picks the topic up.

4. Write manifest items — research first, then discovery. If the validation returned `matches-dismissed`, pull from the dismissed list first:

   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs pull {work_unit}.discovery dismissed "{new_topic}"
   ```

   Then:

   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.research.{new_topic}
   node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.discovery.{new_topic}
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{new_topic} routing research
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{new_topic} summary "{one-line summary}"
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{new_topic} description "{paragraphs}"
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{new_topic} source "research-split:{parent_topic}"
   ```

   `routing: research` because the split fires inside a research session — research is where the new topic enters the pipeline. `source: research-split:{parent_topic}` is historical provenance; the parent's later state changes don't cascade.

Once all accepted threads have been processed, single commit covering the manifest writes and the new research files:

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
