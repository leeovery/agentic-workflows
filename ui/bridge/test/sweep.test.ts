// The surface sweep against the REAL engine source: the never-auto list must
// cover every surface that can render the auto-override line, the batch pair
// must exist, and the generated allowlist must include what skills declare.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sweepSurfaces } from '../src/sweep.js';
import { generateAllowlist, skillAllowedTools } from '../src/allowlist.js';
import { NEVER_AUTO_SURFACES, SURFACE_GATE_TYPES } from '@workflow-ui/shared';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ENGINE = path.join(REPO, 'skills', 'workflow-engine', 'scripts');

describe('surface sweep', () => {
  const sweep = sweepSurfaces(ENGINE);

  it('finds the engine MENU surfaces and the gateway menu', () => {
    expect(sweep.surfaces.length).toBeGreaterThan(20);
    expect(sweep.gatewayMenu).toBe(true);
    expect(sweep.batchPair).toBe(true);
  });

  it('every surface that renders the auto-override line is in NEVER_AUTO_SURFACES', () => {
    const overAuto = sweep.surfaces.filter((s) => s.overAuto).map((s) => s.name);
    expect(overAuto.length).toBeGreaterThan(0);
    for (const name of overAuto) {
      expect(NEVER_AUTO_SURFACES as readonly string[]).toContain(name);
    }
  });

  it('every mapped gateType surface actually exists in the engine', () => {
    const names = new Set(sweep.surfaces.map((s) => s.name));
    for (const mapped of Object.keys(SURFACE_GATE_TYPES)) {
      // The mapping may name surfaces by their exact section name; each must
      // exist (or be the plain gateway MENU).
      const exists = names.has(mapped) || [...names].some((n) => n.startsWith(mapped));
      expect(exists, `mapped surface missing from engine: ${mapped}`).toBe(true);
    }
  });
});

describe('allowlist generation', () => {
  it('parses inline frontmatter with parenthesised Bash scopes', () => {
    const tools = skillAllowedTools(
      '---\nname: x\nallowed-tools: Bash(node a.cjs), Bash(git diff, git log), Read\n---\nbody',
    );
    expect(tools).toEqual(['Bash(node a.cjs)', 'Bash(git diff, git log)', 'Read']);
  });

  it('sweeps the dev repo (skills/ layout absent under .claude) without error and includes basics', () => {
    const list = generateAllowlist(REPO);
    expect(list).toContain('Read');
    expect(list).toContain('Task');
  });
});
