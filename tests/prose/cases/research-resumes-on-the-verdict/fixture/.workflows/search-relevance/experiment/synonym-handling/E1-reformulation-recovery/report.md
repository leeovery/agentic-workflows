# E1: Reformulation Recovery — Report

## Results

12 of 40 zero-result searches recovered via an in-session
reformulation with a click — 30%. Counted with one pass over
logs/search-sessions.log (sessions s-1 through s-40; recoveries
s-1 through s-12).

## Deviations

None.

## Reading

Recovery is common enough to feed behaviour-driven expansion: a
third of failed searches already carry the user-supplied synonym
pair the expansion service would learn from.

## Conclusion

The registered rule fires on the >= 15% branch: behaviour-driven
expansion is the leading candidate and the research carries it
forward.

## Reproduce

grep the committed log: count sessions with a results=0 line and
a later same-session line with results>0 and clicked=yes.
