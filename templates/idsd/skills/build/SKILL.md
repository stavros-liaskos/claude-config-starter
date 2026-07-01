---
name: build
description: Intent-driven development — run the build loop for an intent, validate against expectations, then write a merge summary to intents/<slug>/build.md.
argument-hint: [intent slug or title]
---

# /build

Run the loop that turns an intent and its expectations into merged code. The human owns the intent and the expectations and never leaves them. The harness owns the loop and is never asked to invent what the human wanted.

The core metric of this loop is **presence in the loop, not approval at the gate.** Reviewing a giant diff at the end is how ten thousand lines that "look right" get shipped with nobody owning what "right" meant. Stay in it while it runs.

## Inputs and output

- **Reads:** `intents/<slug>/intent.md`, `intents/<slug>/expectations.md`, and `intents/<slug>/context.md`.
- **Writes:** the code changes, plus a merge summary at `intents/<slug>/build.md`.

Resolve `<slug>` from **$ARGUMENTS**. If it's missing or ambiguous, list the folders under `intents/` and ask which one.

## Preconditions (do not start without these)

- `intents/<slug>/intent.md` exists. If not: *"No intent found — run `/intent` first."*
- `intents/<slug>/expectations.md` exists. If not: *"No expectations found — run `/expectations <slug>` first."*
- `intents/<slug>/context.md` is recommended. If missing, offer to run `/context <slug>` first, or gather context inline as you go.

If the intent or expectations are ambiguous, **stop and ask.** Do not fill the gap yourself — that gap is exactly what this method exists to prevent.

## The loop

1. **Pick the smallest meaningful slice** of the intent that moves toward "done."
2. **Use the context** (`context.md`) for that slice; pull more with `/context` if you hit an edge it didn't cover.
3. **Implement** the slice, matching the patterns the context surfaced.
4. **Validate against expectations** — not against vibes. For each `Done` condition, show it's met. For each `Failed` condition, show it does not occur. For each `Limit`, show it still holds (nothing regressed, nothing out of scope crept in). Run the tests/checks that prove it.
5. **If any expectation is unmet, go again** from step 2. Keep going until they are all met.
6. **Checkpoint with the human** at meaningful points — a slice landed, a decision looms, an assumption had to be made. Short, in the loop, while it's cheap to correct.
7. When **all** expectations are met, write the merge summary and stop.

## Rules

- **Validate against expectations, not vibes.** "It looks right" is not done. Map each result back to a specific `Done` / `Failed` / `Limit` line.
- **Never invent the what.** If the intent or expectations don't answer a question, surface it to the human — don't decide it silently.
- **Stay present.** Prefer many small checkpoints over one big review. Being wrong while feeling fast is the failure this guards against.
- **Small slices.** Smaller changes are easier to validate and cheaper to unwind. Resist generating a large volume of code before anything is checked.
- **Report, don't hide.** If you hit a conflict between the code and the expectations, say so and pause — do not design around the human's boundary.

## End with

Write the merge summary to `intents/<slug>/build.md` using this template:

```
# Build summary: <Intent Title>

Created: <today's date>
Intent: intents/<slug>/intent.md
Expectations: intents/<slug>/expectations.md

---

## Expectations checked
- [x] Done: <condition> — <how it was verified>
- [x] Failed: <condition> — <shown not to occur>
- [x] Limit: <condition> — <shown still true>

## Changes
- `path/to/file` — <what changed and why>

## Assumptions made (confirm before merge)
- <any decision made in the loop that the human should ratify>

## Open questions
- TODO: ...
```

Do not present the work as done unless every expectation is checked. Anything unresolved goes under Assumptions or Open questions. Then echo the summary and the path in the conversation.
