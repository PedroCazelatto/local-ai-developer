# Adopt ASD-STE100 Simplified Technical English for model-written docs

**Category:** Rules / standards

Write a rule covering **ASD-STE100 Simplified Technical English** and make it the standard every piece
of documentation text the models produce must follow — READMEs, spec documents, code comments, commit
bodies, and the planning artifacts the phases write into a project.

The rule belongs under [rules/standards/](../rules/standards/), the on-demand reference set the model
reaches through `search_rules` / `load_rule`.

Still open: whether it is retrieved **on demand** like the other standards, or **always loaded** into
the phase prompts. Always-loaded guarantees every documentation-writing phase follows it, but spends
tokens on every turn of every phase — a real cost on a VRAM-bound box. Decide before building.
