#!/usr/bin/env node
// claude-config-starter — interactive wizard that scaffolds a Claude Code config
// into the current repo, and updates it in place across versions.
// Zero runtime dependencies (Node built-ins only).

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(__dirname, '..', 'templates');
const CWD = process.cwd();
const MANIFEST_REL = '.claude/starter.json';
const VERSION = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')).version;

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

// ---------- content builders ----------
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
  return [
    `${installCmd(pm)}   # install dependencies (Node <version>)`,
    `${runScript(pm, 'dev')} | ${runScript(pm, 'build')} | ${runScript(pm, 'lint')} | ${runScript(pm, 'test')}`,
  ].join('\n');
}

const render = (tpl, map) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in map ? map[k] : `{{${k}}}`));
const readTpl = (rel) => readFileSync(join(TEMPLATES, rel), 'utf8');

function buildAgents(pm, kind) {
  return render(readTpl('AGENTS.md'), {
    PROJECT_NAME: basename(CWD),
    STACK: buildStack(pm, kind),
    LAYOUT: buildLayout(kind),
    COMMANDS: buildCommands(pm, kind),
  });
}

function buildSettings(pm, hook) {
  const settings = JSON.parse(readTpl('settings.base.json'));
  settings.permissions.allow.push(...pmAllow(pm));
  if (hook) {
    settings.hooks = {
      PostToolUse: [
        {
          matcher: 'Write|Edit',
          hooks: [{ type: 'command', command: `${runScript(pm, 'lint')} && ${runScript(pm, 'test')} || exit 2`, statusMessage: 'Linting + testing' }],
        },
      ],
    };
  }
  return groupSettings(JSON.stringify(settings, null, 2) + '\n', [
    'Bash(ls *)', 'Bash(npx tsc *)', pmAllow(pm)[0],
    'Read(**/*.pem)', 'Bash(rm -rf *)', 'Bash(git reset --hard *)', 'Bash(sudo)',
  ]);
}

// Additive merge: keep everything on disk, add any allow/deny entries the
// template introduced (e.g. security fixes), add the hook only if absent.
function mergeSettings(onDiskStr, templateStr, pm) {
  const cur = JSON.parse(onDiskStr);
  const tpl = JSON.parse(templateStr);
  cur.permissions ??= {};
  const union = (a = [], b = []) => { const seen = new Set(a); for (const x of b) if (!seen.has(x)) a.push(x); return a; };
  cur.permissions.allow = union(cur.permissions.allow ?? [], tpl.permissions?.allow ?? []);
  cur.permissions.deny = union(cur.permissions.deny ?? [], tpl.permissions?.deny ?? []);
  if (!cur.hooks && tpl.hooks) cur.hooks = tpl.hooks;
  return groupSettings(JSON.stringify(cur, null, 2) + '\n', [
    'Bash(ls *)', 'Bash(npx tsc *)', pmAllow(pm)[0],
    'Read(**/*.pem)', 'Bash(rm -rf *)', 'Bash(git reset --hard *)', 'Bash(sudo)',
  ]);
}

// ---------- plan ----------
// A plan is the full set of files the wizard would produce for the given answers,
// each tagged with a class that decides how updates treat it.
function readTree(srcDir, destRel, cls) {
  const out = [];
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const rel = join(destRel, entry.name);
    if (entry.isDirectory()) out.push(...readTree(srcPath, rel, cls));
    else out.push({ rel, content: readFileSync(srcPath, 'utf8'), cls });
  }
  return out;
}

function buildPlan({ pm, kind, hook, idsd }) {
  const plan = [
    { rel: 'CLAUDE.md', content: readTpl('CLAUDE.md'), cls: 'managed' },
    { rel: 'AGENTS.md', content: buildAgents(pm, kind), cls: 'user' },
    { rel: '.claude/settings.json', content: buildSettings(pm, hook), cls: 'settings' },
    { rel: 'skills-lock.json', content: readTpl('skills-lock.json'), cls: 'user' },
  ];
  if (idsd) {
    plan.push(...readTree(join(TEMPLATES, 'idsd', 'commands'), '.claude/commands', 'managed'));
    plan.push(...readTree(join(TEMPLATES, 'idsd', 'skills'), '.claude/skills', 'managed'));
  }
  return plan;
}

// ---------- versioning ----------
const sha256 = (s) => 'sha256:' + createHash('sha256').update(s).digest('hex');

function cmpVer(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1; }
  return 0;
}

function readManifest() {
  const p = join(CWD, MANIFEST_REL);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function write(rel, content) {
  const abs = join(CWD, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function backup(rel) {
  const abs = join(CWD, rel);
  let bak = abs + '.bak';
  if (existsSync(bak)) bak = `${abs}.bak.${Date.now()}`;
  copyFileSync(abs, bak);
  return relative(CWD, bak);
}

// ---------- apply the plan ----------
// allowOverwrite is false for fresh/uptodate (create-only) and true for update/adopt.
async function applyPlan(plan, manifest, { allowOverwrite, answers }) {
  const results = { created: [], updated: [], merged: [], skipped: [], review: [], backedUp: [] };
  const hashes = {};

  for (const f of plan) {
    const abs = join(CWD, f.rel);
    const intended = f.content;

    if (!existsSync(abs)) {
      write(f.rel, intended);
      results.created.push(f.rel);
      hashes[f.rel] = sha256(intended);
      continue;
    }

    const onDisk = readFileSync(abs, 'utf8');

    if (f.cls === 'settings') {
      // Additive merge in every mode — it only ever adds allow/deny entries the
      // template introduced (e.g. security fixes), never removes user entries.
      const merged = mergeSettings(onDisk, intended, answers.pm);
      if (merged !== onDisk) { write(f.rel, merged); results.merged.push(f.rel); }
      else results.skipped.push(f.rel);
      hashes[f.rel] = sha256(readFileSync(abs, 'utf8'));
      continue;
    }

    if (sha256(onDisk) === sha256(intended)) {
      results.skipped.push(f.rel);
      hashes[f.rel] = sha256(onDisk);
      continue;
    }

    // On disk differs from the template. In create-only modes, leave it.
    if (!allowOverwrite) {
      results.skipped.push(f.rel);
      hashes[f.rel] = sha256(onDisk);
      continue;
    }

    const installedHash = manifest?.files?.[f.rel] ?? null;
    // With no baseline (adopt) we can't prove the diff is a template change, so
    // treat it as changed and stay conservative.
    const templateChanged = installedHash != null ? installedHash !== sha256(intended) : true;
    const userUntouched = installedHash != null && sha256(onDisk) === installedHash;

    // The template for this file hasn't changed since install — never touch the
    // user's copy, whatever they did to it.
    if (installedHash != null && !templateChanged) {
      results.skipped.push(f.rel);
      hashes[f.rel] = sha256(onDisk);
      continue;
    }

    if (f.cls === 'user') {
      // User-owned files are never auto-overwritten; only flagged for review.
      results.review.push(f.rel);
      hashes[f.rel] = sha256(onDisk);
      continue;
    }

    // Managed file whose template changed.
    if (userUntouched) {
      write(f.rel, intended);
      results.updated.push(f.rel);
      hashes[f.rel] = sha256(intended);
    } else {
      // User-edited (or unknown baseline) → back up, then ask.
      const bak = backup(f.rel);
      results.backedUp.push(bak);
      const take = await confirm(`  ${f.rel} — you've changed it and the template changed too. Take the new version? (your copy saved to ${bak})`, false);
      if (take) { write(f.rel, intended); results.updated.push(f.rel); hashes[f.rel] = sha256(intended); }
      else { results.skipped.push(f.rel); hashes[f.rel] = sha256(onDisk); }
    }
  }

  return { results, hashes };
}

// ---------- gitkeep placeholders ----------
function ensureGitkeeps(created, scaffold) {
  for (const dir of ['.claude/skills', '.claude/commands']) {
    const abs = join(CWD, dir);
    if (scaffold && !existsSync(abs)) mkdirSync(abs, { recursive: true });
    const keepRel = join(dir, '.gitkeep');
    if (existsSync(abs) && !readdirSync(abs).some((e) => e !== '.gitkeep') && !existsSync(join(CWD, keepRel))) {
      write(keepRel, '');
      created.push(keepRel);
    }
  }
}
function pruneGitkeeps() {
  for (const dir of ['.claude/skills', '.claude/commands']) {
    const keepRel = join(dir, '.gitkeep');
    const abs = join(CWD, dir);
    if (existsSync(join(CWD, keepRel)) && existsSync(abs) && readdirSync(abs).some((e) => e !== '.gitkeep')) {
      unlinkSync(join(CWD, keepRel));
    }
  }
}

// ---------- main ----------
async function main() {
  output.write(`\nclaude-config-starter v${VERSION}\nTarget: ${CWD}\n`);
  if (!interactive) output.write('(no TTY detected — using defaults; no overwrites)\n');

  const manifest = readManifest();
  const hasConfig = ['CLAUDE.md', 'AGENTS.md', MANIFEST_REL, '.claude/settings.json'].some((f) => existsSync(join(CWD, f)));

  let mode;
  if (manifest) {
    const c = cmpVer(manifest.starterVersion, VERSION);
    mode = c < 0 ? 'update' : c > 0 ? 'ahead' : 'uptodate';
  } else {
    mode = hasConfig ? 'adopt' : 'fresh';
  }

  // Gather answers.
  let answers;
  let installSkills = false;
  if (mode === 'fresh' || mode === 'adopt') {
    if (mode === 'adopt') output.write('\nExisting config found but no version manifest — recording a baseline so future updates are tracked.\n');
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
    const idsd = await confirm('Add intent-driven development (IDSD) commands?', false);
    answers = { pm, kind, hook, idsd };
    if (mode === 'fresh') installSkills = await confirm('Install skills now?', false);
  } else {
    answers = { pm: 'pnpm', kind: 'backend', hook: false, idsd: false, ...manifest.answers };
    if (mode === 'ahead') {
      output.write(`\nThis config was written by a newer starter (v${manifest.starterVersion}) than this one (v${VERSION}). Only missing files will be created.\n`);
    } else if (mode === 'uptodate') {
      output.write(`\nAlready at v${VERSION}. Checking for missing files only.\n`);
    } else {
      output.write(`\nConfig is v${manifest.starterVersion}; current is v${VERSION}.\n`);
      const go = await confirm('Update this config to the current version?', true);
      if (!go) { output.write('No changes made.\n'); rl?.close(); return; }
    }
  }

  const allowOverwrite = mode === 'update' || mode === 'adopt';
  const plan = buildPlan(answers);
  const { results, hashes } = await applyPlan(plan, manifest, { allowOverwrite, answers });

  // Skills install (fresh only).
  if (installSkills) {
    const source = await ask('Skills source URL (e.g. https://github.com/vercel-labs/skills)');
    if (!source) output.write('No source URL given — skipping skills.\n');
    else {
      const list = (await ask('Skills to add (comma-separated, e.g. find-skills)')).split(',').map((s) => s.trim()).filter(Boolean);
      for (const skill of list) {
        output.write(`\n→ npx skills add ${source} --skill ${skill}\n`);
        const r = spawnSync('npx', ['skills', 'add', source, '--skill', skill], { stdio: 'inherit', cwd: CWD });
        if (r.status !== 0) output.write(`  (skill "${skill}" failed or was skipped)\n`);
      }
    }
  }

  ensureGitkeeps(results.created, mode === 'fresh' || mode === 'adopt');
  pruneGitkeeps();

  // Write / refresh the manifest.
  const now = new Date().toISOString();
  const nextManifest = {
    starterVersion: VERSION,
    installedAt: manifest?.installedAt ?? now,
    updatedAt: now,
    answers,
    files: hashes,
  };
  write(MANIFEST_REL, JSON.stringify(nextManifest, null, 2) + '\n');

  // Report.
  const section = (label, items) => { if (items.length) output.write(`${label}:\n${items.map((f) => `  ${f}`).join('\n')}\n`); };
  output.write('\nDone.\n');
  section('Created', results.created.map((f) => `+ ${f}`));
  section('Updated', results.updated.map((f) => `~ ${f}`));
  section('Merged', results.merged.map((f) => `⤳ ${f}`));
  section('Review (yours — template changed, left as is)', results.review.map((f) => `! ${f}`));
  section('Backed up', results.backedUp.map((f) => `# ${f}`));
  section('Unchanged', results.skipped.map((f) => `= ${f}`));

  if (mode === 'fresh' || mode === 'adopt') output.write('\nNext: fill in the <placeholders> in AGENTS.md.\n');
  if (results.review.length) output.write('\nReview the files above against the current templates and merge anything you want by hand.\n');

  rl?.close();
}

main().catch((err) => {
  console.error(err);
  rl?.close();
  process.exit(1);
});
