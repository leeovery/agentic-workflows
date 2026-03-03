# Dependencies

*Reference for **[technical-specification](../SKILL.md)***

---

At the end of every specification, add a **Dependencies** section that identifies **prerequisites** — systems that must exist before this feature can be built.

The same workflow applies: present the dependencies section for approval, then log verbatim when approved.

## What Dependencies Are

Dependencies are **blockers** — things that must exist before implementation can begin.

If feature B requires data that feature A produces, then feature A is a dependency — B cannot function without A's output existing first.

**The test**: "If system X doesn't exist, can we still deliver this?"
- If **no** → X is a dependency
- If **yes** → X is not a dependency (even if the systems work together)

## What Dependencies Are NOT

**Do not list systems just because they:**
- Work together with this feature
- Share data or communicate with this feature
- Are related or in the same domain
- Would be nice to have alongside this feature

Two systems that cooperate are not necessarily dependent. A notification system and a user preferences system might work together (preferences control notification settings), but if you can build the notification system with hardcoded defaults and add preference integration later, then preferences are not a dependency.

## How to Identify Dependencies

Review the specification for cases where implementation is **literally blocked** without another system:

- **Data that must exist first** (e.g., "FK to users" → User model must exist, you can't create the FK otherwise)
- **Events you consume** (e.g., "listens for payment.completed" → Payment system must emit this event)
- **APIs you call** (e.g., "fetches inventory levels" → Inventory API must exist)
- **Infrastructure requirements** (e.g., "stores files in S3" → S3 bucket configuration must exist)

**Do not include** systems where you merely reference their concepts or where integration could be deferred.

## Categorization

**Required**: Implementation cannot start without this. The code literally cannot be written.

**Partial Requirement**: Only specific elements are needed, not the full system. Note the minimum scope that unblocks implementation.

## Format

```markdown
## Dependencies

Prerequisites that must exist before implementation can begin:

### Required

| Dependency | Why Blocked | What's Unblocked When It Exists |
|------------|-------------|--------------------------------|
| **[System Name]** | [Why implementation literally cannot proceed] | [What parts of this spec can then be built] |

### Partial Requirement

| Dependency | Why Blocked | Minimum Scope Needed |
|------------|-------------|---------------------|
| **[System Name]** | [Why implementation cannot proceed] | [Specific subset that unblocks us] |

### Notes

- [What can be built independently, without waiting]
- [Workarounds if dependencies don't exist yet]
```

## Purpose

This section enables dependency tracking when plans are built from this specification. Dependencies become blocking relationships that help sequence work correctly.

**Key distinction**: This is about sequencing what must come first, not mapping out what works together. A feature may integrate with many systems — only list the ones that block you from starting.
