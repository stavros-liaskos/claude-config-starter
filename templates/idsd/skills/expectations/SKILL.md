---
name: expectations
description: Intent-driven development — read an intent and write its boundary (done / failed / limits) to intents/<slug>/expectations.md.
argument-hint: [intent slug or title]
---

# /expectations

Turn an intent into its **boundary**: the explicit line between done and not-done. This is the craft that used to be smeared across a sprawling "spec" — deliberately *not* called a spec here. It is short, it is owned by the same human who owns the intent, and it is what the build loop validates against.

An intent says *what is wanted*. Expectations say *how we will know it is right, how we will know it is wrong, and what it must never violate* — all in terms the person who wanted the outcome would recognize, not implementation language.

## Inputs and output

- **Reads:** `intents/<slug>/intent.md`.
- **Writes:** `intents/<slug>/expectations.md`.

Resolve `<slug>` from **$ARGUMENTS** (a slug or a title). If it's missing or ambiguous, list the folders under `intents/` and ask which one. If `intents/<slug>/intent.md` does not exist, stop and say: *"No intent found — run `/intent` first."*

## The three parts

1. **Done** — observable, testable conditions under which the result counts as satisfied. If every one of these is true, the work is done. Each must be checkable, not a feeling.
2. **Failed** — concrete conditions that mean the result is wrong *even if it looks right*. The lookalikes. The silent-wrong. What state gets left behind on failure.
3. **Limits** — what must stay true throughout, and what is explicitly out of scope. Non-negotiables the result must stay inside (data that must not change, flows that must keep working, things that must not regress).

### Worked example (keep this concrete style)

Intent: *"A shopper can buy a red shoe for under €90."*

- **Done**: a red shoe in the shopper's size, in stock, priced under €90, is added to the cart and checkout completes.
- **Failed**: a shoe over €90 is offered; an out-of-stock shoe is offered; a non-red shoe is offered; checkout completes but the order total exceeds €90.
- **Limits**: existing checkout for other products keeps working; prices already in the cart are not silently changed; no new payment method is introduced.

Notice: each line is something the shopper (or the PO) could confirm — not a description of how it's built.

## Rules

- **Read the intent first.** Derive the boundary from the intent's success/failure scenarios and constraints; don't restate the intent, sharpen it into testable conditions.
- **Owned by the human who owns the intent.** The moment "done" drifts away from the person who wanted the outcome, the agent starts deciding "done" for them. Keep this human's language.
- **Not a spec.** No implementation, no architecture, no file paths. If you catch yourself writing *how*, that belongs in context, not here.
- **Every line must be checkable.** If a condition can't be observed or tested, rewrite it until it can, or mark it `TODO: confirm with PO`.
- **Failure is a first-class part.** Do not skip the "Failed" section — the lookalikes are where cheap-to-generate, confidently-wrong code hides.
- **Confirm before overwriting.** If `intents/<slug>/expectations.md` already exists, show what's there and ask before replacing it.

## Do

1. Resolve the slug and read `intents/<slug>/intent.md`.
2. Restate the intent's title so both of you agree what this boundary is for.
3. Work through the three parts conversationally. Extract what you can from the intent; ask only for what is genuinely missing.
4. Run the stranger test: hand the boundary to someone who was **not** in the human's head and find every place the agent would still get to decide what "done" means. Close each gap or mark it `TODO: confirm with PO`.

## End with

Write the completed boundary to `intents/<slug>/expectations.md` using this template:

```
# Expectations: <Intent Title>

Status: Draft
Created: <today's date>
Intent: intents/<slug>/intent.md

---

## Done (satisfied when all are true)
- 

## Failed (wrong even if it looks right)
- 

## Limits (must stay true / out of scope)
- 

## Open Questions
- TODO: ...
```

Mark incomplete sections with `TODO: confirm with PO`. Do not leave a section blank.

Then echo a short summary and the path, and point to the next step:

> Wrote `intents/<slug>/expectations.md`. Next: `/context <slug>`.
