import createApp from './app.js';
import { loadEnv } from './config/env.js';

const { PORT } = loadEnv();

createApp().listen(PORT, () => {
  console.log(`UniHop API listening on :${PORT}`);
});
