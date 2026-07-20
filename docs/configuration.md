# Configuration

The system configures itself the way it does everything else: conversationally, once, with the answers recorded where the next session finds them. There is no config file to author by hand. This page maps where each kind of setting lives and how it got there.

## Installation

```bash
npx agntc add leeovery/agentic-workflows
```

installs the skills and agents into the project's `.claude/` directory. Commit them to share with your team (and to use them in Claude Code for Web); `npx agntc update` pulls the latest, `npx agntc remove leeovery/agentic-workflows` uninstalls. On the first `/workflow-start`, `engine boot`'s [migration pass](engine.md#boot-and-migrations) creates `.workflows/` and brings it to the current layout; the same mechanism upgrades existing projects in place after every update.

## Project defaults

`.workflows/manifest.json` (the project manifest) carries a `defaults` block, addressed through the reserved `project` prefix on the [engine's field surface](engine.md):

```bash
engine manifest get project.defaults.plan_format
engine manifest set project.defaults.linters '["vendor/bin/pint --dirty"]'
```

Three defaults exist today, each written the first time its question is answered:

| Default | Set during | Used by |
|---|---|---|
| `plan_format` | [planning's](planning.md) format selection | planning, quick-fix scoping |
| `project_skills` | [implementation's](implementation.md) skills discovery | executor, reviewer, and review verifier agents |
| `linters` | implementation's linter discovery | the executor's LINT step |

The cascade has exactly two levels and a firm rule: **defaults are suggestions, the topic level records the value in use**. A stored default pre-fills the question; the user confirms or overrides per topic; the confirmed value lands on the topic's manifest item. Nothing reads a project default at execution time, so changing it never silently rewrites in-flight work. The STOP-gate discipline names this exact temptation as a failure mode: "the user already set this, confirmation is redundant" is the auto-answer the rules forbid.

## Gate modes

Every approval loop's `a`/auto option persists as a `*_gate_mode: auto` field on the relevant manifest item: `construction_gate_mode` and `finding_gate_mode` on specs, `task_list_gate_mode` and `author_gate_mode` on plans, `task_gate_mode`, `fix_gate_mode`, and `analysis_gate_mode` on implementation items. Two properties make them safe:

- **Only the user's explicit choice at a gate sets them.** No session directive, harness auto mode, or hook-injected text can; the skills say so verbatim.
- **They are scoped and re-gated.** Implementation's `task init` resets all three of its gate modes to `gated` at each session start, so auto is an opt-in per sitting, not a permanent state. Escalations override auto anyway: the fix-loop threshold and the analysis cycle cap stop and ask regardless of mode.

## Environment setup

`.workflows/.state/environment-setup.md` holds natural-language, project-specific setup instructions (copy `.env`, run migrations, install extensions) that implementation executes before its first task. Missing file? The session asks once, saves the answer, and never asks again; "No special setup required" is a recorded answer too.

## Knowledge configuration

Two layers, covered in detail in [knowledge base setup](knowledge-base.md#setup): `~/.config/workflows/config.json` for system-wide defaults (provider, model), `.workflows/.knowledge/` for the per-project store and its config, and `~/.config/workflows/credentials.json` (mode 0600) for keys, which never transit chat, argv, or stdout. A project can pin `provider: null` to run keyword-only regardless of the system default.

## State that is not configuration

`.workflows/.state/migrations` (which migrations have run) and the per-work-unit `.state/` analysis caches are bookkeeping the system maintains for itself. The only human-relevant operation is deleting the migrations log to force a full re-run, safe because [migrations are idempotent](engine.md#boot-and-migrations).

---

*That completes the reference pages. For where this system came from: [history](history.md).*
