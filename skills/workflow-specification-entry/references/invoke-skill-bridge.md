# Invoke the Skill (Bridge Mode)

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Before invoking the processing skill, save a session bookmark.

> *Output the next fenced block as a code block:*

```
Saving session state so Claude can pick up where it left off if the conversation is compacted.
```

```bash
.claude/hooks/workflows/write-session-state.sh \
  "{work_unit}" \
  "skills/technical-specification/SKILL.md" \
  ".workflows/{work_unit}/specification/{topic}/specification.md"
```

This skill's purpose is now fulfilled.

Invoke the [technical-specification](../../technical-specification/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

---

## Handoff

Construct the handoff based on the work type and verb.

#### If `work_type` is `feature`

```
Specification session for: {work_unit}
Work type: {work_type}

Source material:
- Discussion: .workflows/{work_unit}/discussion/{topic}.md

Work unit: {work_unit}
Action: {verb} specification

Invoke the technical-specification skill.
```

#### If `work_type` is `bugfix`

```
Specification session for: {work_unit}
Work type: {work_type}

Source material:
- Investigation: .workflows/{work_unit}/investigation/{topic}.md

Work unit: {work_unit}
Action: {verb} specification

Invoke the technical-specification skill.
```

#### If `work_type` is `epic`

Read the spec's source discussions from the manifest: `get {work_unit} --phase specification --topic {topic} sources`. List each source discussion file.

```
Specification session for: {topic}
Work type: {work_type}

Source material:
- .workflows/{work_unit}/discussion/{source-discussion-1}.md
- .workflows/{work_unit}/discussion/{source-discussion-2}.md
- ...

Work unit: {work_unit}
Topic: {topic}
Action: {verb} specification

Invoke the technical-specification skill.
```
