import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidUpiId, normalizeName } from '../utils/validators.js';

test('isValidUpiId accepts real-looking UPI IDs', () => {
  for (const id of ['riya.s@okaxis', '9876543210@ybl', 'aryan_01@paytm']) {
    assert.equal(isValidUpiId(id), true, id);
  }
});

test('isValidUpiId rejects malformed UPI IDs', () => {
  for (const id of ['', 'riya', '@ybl', 'riya@', 'ri ya@ybl', 'riya@ybl@x']) {
    assert.equal(isValidUpiId(id), false, id);
  }
});

test('normalizeName trims and collapses whitespace, rejects empty or too long', () => {
  assert.equal(normalizeName('  Riya   Sharma '), 'Riya Sharma');
  assert.equal(normalizeName('   '), null);
  assert.equal(normalizeName('a'.repeat(41)), null);
});
