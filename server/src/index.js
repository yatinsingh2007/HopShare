const http = require('node:http');
const app = require('./app');
const { attachSocket } = require('./socket');
const prisma = require('./config/db');

const PORT = process.env.PORT ?? 4000;

const missing = ['DATABASE_URL', 'JWT_SECRET', 'CLERK_SECRET_KEY'].filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const start = async () => {
  try {
    await prisma.$connect();
    console.log('Database connection successful');
  } catch (err) {
    console.error('Database connection failed', err);
  }

  // HTTP and Socket.io share one port
  const server = http.createServer(app);
  attachSocket(server);
  server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
};

start();
