#!/usr/bin/env node
/**
 * Architecture check: import boundaries between workspace packages (ARCH-001..ARCH-013).
 *
 * The rule set is small and explicit. Every package declares what it may import, and the checker
 * reads real import statements instead of trusting the manifest, so a hand-written deep relative
 * import into a sibling package is caught even when `package.json` looks clean.
 *
 * Allowed external, Node built-in and relative-within-package imports are ignored.
 *
 * Usage: node tools/arch/check.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/**
 * `mayImport`: workspace packages this package may depend on.
 * `compositionRoot`: may also import the apps it hosts (the shell and the API host).
 */
const BOUNDARIES = {
  '@h-os/contracts': { mayImport: [], compositionRoot: false },
  '@h-os/i18n': { mayImport: [], compositionRoot: false },
  '@h-os/ui': { mayImport: [], compositionRoot: false },
  '@h-os/kernel': { mayImport: ['@h-os/contracts'], compositionRoot: false },
  '@h-os/web-client': {
    mayImport: ['@h-os/contracts', '@h-os/i18n'],
    compositionRoot: false,
  },
  '@h-os/hr-api': { mayImport: ['@h-os/contracts', '@h-os/kernel'], compositionRoot: false },
  '@h-os/hr-web': {
    mayImport: ['@h-os/contracts', '@h-os/i18n', '@h-os/ui', '@h-os/web-client'],
    compositionRoot: false,
  },
  // Composition roots: they exist to mount app packages into one deployable.
  '@h-os/api': { mayImport: ['@h-os/contracts', '@h-os/kernel'], compositionRoot: true },
  '@h-os/web': {
    mayImport: ['@h-os/contracts', '@h-os/i18n', '@h-os/ui', '@h-os/web-client'],
    compositionRoot: true,
  },
};

const problems = [];
const toPosix = (value) => value.split(sep).join('/');
const listDir = (path) => {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
};

function expandWorkspacePatterns() {
  const yaml = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
  const patterns = yaml
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s*'([^']+)'\s*$/)?.[1])
    .filter(Boolean);
  const directories = new Set();
  for (const pattern of patterns) {
    let current = [ROOT];
    for (const segment of pattern.split('/')) {
      const next = [];
      for (const base of current) {
        if (segment === '*') {
          for (const entry of listDir(base)) {
            if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
              next.push(join(base, entry.name));
            }
          }
        } else {
          const candidate = join(base, segment);
          if (existsSync(candidate)) next.push(candidate);
        }
      }
      current = next;
    }
    for (const candidate of current) {
      if (existsSync(join(candidate, 'package.json'))) directories.add(candidate);
    }
  }
  return [...directories].sort();
}

function sourceFiles(packageDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of listDir(dir)) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push(full);
      }
    }
  };
  walk(join(packageDir, 'src'));
  return files;
}

/** `import ... from 'x'`, `import 'x'`, `export ... from 'x'`, `await import('x')`. */
function importSpecifiers(text) {
  const specifiers = [];
  const patterns = [
    /(?:^|\n)\s*import\s+(?:type\s+)?[^'"\n]*?from\s+['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s+(?:type\s+)?[^'"\n]*?from\s+['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

const packages = new Map();
for (const directory of expandWorkspacePatterns()) {
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  packages.set(manifest.name, { directory, manifest });
}

for (const [name, { directory, manifest }] of packages) {
  const boundary = BOUNDARIES[name];
  if (!boundary) {
    problems.push(`${toPosix(relative(ROOT, directory))}: package ${name} has no declared import boundary`);
    continue;
  }

  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
  const allowed = new Set(boundary.mayImport);
  const appDependencies = boundary.compositionRoot
    ? [...packages.keys()].filter((candidate) => candidate.startsWith('@h-os/hr-'))
    : [];

  for (const file of sourceFiles(directory)) {
    const location = toPosix(relative(ROOT, file));
    const text = readFileSync(file, 'utf8');
    for (const specifier of importSpecifiers(text)) {
      if (specifier.startsWith('node:') || !specifier.startsWith('.')) {
        if (!specifier.startsWith('@h-os/')) continue;
        const target = specifier.split('/').slice(0, 2).join('/');
        if (target === name) continue;
        if (!allowed.has(target) && !appDependencies.includes(target)) {
          problems.push(`${location}: ${name} may not import ${target} (ARCH-001, ARCH-013)`);
        } else if (!declared.has(target)) {
          problems.push(`${location}: ${target} is imported but not declared in ${name}/package.json`);
        }
        continue;
      }

      // Relative imports must stay inside the package. Escaping means reaching into another
      // package's private files, which the manifest-based boundary cannot see.
      const targetPath = resolve(dirname(file), specifier);
      const packageRoot = resolve(directory);
      if (!toPosix(targetPath).startsWith(toPosix(packageRoot) + '/')) {
        problems.push(
          `${location}: relative import "${specifier}" escapes ${name} (use @h-os/contracts instead)`,
        );
      }
    }
  }

  // The manifest itself must not promise dependencies the boundary forbids.
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    if (!dependency.startsWith('@h-os/') || dependency === name) continue;
    if (!allowed.has(dependency) && !appDependencies.includes(dependency)) {
      problems.push(`${name}/package.json: declares forbidden dependency ${dependency}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`Architecture check failed with ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`Architecture is valid: ${packages.size} packages checked.`);
