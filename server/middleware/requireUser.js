import { HttpError } from './errorHandler.js';
import { upsertByClerkId } from '../services/userService.js';

export const requireUser = ({ getAuth, db }) => async (req, res, next) => {
  const { userId } = getAuth(req) ?? {};
  if (!userId) throw new HttpError(401, 'Unauthorized');

  const user = await upsertByClerkId(db, userId);
  if (user.suspended_at) throw new HttpError(403, 'Account suspended');

  req.user = user;
  next();
};
