import { clerkMiddleware, getAuth } from '@clerk/express';
import createApp from './app.js';
import { loadEnv } from './config/env.js';
import { createPool } from './config/db.js';

const { PORT, DATABASE_URL } = loadEnv();
const db = createPool(DATABASE_URL);

createApp({ db, getAuth, authMiddleware: clerkMiddleware() }).listen(PORT, () => {
  console.log(`UniHop API listening on :${PORT}`);
});
