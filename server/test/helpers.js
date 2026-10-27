import { createPool } from '../config/db.js';
import { migrate } from '../db/migrate.js';

let poolPromise;

export const getTestDb = () => {
  if (!process.env.DATABASE_URL_TEST) {
    throw new Error('DATABASE_URL_TEST is not set (see server/.env.example)');
  }
  poolPromise ??= (async () => {
    const pool = createPool(process.env.DATABASE_URL_TEST);
    await migrate(pool);
    return pool;
  })();
  return poolPromise;
};

export const resetTestDb = (pool) => pool.query('TRUNCATE users RESTART IDENTITY CASCADE');

export const closeTestDb = async () => {
  if (poolPromise) await (await poolPromise).end();
};

export const fakeGetAuth = (req) => ({ userId: req.headers['x-test-user'] ?? null });
