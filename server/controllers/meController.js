import { HttpError } from '../middleware/errorHandler.js';
import { toPublicMe, updateProfile } from '../services/userService.js';
import { isValidUpiId, normalizeName, MAX_NAME_LENGTH } from '../utils/validators.js';

export const getMe = (req, res) => {
  res.json({ success: true, data: toPublicMe(req.user) });
};

const parseProfilePatch = (body = {}) => {
  const patch = {};
  if (body.firstName !== undefined) {
    if (typeof body.firstName !== 'string' || !body.firstName.trim()) {
      throw new HttpError(400, "First name can't be empty");
    }
    patch.firstName = normalizeName(body.firstName);
    if (!patch.firstName) {
      throw new HttpError(400, `First name must be ${MAX_NAME_LENGTH} characters or fewer`);
    }
  }
  if (body.upiId !== undefined) {
    const upiId = typeof body.upiId === 'string' ? body.upiId.trim() : '';
    if (!isValidUpiId(upiId)) throw new HttpError(400, 'Enter a valid UPI ID, like name@bank');
    patch.upiId = upiId;
  }
  return patch;
};

export const updateMe = (db) => async (req, res) => {
  const user = await updateProfile(db, req.user.id, parseProfilePatch(req.body));
  res.json({ success: true, data: toPublicMe(user) });
};
