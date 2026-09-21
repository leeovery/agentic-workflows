# Where everything starts

Everything begins at `/workflow-start`, and everything resumes there. It opens on an overview of every piece of work in flight, grouped by kind, with where each one has got to and what it is waiting on. The reason it is one command rather than several is that the system keeps track of where each piece of work is, not you: there is no phase to remember and no separate command to continue anything. The menu beneath the overview offers a key for each piece of work and says what it recommends.

```sample start-menu
```

Starting something new is one row. If you already know what it is, say so: `f` for a feature, `b` for a bugfix, and so on. If you don't, `s` takes a description in your own words and the discovery phase settles the kind of work from it. Either way, what happens next is a short exchange about what the work actually is, which is the subject of the next screen.

Inside a piece of work the rhythm is the same everywhere. The system carries on with the work until it reaches a decision that is genuinely yours, then it stops at a gate, shows a menu, and waits. The menu beneath this screen is one. You can answer with a key, in plain words, go back, or close the terminal. Everything a session produces is committed to git as it goes, which is why leaving part-way costs nothing: the next `/workflow-start` shows the overview again, with that piece of work exactly where you left it.
