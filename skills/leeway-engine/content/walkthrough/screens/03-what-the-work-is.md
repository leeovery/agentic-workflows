# What the work is

Whatever you start with, the first phase is discovery, and its only job is to settle what the work is. It never starts solving the problem. The reason it comes first is that the kind of work decides the route through the three stages, and settling the kind is what puts the work on the right one.

There are five kinds. A feature is one coherent thing to build. An epic is several distinct things wearing one name, which becomes topics that each travel on their own. A bugfix is something that used to work and now doesn't. A quick-fix is small and mechanical, with nothing to debate. A cross-cutting concern is a standard for the codebase to follow rather than something to ship. Sometimes what you describe is none of these but the product as a whole, with no single thing to build yet. Discovery notices that and carries on at that level instead, which the next screen covers.

```table
 | DISCOVERY | DEFINITION | DELIVERY
feature | discussion | spec · plan | build · review
epic | per topic | per topic | per topic
bugfix | investigation | spec · plan | build · review
quick-fix |  | scoping | build · review
cross-cutting | discussion | spec |
```

Discovery works by asking one question at a time and saying back what it is hearing, so a wrong reading is corrected the moment it appears rather than three phases later. If you have notes, a design document or an error report, hand them over here and they travel with the work. When the picture holds steady it says what it thinks the work is and why, and asks whether that's right. Nothing is written to the repository until you say yes. At that point the work is saved, together with what you told it, and routed into its first real phase.
