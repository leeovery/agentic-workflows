# Working in parallel

You can have more than one session open on the same project, and for the talking phases that is a perfectly good way to work: one session in a discussion on one topic while another talks through a second. Ledger keeps them aware of each other without locking anyone out.

A session working a topic leaves a mark on it. An epic's menu marks a topic another session holds as *in session*, with how long ago it was last active, and strikes its row through so you don't pick it by accident. You still can: entering a held topic asks you to confirm first. When a session ends, its marks go with it.

Code is different. The build runs its tasks side by side, each in a worktree of its own, and merges them back; in step they run one at a time. But a build, the review phase and a quick-fix take turns in the project's checkout, whichever piece of work each belongs to: entering one while another session holds the code shows you which session it is and when it was last active.

```
   talking phases    as many sessions as you like
   a build's tasks   side by side, each in its own worktree
   the checkout      one build, review or quick-fix at a time
```

Where the Claude Code mod runs, a board beside the conversation shows what is happening now — the build's tasks, a topic's map, the questions waiting — without reprinting it into the transcript. If you work in tmux or Portal, Ledger can also label each session to show where it is working; it asks once per project.

Everything a session produces is committed to git as it goes, Ledger's records on a branch of their own, confined to what each action wrote, so parallel sessions never sweep up one another's changes and any session can end at any moment and be resumed from disk.
