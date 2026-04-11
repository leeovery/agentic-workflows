# Artifact With Code Blocks

Intro paragraph describing the artifact. The bulk of this fixture is here
to push the file above `keep_whole_below` so the chunker goes through
real heading parsing — otherwise the fenced code blocks inside never get
tested.

Padding line 01
Padding line 02
Padding line 03
Padding line 04
Padding line 05
Padding line 06
Padding line 07
Padding line 08
Padding line 09
Padding line 10
Padding line 11
Padding line 12
Padding line 13
Padding line 14
Padding line 15
Padding line 16
Padding line 17
Padding line 18
Padding line 19
Padding line 20

## Section One

This section contains a fenced code block with markdown-looking
headings inside. The chunker must NOT treat them as real headings.

```markdown
## Not A Real Heading One
### Not A Real Heading Two
#### Not A Real Heading Three

Even with more markdown-looking content below, the parser must stay
inside the fence until the closing marker.
```

And here is a second code block using tildes instead of backticks — also
a valid fence marker in CommonMark.

~~~
## Also Not A Heading
More code content.
~~~

Back to real content under Section One.

## Section Two

A short real section to prove Section One's boundary is correctly
determined. There must be exactly two H2 chunks in the final output.

- item 1
- item 2
- item 3
