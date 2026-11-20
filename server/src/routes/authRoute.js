const { Router } = require('express');
const { warmUp, login, refresh, logout } = require('../controllers/authController');

const router = Router();

router.get('/warmup', warmUp);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
