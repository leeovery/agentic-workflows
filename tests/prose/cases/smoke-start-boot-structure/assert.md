The prose should have taken this path:

1. casing conventions are loaded before the boot pipeline runs
2. the boot pipeline is declared mandatory — it must complete before the
   skill proceeds
3. the knowledge gate is reached only after boot, and branches on what
   boot reported rather than on its own checks
