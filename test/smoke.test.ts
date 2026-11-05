import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const BUNDLE = new URL('../dist/cookbook-mcp.js', import.meta.url).pathname;

describe('placeholder', () => {
  it('exits non-zero and points at the repository', () => {
    const result = spawnSync(process.execPath, [BUNDLE], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /placeholder release/);
  });
});
