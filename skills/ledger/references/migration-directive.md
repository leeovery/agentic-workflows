# Migration Directive

*Reference for **[ledger](../SKILL.md)***

---

The migration has reached a directive: a step of its work that this session carries out before anything else runs in the project. It is the migration at work, never a failure.

Read the directive, `{file}`, and carry it out as written. Its head names the files it may touch and what it asks the person: touch no other file, and ask the person nothing else.

The directive's check tells the pieces done from the rest. A piece done is kept. A piece the check names is taken up as the directive says. See where the directive stands, and again whenever you need to:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs migrate check {directive}
```

Each piece in `unfinished` names what it still lacks; where the check itself fails, its refusal names what it tripped on. Once `passed` is `true` and the directive's own steps are done, close the directive's checklist, which records the directive as done:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs checklist close directive {directive}
```

→ Return to caller.
