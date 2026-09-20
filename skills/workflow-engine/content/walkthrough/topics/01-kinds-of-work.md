# The kinds of work

Not every piece of work deserves the same process. A one-line rename and a months-long initiative both benefit from some structure, but forcing the rename through weeks of discussion would be absurd and letting the initiative skip straight to code would be reckless. So there are five kinds of work, each with a journey sized to fit, and the kind is settled for you at the start from how you describe what you want.

```
   epic           several distinct things wearing one name;
                  each becomes a topic with its own journey
   feature        one coherent thing to build, start to finish
   bugfix         something that used to work and now doesn't;
                  an investigation replaces the discussion
   quick-fix      small and mechanical, nothing to debate;
                  one scoping pass, then build and review
   cross-cutting  a standard for the codebase to follow;
                  it ends at its specification
```

You never have to choose. Press `s` from the start menu, describe the work, and the system works out the kind in conversation, telling you its read and asking whether it's right before anything is created. The typed rows on the start menu (`f`, `e`, `b`, `q`, `c`) are hints when you already know, and even then the shape is confirmed before it's committed to.

A piece of work of any kind is called a work unit, and each has its own home under `.workflows/` in your repository. Inside an epic the separate concerns are called topics; for every other kind the topic is simply the work itself and the word never comes up.

Getting the kind wrong at the start costs nothing. A feature that grows into several things can pivot into an epic, and a feature that belongs inside a larger effort can be absorbed into one, both from the manage menu. Both are described under *Reshaping work*.
