---
name: intent
description: Intent-driven development — guide a Product Owner through the five components of an intent, then write it to intents/<slug>/intent.md.
argument-hint: [free text, a ticket, a doc link, or nothing]
---

# /intent

Help a Product Owner articulate a product intent. An intent is a precise, traceable unit of product thinking. It has exactly five components — no more, no less.

This is the **first artifact** of the lifecycle. It is written to `intents/<slug>/intent.md`, and every later stage (`/expectations`, `/context`, `/build`) reads from it.

## The five components

1. **Description** — what is wanted. Product language, not engineering language.
2. **Constraints** — rules, limits, and non-negotiables. What must stay true. What is explicitly out of scope.
3. **Failure scenarios** — concrete conditions under which this intent has failed. What does the user see? What state is left behind?
4. **Success scenarios** — observable, testable conditions under which this intent is satisfied.
5. **Connections** — other intents this one touches. Ask: *"If this changed, what else would have to change?"* — anything that a change here would ripple into. A change here must be traceable to everything it affects.

### Worked example (keep this concrete style)

Outcome: *"A shopper can buy a red shoe for under €90."*

- **Description**: a red shoe the shopper can actually buy for under €90.
- **Constraints**: their size, in stock, deliverable to them.
- **Failure scenarios**: returns a €140 shoe; returns an out-of-stock shoe; returns a shoe that isn't red.
- **Success scenarios**: the shopper adds an affordable red shoe to the cart and checks out.
- **Connections**: anything that touches price, inventory, or checkout — because a change there changes this.

Notice: every scenario is something the shopper would see, not how it's built. Aim for that.

## Rules

- **Write the artifact.** When the intent is complete, write it to `intents/<slug>/intent.md`. Nothing downstream works without this file.
- **Confirm before overwriting.** If `intents/<slug>/intent.md` already exists, show what's there and ask before replacing it.
- **One component at a time.** Do not dump all five questions at once. Ask, listen, extract, confirm — then move on.
- **Never invent business logic.** If something is unclear, mark it `TODO: confirm with PO` and continue.
- **Stay at product level.** Do not describe implementation unless the PO brings it up.
- **Connections are mandatory.** Isolated intents are a smell. Look for at least one.
- **Speak the PO's language.** No file paths, repo names, spec IDs, or engineering jargon in any message to the PO. Use the product and business concepts they already know. (The `intents/<slug>/…` path is plumbing — mention it once at the end, don't narrate it.)

## Do

1. Accept any input: **$ARGUMENTS** — free text, a ticket, a doc link, or nothing. If nothing, ask: *"What outcome are you trying to achieve?"*
2. Derive a short noun-phrase title (e.g. "Checkout Discount", "Password Reset") and a kebab-case **slug** from it (`checkout-discount`). Confirm the title.
3. Work through the five components conversationally. Extract what you can from the input; ask only for what is genuinely missing.
4. For connections: silently read the project's product and architecture documentation and any existing intents (`intents/*/intent.md`) to find related areas. Surface connections to the PO in plain product language — never expose file paths, spec names, or technical terms. Ask: *"Does this touch how people check out?"* not *"Is this related to the checkout module?"*

## The stranger test (do this before finishing)

An intent is only done when nothing is left for an agent to guess. Play the stranger: read the draft as someone who was **not** in the PO's head, and point out every place an engineer would still have to make a decision the PO didn't. Say it plainly: *"Here's where someone building this would still have to guess: …"* Each gap is a hole the agent would otherwise fill on its own. Turn each one into a question for the PO and close it — don't paper over it. Only stop when there are no guessable holes left, or the remaining ones are marked `TODO: confirm with PO`.

## End with

Write the completed intent to `intents/<slug>/intent.md` using this template:

```
# Intent: <Title>

Status: Draft
Created: <today's date>

---

## Description
<what is wanted>

## Constraints
- 

## Failure Scenarios
- 

## Success Scenarios
- 

## Connections
| Intent | Why it's connected |
|---|---|
| <name> | <reason> |

## Open Questions
- TODO: ...
```

Mark incomplete sections with `TODO: confirm with PO`. Do not leave a section blank.

Then echo a short summary and the path in the conversation, and point to the next step:

> Wrote `intents/<slug>/intent.md`. Next: `/expectations <slug>`.
