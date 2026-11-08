// H6 of Portal's kill-all investigation read in full, as engine board answers the hunt's page — §20.12's third drawing — held to its shape by tests/scripts/test-engine-board-investigation.cjs.
export default {
  kind: 'hunt',
  unit: 'killing-all-sessions-wipes-restore-state',
  item: 'hypothesis',
  name: 'H6',
  title: 'A dying tmux reads as zero sessions',
  state: 'confirmed',
  text: [
    'Basis: found in the reboot-timing trials (E5): a 10ms gap between the daemon\'s SIGTERM and the server\'s wiped 5/5 sessions including two whose programs had survived.',
    'Reach: any committer — the daemon\'s SIGTERM flush (E5, E7) and a hook-run commit-now (E7, gap 30ms #1: 0/0 with flush_completed=false).',
  ].join('\n\n'),
}
