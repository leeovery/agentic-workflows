#!/usr/bin/env bash
# The world the tapes record in, built under /tmp/ledger-demo (DEMO_WORLD
# moves it): acme-app, a small web app in a git repository, with Ledger
# installed in it from this checkout and its state laid in from one of the
# walkthrough's sample worlds, so `/ledger` opens straight on the screen a
# tape shows. Beside it, Ledger's own config folder (LEDGER_CONFIG_DIR), a
# gitconfig of the world's own, and profile.sh, which a tape sources.
#
# Claude Code itself is the person's own: the tapes run the real `claude`
# with the real home folder, so it signs in as they do. Nothing else of the
# person's is read or written: Ledger's config is the world's, git's is the
# world's, and the session reads the project's settings alone
# (`--setting-sources project`), so the person's own plugins, hooks and status
# line stay out of the frame.
#
# The state is a sample world from skills/ledger-engine/content/walkthrough/
# fixtures/, the same files the walkthrough draws its screens from, laid into
# the project's `.ledger/` (a worktree of its `ledger-state` branch) once
# boot has set it up, with every setup question answered: the walkthrough
# skipped, the knowledge base keyword-only, the brownfield offer answered.
#
# Usage:  demo/world.sh start       the start menu's world: a feature mid-build,
#                                   a bugfix in investigation, an epic in
#                                   discussion, four items in the inbox
#         demo/world.sh roadmap     the roadmap: an item on each of three
#                                   horizons, Launch Core started
#         demo/world.sh discussion  Launch Core's Billing topic mid-discussion
#         demo/world.sh build       Saved Filters at its build; no tape uses
#                                   it, as the sample's tasks are the tracker's
#                                   answer, which a live build asks the
#                                   tracker for (demo/README.md)
set -euo pipefail

project=acme-app
# When every commit the world is built with is dated.
epoch="2026-01-02T09:00:00Z"

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
fixtures="$root/skills/ledger-engine/content/walkthrough/fixtures"

# marker is the file only a world holds, written as it is built: world.sh
# empties a folder only where it holds one, or holds nothing at all.
marker=".ledger-demo-world"

# refuse stops, saying why the world can't be built where DEMO_WORLD names.
refuse() {
	echo "$world $1; set DEMO_WORLD elsewhere" >&2
	exit 1
}

# physical is the folder $1 names by its physical path, its links followed
# (macOS keeps /tmp at /private/tmp); a folder not made yet by its parent's.
physical() {
	if [ -d "$1" ]; then
		(cd -P "$1" && pwd)
		return
	fi
	local parent
	parent="$(cd -P "$(dirname "$1")" && pwd)"
	echo "${parent%/}/$(basename "$1")"
}

named="${DEMO_WORLD:-/tmp/ledger-demo}"
world="$(physical "$named" 2>/dev/null)" || {
	world="$named"
	refuse "can't be read"
}
repo="$world/$project"
config="$world/config"

# What the shell running this carries of the person's own git config, and
# of the Claude Code session or multiplexer it may run inside, never reaches
# the world: a `claude` started inside another session's environment takes
# itself for that session's child.
leaks="GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_CONFIG_PARAMETERS GIT_CONFIG_COUNT GIT_TEMPLATE_DIR GIT_EXEC_PATH XDG_CONFIG_HOME"
session_leaks="$(env | sed -nE 's/^(CLAUDE[A-Z_]*|AI_AGENT|TMUX[A-Z_]*|ZMX_[A-Z_]*|STY)=.*/\1/p' | sort -u | tr '\n' ' ')"
# shellcheck disable=SC2086 # the names, one word each
unset $leaks $session_leaks
export GIT_CONFIG_GLOBAL="$world/gitconfig"
export GIT_CONFIG_NOSYSTEM=1
export LEDGER_CONFIG_DIR="$config"
# The engine's own calls to Claude, the one-decision check that boot
# launches in the background for a sample's unchecked decisions among them,
# go to a stand-in that cannot answer, so the decisions stay as the sample
# has them and no boot of the world spends a call on your login. A check
# that outlived its world would write into the next one built at the same
# path.
export LEDGER_CLAUDE=/usr/bin/false
export TZ=UTC

engine() {
	node .claude/skills/ledger-engine/scripts/engine.cjs "$@"
}

gitconfig() {
	cat >"$GIT_CONFIG_GLOBAL" <<EOF
[user]
	name = Ada Webb
	email = ada@acme.dev
[commit]
	gpgSign = false
[tag]
	gpgSign = false
[init]
	defaultBranch = main
[advice]
	detachedHead = false
EOF
}

# What a tape sources, in the shell vhs opens: Ledger's config and git's the
# world's, the engine's own calls to Claude stood in for, no session or
# multiplexer of the person's, colour as Ghostty reports it, and a bare
# prompt. HOME stays the person's, for Claude Code's sign-in.
profile() {
	cat >"$world/profile.sh" <<EOF
export LEDGER_CONFIG_DIR="$config"
export LEDGER_CLAUDE="$LEDGER_CLAUDE"
export GIT_CONFIG_GLOBAL="$GIT_CONFIG_GLOBAL"
export GIT_CONFIG_NOSYSTEM=1
export TZ=UTC
export COLORTERM=truecolor
unset \$(env | sed -nE 's/^(CLAUDE[A-Z_]*|AI_AGENT|TMUX[A-Z_]*|ZMX_[A-Z_]*|STY)=.*/\1/p')
unset $leaks NO_COLOR FORCE_COLOR
# Claude Code's fullscreen renderer, as the person runs it.
export CLAUDE_CODE_NO_FLICKER=1
PS1='\[\e[34m\]❯\[\e[0m\] '
cd "$repo"
clear
EOF
}

# --- the project ---------------------------------------------------------------

# A commit dated $1, of everything in the tree, with the message $2.
commit() {
	git add -A
	GIT_AUTHOR_DATE="$1" GIT_COMMITTER_DATE="$1" git commit -qm "$2"
}

# acme-app: a small web app for teams' reports, its filters, exports,
# payments and imports, in a few dated commits.
build_project() {
	mkdir -p "$repo"
	cd "$repo"
	git init -q -b main
	mkdir -p src/reports src/payments src/imports test
	cat >README.md <<'EOF'
# Acme

Reports for small teams: filter what you need, export it, share it.

    npm install
    npm run dev
EOF
	cat >package.json <<'EOF'
{
  "name": "acme-app",
  "version": "0.9.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
EOF
	printf 'node_modules/\ndist/\n' >.gitignore
	cat >src/server.ts <<'EOF'
import { Hono } from 'hono';
import { reports } from './reports/routes.js';

const app = new Hono();
app.route('/reports', reports);

export default app;
EOF
	commit "2025-11-03T09:12:00Z" "Start acme-app"

	cat >src/reports/filters.ts <<'EOF'
import { z } from 'zod';

export const Filter = z.object({
  field: z.string(),
  op: z.enum(['eq', 'neq', 'gt', 'lt', 'contains']),
  value: z.union([z.string(), z.number()]),
});

export type Filter = z.infer<typeof Filter>;

export function apply<T extends Record<string, unknown>>(rows: T[], filters: Filter[]): T[] {
  return rows.filter((row) => filters.every((f) => matches(row[f.field], f)));
}

function matches(cell: unknown, f: Filter): boolean {
  switch (f.op) {
    case 'eq': return cell === f.value;
    case 'neq': return cell !== f.value;
    case 'gt': return Number(cell) > Number(f.value);
    case 'lt': return Number(cell) < Number(f.value);
    case 'contains': return String(cell).includes(String(f.value));
  }
}
EOF
	cat >src/reports/routes.ts <<'EOF'
import { Hono } from 'hono';
import { exportCsv } from './export.js';

export const reports = new Hono();

reports.get('/:id/export', async (c) => {
  const file = await exportCsv(c.req.param('id'));
  return c.body(file, 200, { 'content-type': 'text/csv' });
});
EOF
	cat >src/reports/export.ts <<'EOF'
import { rowsFor } from './store.js';

export async function exportCsv(reportId: string): Promise<string> {
  const rows = await rowsFor(reportId);
  const header = Object.keys(rows[0] ?? {});
  return [header.join(','), ...rows.map((r) => header.map((h) => String(r[h])).join(','))].join('\n');
}
EOF
	cat >src/reports/store.ts <<'EOF'
export async function rowsFor(_reportId: string): Promise<Record<string, unknown>[]> {
  return [];
}
EOF
	cat >test/filters.test.ts <<'EOF'
import { expect, test } from 'vitest';
import { apply } from '../src/reports/filters.js';

test('every filter must match', () => {
  const rows = [{ team: 'ops', spend: 40 }, { team: 'ops', spend: 90 }];
  expect(apply(rows, [{ field: 'spend', op: 'gt', value: 50 }])).toHaveLength(1);
});
EOF
	commit "2025-11-17T14:40:00Z" "Filter and export reports"

	cat >src/payments/charge.ts <<'EOF'
export interface Charge {
  invoiceId: string;
  amountPence: number;
  currency: 'GBP' | 'EUR' | 'USD';
}

export async function charge(c: Charge): Promise<{ id: string }> {
  return { id: `ch_${c.invoiceId}` };
}
EOF
	cat >src/imports/csv.ts <<'EOF'
export function parseCsv(text: string): Record<string, string>[] {
  const [head, ...lines] = text.trim().split('\n');
  const cols = head.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
}
EOF
	commit "2025-12-08T10:05:00Z" "Take card payments; import rows from CSV"
}

# Ledger, installed as `npx agntc add` installs its pack: each skill folder
# into .claude/skills/, the agents into .claude/agents/. The session runs in
# Claude Code's ask-first mode, so auto mode's offer to learn the environment
# never draws over the screen, and the project's own settings allow every
# tool Ledger's turns use, any shell command among them, since Claude writes
# its own loops and pipes round the engine: a question about a permission
# would stop the recording. This is a throwaway project in /tmp. Prompt
# suggestions are off, so the prompt box stays empty under the menu.
install_ledger() {
	mkdir -p .claude/skills .claude/agents
	for skill in "$root"/skills/*/; do
		cp -R "$skill" ".claude/skills/$(basename "$skill")"
	done
	rm -rf .claude/skills/*/.claude-plugin/types
	cp "$root"/agents/*.md .claude/agents/
	cat >.claude/settings.json <<'EOF'
{
  "permissions": {
    "allow": [
      "Bash",
      "Read",
      "Glob",
      "Grep",
      "Edit",
      "Write",
      "Skill",
      "WebFetch",
      "WebSearch"
    ]
  },
  "promptSuggestionEnabled": false
}
EOF
	commit "2026-01-02T09:00:00Z" "Add Ledger"
}

# Ledger's state for the project: boot sets up `.ledger/`, every setup
# question is answered, then the sample world named by $1 is laid in and
# committed to the state branch. The sample's project manifest is merged
# into the one boot made, so what setup recorded stays.
seed_state() {
	local sample="$fixtures/$1/state"
	export CLAUDE_CODE_SESSION_ID="00000000-0000-4000-8000-000000000001"
	engine boot </dev/null >/dev/null
	engine knowledge setup --keyword-only >/dev/null
	engine walkthrough record skipped >/dev/null
	engine brownfield record native >/dev/null
	node - "$sample/manifest.json" .ledger/manifest.json <<'EOF'
const fs = require('fs');
const [sample, live] = process.argv.slice(2);
const merged = { ...JSON.parse(fs.readFileSync(live, 'utf8')), ...JSON.parse(fs.readFileSync(sample, 'utf8')) };
fs.writeFileSync(live, JSON.stringify(merged, null, 2) + '\n');
EOF
	(cd "$sample" && find . -mindepth 1 -maxdepth 1 ! -name manifest.json -exec cp -R {} "$repo/.ledger/" \;)
	(
		cd .ledger
		git add -A
		GIT_AUTHOR_DATE="$epoch" GIT_COMMITTER_DATE="$epoch" git commit -qm "Seed the demo's state"
	)
	unset CLAUDE_CODE_SESSION_ID
}

# A world built afresh. It empties the folder first, so only one that is a
# world already (it holds the marker), or holds nothing, is taken; never /,
# the person's home or a folder holding it, whatever links name them.
fresh() {
	local own held
	own="$(physical "$HOME")"
	[ "$world" != / ] || refuse "is the root folder"
	case "$own/" in
	"$world"/*) refuse "is your home, or holds it" ;;
	esac
	if [ -e "$world" ] || [ -L "$world" ]; then
		[ -d "$world" ] || refuse "isn't a folder"
		held="$(ls -A "$world")" || refuse "can't be read"
		[ -z "$held" ] || [ -f "$world/$marker" ] || refuse "isn't a demo world: it holds no $marker"
	fi
	rm -rf "$world"
	mkdir -p "$world" "$config"
	touch "$world/$marker"
	gitconfig
	profile
}

case "${1:-}" in
start) sample=start-menu ;;
build) sample=build-progress ;;
roadmap) sample=roadmap ;;
discussion) sample=discussion-map ;;
*)
	echo "usage: demo/world.sh start | build | roadmap | discussion" >&2
	exit 2
	;;
esac

fresh
build_project
install_ledger
seed_state "$sample"
