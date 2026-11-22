const { Router } = require('express');
const { getMe, updateMe, myActivity, readActivity } = require('../controllers/meController');
const { myPayments } = require('../controllers/fareController');

const router = Router();

router.get('/', getMe);
router.patch('/', updateMe);
router.get('/payments', myPayments);
router.get('/activity', myActivity);
router.post('/activity/read', readActivity);

module.exports = router;
