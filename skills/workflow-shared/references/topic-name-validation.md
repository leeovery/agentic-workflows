# Topic Name Validation

*Shared reference. Loaded by `workflow-inception-process`, `workflow-research-process`, `workflow-discussion-process`, and any flow that proposes a new topic name for the discovery map.*

---

Validates a proposed topic name against three gates: format (kebab-case), active map collision, and dismissed-list match. Returns a `result` the caller branches on. The reference is read-only — it never mutates the manifest. The caller decides what to do with the result (proceed, re-prompt, pull from dismissed, etc.).

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.
- `proposed_name` — the topic name the user has proposed. Always present.
- `caller_context` — short label identifying the flow (e.g. `research-split`, `discussion-elevation`, `refinement-add`, `direct-entry`). Used in the rejection display for clarity. Optional; defaults to `add`.

After return, the caller reads `result` from conversation memory. Possible values:

- `format-invalid` — `proposed_name` is not kebab-case. Rejection rendered.
- `collision-active` — name matches an active discovery-map item. Rejection rendered.
- `matches-dismissed` — name matches an entry on the dismissed list. **Informational** — caller pulls before writing.
- `ok` — no conflict. Caller proceeds.

## A. Validate Format

A kebab-case name is lowercase ASCII letters, digits, and `-`. No leading or trailing `-`, no consecutive `-`, no other characters. This matches the kebab-case rule in **[casing-conventions.md](casing-conventions.md)** and what every other map writer normalises to before persisting.

Test `proposed_name` against this pattern: `^[a-z0-9]+(-[a-z0-9]+)*$`.

#### If the name does not match

Set `result = "format-invalid"` and render the rejection:

> *Output the next fenced block as a code block:*

```
"{proposed_name}" is not a valid topic name for the map —
names must be kebab-case (lowercase letters, digits, and `-`,
no spaces or capitals). See casing-conventions.md.
```

→ Return to caller.

#### Otherwise

→ Proceed to **B. Read Map and Dismissed List**.

## B. Read Map and Dismissed List

Re-run discovery to pick up state changes since the caller's last invocation (writes earlier in the session, prior splits in the same batch):

```bash
node .claude/skills/workflow-inception-process/scripts/discovery.cjs {work_unit}
```

Read:

- `discovery_map` — list of active topic items. The `name` field of each entry is the case-sensitive map name.
- `dismissed` — array of names previously removed via refinement.

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

A dismissed-list match is **not** a rejection. User-explicit spawns (split, elevation, refinement add, direct-entry) bypass the dismissed list — the list only blocks automatic re-adds by analyses. The caller pulls the name from `dismissed` before writing the new item.

#### If a match exists

Set `result = "matches-dismissed"`.

→ Return to caller.

#### Otherwise

→ Proceed to **E. Return OK**.

## E. Return OK

Set `result = "ok"`.

→ Return to caller.
