import { toPublicMe } from '../services/userService.js';

export const getMe = (req, res) => {
  res.json({ success: true, data: toPublicMe(req.user) });
};
