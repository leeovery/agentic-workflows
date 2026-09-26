---
topic: installation
status: concluded
type: feature
work_type: greenfield
date: 2026-01-25
sources:
  - name: installation-options
    status: incorporated
---

# Specification: Installation

Tick is a Go CLI tool requiring cross-platform installation. This specification covers distribution methods, install script behavior, and platform support.

## Overview

**Installation model**: Global installation (not per-project vendoring). Single version shared across projects, installed to user's system.

**Primary audience**:
- macOS developers (via Homebrew)
- Linux users and ephemeral environments like Claude Code for Web (via install script)
- CI/CD pipelines (via install script)

**Not in scope for v1**: Windows support. Go cross-compiles Windows binaries (available in releases), but no automated install path.

## Installation Methods

Four methods supported, in priority order:

### 1. Install Script (Primary)

`curl -fsSL https://raw.githubusercontent.com/{repo}/main/scripts/install.sh | bash`

- Primary documented method
- Essential for constrained/ephemeral environments
- Works anywhere with curl and bash

### 2. Homebrew (macOS)

```bash
brew tap {owner}/tick
brew install tick
```

- Preferred method for macOS users
- Handles code signing automatically
- Manages updates via `brew upgrade tick`

### 3. GitHub Releases

Pre-built binaries available for manual download. Required infrastructure (install script pulls from here).

Platforms:
- `darwin-amd64` (macOS Intel)
- `darwin-arm64` (macOS Apple Silicon)
- `linux-amd64`
- `linux-arm64`

### Release Asset Naming

goreleaser convention: `{binary}_{version}_{os}_{arch}.tar.gz`

Assets per release:
- `tick_X.Y.Z_darwin_amd64.tar.gz`
- `tick_X.Y.Z_darwin_arm64.tar.gz`
- `tick_X.Y.Z_linux_amd64.tar.gz`
- `tick_X.Y.Z_linux_arm64.tar.gz`

Each archive contains the `tick` binary.

### 4. go install

`go install github.com/{repo}@latest`

- For users with Go toolchain installed
- Available if repository is structured correctly (no extra work)

## Install Script Behavior

The install script (`scripts/install.sh`) behaves differently based on platform.

### Linux Behavior

1. **Detect platform**: `uname -s` (OS) and `uname -m` (architecture)
2. **Download binary**: Fetch latest release from GitHub for detected platform
3. **Install location**:
   - `/usr/local/bin` if writable (no sudo required)
   - `~/.local/bin` as fallback (user-writable, XDG-compliant)
4. **Overwrite existing**: Always install latest version (no version checking)
5. **No fallbacks**: If binary download fails, script fails. No `go install` or source build fallback.

### macOS Behavior

1. **Check for Homebrew**: If `brew` command exists
   - Run `brew tap {owner}/tick && brew install tick`
   - Exit successfully
2. **No Homebrew**: Exit with message:
   ```
   Please install via Homebrew:
   brew tap {owner}/tick && brew install tick
   ```

macOS does not handle direct binary downloads. This avoids code signing complexity - Homebrew handles signing automatically.

### Design Principles

- **Simple**: No complex fallback chains
- **Idempotent**: Safe to run multiple times
- **Fast**: Important for ephemeral environments where script runs at session start
- **Overwrite by default**: If user runs install script, they want latest version

### Architecture Mapping

| `uname -m` | Asset arch |
|------------|------------|
| `x86_64` | `amd64` |
| `aarch64` | `arm64` |
| `arm64` | `arm64` |

## Updates

**No self-update capability**. Tick does not include an `upgrade` command.

Updates handled via the original installation method:

| Method | Update Command |
|--------|---------------|
| Homebrew | `brew upgrade tick` |
| go install | `go install github.com/{repo}@latest` |
| Install script | Re-run the script |

### Rationale

- Avoids complexity and security concerns of self-update
- Prevents conflicts with package managers (e.g., Homebrew user runs `tick upgrade`, now Homebrew is out of sync)
- Ephemeral environments don't need updates - each session starts fresh with latest version

## Environment Matrix

| Environment | Method | Notes |
|-------------|--------|-------|
| macOS (developer machine) | Homebrew | Primary dev environment |
| Claude Code for Web | Install script | Run at session start |
| Linux server | Install script or go install | |
| CI/CD | Install script | Fast, idempotent |
| Windows | Manual download | Not officially supported |

## Dependencies

Prerequisites that must exist before implementation can begin:

### Required

| Dependency | Why Blocked | What's Unblocked When It Exists |
|------------|-------------|--------------------------------|
| **tick-core (buildable binary)** | Cannot distribute what doesn't exist. goreleaser needs a Go project that compiles successfully. | Install script, Homebrew formula, GitHub releases |

### Notes

- Homebrew formula requires the GitHub repository URL and release asset naming conventions
- Install script implementation can be written before tick-core is complete, but cannot be tested end-to-end
- goreleaser configuration can be set up early with placeholder build targets
