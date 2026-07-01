#!/usr/bin/env node
// claude-config-starter — interactive wizard that scaffolds a Claude Code config
// into the current repo. Zero runtime dependencies (Node built-ins only).

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(__dirname, '..', 'templates');
const CWD = process.cwd();

// ---------- prompt helpers ----------
const interactive = Boolean(input.isTTY && output.isTTY);
let rl;
const getRl = () => (rl ??= createInterface({ input, output }));

async function choose(question, options, defaultIndex = 0) {
  if (!interactive) return options[defaultIndex].value;
  output.write(`\n${question}\n`);
  options.forEach((o, i) =>
    output.write(`  ${i + 1}) ${o.label}${i === defaultIndex ? '  (default)' : ''}\n`),
  );
  const ans = (await getRl().question(`Choose [1-${options.length}] (${defaultIndex + 1}): `)).trim();
  if (!ans) return options[defaultIndex].value;
  const n = Number(ans);
  if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1].value;
  output.write('Invalid choice — using default.\n');
  return options[defaultIndex].value;
}

async function confirm(question, defaultYes = false) {
  if (!interactive) return defaultYes;
  const ans = (await getRl().question(`${question} (${defaultYes ? 'Y/n' : 'y/N'}): `)).trim().toLowerCase();
  if (!ans) return defaultYes;
  return ans === 'y' || ans === 'yes';
}

async function ask(question, def = '') {
  if (!interactive) return def;
  const ans = (await getRl().question(`${question}${def ? ` (${def})` : ''}: `)).trim();
  return ans || def;
}

// ---------- package manager ----------
function detectPm() {
  if (existsSync(join(CWD, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(CWD, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(CWD, 'package-lock.json'))) return 'npm';
  return 'pnpm';
}
const runScript = (pm, s) => (pm === 'npm' ? `npm run ${s}` : `${pm} ${s}`);
const installCmd = (pm) => (pm === 'npm' ? 'npm install' : `${pm} install`);

function pmAllow(pm) {
  if (pm === 'yarn')
    return ['Bash(yarn install *)', 'Bash(yarn lint *)', 'Bash(yarn test *)', 'Bash(yarn build *)', 'Bash(yarn tsc *)'];
  if (pm === 'pnpm')
    return ['Bash(pnpm install *)', 'Bash(pnpm lint *)', 'Bash(pnpm test *)', 'Bash(pnpm build *)', 'Bash(pnpm exec *)'];
  return ['Bash(npm install *)', 'Bash(npm run *)', 'Bash(npx *)'];
}

// Insert a blank line before each given entry in the stringified settings.json,
// so the allow/deny lists read as topic groups. Blank lines are valid JSON.
function groupSettings(jsonStr, boundaries) {
  return boundaries.reduce((s, b) => s.replace(`      "${b}"`, `\n      "${b}"`), jsonStr);
}

// ---------- AGENTS.md blocks ----------
function buildStack(pm, kind) {
  const lines = [`- **Package manager:** ${pm} · Node <version> (\`.nvmrc\`).`];
  if (kind === 'backend' || kind === 'both')
    lines.push('- **Backend** (`<package-name>`): <runtime & framework>, <language>, <test runner>. Deployed to **<host>**.');
  if (kind === 'frontend' || kind === 'both')
    lines.push('- **Frontend** (`<package-name>`): <framework>, <language>, <styling>, <test runner>. Deployed to **<host>**.');
  if (kind === 'library')
    lines.push('- **Library** (`<package-name>`): <language>, <build tool>, <test runner>. Published to **<registry>**.');
  if (kind === 'both') lines.push('- **Shared:** `packages/*` — <shared packages>.');
  return lines.join('\n');
}

function buildLayout(kind) {
  const byKind = {
    backend: ['src/            # handlers / services / clients / schemas / types', '__tests__/      # tests mirroring src/', 'docs/           # architecture, ADRs, notes'],
    frontend: ['src/ (or app/)  # routes, components, hooks', '__tests__/      # tests mirroring src/', 'public/         # static assets', 'docs/           # architecture, ADRs, notes'],
    both: ['apps/frontend   # web app', 'apps/backend    # service / API', 'packages/*      # shared packages', 'docs/           # architecture, ADRs, notes'],
    library: ['src/            # library source', '__tests__/      # tests mirroring src/', 'docs/           # usage & API notes'],
  };
  return byKind[kind].join('\n');
}

function buildCommands(pm, kind) {
  const lines = [`${installCmd(pm)}   # install dependencies (Node <version>)`];
  lines.push(`${runScript(pm, 'dev')} | ${runScript(pm, 'build')} | ${runScript(pm, 'lint')} | ${runScript(pm, 'test')}`);
  return lines.join('\n');
}

const render = (tpl, map) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in map ? map[k] : `{{${k}}}`));

// ---------- file writing (never overwrite) ----------
const results = { created: [], skipped: [] };
function writeIfMissing(relPath, content) {
  const abs = join(CWD, relPath);
  if (existsSync(abs)) {
    results.skipped.push(relPath);
    return;
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  results.created.push(relPath);
}

// Drop a .gitkeep we created if the directory ended up with real content.
// Only prunes placeholders this run created — never a pre-existing file.
function pruneGitkeep(relDir) {
  const keepRel = join(relDir, '.gitkeep');
  if (!results.created.includes(keepRel)) return;
  const abs = join(CWD, relDir);
  if (existsSync(abs) && readdirSync(abs).some((e) => e !== '.gitkeep')) {
    unlinkSync(join(CWD, keepRel));
    results.created = results.created.filter((f) => f !== keepRel);
  }
}

// Recursively copy a template tree into the target, never overwriting.
function copyTreeIfMissing(srcDir, destRel) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const rel = join(destRel, entry.name);
    if (entry.isDirectory()) copyTreeIfMissing(srcPath, rel);
    else writeIfMissing(rel, readFileSync(srcPath, 'utf8'));
  }
}

// ---------- main ----------
async function main() {
  output.write(`\nclaude-config-starter\nScaffolding Claude Code config into:\n  ${CWD}\n`);
  if (!interactive) output.write('(no TTY detected — using detected defaults)\n');

  const pm = await choose(
    'Which package manager does this project use?',
    [{ label: 'yarn', value: 'yarn' }, { label: 'pnpm', value: 'pnpm' }, { label: 'npm', value: 'npm' }],
    ['yarn', 'pnpm', 'npm'].indexOf(detectPm()),
  );
  const kind = await choose(
    'What kind of project is this?',
    [{ label: 'backend', value: 'backend' }, { label: 'frontend', value: 'frontend' }, { label: 'both (monorepo)', value: 'both' }, { label: 'library', value: 'library' }],
    0,
  );
  const hook = await confirm('Add a PostToolUse hook that runs lint + test after each edit?', false);
  const wantIdsd = await confirm('Add intent-driven development (IDSD) commands?', false);
  const wantSkills = await confirm('Install skills now?', false);

  // Render AGENTS.md + CLAUDE.md
  const agents = render(readFileSync(join(TEMPLATES, 'AGENTS.md'), 'utf8'), {
    PROJECT_NAME: basename(CWD),
    STACK: buildStack(pm, kind),
    LAYOUT: buildLayout(kind),
    COMMANDS: buildCommands(pm, kind),
  });

  // Build .claude/settings.json
  const settings = JSON.parse(readFileSync(join(TEMPLATES, 'settings.base.json'), 'utf8'));
  settings.permissions.allow.push(...pmAllow(pm));
  if (hook) {
    settings.hooks = {
      PostToolUse: [
        {
          matcher: 'Write|Edit',
          hooks: [
            {
              type: 'command',
              command: `${runScript(pm, 'lint')} && ${runScript(pm, 'test')} || exit 2`,
              statusMessage: 'Linting + testing',
            },
          ],
        },
      ],
    };
  }

  writeIfMissing('CLAUDE.md', readFileSync(join(TEMPLATES, 'CLAUDE.md'), 'utf8'));
  writeIfMissing('AGENTS.md', agents);
  const settingsJson = groupSettings(JSON.stringify(settings, null, 2) + '\n', [
    // allow groups
    'Bash(ls *)',
    'Bash(npx tsc *)',
    pmAllow(pm)[0],
    // deny groups
    'Read(**/*.pem)',
    'Bash(rm -rf *)',
    'Bash(git reset --hard *)',
    'Bash(sudo)',
  ]);
  writeIfMissing('.claude/settings.json', settingsJson);
  writeIfMissing('skills-lock.json', readFileSync(join(TEMPLATES, 'skills-lock.json'), 'utf8'));
  writeIfMissing('.claude/skills/.gitkeep', '');
  writeIfMissing('.claude/commands/.gitkeep', '');

  // Optionally add the intent-driven development (IDSD) command pack
  if (wantIdsd) {
    copyTreeIfMissing(join(TEMPLATES, 'idsd', 'commands'), '.claude/commands');
    copyTreeIfMissing(join(TEMPLATES, 'idsd', 'skills'), '.claude/skills');
  }

  // Optionally install skills from a source of your choice
  if (wantSkills) {
    const source = await ask('Skills source URL (e.g. https://github.com/vercel-labs/skills)');
    if (!source) {
      output.write('No source URL given — skipping skills.\n');
    } else {
      const list = (await ask('Skills to add (comma-separated, e.g. find-skills)'))
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const skill of list) {
        output.write(`\n→ npx skills add ${source} --skill ${skill}\n`);
        const r = spawnSync('npx', ['skills', 'add', source, '--skill', skill], { stdio: 'inherit', cwd: CWD });
        if (r.status !== 0) output.write(`  (skill "${skill}" failed or was skipped)\n`);
      }
    }
  }

  // Remove now-redundant .gitkeep placeholders we created
  pruneGitkeep('.claude/commands');
  pruneGitkeep('.claude/skills');

  // Report
  output.write('\nDone.\n');
  if (results.created.length) output.write(`Created:\n${results.created.map((f) => `  + ${f}`).join('\n')}\n`);
  if (results.skipped.length) output.write(`Skipped (already present):\n${results.skipped.map((f) => `  = ${f}`).join('\n')}\n`);
  output.write('\nNext: fill in the <placeholders> in AGENTS.md.\n');

  rl?.close();
}

main().catch((err) => {
  console.error(err);
  rl?.close();
  process.exit(1);
});
