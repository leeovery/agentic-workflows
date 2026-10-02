import { describe, expect, test, tier } from 'claude-code/testing'

import { engineCallIn, lineOf } from '../hooks/engine-call.ts'

tier('user')

const ENGINE = 'node .claude/skills/workflow-engine/scripts/engine.cjs'

describe('engineCallIn', () => {
  test('a call reads as its verb and its arguments as written', () => {
    expect(
      engineCallIn(`${ENGINE} manifest set payments.specification.ledger status=completed`),
    ).toEqual({ verb: 'manifest set', args: 'payments.specification.ledger status=completed' })
    expect(engineCallIn(`${ENGINE} render task-gate auth.implementation.auth-flow`)).toEqual({
      verb: 'render task-gate',
      args: 'auth.implementation.auth-flow',
    })
    expect(engineCallIn(`${ENGINE} session label pay`)).toEqual({ verb: 'session label', args: 'pay' })
  })

  test('boot and commit take no verb of their own; the roadmap\'s session and horizon take theirs', () => {
    expect(engineCallIn(`${ENGINE} boot`)).toEqual({ verb: 'boot', args: '' })
    expect(engineCallIn(`${ENGINE} commit pay --topic discussion/ledger`)).toEqual({
      verb: 'commit',
      args: 'pay --topic discussion/ledger',
    })
    expect(engineCallIn(`${ENGINE} roadmap session open --session-log-file draft.md`)).toEqual({
      verb: 'roadmap session open',
      args: '--session-log-file draft.md',
    })
    expect(engineCallIn(`${ENGINE} roadmap horizon add Later`)).toEqual({
      verb: 'roadmap horizon add',
      args: 'Later',
    })
    expect(engineCallIn(`${ENGINE} roadmap pull guest-ordering --into pay`)).toEqual({
      verb: 'roadmap pull',
      args: 'guest-ordering --into pay',
    })
  })

  test('free text goes last, as written, so a cut line keeps what the call addresses', () => {
    expect(
      engineCallIn(`${ENGINE} commit pay -m "discussion(pay): settle the ledger" --topic discussion/ledger`),
    ).toEqual({
      verb: 'commit',
      args: 'pay --topic discussion/ledger -m "discussion(pay): settle the ledger"',
    })
    expect(
      engineCallIn(`${ENGINE} knowledge query "ledger rounding" --limit 5`),
    ).toEqual({ verb: 'knowledge query', args: '"ledger rounding" --limit 5' })
  })

  test('the engine by any path to the project — the settings hooks\' quoted form included', () => {
    expect(
      engineCallIn('node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" session cleanup'),
    ).toEqual({ verb: 'session cleanup', args: '' })
    expect(
      engineCallIn('  node /work/app/.claude/skills/workflow-engine/scripts/engine.cjs task start pay ledger ledger-2-3\n'),
    ).toEqual({ verb: 'task start', args: 'pay ledger ledger-2-3' })
  })

  test('substitutions and quotes stay as written', () => {
    expect(
      engineCallIn(`${ENGINE} manifest set pay.planning.ledger approvals.structure $(date +%Y-%m-%d)`),
    ).toEqual({ verb: 'manifest set', args: 'pay.planning.ledger approvals.structure $(date +%Y-%m-%d)' })
    expect(
      engineCallIn(`${ENGINE} manifest push pay.implementation.ledger bank '{"task":"ledger-1-1"}'`),
    ).toEqual({ verb: 'manifest push', args: `pay.implementation.ledger bank '{"task":"ledger-1-1"}'` })
  })

  test('anything run beside the call, or not the engine at all, reads as none', () => {
    for (const command of [
      `${ENGINE} manifest get pay status 2>/dev/null`,
      `${ENGINE} boot && git status`,
      `${ENGINE} boot; ls`,
      `${ENGINE} render epic-menu | head`,
      `${ENGINE} boot &`,
      `${ENGINE} boot\n${ENGINE} boot`,
      `cd /work && ${ENGINE} boot`,
      `${ENGINE} boot # comment`,
      `${ENGINE}`,
      `${ENGINE} --help`,
      `${ENGINE} commit pay -m "unclosed`,
      'node .claude/skills/workflow-discovery/scripts/gateway.cjs pay',
      'node skills/workflow-engine/scripts/engine.cjs boot',
      'git status',
      `echo ${ENGINE} boot`,
    ]) {
      expect(engineCallIn(command), command).toBe(null)
    }
  })
})

describe('lineOf', () => {
  const call = { verb: 'manifest set', args: 'payments.specification.ledger status=completed' }

  test('the marker, the verb, then the arguments beside a dot', () => {
    expect(lineOf(call, 80)).toEqual({
      marker: '▪',
      verb: ' manifest set',
      args: ' · payments.specification.ledger status=completed',
    })
    expect(lineOf({ verb: 'boot', args: '' }, 80)).toEqual({ marker: '▪', verb: ' boot', args: '' })
  })

  test('cut to the width, the arguments first, an ellipsis where anything was cut', () => {
    const cut = lineOf(call, 30)

    expect(cut).toEqual({ marker: '▪', verb: ' manifest set', args: ' · payments.spe…' })
    expect((cut.marker + cut.verb + cut.args).length).toBe(30)

    const exact = lineOf(call, 63)

    expect(exact.args).toBe(' · payments.specification.ledger status=completed')
    expect(lineOf(call, 62).args).toBe(' · payments.specification.ledger status=complet…')
  })

  test('a width the verb does not fit cuts the verb too', () => {
    const cut = lineOf(call, 8)

    expect(cut).toEqual({ marker: '▪', verb: ' manif…', args: '' })
    expect((cut.marker + cut.verb).length).toBe(8)
  })
})
