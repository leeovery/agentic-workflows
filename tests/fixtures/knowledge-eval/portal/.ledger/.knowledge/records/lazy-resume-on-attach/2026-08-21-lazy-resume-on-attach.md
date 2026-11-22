# Fire resume hooks on attach, not on reboot

Today a reboot brings every saved session's resume hook up at once. Bootstrap respawns each
restored pane with the hydrate helper, and once scrollback replay finishes the helper execs
the registered hook, so all of them launch together whether or not the user ever looks at
that pane. With a large session population that is a lot of work nobody asked for, and the
cost lands entirely in memory.

Measured on this machine on 2026-08-21: 42 live Claude processes, 13.1 GB resident between
them, averaging 318 MB each and peaking at 702 MB. That is roughly a fifth of a 64 GB machine
committed to sessions the user is mostly not looking at, and the pageout counter is over a
million. The pressure scales with the number of saved sessions, which only grows — every new
piece of work adds another session that will be resumed on every subsequent reboot, forever,
regardless of whether it is still active work.

The idea is to make resumption lazy. Restore the pane as it does now — skeleton, geometry,
scrollback all replayed, so the pane still looks exactly as the user left it — but hold the
hook until the pane is actually attached and viewed for the first time. The session comes
back when the user goes to it, and a pane they never open in that boot costs nothing beyond
its replayed scrollback. Steady-state memory then tracks what the user is actually working
on rather than the full historical set.

The visible behaviour worth preserving is that a restored pane should still read as restored
before its hook fires. The scrollback is already replayed at that point, so the pane shows
its prior content; what changes is only that the live process behind it starts later. Some
signal that the pane is waiting to resume, rather than looking like a dead shell, is probably
part of this.

Worth thinking about what "actually attaching" means precisely, since a pane can be
switched to, be part of an attached session without being the active pane, or be visible in
a split without having focus — and whether resuming should be automatic on first view or
something the user triggers explicitly per pane.

Relevant surfaces: the hydrate helper's exec chain (`portal state hydrate`), bootstrap step 6
and the restore engine's phase A/B split in `internal/restore/`, the `client-attached` and
`client-session-changed` global hooks registered in `internal/tmux/hooks_register.go`, and
the eager signal-hydrate pass at bootstrap step 7.
