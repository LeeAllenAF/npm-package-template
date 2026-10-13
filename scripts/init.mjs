#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';

const TEMPLATE = 'LeeAllenAF/npm-package-template';
const flags = new Set(['--name', '--repo', '--description', '--author', '--yes', '--dry-run', '--help']);

export function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const [flag, inline] = args[i].split('=', 2);
    if (!flags.has(flag)) throw new Error(`Unknown option: ${flag}`);
    if (['--yes', '--dry-run', '--help'].includes(flag)) {
      if (inline !== undefined) throw new Error(`${flag} takes no value`);
      options[flag.slice(2).replace('-', '')] = true;
    } else {
      const value = inline ?? args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
      options[flag.slice(2)] = value;
    }
  }
  return options;
}
export function parseGitHubRepo(remote) {
  if (!remote) return null;
  const match = remote.trim().match(/^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https?:\/\/github\.com\/)([\w-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
  return match ? `${match[1]}/${match[2]}` : null;
}
export function validateName(name) {
  if (!name || name.length > 214 || name !== name.toLowerCase() || /\s/.test(name) || name.startsWith('.') || name.startsWith('_')) return false;
  return /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/.test(name);
}
export function validateRepo(repo) {
  return /^[\w-]+\/[\w.-]+$/.test(repo) && !repo.endsWith('/.');
}
function gitRemote(cwd) {
  try { return execFileSync('git', ['remote', 'get-url', 'origin'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}
export function initialize(cwd, input, { dryRun = false } = {}) {
  const packagePath = resolve(cwd, 'package.json');
  if (!existsSync(packagePath)) throw new Error('Run from the package repository root.');
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  if (pkg.name !== 'replace-me-package') throw new Error('Package has already been initialized.');
  const { name, repo, description, author } = input;
  if (!validateName(name)) throw new Error('Invalid npm package name.');
  if (!validateRepo(repo)) throw new Error('Invalid GitHub repository; expected owner/repository.');
  if (repo.toLowerCase() === TEMPLATE.toLowerCase()) throw new Error('Create a repository from this template; do not initialize the original template.');
  if (!description?.trim() || !author?.trim()) throw new Error('Description and author must be non-empty.');
  const lockPath = resolve(cwd, 'package-lock.json');
  if (existsSync(lockPath)) throw new Error('Existing package-lock.json detected. Initialize before installing dependencies.');
  const url = `https://github.com/${repo}`;
  pkg.name = name; pkg.description = description.trim(); pkg.author = author.trim();
  pkg.repository = { type: 'git', url: `git+${url}.git` };
  pkg.homepage = `${url}#readme`;
  pkg.bugs = { url: `${url}/issues` };
  delete pkg.scripts.init;
  const readme = `# ${name}

${description.trim()}

[![CI](${url}/actions/workflows/ci.yml/badge.svg)](${url}/actions/workflows/ci.yml)

## Installation

\`\`\`sh
npm install ${name}
\`\`\`

## Usage

\`\`\`ts
import { greet } from '${name}';
console.log(greet('world'));
\`\`\`

Replace this example with your public API.

## Development

Run \`npm ci\` and \`npm run check\`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Releases

Configure npm trusted publishing for \`${repo}\` with workflow \`publish.yml\` and GitHub environment \`npm\`. Tag a version with \`vX.Y.Z\` to publish.

## License

MIT
`;
  if (!dryRun) {
    writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
    writeFileSync(resolve(cwd, 'README.md'), readme);
    rmSync(resolve(cwd, 'scripts/init.mjs'));
    rmSync(resolve(cwd, 'scripts/init.test.mjs'), { force: true });
  }
  return ['package.json', 'README.md', 'scripts/init.mjs and scripts/init.test.mjs (removed)'];
}
async function main() {
  const cwd = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('npm run init -- [--repo owner/name] [--name npm-name] [--description text] [--author name] [--yes] [--dry-run]');
    return;
  }
  const remote = parseGitHubRepo(gitRemote(cwd));
  const candidate = args.repo ?? remote ?? process.env.GITHUB_REPOSITORY ?? '';
  const inferredName = candidate ? candidate.split('/')[1].toLowerCase() : '';
  if (args.yes && (!candidate || !args.description || !args.author)) throw new Error('--yes requires repository, description and author');
  const rl = args.yes ? null : createInterface({ input: stdin, output: stdout });
  try {
    const ask = async (label, suggested = '') => {
      if (!rl) return suggested;
      const answer = (await rl.question(`${label}${suggested ? ` [${suggested}]` : ''}: `)).trim();
      return answer || suggested;
    };
    const repo = args.repo ?? await ask('GitHub repository (owner/name)', candidate);
    const name = args.name ?? await ask('npm package name', inferredName);
    const description = args.description ?? await ask('Description');
    const author = args.author ?? await ask('Author', 'Lee Allen');
    const files = initialize(cwd, { repo, name, description, author }, { dryRun: args.dryrun });
    console.log(`${args.dryrun ? 'Would update' : 'Initialized'} ${name}: ${files.join(', ')}`);
    if (!args.dryrun) console.log('Next: npm install && npm run check && npm pack --dry-run; commit package-lock.json.');
  } finally { await rl?.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Initialization failed: ${error.message}`); process.exitCode = 1; });
}
