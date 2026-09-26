---
topic: installation-options
status: concluded
work_type: greenfield
date: 2026-01-19
---

# Discussion: Installation Options

## Context

Tick is a Go CLI tool that needs to be installable across various environments. The research phase proposed: GitHub releases (via goreleaser or manual), Homebrew via personal tap. However, this leaves gaps.

**Problem**: Different environments have different installation capabilities:
- **macOS with Homebrew**: Well-served by the proposed approach
- **Linux**: Homebrew exists but isn't universally installed; many prefer native package managers or direct binaries
- **Claude Code for Web**: Containerized environment without Homebrew or typical package managers
- **Windows**: Status unclear - is it even a target?

**Key constraint**: Tick is agent-first. Agents running in constrained environments (like Claude Code for Web) need a reliable way to install tick without human intervention or complex setup.

### References

- Research: exploration.md (lines 545-553) - Distribution section
- Go compiles to static binaries - simplifies distribution

## Questions

- [x] Global or per-project installation?
- [x] What installation methods should we support?
      - Homebrew, direct binary, install script, go install?
      - Which are essential vs nice-to-have?
- [x] How should the install script work?
      - What environments must it handle?
      - How to detect platform/architecture?
      - Ephemeral environment considerations?
- [x] Should we support Windows?
      - Is it a target environment?
      - What would be required?
- [x] How do we handle versioning and updates?
      - Self-update capability?
      - Version pinning for agents?

---

## Global or per-project installation?

### Context
Should tick be installed once on a user's system, or vendored into each project?

### Options Considered

**Global installation**
- Installed to user's system (e.g., `/usr/local/bin`, `~/.local/bin`)
- Single version shared across projects
- Respects user's home system conventions

**Per-project (vendored)**
- Binary stored in repository
- Each project has its own version
- No system-wide installation needed

### Journey

Initial thought was to consider per-project for reproducibility. But:
- Adds significant size to repositories (Go binaries are ~10-20MB)
- Version drift across projects
- Awkward for a CLI tool - not a library
- No clear benefit over global install

**Ephemeral environments** (like Claude Code for Web) are the interesting case: there's no persistent "global" install. Each session starts fresh. The solution: install script runs as part of session setup, installs to user-writable location, cached if environment supports it.

### Decision

**Global installation**. Per-project vendoring adds bloat without clear benefit. For ephemeral environments, install script handles session setup.

---

## What installation methods should we support?

### Context
Go produces static binaries, which simplifies distribution. But users need a way to get those binaries onto their systems. Different environments have different capabilities.

### Options Considered

**Homebrew (macOS/Linux)**
- Pros: Familiar to developers, handles updates, existing personal tap available
- Cons: Requires Homebrew installed, not available in all environments

**GitHub Releases with pre-built binaries**
- Pros: Universal, no dependencies, goreleaser automates multi-platform builds
- Cons: Manual download/install, no automatic updates

**Install script (curl | bash pattern)**
- Pros: Works anywhere with curl/bash, can detect platform, familiar pattern
- Cons: Security concerns (though common), requires maintaining the script

**go install**
- Pros: Native to Go ecosystem, simple
- Cons: Requires Go toolchain installed

### Journey

Research proposed Homebrew + GitHub releases. But testing in Claude Code for Web revealed: no Homebrew available, but curl and Go toolchain present.

**Emerging priority**:
1. **Install script** - essential for constrained environments, works everywhere with curl/bash
2. **GitHub releases** - required anyway (install script pulls from here)
3. **Homebrew** - nice-to-have for better UX on systems that have it
4. **go install** - free if repo structured correctly, but requires Go toolchain

**Key insight**: Install script may need to be the *primary* documented method, not Homebrew. Homebrew is an optimization for those who have it.

For ephemeral environments: install script runs at session start, needs to be fast and idempotent.

### Decision

Support all four methods, prioritized:
1. **Install script** - primary method, documented first
2. **Homebrew** - alternative for those who prefer it (via personal tap)
3. **GitHub releases** - manual download option
4. **go install** - for Go developers

---

## How should the install script work?

### Context

The install script is the primary installation method. Needs to work across macOS and Linux, be fast for ephemeral environments, and simple to maintain.

### Options Considered

**Install location**
- `/usr/local/bin` - traditional, but may need sudo
- `~/.local/bin` - user-writable, XDG-compliant
- Custom `~/.tick/bin` - isolated but requires PATH modification

**Version handling**
- Always download latest
- Check version and update if outdated
- Skip entirely if already installed

**Fallback strategy**
- Binary only (fail if unavailable)
- Binary → go install → source build (like Beads)

### Journey

Researched how [Beads](https://github.com/steveyegge/beads) handles this. Their install script:
- Tries `/usr/local/bin` first (if writable), falls back to `~/.local/bin`
- Detects platform via `uname -s` (OS) and `uname -m` (arch)
- Has multiple fallbacks: binary download → go install → source build
- Applies ad-hoc code signing on macOS after download

For tick, we want **simpler**:
- Use conventional locations: `/usr/local/bin` if writable, else `~/.local/bin`
- Platform detection same as Beads (proven pattern)
- **No fallbacks**: just binary download, fail if unavailable
- Keep it simple

**Revisited "skip if installed"**: Initially thought to skip if already installed to save time in ephemeral environments. But reconsidered - if someone runs the install script, they probably want the latest version. Simpler to always download and install (overwrite existing).

**macOS code signing research**: Two levels exist:
- **Ad-hoc signing** (free): `codesign --force -s - /path/to/binary` - required for Apple Silicon, but downloaded binaries still show "developer cannot be verified" warning
- **Notarization** ($99/year Apple Developer Program): Eliminates Gatekeeper warnings completely

For a developer CLI tool, ad-hoc signing is sufficient. Users can right-click → Open to bypass the warning on first run. Homebrew handles signing automatically.

**Simplified macOS approach**: Rather than handling binary downloads and code signing for macOS, the install script should delegate to Homebrew on macOS. This gives macOS users the proper experience (signing, updates) while keeping the script simple. If Homebrew isn't installed, the script exits with instructions to install via Homebrew.

The install script is **primarily for Linux/ephemeral environments**. macOS users should use Homebrew directly - the script just does the right thing if someone happens to run it on macOS.

### Decision

**Linux behavior**:
- Download latest binary from GitHub releases to `/usr/local/bin` (if writable) or `~/.local/bin`
- Overwrite existing installation
- No fallbacks - fail if binary download fails

**macOS behavior**:
- If Homebrew installed: run `brew tap .../tick && brew install tick`
- If no Homebrew: exit with message "Please install via Homebrew: brew tap ... && brew install tick"
- No direct binary handling on macOS

**Primary audience**: Linux users, ephemeral environments (Claude Code for Web), CI/CD

---

## Should we support Windows?

### Context

Windows is a significant platform, but adds complexity. Install script pattern doesn't work (no bash by default). Would need different distribution approach.

### Journey

Considered whether Windows is a target audience:
- Tick is agent-first, primarily for Claude Code environments
- Agents typically run in Linux containers
- No Windows machine available for testing
- Go cross-compiles to Windows easily, so binaries could be provided
- But install script won't work - would need manual download or separate installer

### Decision

**Not a priority**. Focus on:
1. macOS via Homebrew (primary development machine)
2. Linux via install script (ephemeral environments like Claude Code for Web)

Windows support can be added later by someone who wants it and can test it. Go's cross-compilation means the binaries will be there in releases anyway - just no automated install path.

---

## How do we handle versioning and updates?

### Context

How do users get newer versions of tick? Should tick have self-update capability?

### Options Considered

**Self-update command** (e.g., `tick upgrade`)
- Pros: Convenient, single command
- Cons: Complexity, security concerns, may conflict with package managers

**Package manager handles it**
- Homebrew: `brew upgrade tick`
- go install: `go install ...@latest`
- Install script: re-run to get latest

**No update mechanism**
- User manually downloads new version

### Journey

The question is whether tick needs to know how to update itself. Arguments against:
- Homebrew already handles updates well
- `go install` users can just run it again
- Self-update adds complexity and potential security issues
- Could conflict with how the user installed it (Homebrew user runs `tick upgrade`, now Homebrew is out of sync)

For ephemeral environments, updates aren't really a concept - each session starts fresh and gets whatever version the install script downloads.

### Decision

**No self-update capability**. Updates handled by:
- **Homebrew**: `brew upgrade tick`
- **go install**: `go install github.com/.../tick@latest`
- **Install script**: Re-run the script (or just use latest in fresh sessions)

This keeps tick simple and avoids conflicts with package managers.

---

## Summary

### Key Decisions

1. **Global installation** - not per-project vendoring
2. **Primary methods**: Homebrew (macOS), install script (Linux/ephemeral)
3. **Install script behavior**:
   - Linux: download binary, overwrite existing
   - macOS: delegate to Homebrew (or exit with instructions if no Homebrew)
4. **Install location** (Linux): `/usr/local/bin` if writable, else `~/.local/bin`
5. **macOS code signing**: Handled by Homebrew (no direct binary handling on macOS)
6. **Windows**: Not a priority, can be added later
7. **Updates**: Handled by package managers, no self-update in tick

### Primary Use Cases

| Environment | Installation Method |
|-------------|-------------------|
| macOS (developer machine) | Homebrew |
| Claude Code for Web | Install script at session start |
| Linux server | Install script or go install |
| CI/CD | Install script |

### Next Steps

- [ ] Implement install script in `scripts/install.sh`
- [ ] Set up Homebrew tap formula
- [ ] Configure goreleaser for multi-platform releases
- [ ] Document installation in README
