const { Router } = require('express');
const { getMe, updateMe } = require('../controllers/meController');
const { myPayments } = require('../controllers/fareController');

const router = Router();

router.get('/', getMe);
router.patch('/', updateMe);
router.get('/payments', myPayments);

module.exports = router;
