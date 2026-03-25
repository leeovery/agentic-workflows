# Skill Compliance Self-Check

## The Idea

Add a final validation step at the end of each skill where Claude re-reads the skill instructions and audits its own output for compliance.

## Context

Skills contain explicit instructions, but Claude can drift — skipping steps, summarising when it shouldn't, updating manifests incorrectly, or producing output that doesn't match conventions. A self-check would catch these issues before the user sees incomplete or non-compliant results.

## What It Would Check

**Instruction compliance:**
- Were all steps followed in order?
- Were any steps skipped?
- Were STOP gates respected?
- Were summaries produced where they shouldn't have been?
- Did output match the display/rendering conventions?

**Output correctness:**
- Is the manifest updated correctly (right fields, right values, right paths)?
- Were any manual manifest edits made that should have gone through the CLI?
- Are tracking files (state, cache, analysis) correct and consistent?
- Do disk artifacts match what the manifest says should exist?

## How It Would Work

At the end of each processing skill, before the final commit:
1. Re-read the SKILL.md and all loaded reference files
2. Compare actual outputs against expected outputs
3. Check manifest state against what the instructions prescribed
4. If violations found: report them to the user, explain what went wrong, and go back and fix
5. If clean: proceed silently (no unnecessary output)

## Design Consideration

This should be lightweight enough to not bloat context but thorough enough to catch real drift. Could be a shared reference file loaded by all processing skills, or a dedicated validation agent.
