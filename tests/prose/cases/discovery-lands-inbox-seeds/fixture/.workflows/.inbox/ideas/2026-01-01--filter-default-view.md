# Filter Default View

Related to saving filters on the orders list: once a user has a
saved combination, one of them is almost always "their" view — the
one they open first every morning. The idea is to let a user mark
one saved filter as their default, so the orders list opens already
filtered to it when they log in.

Without this, the saved dropdown still helps, but the first act of
every session is picking the same entry from it. A default makes
the common case zero-click. It should be per-user like the filters
themselves, and easy to clear — falling back to the unfiltered list
when no default is set.
