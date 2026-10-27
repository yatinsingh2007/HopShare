import { Router } from 'express';
import { getMe } from '../controllers/meController.js';

const meRoutes = () => {
  const router = Router();
  router.get('/', getMe);
  return router;
};

export default meRoutes;
