import { describe, expect, test, tier } from 'claude-code/testing'

import type { View } from '../hooks/model.ts'
import { ALL } from '../hooks/views/all.ts'
import { block, drawn } from './drawing.ts'
import MINT_WORK from './fixtures/board-all.mjs'

tier('user')

describe('All work (20.16)', () => {
  test('is §20.16\'s drawing at 64 columns, a unit\'s second line wrapping under its indent, a topic postponed out of an epic named with the epic, each inbox item one line', () => {
    expect(drawn(ALL, MINT_WORK).text).toEqual(
      block(`
All work · Mint
3 in progress · ⚑ 5 waiting on you · 2 complete

IN PROGRESS ──────────────────────────────────────────────── 3
◐ Token-aware diff sizing                          ⚑ 3 waiting
     feature · build · 58 of 68 tasks done · this session
◐ Rate-limit-aware publish                         ⚑ 2 waiting
     feature · specification · 18 sections · another session
○ Publish failure swallows gh stderr
     bugfix · investigation · cause found, not yet confirmed

ROADMAP ──────────────────────────────────────────── 3 waiting
Next
◇ Headline first release notes
◇ Changelog site · postponed from Release notes overhaul
Later
◇ Agent guide for running releases

INBOX ──────────────────────────────────────── 1 idea · 2 bugs
◇ Mint CLI UI/UX overhaul
✗ Single-version regenerate prepends changelog entry at top i…
✗ Publish heal hint: wrong diagnosis, wrong command form

COMPLETE ──────────────────────────────────────────── 2 ▸ show
`),
    )
  })

  test('a unit opens its page; this session\'s opens its tab; COMPLETE opens to its units', () => {
    const { lines } = drawn(ALL, MINT_WORK)
    const opened = drawn(ALL, MINT_WORK, { opened: ['all:complete'] }).text

    expect(lines.filter(line => line.press !== undefined).map(line => line.press)).toEqual(['tab:unit', 'page:unit:rate-limit-aware-publish', 'page:unit:publish-failure'])
    expect(opened.slice(-5)).toEqual(['COMPLETE ──────────────────────────────────────────── 2 ▾ hide', '✓ Release notes overhaul', '     epic', '✓ Tag signing', '     feature'])
  })

  test('N4: a postponed topic\'s title too long for its row gives way with "…", the epic it came from kept whole', () => {
    const long = { ...MINT_WORK, roadmap: [{ horizon: 'Next', items: [{ title: 'A website for the app, with its pricing and its download', from: 'Fumi' }] }] } as View

    expect(drawn(ALL, long).text).toContain('◇ A website for the app, with its prici… · postponed from Fumi')
  })

  test('D34: quick-fixes are counted as their own kind, each marked ◇', () => {
    const { text } = drawn(ALL, { ...MINT_WORK, inbox: [{ kind: 'idea', title: 'Fumi stacks' }, { kind: 'quick-fix', title: 'Tidy the footer' }] } as View)

    expect(text).toContain('INBOX ────────────────────────── 1 idea · 0 bugs · 1 quick-fix')
    expect(text).toContain('◇ Tidy the footer')
  })

  test('D35: the epic at its menu after the map is approved, this session in it', () => {
    const fumi = { ...MINT_WORK, project: 'Fumi', waiting: 0, units: [{ unit: 'fumi', title: 'Fumi', type: 'epic', phase: 'discussion', standing: '0 of 12 topics decided', waiting: 0, session: 'this' }], complete: [] } as View

    expect(drawn(ALL, fumi).text.slice(0, 6)).toEqual(['All work · Fumi', '1 in progress · 0 complete', '', 'IN PROGRESS ──────────────────────────────────────────────── 1', '◐ Fumi', '     epic · discussion · 0 of 12 topics decided · this session'])
  })

  test('at the start menu it says so; a project\'s name too long for the head gives way with "…", never where the session stands', () => {
    expect(drawn(ALL, { ...MINT_WORK, at_start: true } as View).text[0]).toBe('All work · Mint · at the start menu')
    expect(drawn(ALL, { ...MINT_WORK, project: 'Agentic Engineering Workflows for Claude Code', at_start: true } as View).text[0]).toBe('All work · Agentic Engineering Workflows … · at the start menu')
  })
})
