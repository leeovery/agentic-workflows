# Mark a Dependency Satisfied

*Shared reference. Loaded by the epic menu's unblock (`workflow-continue-epic`) and implementation's dependency check (`workflow-implementation-process`).*

---

The caller passes `work_unit`, `topic` — the plan the dependency blocks — and `dep`, the dependency's key in that plan's `external_dependencies`. Record the user's call — the dependency is satisfied outside the workflow:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} external_dependencies.{dep}.state satisfied_externally
```

The record belongs to the plan, and neither caller is the session working it — `--sweep`, so the commit stamps no identity there:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic planning/{topic} --sweep -m "impl({work_unit}): mark {dep} dependency as satisfied externally"
```

→ Return to caller.
