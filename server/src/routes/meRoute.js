const { Router } = require('express');
const { getMe, updateMe } = require('../controllers/meController');

const router = Router();

router.get('/', getMe);
router.patch('/', updateMe);

module.exports = router;
