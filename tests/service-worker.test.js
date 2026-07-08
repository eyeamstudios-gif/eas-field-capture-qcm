import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swSource = readFileSync(join(__dirname, '..', 'service-worker.js'), 'utf8');

test('service worker includes governance.js and import/export modules', () => {
  const requiredAssets = [
    '/js/governance.js',
    '/js/export.js',
    '/js/storage.js',
    '/js/app.js',
    '/js/utils.js',
  ];

  for (const asset of requiredAssets) {
    assert.ok(swSource.includes(asset), `Missing asset in service worker cache list: ${asset}`);
  }
});

test('service worker cache version is bumped for production safety', () => {
  assert.match(swSource, /field-capture-qcm-v1\.0\.4/);
});

test('offline modules remain cacheable as a complete app shell set', () => {
  const assetMatches = [...swSource.matchAll(/'(\/[^']+)'/g)].map((match) => match[1]);
  assert.ok(assetMatches.length >= 15);
  assert.ok(assetMatches.includes('/index.html'));
  assert.ok(assetMatches.includes('/js/governance.js'));
});
