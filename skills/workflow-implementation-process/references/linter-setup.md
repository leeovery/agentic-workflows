# Linter Setup

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Discover and configure project linters for use during the TDD cycle's LINT step. Linters run after every REFACTOR to catch mechanical issues (formatting, unused imports, type errors) that are cheaper to fix immediately than in review.

---

## Discovery Process

1. **Identify project languages** — check file extensions, package files (`composer.json`, `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, etc.), and project skills in `.claude/skills/`
2. **Check for existing linter configs** — look for config files in the project root:
   - PHP: `phpstan.neon`, `phpstan.neon.dist`, `pint.json`, `.php-cs-fixer.php`
   - JavaScript/TypeScript: `.eslintrc*`, `eslint.config.*`, `biome.json`
   - Go: `.golangci.yml`, `.golangci.yaml`
   - Python: `pyproject.toml` (ruff/mypy sections), `setup.cfg`, `.flake8`
   - Rust: `rustfmt.toml`, `clippy.toml`
3. **Verify tools are installed** — run each discovered tool with `--version` or equivalent to confirm it's available
4. **Recommend if none found** — if a language is detected but no linter is configured, suggest best-practice tools (e.g., PHPStan + Pint for PHP, ESLint for JS/TS, golangci-lint for Go). Include install commands.

## Storage

Linter commands are stored in the manifest as a `linters` array. Write to both topic level and phase level so future topics receive a recommendation.

Topic level:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} linters [{"name":"phpstan","command":"vendor/bin/phpstan analyse --memory-limit=512M"},{"name":"pint","command":"vendor/bin/pint --test"}]
```

Phase level:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation linters [{"name":"phpstan","command":"vendor/bin/phpstan analyse --memory-limit=512M"},{"name":"pint","command":"vendor/bin/pint --test"}]
```

Each entry has:
- **name** — identifier for display
- **command** — the exact shell command to run (including flags)

If the user skips linter setup, store an empty array at both levels:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} linters []
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation linters []
```
