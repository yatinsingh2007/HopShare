const app = require('./app');
const prisma = require('./config/db');

const PORT = process.env.PORT ?? 4000;

const start = async () => {
  try {
    await prisma.$connect();
    console.log('Database connection successful');
  } catch (err) {
    console.error('Database connection failed', err);
  }

  app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
};

start();
