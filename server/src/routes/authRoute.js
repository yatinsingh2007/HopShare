const { Router } = require('express');
const { requireUser } = require('../middleware/requireUser');
const { warmUp, login, refresh, logout, logoutAll } = require('../controllers/authController');

const router = Router();

router.get('/warmup', warmUp);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/logout-all', requireUser, logoutAll);

module.exports = router;
