---
name: context
description: Intent-driven development — assemble just-enough technical context for an intent and write it to intents/<slug>/context.md.
argument-hint: [intent slug or title]
---

# /context

Assemble the **how** for an intent: the tech, the existing system, and the codebase constraints the work has to live inside. Context is owned by the harness, not the human who owns the intent — this is the craft where the agent reads the repo.

The one rule that makes context work: **pull, don't dump.** Feed exactly what the work needs, progressively. A wall of the whole architecture is how the loop drowns and how tokens get spent being confidently wrong. Just-in-time, not just-in-case.

## Inputs and output

- **Reads:** `intents/<slug>/intent.md` and `intents/<slug>/expectations.md`.
- **Writes:** `intents/<slug>/context.md`.

Resolve `<slug>` from **$ARGUMENTS**. If it's missing or ambiguous, list the folders under `intents/` and ask which one. If `intents/<slug>/intent.md` is missing, stop and say: *"No intent found — run `/intent` first."* If `expectations.md` is missing, note it and continue (context can still be gathered, but flag that expectations should follow).

## What a context brief contains

- **Where it lives** — the specific files, modules, or services this intent touches, and why each is relevant.
- **How it's done here** — the existing patterns, conventions, and abstractions to follow (so the change matches the codebase instead of reinventing it).
- **Constraints from the code** — what the current system forces or forbids: data shapes, contracts, integration points, invariants that must not break.
- **Unknowns** — what could not be determined from the repo and needs a human or a spike.

## Rules

- **Pull, don't dump.** Scope context to this intent, not the whole system. If a fact doesn't change a decision for this work, leave it out.
- **Cite, don't paraphrase from memory.** Point to real files and symbols you actually read (`path/to/file.ts:42`). Never invent structure that isn't there.
- **Context is the how — never the what.** Do not redefine the intent or the expectations here; consume them.
- **Surface conflicts.** If the codebase contradicts the intent or expectations (a constraint that makes "done" impossible), say so plainly and stop — don't quietly design around it.
- **Confirm before overwriting.** If `intents/<slug>/context.md` already exists, show what's there and ask before replacing it.

## Do

1. Resolve the slug and read `intents/<slug>/intent.md` (and `expectations.md` if present).
2. Read only what's relevant: start from the project's architecture/product docs, then the specific code the intent touches. Stop when you have enough to build against.
3. Produce a focused context brief (below). Keep it short enough that every line earns its place.
4. Note what you deliberately did **not** load, so the build loop knows more can be pulled on demand.

## End with

Write the brief to `intents/<slug>/context.md` using this template:

```
# Context: <Intent Title>

Created: <today's date>
Intent: intents/<slug>/intent.md
Expectations: intents/<slug>/expectations.md

---

## Where it lives
- `path/to/file` — <why relevant>

## How it's done here
- <pattern / convention to follow>

## Constraints from the code
- <what the system forces or forbids>

## Unknowns
- <what couldn't be determined from the repo>

## Not loaded (available on demand)
- <areas intentionally left out for now>
```

Then echo a short summary and the path, and point to the next step:

> Wrote `intents/<slug>/context.md`. Next: `/build <slug>`.
