# Migration Directive

*Reference for **[leeway](../SKILL.md)***

---

The migration stopped at a directive: a step whose work is judgment, which this session carries out before anything else runs in the project.

Fetch the stop's screen and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render directive-stop --directive {directive}
```

Read the directive, `{file}`, and carry it out as written. Its head names the files it may touch and what it asks the person: touch no other file, and ask the person nothing else.

The directive's check tells the pieces done from the rest. A piece done is kept. A piece the check names is redone from the start, never resumed from what an earlier session left of it. See where the directive stands, and again whenever you need to:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs migrate check {directive}
```

Each piece in `unfinished` names what it still lacks. Once `passed` is `true`, close the directive's checklist, which records the directive as done:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs checklist close directive {directive}
```

→ Return to caller.
