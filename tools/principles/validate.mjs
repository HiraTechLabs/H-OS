#!/usr/bin/env node
/**
 * Validates the rule and decision files the resolver depends on (README.md, DEC-002, DEC-006).
 *
 * The resolver parses principle files mechanically, so a malformed heading silently drops a rule.
 * This script fails the build instead: heading grammar, unique IDs, the tag vocabulary, override and
 * relaxation targets, and the decision front matter contract.
 *
 * Usage: node tools/principles/validate.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const TAGS = new Set([
  '*', 'api', 'db', 'migration', 'domain', 'events', 'auth', 'permissions', 'org-tree', 'money',
  'audit', 'files', 'jobs', 'config', 'deps', 'logging', 'testing', 'git', 'perf', 'ui', 'i18n',
  'a11y', 'docs', 'graph', 'decision', 'ai', 'infra',
]);
const LEVELS = new Set(['must', 'should']);
const ENFORCEMENT = new Set(['lint', 'arch-test', 'test', 'ci', 'review']);
const STATUSES = new Set(['proposed', 'accepted', 'superseded', 'rejected']);
const RULE_ID = /^[A-Z][A-Z-]*-[0-9]{3}$/;
const DECISION_ID = /^DEC-[0-9]{4}$/;
const RULE_HEADING = /^###\s+(\S+)\s+\[([a-z-]+)\|([a-z-]+)\]\s+(.+?)\s*$/;

const problems = [];
const fail = (file, message) => problems.push(`${relative(ROOT, file).split('\\').join('/')}: ${message}`);
const listDir = (path) => {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
};

/** Every `*.md` under a directory, ignoring the human READMEs the resolver skips. */
function markdownFiles(directory) {
  return listDir(directory)
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('README'))
    .map((entry) => join(directory, entry.name))
    .sort();
}

function appPrincipleDirectories() {
  const directories = [];
  for (const app of listDir(join(ROOT, 'apps'))) {
    const directory = join(ROOT, 'apps', app.name, '.caliper', 'principles');
    if (app.isDirectory() && existsSync(directory)) directories.push(directory);
  }
  return directories.sort();
}

/** Parses the small YAML subset the decision front matter uses: scalars, block lists, `[]`, `null`. */
function parseFrontMatter(file) {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const body = text.slice(3, end).split(/\r?\n/);
  const data = {};
  let currentKey = null;
  for (const line of body) {
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(item[1].trim().replace(/^'(.*)'$/, '$1'));
      continue;
    }
    const pair = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!pair) continue;
    const [, key, raw] = pair;
    currentKey = key;
    const value = raw.trim();
    if (value === '[]') data[key] = [];
    else if (value === 'null') data[key] = null;
    else data[key] = value === '' ? '' : value.replace(/^'(.*)'$/, '$1');
  }
  return data;
}

function collectRules() {
  const ruleIds = new Map();
  const files = [
    ...markdownFiles(join(ROOT, '.caliper', 'principles')),
    ...appPrincipleDirectories().flatMap((directory) => markdownFiles(directory)),
  ];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    let inFence = false;
    for (const [index, line] of lines.entries()) {
      if (line.trim().startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence || !line.startsWith('### ')) continue;

      const match = line.match(RULE_HEADING);
      if (!match) {
        fail(file, `line ${index + 1}: malformed rule heading "${line.trim()}"`);
        continue;
      }
      const [, id, level, enforcement, tagList] = match;
      if (!RULE_ID.test(id)) fail(file, `line ${index + 1}: rule id "${id}" is not <DOMAIN>-<NNN>`);
      if (ruleIds.has(id)) fail(file, `line ${index + 1}: duplicate rule id ${id} (also in ${ruleIds.get(id)})`);
      else ruleIds.set(id, relative(ROOT, file).split('\\').join('/'));
      if (!LEVELS.has(level)) fail(file, `line ${index + 1}: unknown level "${level}"`);
      if (!ENFORCEMENT.has(enforcement)) fail(file, `line ${index + 1}: unknown enforcement "${enforcement}"`);
      const tags = tagList.split(',').map((tag) => tag.trim());
      if (tags.length === 0 || tags.some((tag) => tag === '')) fail(file, `line ${index + 1}: ${id} has no tags`);
      for (const tag of tags) {
        if (!TAGS.has(tag)) fail(file, `line ${index + 1}: ${id} uses unknown tag "${tag}" (new tags need a Decision)`);
      }
    }

    // Override and relaxation lines must point at a real rule.
    for (const [index, line] of lines.entries()) {
      const directive = line.match(/^\s*(overrides|relaxes):\s*(\S+)\s*$/);
      if (!directive) continue;
      const [, kind, target] = directive;
      if (!ruleIds.has(target)) fail(file, `line ${index + 1}: ${kind} target ${target} is not a declared rule`);
      if (kind === 'relaxes') {
        const decision = lines
          .slice(index + 1, index + 4)
          .map((candidate) => candidate.match(/^\s*decision:\s*(\S+)\s*$/)?.[1])
          .find(Boolean);
        if (!decision) {
          fail(file, `line ${index + 1}: relaxing ${target} requires "decision: DEC-NNNN" on the next line (DEC-006)`);
        } else if (!DECISION_ID.test(decision)) {
          fail(file, `line ${index + 1}: "${decision}" is not a decision id`);
        }
      }
    }
  }
  return ruleIds;
}

function validateDecisions() {
  const directory = join(ROOT, '.caliper', 'decisions');
  const files = markdownFiles(directory);
  const byId = new Map();

  for (const file of files) {
    const name = file.split('\\').pop();
    const frontMatter = parseFrontMatter(file);
    if (!frontMatter) {
      fail(file, 'missing front matter (DEC-002)');
      continue;
    }
    for (const key of ['id', 'title', 'status', 'date', 'tags', 'affects', 'relaxes', 'supersedes']) {
      if (!(key in frontMatter)) fail(file, `front matter is missing "${key}" (DEC-002)`);
    }
    const id = frontMatter.id;
    if (!DECISION_ID.test(id ?? '')) fail(file, `id "${id}" is not DEC-NNNN`);
    if (!name.startsWith(`${id}-`)) fail(file, `file name does not start with "${id}-" (DEC-002)`);
    if (byId.has(id)) fail(file, `duplicate decision id ${id} (also in ${byId.get(id)})`);
    byId.set(id, relative(ROOT, file).split('\\').join('/'));
    if (!STATUSES.has(frontMatter.status)) fail(file, `unknown status "${frontMatter.status}"`);

    const relaxes = Array.isArray(frontMatter.relaxes) ? frontMatter.relaxes : [];
    const hasReviewBy =
      typeof frontMatter.review_by === 'string' && frontMatter.review_by.trim().length > 0;
    if (relaxes.length > 0 && !hasReviewBy) {
      fail(file, 'relaxes a rule but has no review_by date (DEC-006)');
    }
    if (relaxes.length === 0 && hasReviewBy) {
      fail(file, 'review_by is set but no rule is relaxed');
    }
    if (frontMatter.supersedes && !DECISION_ID.test(frontMatter.supersedes)) {
      fail(file, `supersedes "${frontMatter.supersedes}" is not a decision id`);
    }
    if (frontMatter.status === 'superseded' && !frontMatter.supersedes) {
      fail(file, 'a superseded decision must name its successor in supersedes');
    }
  }

  for (const [id, path] of byId) {
    const frontMatter = parseFrontMatter(join(ROOT, path));
    if (frontMatter?.supersedes && !byId.has(frontMatter.supersedes)) {
      fail(join(ROOT, path), `supersedes ${frontMatter.supersedes}, which does not exist`);
    }
    if (id === frontMatter?.supersedes) fail(join(ROOT, path), 'a decision cannot supersede itself');

    // A superseded decision's designated successor must not be superseded by another decision back to itself (no cycles).
    if (frontMatter?.status === 'superseded' && frontMatter?.supersedes) {
      const successorPath = byId.get(frontMatter.supersedes);
      const successorFM = successorPath ? parseFrontMatter(join(ROOT, successorPath)) : null;
      if (successorFM?.supersedes === id) {
        fail(join(ROOT, path), `mutual/circular supersedes loop detected between ${id} and ${frontMatter.supersedes}`);
      }
    }
  }

  return byId;
}

const rules = collectRules();
const decisions = validateDecisions();

if (problems.length > 0) {
  console.error(`Governance validation failed with ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `Governance is valid: ${rules.size} rules across ${1 + appPrincipleDirectories().length} principle sets, ${decisions.size} decisions.`,
);
