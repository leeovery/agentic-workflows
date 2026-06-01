# Topic Name Validation

*Shared reference. Loaded by `workflow-discovery`, `workflow-research-process`, `workflow-discussion-process`, and any flow that proposes a new topic name for the discovery map.*

---

Validates a proposed topic name. First step normalises to kebab-case silently (callers always have Claude pick the name, so a slip should self-correct rather than escalate). Then checks against active discovery-map items (collision rejects) and the dismissed list (informational — caller pulls before writing). Returns a `result` the caller branches on. The reference is read-only — it never mutates the manifest.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.
- `proposed_name` — the topic name the user has proposed. Always present.

After return, the caller reads `result` from conversation memory. Possible values:

- `collision-active` — name matches an active discovery-map item. Rejection rendered.
- `matches-dismissed` — name matches an entry on the dismissed list. **Informational** — caller pulls before writing.
- `ok` — no conflict. Caller proceeds.

## A. Normalise to Kebab-Case

Callers always have Claude generate or extract the proposed name before invoking this reference, so a non-kebab-case `proposed_name` is a Claude-side slip — not a user-facing error. The fix is to self-correct silently, then carry on.

A kebab-case name is lowercase ASCII letters, digits, and `-`. No leading or trailing `-`, no consecutive `-`, no other characters. See **[casing-conventions.md](casing-conventions.md)** for the canonical rule.

Test `proposed_name` against this pattern: `^[a-z0-9]+(-[a-z0-9]+)*$`.

#### If the name matches

→ Proceed to **B. Read Map and Dismissed List**.

#### Otherwise

Re-derive a kebab-case form for `proposed_name` per casing-conventions.md (lowercase, split on spaces/underscores/punctuation, join with single hyphens, strip leading/trailing hyphens). Use the corrected value as `proposed_name` for all subsequent steps. Do not render a rejection or surface the correction to the user — the caller and the user only see the normalised name from this point onward.

→ Proceed to **B. Read Map and Dismissed List**.

## B. Read Map and Dismissed List

Re-run discovery to pick up state changes since the caller's last invocation (writes earlier in the session, prior splits in the same batch):

```bash
node .claude/skills/workflow-discovery/scripts/discovery.cjs {work_unit}
```

Read:

- `discovery_map` — list of active topic items. The `name` field of each entry is the case-sensitive map name.
- `dismissed` — array of names previously removed from the map by the user.

→ Proceed to **C. Compare Against Active Map**.

## C. Compare Against Active Map

Check whether `proposed_name` matches any `name` in `discovery_map` (case-sensitive — kebab-case enforcement in **A** means this is effectively case-insensitive too).

#### If a match exists

Set `result = "collision-active"` and render the rejection:

> *Output the next fenced block as a code block:*

```
"{proposed_name}" is already on the map. Pick a different name
or use edit-summary / change-routing on the existing item.
```

→ Return to caller.

#### Otherwise

→ Proceed to **D. Compare Against Dismissed List**.

## D. Compare Against Dismissed List

Check whether `proposed_name` matches any entry in `dismissed` (case-sensitive).

A dismissed-list match is **not** a rejection. User-explicit spawns (split, elevation, discovery session add, direct-entry) bypass the dismissed list — the list only blocks automatic re-adds by analyses. The caller pulls the name from `dismissed` before writing the new item.

#### If a match exists

Set `result = "matches-dismissed"`.

→ Return to caller.

#### Otherwise

→ Proceed to **E. Return OK**.

## E. Return OK

Set `result = "ok"`.

→ Return to caller.
