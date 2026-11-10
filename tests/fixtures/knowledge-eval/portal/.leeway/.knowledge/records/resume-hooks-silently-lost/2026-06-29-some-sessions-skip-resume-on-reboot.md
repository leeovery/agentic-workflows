# Some sessions don't resume their work after a reboot

After a machine crash with 32 Claude sessions running under Portal/tmux, the user rebooted and Portal's resurrection layer kicked in: the loading screen showed sessions resuming, the tmux sessions were restored, and on reattach roughly 28 of the 32 came back fully — their Claude sessions resumed correctly. However, around 4 of the 32 did **not** resume their work; the session itself was present but the on-resume behaviour (resuming the Claude session in the pane) did not happen.

The failure was a small minority and there was no obvious shared characteristic — no specific projects were identified and no common pattern was spotted across the four. The user's own hunch is that the non-resuming ones may have been **older sessions**, which raises the possibility that something about how older sessions were created or recorded leaves them missing whatever the resume path depends on. The other framings the user offered: there may be a gap in the on-resume **hook** firing for those panes, or the issue may sit in Portal's restore/resume logic rather than the hook.

Impact: low frequency but real — in a large working set (32 sessions here), a handful silently come back without their work resumed, so the user has to notice which ones didn't and restart that work manually. It undercuts the "everything comes back" confidence that the resurrection feature otherwise delivers.

Conditions observed:
- Triggered by a full reboot (crash recovery), not an in-server detach/reattach.
- ~28/32 succeeded, ~4/32 failed to resume — so it is intermittent / subset, not a total failure.
- Suspected correlation with session age ("old sessions"), unconfirmed.

This was noticed in passing during the `restore-host-terminal-windows` discovery and parked here so it gets its own investigation. Relevant areas to look at when picked up (per the project's resume mechanism): the per-pane on-resume hooks (`hooks.json`, the hydrate helper exec chain that fires hooks on reboot recovery), the structural pane-key resolution that hook lookups depend on, and whether older/legacy sessions carry the markers the restore path expects. No reproduction has been attempted and no root cause assumed.
