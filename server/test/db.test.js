import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getTestDb, resetTestDb, closeTestDb } from './helpers.js';
import { migrate } from '../db/migrate.js';

after(closeTestDb);

test('migrate applies 001_init once; a second run returns []', async () => {
  const db = await getTestDb();
  const { rows } = await db.query('SELECT name FROM schema_migrations');
  assert.ok(rows.some((r) => r.name === '001_init.sql'));
  assert.deepEqual(await migrate(db), []);
});

test('PostGIS works: ST_MakePoint(lon, lat)', async () => {
  const db = await getTestDb();
  const { rows } = await db.query('SELECT ST_AsText(ST_MakePoint(77.2090, 28.6139)) AS p');
  assert.equal(rows[0].p, 'POINT(77.209 28.6139)');
});

test('users.clerk_user_id is unique', async () => {
  const db = await getTestDb();
  await resetTestDb(db);
  await db.query("INSERT INTO users (clerk_user_id) VALUES ('user_abc')");
  await assert.rejects(
    db.query("INSERT INTO users (clerk_user_id) VALUES ('user_abc')"),
    (err) => err.code === '23505',
  );
});
