import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import createApp from '../app.js';
import { getTestDb, resetTestDb, closeTestDb, fakeGetAuth } from './helpers.js';

after(closeTestDb);

let db;
let app;
beforeEach(async () => {
  db = await getTestDb();
  await resetTestDb(db);
  app = createApp({ getAuth: fakeGetAuth, db });
});

test('GET /api/me with no user → 401', async () => {
  const res = await request(app).get('/api/me');
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { success: false, message: 'Unauthorized' });
});

test('GET /api/me first time creates the user, profile incomplete, not verified', async () => {
  const res = await request(app).get('/api/me').set('x-test-user', 'user_1');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.profileComplete, false);
  assert.equal(res.body.data.idVerified, false);
  const { rowCount } = await db.query("SELECT 1 FROM users WHERE clerk_user_id = 'user_1'");
  assert.equal(rowCount, 1);
});

test('5 concurrent first requests create exactly one user row', async () => {
  const results = await Promise.all(
    Array.from({ length: 5 }, () => request(app).get('/api/me').set('x-test-user', 'user_2')),
  );
  assert.deepEqual(results.map((r) => r.status), [200, 200, 200, 200, 200]);
  const { rowCount } = await db.query("SELECT 1 FROM users WHERE clerk_user_id = 'user_2'");
  assert.equal(rowCount, 1);
});

test('GET /api/me for a suspended user → 403', async () => {
  await db.query("INSERT INTO users (clerk_user_id, suspended_at) VALUES ('user_3', now())");
  const res = await request(app).get('/api/me').set('x-test-user', 'user_3');
  assert.equal(res.status, 403);
  assert.deepEqual(res.body, { success: false, message: 'Account suspended' });
});

test('response never includes clerk_user_id', async () => {
  const res = await request(app).get('/api/me').set('x-test-user', 'user_4');
  assert.ok(!JSON.stringify(res.body).includes('user_4'));
});
