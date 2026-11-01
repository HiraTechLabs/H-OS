#!/usr/bin/env node
/**
 * Generates the architecture graph from code and configuration (GRAPH-002).
 *
 * Structural facts are derived here: workspace packages, their `@h-os` dependencies, the database
 * schemas each package defines, and the event types declared in the contracts package. Only
 * descriptions, ownership and external systems are hand-written, in `overrides.json` (GRAPH-004).
 *
 * Deterministic output: every list is sorted, so `--check` fails only on a real change.
 *
 * Usage:
 *   node tools/graph/generate.mjs           # write .caliper/graph/graph.json and graph.md
 *   node tools/graph/generate.mjs --check   # fail when the committed graph is stale
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const GRAPH_DIR = join(ROOT, '.caliper', 'graph');
const GRAPH_JSON = join(GRAPH_DIR, 'graph.json');
const GRAPH_MD = join(GRAPH_DIR, 'graph.md');
const WORKSPACE = join(ROOT, 'pnpm-workspace.yaml');
const EVIDENCE = join(ROOT, 'platform', 'contracts', 'src', 'events.ts');

const toPosix = (value) => value.split(sep).join('/');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));const listDir = (path) => {
  try {
    return readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
};

/** Expands the simple `a/*` / `a/*\\/b` patterns used by pnpm-workspace.yaml. */
function expandWorkspacePatterns(yaml) {
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
          if (existsSync(candidate) && statSync(candidate).isDirectory()) next.push(candidate);
        }
      }
      current = next;
    }
    for (const directory of current) {
      if (existsSync(join(directory, 'package.json'))) directories.add(directory);
    }
  }
  return [...directories].sort();
}

/** Collects every TypeScript source file under a package, excluding build output and tests. */
function sourceFiles(packageDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of listDir(dir)) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', 'test', 'coverage', 'migrations'].includes(entry.name)) continue;
        walk(full);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        files.push(full);
      }
    }
  };
  walk(join(packageDir, 'src'));
  return files;
}

/** Tables declared as `<schema>.table('name', ...)` in a package's sources. */
function ownedSchemas(packageDir) {
  const schemas = new Map();
  for (const file of sourceFiles(packageDir)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\b(\w+)Schema\.table\(\s*'([a-z0-9_]+)'/g)) {
      const [, schema, table] = match;
      if (!schemas.has(schema)) schemas.set(schema, new Set());
      schemas.get(schema).add(table);
    }
  }
  return [...schemas.entries()]
    .map(([schema, tables]) => ({ schema, tables: [...tables].sort() }))
    .sort((a, b) => a.schema.localeCompare(b.schema));
}

/** Event types declared as `export const XEventType = { ... } as const` in the contracts package. */
function declaredEvents() {
  const text = readFileSync(EVIDENCE, 'utf8');
  const events = [];
  for (const block of text.matchAll(/export const (\w+EventType) = \{([\s\S]*?)\} as const;/g)) {
    for (const value of block[2].matchAll(/'([a-z0-9][a-z0-9.-]+\.v\d+)'/g)) {
      events.push(value[1]);
    }
  }
  return events.sort();
}

function nodeTypeFor(name) {
  if (name === '@h-os/contracts') return 'contract';
  if (name === '@h-os/api' || name === '@h-os/web') return 'app';
  return 'module';
}

function owningAppFor(name) {
  return name.startsWith('@h-os/hr-') ? 'h-hr' : 'h-os';
}

/** Convention documented in `graph.md`: the app module that records the event owns its publication. */
function publisherFor(event) {
  return event.startsWith('hr.') ? '@h-os/hr-api' : '@h-os/kernel';
}

function buildGraph() {
  const overrides = readJson(join(GRAPH_DIR, 'overrides.json'));
  const descriptions = overrides.descriptions ?? {};
  const packages = expandWorkspacePatterns(readFileSync(WORKSPACE, 'utf8'));

  const nodes = [];
  const edges = [];
  const runtimeDependencies = new Map();

  for (const directory of packages) {
    const manifest = readJson(join(directory, 'package.json'));
    const name = manifest.name;
    const schemas = ownedSchemas(directory);
    const dependencies = Object.keys(manifest.dependencies ?? {})
      .filter((dependency) => dependency.startsWith('@h-os/'))
      .sort();
    runtimeDependencies.set(name, dependencies);

    nodes.push({
      id: name,
      type: nodeTypeFor(name),
      owningApp: owningAppFor(name),
      path: toPosix(relative(ROOT, directory)),
      description: descriptions[name] ?? `Workspace package ${name}.`,
      data: schemas.flatMap((entry) => entry.tables.map((table) => `${entry.schema}.${table}`)),
      contract: name === '@h-os/contracts' ? 'platform/contracts/src/index.ts' : null,
    });

    for (const dependency of dependencies) {
      edges.push({
        from: name,
        to: dependency,
        type: 'depends-on',
        reason: 'runtime workspace dependency',
      });
    }

    for (const entry of schemas) {
      edges.push({
        from: name,
        to: 'datastore:postgres',
        type: 'owns-data',
        reason: `defines PostgreSQL schema "${entry.schema}"`,
      });
    }
  }

  nodes.push({
    id: 'datastore:postgres',
    type: 'datastore',
    owningApp: 'h-os',
    path: null,
    description: 'PostgreSQL 16. One database, one schema per owner; no cross-schema joins.',
    data: nodes.flatMap((node) => node.data),
    contract: null,
  });

  for (const event of declaredEvents()) {
    const publisher = publisherFor(event);
    if (!runtimeDependencies.has(publisher)) continue;
    nodes.push({
      id: event,
      type: 'event',
      owningApp: owningAppFor(publisher),
      path: 'platform/contracts/src/events.ts',
      description: `Versioned domain event ${event}.`,
      data: [],
      contract: `platform/contracts/src/events.ts#${event}`,
    });
    edges.push({
      from: publisher,
      to: event,
      type: 'publishes',
      reason: 'recorded in the transactional outbox with the state change (ARCH-007)',
    });
  }

  for (const external of overrides.externalSystems ?? []) {
    nodes.push({
      id: external.id,
      type: 'external-system',
      owningApp: 'h-os',
      path: null,
      description: external.description ?? `External system ${external.id}.`,
      data: [],
      contract: null,
    });
  }

  // GRAPH-006: one app may not reach into another app's packages. Platform packages are shared
  // infrastructure, so only app-to-app edges are rejected; cross-app data goes through contracts.
  const ownerOf = new Map(
    nodes
      .filter((node) => node.type !== 'event' && node.type !== 'datastore')
      .map((node) => [node.id, node.owningApp]),
  );
  for (const edge of edges) {
    if (edge.type !== 'depends-on') continue;
    const fromOwner = ownerOf.get(edge.from);
    const toOwner = ownerOf.get(edge.to);
    if (fromOwner && toOwner && fromOwner !== 'h-os' && toOwner !== 'h-os' && fromOwner !== toOwner) {
      throw new Error(
        `${edge.from} (${fromOwner}) depends on ${edge.to} (${toOwner}): cross-app imports must go through @h-os/contracts (GRAPH-006).`,
      );
    }
  }

  const unique = new Map();
  for (const edge of edges) unique.set(`${edge.from}|${edge.type}|${edge.to}`, edge);

  return {
    generatedBy: 'tools/graph/generate.mjs',
    nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...unique.values()].sort(
      (a, b) => a.from.localeCompare(b.from) || a.type.localeCompare(b.type) || a.to.localeCompare(b.to),
    ),
  };
}

const mermaidId = (id) => id.replace(/[^A-Za-z0-9_]/g, '_');

function renderMarkdown(graph) {
  const packages = graph.nodes.filter((node) => node.type !== 'event' && node.type !== 'datastore');
  const events = graph.nodes.filter((node) => node.type === 'event');
  const lines = [];

  lines.push('# Architecture graph', '');
  lines.push('<!-- Generated by tools/graph/generate.mjs. Do not edit by hand (GRAPH-002). -->', '');
  lines.push(
    `${graph.nodes.length} nodes and ${graph.edges.length} edges. Descriptions and ownership are hand-written in ` +
      '`overrides.json`; everything else is derived from the workspace, the sources and `pnpm-workspace.yaml`.',
    '',
  );

  lines.push('## Package dependencies', '');
  lines.push('```mermaid', 'flowchart LR');
  for (const node of packages) {
    lines.push(`  ${mermaidId(node.id)}["${node.id}<br/><small>${node.type}</small>"]`);
  }
  lines.push(`  ${mermaidId('datastore:postgres')}[("postgres")]`);
  for (const edge of graph.edges) {
    if (edge.type === 'depends-on') {
      lines.push(`  ${mermaidId(edge.from)} --> ${mermaidId(edge.to)}`);
    } else if (edge.type === 'owns-data') {
      lines.push(`  ${mermaidId(edge.from)} -. owns .-> ${mermaidId(edge.to)}`);
    }
  }
  lines.push('```', '');

  lines.push('## Events', '');
  lines.push('```mermaid', 'flowchart LR');
  for (const edge of graph.edges.filter((candidate) => candidate.type === 'publishes')) {
    lines.push(`  ${mermaidId(edge.from)} -- "${edge.to}" --> ${mermaidId(edge.from)}_${mermaidId(edge.to)}(["event"])`);
  }
  lines.push('```', '');

  lines.push('## Nodes', '');
  lines.push('| id | type | owning app | path | data |', '|---|---|---|---|---|');
  for (const node of graph.nodes) {
    const data = node.data.length > 0 ? `${node.data.length} table(s)` : '';
    lines.push(`| \`${node.id}\` | ${node.type} | ${node.owningApp} | ${node.path ?? ''} | ${data} |`);
  }
  lines.push('');

  if (events.length > 0) {
    lines.push('## Event catalogue', '');
    lines.push('| event | publisher |', '|---|---|');
    for (const event of events) {
      const publisher = graph.edges.find(
        (edge) => edge.to === event.id && edge.type === 'publishes',
      );
      lines.push(`| \`${event.id}\` | \`${publisher?.from ?? ''}\` |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  const check = process.argv.includes('--check');
  const graph = buildGraph();
  const json = `${JSON.stringify(JSON.parse(JSON.stringify(graph)), null, 2)}\n`;
  const markdown = renderMarkdown(graph);

  if (check) {
    const stale = [];
    if (!existsSync(GRAPH_JSON) || readFileSync(GRAPH_JSON, 'utf8') !== json) stale.push(GRAPH_JSON);
    if (!existsSync(GRAPH_MD) || readFileSync(GRAPH_MD, 'utf8') !== markdown) stale.push(GRAPH_MD);
    if (stale.length > 0) {
      console.error('Architecture graph is stale (GRAPH-002, GRAPH-003). Run: pnpm graph');
      for (const file of stale) console.error(`  differs: ${toPosix(relative(ROOT, file))}`);
      process.exit(1);
    }
    console.log(`Architecture graph is current (${graph.nodes.length} nodes, ${graph.edges.length} edges).`);
    return;
  }

  mkdirSync(GRAPH_DIR, { recursive: true });
  writeFileSync(GRAPH_JSON, json);
  writeFileSync(GRAPH_MD, markdown);
  console.log(`Wrote ${toPosix(relative(ROOT, GRAPH_JSON))} and graph.md (${graph.nodes.length} nodes, ${graph.edges.length} edges).`);
}

main();
