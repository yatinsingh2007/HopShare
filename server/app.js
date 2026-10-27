import express from 'express';
import healthRoutes from './routes/health.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const createApp = ({ getAuth, db } = {}) => {
  const app = express();
  app.use(express.json());

  app.use('/api/health', healthRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
};

export default createApp;
