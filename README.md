# claude-config-starter

An interactive wizard that scaffolds a [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
config into any repo. Run one command inside your project, answer a few questions
(package manager, backend/frontend, …), and it drops in a tailored `CLAUDE.md`,
`AGENTS.md`, and `.claude/settings.json`. On a first run it **never overwrites** existing
files; on later runs it can **update** an existing config to a newer version (see
[Updating](#updating)).

## Usage

From the root of the project you want to configure:

```bash
npx github:stavros-liaskos/claude-config-starter
```

No install, no dependencies — it runs on Node ≥ 18 using only built-ins.

The wizard asks:

1. **Package manager** — yarn / pnpm / npm (auto-detected from your lockfile, confirm or change).
   Tunes the `settings.json` allow-list, the lint/test hook, and the AGENTS.md commands.
2. **Project type** — backend / frontend / both (monorepo) / library.
   Shapes the AGENTS.md Stack + Layout + Commands sections.
3. **Lint/test hook** — whether to add a `PostToolUse` hook that runs `<pm> lint && <pm> test`
   after every edit.
4. **IDSD commands** — whether to add the intent-driven development command pack (see below).
5. **Skills** — optionally installs skills: asks for a skills source URL (e.g.
   `https://github.com/vercel-labs/skills`) and the skill name(s), then runs `npx skills add`.

On a fresh install, existing files are left untouched; the wizard prints a summary at the end.

## What it generates

```
CLAUDE.md              # @AGENTS.md — single entry point every agent reads
AGENTS.md              # the "constitution", pre-filled for your pm + project type
skills-lock.json       # tracks installed skills
.claude/
├── settings.json      # permission allow/deny defaults (+ pm rules, + optional hook)
├── starter.json       # version manifest — records what was installed (see Updating)
├── skills/            # shared skills land here
└── commands/          # project-specific slash commands go here
```

`CLAUDE.md` intentionally contains only `@AGENTS.md`, keeping a single source of truth
that every agent tool reads — Claude Code follows the `@` reference; Cursor, Codex, Gemini,
and Copilot read `AGENTS.md` natively.

`.claude/settings.local.json` is **not** generated — it's machine-specific, gitignored, and
accumulates your personal allow-list as you work. Never commit it.

## Updating

Re-run the same command in a repo that already has the config, and the wizard detects what's
there via `.claude/starter.json` (a manifest holding the installed version, your answers, and
a hash of every generated file) and acts accordingly:

- **Already current** → only creates anything missing; nothing is overwritten.
- **Older version** → asks whether to update, then reconciles each file by class:

| File class | Files | On update |
|---|---|---|
| **Managed** | `CLAUDE.md`, IDSD commands/skills | If you never touched it → updated in place. If you edited it *and* the template changed → your copy is saved to `<file>.bak` and you're asked keep-mine / take-new, one file at a time. If the template didn't change → left alone. |
| **User-owned** | `AGENTS.md`, `skills-lock.json` | Never overwritten. If the template changed, it's listed under **Review** so you can merge by hand. |
| **settings.json** | `.claude/settings.json` | **Additive merge** — new `allow`/`deny` entries from the template (e.g. security fixes) are added; everything you added is kept; nothing is removed. |

- **No manifest but config present** (installed before versioning) → the wizard records a
  baseline manifest so future updates are tracked, and merges in any missing defaults.

The manifest is meant to be committed. Delete leftover `*.bak` files once you've reconciled them.

The version comes from this package's `package.json`; bump it whenever you change a template.

## Permissions

- **`deny`** blocks reads/edits of secrets (`.env`, `*.key`, `*.pem`, …) and dangerous
  commands (`rm -rf`, `git reset --hard`, force-push, `sudo`).
- **`allow`** pre-approves safe commands (lint, test, build, `git diff/status/add/commit`,
  plus the package-manager rules for your chosen pm) so the agent doesn't prompt on every run.

## Skills

The wizard can install [Agent Skills](https://agentskills.io) from any source you point it
at. It asks for a source URL and the skill name(s), then runs `npx skills add`. Add more later:

```bash
npx skills add <source-url> --skill <skill-name>
# e.g.
npx skills add https://github.com/vercel-labs/skills --skill find-skills
```

## Intent-driven development (IDSD)

Opt in during the wizard to install a set of slash commands for **intent-driven
development** — the ICE model (Intent · Context · Expectations) and the loop that runs on
them. The human owns *what* is wanted and *what "done" means*; the harness owns *how* it
gets built and validates against that boundary.

The commands form a **pipeline**: each stage writes a markdown artifact under
`intents/<slug>/`, and the next stage reads it. Each stage also echoes a short summary in
chat and points to the next step.

| Command | Reads | Writes | What it does |
|---|---|---|---|
| `/intent` | — | `intents/<slug>/intent.md` | Draft a product intent as five components: description, constraints, failure scenarios, success scenarios, connections. Product language. |
| `/expectations` | `intent.md` | `intents/<slug>/expectations.md` | Turn the intent into an explicit boundary — `done` / `failed` / `limits` — that the build loop validates against. Owned by the same human who owns the intent. |
| `/context` | `intent.md`, `expectations.md` | `intents/<slug>/context.md` | Assemble just-enough technical context, pulled progressively (not dumped up front). Owned by the harness. |
| `/build` | `intent.md`, `expectations.md`, `context.md` | code + `intents/<slug>/build.md` | Implement a slice, validate against the expectations, iterate until met, write a merge summary — staying present in the loop, not approving at the gate. |

Typical flow: `/intent <outcome>` → `/expectations <slug>` → `/context <slug>` → `/build <slug>`.

Each command is a thin entry point that reads its `.claude/skills/<name>/SKILL.md`. They're
generic and product-agnostic — adapt the language to your domain.

## Repo layout (this project)

```
bin/init.mjs           # the wizard (zero dependencies)
templates/             # source files the wizard renders
├── CLAUDE.md
├── AGENTS.md          # {{PROJECT_NAME}} {{STACK}} {{LAYOUT}} {{COMMANDS}} tokens
├── settings.base.json # deny rules + common allow (wizard adds pm rules + hook)
└── skills-lock.json
```

## Development

```bash
# dry-run the wizard against a scratch directory
mkdir -p /tmp/scratch && cd /tmp/scratch
node /path/to/claude-config-starter/bin/init.mjs
# or run with npx
npx /path/to/claude-config-starter
```
