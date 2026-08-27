import { describe, it, expect } from 'vitest';
import { buildStructure, findClaims, headingSections, slug } from '../src/structure.js';

describe('structure — manifest-owned', () => {
  it('discussion structure comes from manifest subtopics, not the document', () => {
    const manifest = {
      phases: {
        discussion: {
          items: {
            'rate-limiting': {
              subtopics: {
                'limiter-scope': { status: 'decided' },
                'retry-budget': { status: 'pending' },
              },
            },
          },
        },
      },
    };
    // A freeform document with NO matching headings still gets the full rail.
    const s = buildStructure('discussion', 'rate-limiting', manifest, '# Some freeform notes\n\nprose');
    expect(s.available).toBe(true);
    expect(s.sections.map((n) => [n.label, n.status])).toEqual([
      ['limiter-scope', 'decided'],
      ['retry-budget', 'pending'],
    ]);
  });

  it('spec structure carries sources AND consult references from the manifest', () => {
    const manifest = {
      phases: {
        specification: {
          items: {
            't1': {
              sources: { d1: { status: 'incorporated' }, d2: { status: 'stale' } },
              consult_references: { other: { status: 'pending' } },
            },
          },
        },
      },
    };
    const s = buildStructure('specification', 't1', manifest, '## Decisions\n\nbody');
    expect(s.sources?.map((n) => [n.label, n.status])).toEqual([
      ['d1', 'incorporated'],
      ['d2', 'stale'],
    ]);
    expect(s.consultReferences).toEqual([{ label: 'other', status: 'pending' }]);
    expect(s.sections.some((n) => n.label === 'Decisions')).toBe(true);
  });
});

describe('structure — heading-keyed + degradation', () => {
  it('investigation is heading-keyed; deleting all headings degrades to Read-only', () => {
    const withHeadings = buildStructure('investigation', 'bug', null, '## Symptom\n\n## Root cause\n');
    expect(withHeadings.available).toBe(true);
    expect(withHeadings.sections.map((n) => n.label)).toEqual(['Symptom', 'Root cause']);
    const noHeadings = buildStructure('investigation', 'bug', null, 'just prose, no headings');
    expect(noHeadings.available).toBe(false);
  });

  it('research is Read-only by design (low structure is honest)', () => {
    expect(buildStructure('research', 'x', null, '## Anything\n').available).toBe(false);
  });
});

describe('claim chips', () => {
  it('finds measured claims by the cmd → result convention', () => {
    const md = 'The build is clean: `npm run typecheck` → 0 errors\nplain prose\n`grep -c foo file` → 3 matches';
    const chips = findClaims(md);
    expect(chips).toHaveLength(2);
    expect(chips[0]).toMatchObject({ command: 'npm run typecheck', result: '0 errors' });
    expect(chips[1]).toMatchObject({ command: 'grep -c foo file' });
  });

  it('ignores non-command backtick→arrow lines (misses cost nothing)', () => {
    expect(findClaims('`SomeType` → the shape of a thing')).toHaveLength(0);
  });
});

describe('anchors', () => {
  it('slug matches the Read lens heading slugs', () => {
    expect(slug('Root Cause & Analysis')).toBe('root-cause-analysis');
    expect(headingSections('### F1: A Finding')[0]).toMatchObject({ anchor: 'f1-a-finding' });
  });
});
