import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('start and migrate scripts boot without a .env file (hosted platforms inject env vars)', async () => {
  const { scripts } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  for (const name of ['start', 'migrate']) {
    assert.doesNotMatch(scripts[name], /--env-file=/, `${name} must use --env-file-if-exists`);
  }
});
