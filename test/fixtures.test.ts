/**
 * Offline regression test: replays recorded platform responses (test/fixtures/*.json)
 * through the full extraction pipeline and compares against the recorded snapshot.
 *
 * No network access. Record / refresh fixtures with `npm run fixtures:record`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { useCassette, ejectCassette } from '../src/utils/http.js';
import { executeExtraction } from '../src/services/extract-service.js';
import { snapshotOf } from '../src/utils/snapshot.js';
import type { PlatformFixture } from './fixture-types.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const files = fs.existsSync(fixturesDir)
  ? fs.readdirSync(fixturesDir).filter(f => f.endsWith('.json')).sort()
  : [];

describe('platform fixtures (offline replay)', () => {
  if (files.length === 0) {
    it.skip('no fixtures recorded yet — run `npm run fixtures:record` once with network access');
    return;
  }

  for (const file of files) {
    const fixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, file), 'utf-8')) as PlatformFixture;

    it(`${fixture.id} (${fixture.platform})`, async () => {
      useCassette('replay', fixture.requests);
      try {
        const result = await executeExtraction({ url: fixture.url, format: 'both', upload_images: false });
        assert.deepEqual(snapshotOf(result), fixture.expected);
      } finally {
        ejectCassette();
      }
    });
  }
});
