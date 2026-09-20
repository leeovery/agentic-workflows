# Working in parallel

You can have more than one session open on the same project, and for the thinking phases that is a perfectly good way to work: one session in a discussion on one topic while another researches a second. The system keeps them aware of each other without locking anyone out.

Each session in a phase leaves a heartbeat on the topic it is working. An epic's dashboard reads those heartbeats and marks a topic another session holds as *in session*, with how long ago it was last active, and strikes its row through so you don't pick it by accident. You still can; entering a held topic asks you to confirm first, and nothing prevents it. Background analyses the system runs on an epic wait while a source topic is held, so nothing is analysed out from under a live conversation. When a session ends, its heartbeats go with it.

Code is the exception. Implementation and review both change the working tree, and two sessions writing to the same checkout would corrupt each other, so there is one code session per checkout at a time. Entering implementation or review while another session holds that slot shows you where it is and waits.

```
   thinking phases   as many sessions as you like, side by side
   code phases       one session per checkout, taking turns
```

If you work in tmux, the system can rename your tmux session to show where each one is: the project, the piece of work, the phase and the topic, collapsing the topic when it is the same as the work. It asks once per project whether you want that, and restores the original name when the session ends or returns to the start menu.

Everything a session produces is committed to git as it goes, confined to the files its own action wrote, so parallel sessions never sweep up one another's changes under the wrong message, and any session can end at any moment and be resumed from disk.
