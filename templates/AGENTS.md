# AGENTS.md — {{PROJECT_NAME}}

> The **constitution**: the always-on, tool-agnostic context every agent reads. Kept lean —
> deep detail lives in linked docs and is pulled on demand. Every tool reads this
> (Claude Code via `CLAUDE.md → @AGENTS.md`; Cursor/Codex/Gemini/Copilot natively).

## What this is
<One or two sentences: what the project does, who uses it, and what it replaces or enables.>

## Stack
{{STACK}}

## Layout
```
{{LAYOUT}}
```

## Commands
```bash
{{COMMANDS}}
```

## Conventions
- <Language/type conventions, e.g. TypeScript strict; validate external inputs with Zod.>
- <Where tests live and which runner.>
- **Branch naming:** <convention, e.g. ticket key alone `ABC-123`, no suffix.>
- **Commits:** <style, e.g. one-line subject, no AI signature.> **PRs:** <expectations, e.g. concise body, link the ticket.>

## How we code (every change — framework or quick fix)
Behavioral baseline (adapted from Karpathy's coding guidelines). Applies always:
- **Think before coding.** Surface assumptions and name confusion instead of hiding them;
  present alternative interpretations rather than silently picking one; suggest the simpler
  approach when it exists. Ask rather than guess.
- **Simplicity first.** Minimal code that solves exactly what was asked — no unrequested
  features, no premature abstraction, no error handling for impossible cases.
  Test: *"would a senior engineer call this overcomplicated?"*
- **Surgical changes.** Touch only what the task needs; match existing style and patterns.
  Don't refactor working code or fix unrelated formatting. Remove only what your change
  orphaned; **report** pre-existing dead code rather than deleting it.
- **Goal-driven.** Turn vague tasks into testable success criteria; verify against them as you go.

## Principles (non-negotiable)
- <Project-specific invariants that must never be violated. Delete if none.>

## How we work
<Describe the change workflow — e.g. spec-driven development, PR review gates, or a lightweight
"branch → change → test → PR" loop. Reference any shared skills or commands the team relies on.>

## Deep context (load on demand)
- `docs/` — <what's there>.
- `<link>` — <sibling repos, ADRs, shared frameworks>.
