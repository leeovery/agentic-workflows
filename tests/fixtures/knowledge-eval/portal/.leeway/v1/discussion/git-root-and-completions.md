---
topic: git-root-and-completions
status: concluded
work_type: greenfield
date: 2026-01-26
---

# Discussion: Git Root Detection & Shell Completions

## Context

Two small enhancements identified from the [tmux session managers analysis](../research/tmux-session-managers-analysis.md). Both originated from sesh's feature set. Neither is complex, but both benefit from nailing down the specifics before implementation.

**Git root detection**: When a user selects a directory for a new session (via file browser, `zw .`, or `zw <path>`), resolve to the git repository root rather than using the literal directory. Prevents registering subdirectories as projects.

**Shell completions**: Add a `zw completion` subcommand that outputs shell completion scripts. Cobra provides the generation; we just need to wire it up.

### References

- [tmux-session-managers-analysis.md](../research/tmux-session-managers-analysis.md) — topics 15, 16
- [ZW specification](../specification/zw.md) — current spec (concluded)
- sesh's `root` command and `completion` command as prior art

## Questions

- [x] Should git root resolution be automatic or a suggestion?
- [x] What happens for directories that aren't git repos?
- [x] Where in ZW's flow does git root detection apply?
- [x] How should `zw completion` be structured?
- [x] Do these features require spec changes?

---

## Q1: Should git root resolution be automatic or a suggestion?

**Options considered:**

A. **Always auto-resolve** — Silently use git root. User selects `~/Code/myapp/src/api/handlers/`, ZW registers `~/Code/myapp/` and suggests "myapp" as session name. No prompt.

B. **Suggest with override** — Detect git root, prompt user to confirm or keep the subdirectory.

**Decision: A — Always auto-resolve.**

There's no realistic scenario where a subdirectory should be registered as a project instead of the git root. Adding a confirmation prompt for something that's always "yes" just adds friction, especially on mobile where every interaction costs more.

## Q2: What happens for directories that aren't git repos?

**Decision: Use the directory as-is.**

If `git rev-parse --show-toplevel` fails (exit code 128), the directory isn't in a git repo. ZW uses the literal directory, same as current behaviour. No warning, no message. Git root detection is a silent enhancement that only activates when there's a root to find.

## Q3: Where in ZW's flow does git root detection apply?

Three entry points where a user provides a directory for a new session:

1. `zw .` — current directory
2. `zw <path>` — explicit path argument
3. File browser selection — user navigates to and selects a directory

**Decision: One resolution function, applied uniformly in all three places.** The directory passes through git root resolution before project registration. Not three separate implementations — one function called at all three call sites.

Implementation: `exec.Command("git", "-C", selectedDir, "rev-parse", "--show-toplevel")`. If it succeeds, use the output. If it fails, use the original directory.

## Q4: How should `zw completion` be structured?

**Decision: Standard Cobra completion subcommand, three shells only.**

```
zw completion bash
zw completion zsh
zw completion fish
```

Each outputs the completion script to stdout. Users source it in their shell config:

```bash
source <(zw completion zsh)
```

No powershell support. ZW wraps Zellij, which doesn't run on Windows. Powershell would be dead code.

Cobra provides `GenBashCompletionV2`, `GenZshCompletion`, and `GenFishCompletion` out of the box.

## Q5: Do these features require spec changes?

**Decision: Yes, two minor amendments to the spec.**

1. **CLI commands table** — Add `zw completion <shell>` row: "Output shell completion script (bash, zsh, fish)"
2. **Directory handling** — Note in the "Directory Change for New Sessions" section that directories are resolved to git root when inside a git repository.

Neither change alters the architecture or introduces new concepts. They're additive details.

---

## Summary

| Feature | Decision | Complexity |
|---------|----------|------------|
| Git root detection | Auto-resolve, silent, one function at three call sites | Low |
| Non-git directories | Use as-is, no warning | Trivial |
| Shell completions | `zw completion bash/zsh/fish`, Cobra built-ins | Low |
| Spec changes | Two minor additions to existing spec | Trivial |

### Next Steps

- Amend ZW specification with both features
- Implementation during the normal build phase
