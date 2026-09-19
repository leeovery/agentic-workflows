import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateAllowlist, skillAllowedTools } from '../src/allowlist.js';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function skill(name: string, frontmatter: string): void {
  const d = path.join(dir, '.claude', 'skills', name);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'SKILL.md'), `---\n${frontmatter}\n---\nbody`);
}

describe('allowlist generation', () => {
  it('parses inline frontmatter with parenthesised Bash scopes (commas inside parens kept)', () => {
    expect(skillAllowedTools('---\nallowed-tools: Bash(node a.cjs), Bash(git diff, git log), Read\n---\n')).toEqual([
      'Bash(node a.cjs)',
      'Bash(git diff, git log)',
      'Read',
    ]);
  });

  it('sweeps skills, expands Bash(cmd)→Bash(cmd:*), and includes the BASE_BASH dev set', () => {
    skill('workflow-start', 'allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs)');
    const list = generateAllowlist(dir);
    // The frontmatter grant AND its wildcard expansion are both present.
    expect(list).toContain('Bash(node .claude/skills/workflow-engine/scripts/engine.cjs)');
    expect(list).toContain('Bash(node .claude/skills/workflow-engine/scripts/engine.cjs:*)');
    // BASE_BASH dev commands (the round-8 gap) are present as wildcards.
    expect(list).toContain('Bash(node:*)');
    expect(list).toContain('Bash(git diff:*)');
    expect(list).toContain('Bash(rm -rf .workflows/.cache:*)');
    // File tools are NOT in the allowlist — canUseTool governs them.
    expect(list.some((t) => t.startsWith('Write'))).toBe(false);
    expect(list.some((t) => t.startsWith('Edit'))).toBe(false);
  });

  it('an absent skills dir yields just the BASE_BASH set, no throw', () => {
    const list = generateAllowlist(dir);
    expect(list.every((t) => t.startsWith('Bash('))).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
});
