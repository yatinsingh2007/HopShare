import express from 'express';
import healthRoutes from './routes/health.js';
import meRoutes from './routes/me.js';
import { requireUser } from './middleware/requireUser.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const createApp = ({ getAuth, db, authMiddleware } = {}) => {
  const app = express();
  app.use(express.json());
  if (authMiddleware) app.use(authMiddleware);

  app.use('/api/health', healthRoutes);
  app.use('/api/me', requireUser({ getAuth, db }), meRoutes());

  app.use(notFound);
  app.use(errorHandler);
  return app;
};

export default createApp;
