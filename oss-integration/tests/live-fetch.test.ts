import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

import { fetchLiveRepository, spdxFromText } from '../src/repository/live-fetch.js';
import { extractTgz, riskPriority } from '../src/repository/tar.js';
import { scanSecurity, inspectPackageJson } from '../src/security/gate.js';

/**
 * The live path is exercised offline here by injecting `fetchImpl`, so these
 * assertions are deterministic. `tests/live-repository.test.ts` covers the real
 * network and is opt-in.
 */

// --- a tiny ustar writer, so the extractor is tested against a real archive ---
function tar(files: { path: string; body: string }[]): Buffer {
  const blocks: Buffer[] = [];
  for (const f of files) {
    const header = Buffer.alloc(512);
    header.write(f.path.slice(0, 100), 0, 'utf8');
    header.write('000644 \0', 100, 'utf8');
    header.write('000000 \0', 108, 'utf8');
    header.write('000000 \0', 116, 'utf8');
    const size = Buffer.byteLength(f.body);
    header.write(size.toString(8).padStart(11, '0') + ' ', 124, 'utf8');
    header.write('00000000000 ', 136, 'utf8');
    header.write('        ', 148, 'utf8'); // checksum placeholder
    header.write('0', 156, 'utf8');
    header.write('ustar\0' + '00', 257, 'utf8');
    let sum = 0;
    for (const b of header) sum += b;
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'utf8');
    blocks.push(header);
    const body = Buffer.alloc(Math.ceil(size / 512) * 512);
    body.write(f.body, 0, 'utf8');
    blocks.push(body);
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

interface Route {
  body?: string | Buffer;
  status?: number;
}

function stubFetch(routes: Record<string, Route>): typeof fetch {
  return (async (url: string | URL) => {
    const key = String(url);
    const route = routes[key];
    if (!route || route.status === 404) {
      return new Response(null, { status: 404 });
    }
    const body = route.body ?? '';
    return new Response(typeof body === 'string' ? body : new Uint8Array(body), { status: route.status ?? 200 });
  }) as unknown as typeof fetch;
}

const REF = { owner: 'acme', name: 'widget', id: 'acme/widget', url: 'https://github.com/acme/widget' };
const RAW = 'https://raw.githubusercontent.com/acme/widget';

test('tar: the extractor reads a real ustar archive', () => {
  const buf = tar([
    { path: 'package/package.json', body: '{"name":"widget"}' },
    { path: 'package/src/index.js', body: 'export const a = 1;' },
  ]);
  const out = extractTgz(buf, { maxEntries: 10, maxFileBytes: 1000, readExtensions: ['.js', '.json'] });
  assert.deepEqual(out.paths, ['package/package.json', 'package/src/index.js']);
  assert.equal(out.entries.find((e) => e.path.endsWith('index.js'))?.text, 'export const a = 1;');
});

test('tar: the scan budget goes to risk-bearing files, not translation data', () => {
  assert.ok(riskPriority('package/package.json') < riskPriority('package/src/index.js'));
  assert.ok(riskPriority('package/scripts/setup.sh') < riskPriority('package/src/index.js'));
  assert.ok(riskPriority('package/src/index.js') < riskPriority('package/locales/ja.json'));

  const files = [
    ...Array.from({ length: 20 }, (_, i) => ({ path: `package/locales/l${i}.json`, body: '{}' })),
    { path: 'package/scripts/install.sh', body: 'echo hi' },
  ];
  const out = extractTgz(tar(files), {
    maxEntries: 3,
    maxFileBytes: 1000,
    readExtensions: ['.json', '.sh'],
  });
  assert.ok(
    out.entries.some((e) => e.path.endsWith('install.sh')),
    'the install script must survive the cap even though 20 locale files came first',
  );
  assert.equal(out.truncated, true);
});

test('live: licence file text outranks a self-declared metadata field', () => {
  assert.equal(spdxFromText('                              Apache License\n                        Version 2.0'), 'Apache-2.0');
  assert.equal(spdxFromText('Mozilla Public License Version 2.0'), 'MPL-2.0');
  assert.equal(spdxFromText('Permission is hereby granted, free of charge'), 'MIT');
  assert.equal(spdxFromText('some prose that is not a licence'), null);
});

test('live: a full fetch establishes real facts and upgrades the evidence class', async () => {
  const tarball = tar([
    { path: 'package/package.json', body: '{"name":"widget","dependencies":{"left-pad":"^1.0.0"}}' },
    { path: 'package/src/index.js', body: 'export const run = () => 1;' },
    { path: 'package/test/index.test.js', body: 'test("x", () => {});' },
  ]);
  const profileFetch = stubFetch({
    [`${RAW}/main/README.md`]: { body: '# widget\n' },
    [`${RAW}/main/LICENSE`]: { body: '                              Apache License\n                        Version 2.0\n' },
    [`${RAW}/main/package.json`]: { body: '{"name":"widget","description":"a widget"}' },
    'https://registry.npmjs.org/widget': {
      body: JSON.stringify({
        'dist-tags': { latest: '2.1.0' },
        time: { modified: '2026-08-01T00:00:00.000Z' },
        versions: {
          '2.1.0': {
            name: 'widget',
            description: 'a widget',
            license: 'MIT',
            dependencies: { 'left-pad': '^1.0.0' },
            scripts: { test: 'node --test' },
            dist: { tarball: 'https://registry.npmjs.org/widget/-/widget-2.1.0.tgz' },
          },
        },
      }),
    },
    'https://registry.npmjs.org/widget/-/widget-2.1.0.tgz': { body: tarball },
  });

  const { profile, attempts } = await fetchLiveRepository(REF, { fetchImpl: profileFetch });

  assert.equal(profile.source, 'live-github');
  // The LICENSE file says Apache-2.0 while package metadata claims MIT. The
  // file must win: it is the licence that actually ships with the code.
  assert.equal(profile.licenseSpdx, 'Apache-2.0');
  assert.equal(profile.latestRelease, '2.1.0');
  assert.equal(profile.lastMeaningfulUpdate, '2026-08-01');
  assert.equal(profile.tests, 'PRESENT');
  assert.deepEqual(profile.dependencies, ['left-pad']);
  for (const artifact of ['README', 'license-file', 'package-metadata', 'source']) {
    assert.ok(profile.inspected.includes(artifact), `expected ${artifact} to be inspected`);
  }
  // Real source reached the scanner, which is the whole point of --live.
  assert.ok(Object.keys(profile.artifacts).some((k) => k.startsWith('npm:')));
  assert.ok(attempts.every((a) => a.url.length > 0));
  assert.ok(attempts.some((a) => a.what === 'default branch' && a.ok));
});

test('live: master is tried when main does not serve, and the probe is disclosed', async () => {
  const f = stubFetch({ [`${RAW}/master/README.md`]: { body: '# widget' } });
  const { profile, attempts } = await fetchLiveRepository(REF, { fetchImpl: f });
  const branchAttempt = attempts.find((a) => a.what === 'default branch');
  assert.ok(branchAttempt?.ok);
  assert.match(branchAttempt.detail, /not a confirmed default/);
  assert.equal(profile.documentation, 'PRESENT');
});

test('live: an unreachable repository yields UNKNOWN everywhere, never a guess', async () => {
  const { profile } = await fetchLiveRepository(REF, { fetchImpl: stubFetch({}) });
  assert.equal(profile.licenseSpdx, 'UNKNOWN');
  assert.equal(profile.latestRelease, 'UNKNOWN');
  assert.equal(profile.lastMeaningfulUpdate, 'UNKNOWN');
  assert.equal(profile.tests, 'UNKNOWN');
  assert.equal(profile.documentation, 'UNKNOWN');
  assert.deepEqual(profile.inspected, []);
  assert.equal(profile.licenseEvidence.class, 'UNKNOWN');
});

test('live: tests absent from an npm tarball are UNKNOWN, not ABSENT', async () => {
  const tarball = tar([{ path: 'package/src/index.js', body: 'export const a = 1;' }]);
  const f = stubFetch({
    [`${RAW}/main/README.md`]: { body: '# widget' },
    [`${RAW}/main/package.json`]: { body: '{"name":"widget"}' },
    'https://registry.npmjs.org/widget': {
      body: JSON.stringify({
        'dist-tags': { latest: '1.0.0' },
        versions: { '1.0.0': { name: 'widget', dist: { tarball: 'https://registry.npmjs.org/widget/-/widget-1.0.0.tgz' } } },
      }),
    },
    'https://registry.npmjs.org/widget/-/widget-1.0.0.tgz': { body: tarball },
  });
  const { profile } = await fetchLiveRepository(REF, { fetchImpl: f });
  assert.equal(profile.tests, 'UNKNOWN', 'npm tarballs routinely exclude tests, so their absence proves nothing');
});

// --- security gate corrections -------------------------------------------

test('security: dependency risk is judged structurally, not by regex over any URL', () => {
  const authorsOnly = JSON.stringify({
    name: 'x',
    contributors: [{ name: 'Someone', url: 'http://example.com/' }],
    dependencies: { lodash: '^4.0.0' },
  });
  assert.deepEqual(inspectPackageJson('package.json', authorsOnly), [], 'an author URL is not a dependency');

  const gitDep = JSON.stringify({ dependencies: { thing: 'git+ssh://git@host/x.git' } });
  const found = inspectPackageJson('package.json', gitDep);
  assert.equal(found.length, 1);
  assert.equal(found[0]?.risk, 'suspicious-dependency');
});

test('security: install scripts are reported from the scripts map only', () => {
  const withInstall = JSON.stringify({ scripts: { postinstall: 'node ./setup.js', test: 'jest' } });
  const found = inspectPackageJson('package.json', withInstall);
  assert.equal(found.length, 1);
  assert.equal(found[0]?.risk, 'untrusted-install-script');
  assert.match(found[0]?.rule ?? '', /postinstall/);

  assert.deepEqual(inspectPackageJson('package.json', JSON.stringify({ scripts: { test: 'jest' } })), []);
});

test('security: a broad destructive delete blocks, a scoped one does not', () => {
  assert.equal(scanSecurity({ artifacts: { 'a.sh': 'rm -rf / --no-preserve-root' } }).status, 'BLOCK');
  assert.equal(scanSecurity({ artifacts: { 'a.sh': 'rm -rf $HOME/.cache' } }).status, 'BLOCK');
  assert.equal(scanSecurity({ artifacts: { 'a.sh': 'rm -rf *' } }).status, 'BLOCK');

  const scoped = scanSecurity({
    artifacts: { 'a.js': 'fs.rmSync(receivedSnapshotPath, { recursive: true, force: true });' },
  });
  assert.equal(scoped.status, 'CONDITIONAL', 'a delete of a computed path is worth review, not a block');
  assert.equal(scoped.findings[0]?.severity, 'medium');
  assert.match(scoped.findings[0]?.rule ?? '', /target path was not evaluated/);
});
