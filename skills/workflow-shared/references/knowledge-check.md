# Knowledge Check

*Shared reference for all entry-point skills.*

---

## A. Check Readiness

Run the following command and capture its stdout and exit code:

```
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs check
```

#### If the command exits with a non-zero exit code

The knowledge CLI crashed unexpectedly. Surface the error:

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Knowledge Base Error
●───────────────────────────────────────────────●

The knowledge check command failed unexpectedly:

  {error output}

This must be resolved before the workflow can proceed.
```

**STOP.** Do not proceed — terminal condition.

#### If stdout is `not-ready`

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Knowledge Base Not Ready
●───────────────────────────────────────────────●

```

> *Output the next fenced block as markdown (not a code block):*

```
> The knowledge base is required infrastructure for workflows.
> It must be initialised before any workflow can proceed.
```

> *Output the next fenced block as a code block:*

```
To set up the knowledge base, run:

  node .claude/skills/workflow-knowledge/scripts/knowledge.cjs setup

Setup configures system defaults, initialises the project store,
and runs the initial indexing pass. If no API key is available,
stub mode is offered as an alternative.
```

**STOP.** Do not proceed — terminal condition.

#### If stdout is `ready`

→ Proceed to **B. Compact**.

## B. Compact

Run the following command:

```
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs compact
```

If the command produces output (chunks were removed), display it. If it produces no output, proceed silently.

#### If the command exits with a non-zero exit code

Surface the error as a warning — compaction failure is not a blocker.

> *Output the next fenced block as a code block:*

```
⚑ Knowledge compaction warning
  {error details}
  Compaction failed but the knowledge base is functional.
  Proceeding normally.
```

→ Return to caller.

#### Otherwise

→ Return to caller.
