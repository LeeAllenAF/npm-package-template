import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, parseGitHubRepo, validateName, initialize } from './init.mjs';

const input = { name: '@sample/library', repo: 'someone/a-library', description: 'A small library', author: 'Example Author' };
test('parses CLI flags', () => assert.deepEqual(parseArgs(['--repo=a/b', '--yes', '--dry-run']), { repo:'a/b', yes: true, dryrun: true }));
test('rejects unknown flags', () => assert.throws(() => parseArgs(['--wat'])));
test('infers SSH and HTTPS GitHub origins', () => {
  assert.equal(parseGitHubRepo('git@github.com:my-org/repo.git'), 'my-org/repo');
  assert.equal(parseGitHubRepo('https://github.com/my-org/repo.git'), 'my-org/repo');
  assert.equal(parseGitHubRepo('https://gitlab.com/a/b'), null);
});
test('validates package names', () => {
  assert.ok(validateName('@sample/library'));
  for (const name of ['UpperCase', 'a b', '@missing', 'bad/name', '../escape', '']) assert.equal(validateName(name), false);
});
test('initialization is idempotence-safe and supports dry run', () => {
  const temp = mkdtempSync(join(tmpdir(), 'npm-template-'));
  try {
    mkdirSync(join(temp, 'scripts'));
    writeFileSync(join(temp, 'package.json'), JSON.stringify({ name: 'replace-me-package', scripts: { init: 'node scripts/init.mjs' } }));
    writeFileSync(join(temp, 'scripts/init.mjs'), 'stub');
    initialize(temp, input, { dryRun: true });
    assert.equal(JSON.parse(readFileSync(join(temp, 'package.json'))).name, 'replace-me-package');
    initialize(temp, input);
    const pkg = JSON.parse(readFileSync(join(temp, 'package.json')));
    assert.equal(pkg.name, '@sample/library');
    assert.equal(pkg.repository.url, 'git+https://github.com/someone/a-library.git');
    assert.equal(pkg.scripts.init, undefined);
    assert.equal(existsSync(join(temp, 'scripts/init.mjs')), false);
    assert.match(readFileSync(join(temp, 'README.md'), 'utf8'), /@sample\/library/);
    assert.throws(() => initialize(temp, input), /already been initialized/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
