# Verify Source Material

*Reference for **[technical-specification](../SKILL.md)***

---

Verify that all source material exists and is accessible before beginning specification work.

## Verification

1. For each source path provided in the handoff context, run `ls` to confirm the file exists — do not read the file contents
2. If any file is missing, **STOP** — inform the user which file is missing and do not proceed
3. If all files exist, proceed

### Example

```bash
ls .workflows/auth-flow/discussion/discussion.md
ls .workflows/{work_unit}/research/api-patterns.md
```
