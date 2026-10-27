import { Router } from 'express';
import { getMe, updateMe } from '../controllers/meController.js';

const meRoutes = ({ db }) => {
  const router = Router();
  router.get('/', getMe);
  router.patch('/', updateMe(db));
  return router;
};

export default meRoutes;
