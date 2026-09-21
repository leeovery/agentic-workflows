# Format Version Check

*Shared reference. Loaded by `workflow-planning-process` (plan initialisation and session setup), `workflow-scoping-process` (format selection), `workflow-implementation-process` (adapter load), and `workflow-review-process` (plan read) — before a session's first command against a plan format's tool.*

---

The caller provides `format`.

## A. Read the Declaration

Read the **Version** section of the format's **[about.md](../../workflow-planning-process/references/output-formats/{format}/about.md)**. It declares the tool and the version it requires as `X.Y.*`, the command that prints the installed version with the shape of its output, and where the update instructions live.

#### If the section declares nothing to check

→ Return to caller.

#### Otherwise

→ Proceed to **B. Compare**.

---

## B. Compare

Run the declared command and take the installed `X.Y.Z` from its output. The check passes when the installed `X.Y` equals the required `X.Y` — the `*` is the patch, any value.

#### If the check passes

→ Return to caller.

#### Otherwise

> *Output the next fenced block as a properties code block (```properties fence):*

```
⚑ The installed tool does not match the version this plan format requires
```

> *Output the next fenced block as markdown (not a code block):*

```
> {tool} {installed} is installed; the {format} format requires `{required}`. See {update_instructions} to update to that version. An installed version newer than the requirement means these workflows are behind it — update them with `npx agntc update` and start again.
```

**STOP.** Wait for user response.

→ Return to **B. Compare**.
